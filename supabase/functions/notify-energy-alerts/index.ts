/**
 * notify-energy-alerts — Sends WhatsApp notifications for CRITICAL energy alerts.
 * 
 * Flow:
 * 1. Finds critical energy_alerts where notification_sent_at IS NULL
 * 2. For each, resolves the phone: UC.telefone_alertas → admin profile.telefone
 * 3. Enqueues WhatsApp message via enqueue_wa_outbox_item RPC
 * 4. Marks notification_sent_at on the alert
 * 
 * Can be invoked manually or via pg_cron.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ALERT_TYPE_LABELS: Record<string, string> = {
  meter_offline: "Medidor offline",
  no_generation: "Usina sem geração",
  missing_invoice: "Fatura em atraso",
  allocation_mismatch: "Alocação GD incorreta",
  reconciliation_critical: "Divergência crítica na fatura",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // 1. Find critical alerts without notification
    const { data: alerts, error: alertsErr } = await supabase
      .from("energy_alerts")
      .select("id, tenant_id, alert_type, severity, title, description, context_json, unit_id, plant_id, gd_group_id, created_at")
      .eq("severity", "critical")
      .is("resolved_at", null)
      .is("notification_sent_at", null)
      .order("created_at", { ascending: true })
      .limit(50);

    if (alertsErr) {
      console.error("[notify-energy-alerts] Error fetching alerts:", alertsErr.message);
      return new Response(JSON.stringify({ error: alertsErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!alerts || alerts.length === 0) {
      console.log("[notify-energy-alerts] No pending critical alerts to notify");
      return new Response(JSON.stringify({ sent: 0, message: "No pending critical alerts" }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[notify-energy-alerts] Found ${alerts.length} critical alerts to notify`);

    let sent = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const alert of alerts) {
      try {
        // 2. Resolve UC info
        let ucNome = "—";
        let ucCodigo = "—";
        let ucTelefoneAlertas: string | null = null;

        if (alert.unit_id) {
          const { data: uc } = await supabase
            .from("units_consumidoras")
            .select("nome, codigo_uc, telefone_alertas")
            .eq("id", alert.unit_id)
            .maybeSingle();
          if (uc) {
            ucNome = uc.nome || "—";
            ucCodigo = uc.codigo_uc || "—";
            ucTelefoneAlertas = uc.telefone_alertas || null;
          }
        }

        // 3. Resolve phone: UC.telefone_alertas → admin profile.telefone
        let targetPhone = ucTelefoneAlertas;

        if (!targetPhone) {
          // Fallback: get admin phone for this tenant
          const { data: adminProfile } = await supabase
            .from("profiles")
            .select("telefone")
            .eq("tenant_id", alert.tenant_id)
            .not("telefone", "is", null)
            .limit(1)
            .maybeSingle();

          targetPhone = adminProfile?.telefone || null;
        }

        if (!targetPhone) {
          console.warn(`[notify-energy-alerts] No phone for alert ${alert.id} (tenant ${alert.tenant_id}), skipping`);
          skipped++;
          continue;
        }

        // Normalize phone to JID
        const phone = targetPhone.replace(/\D/g, "");
        if (phone.length < 10) {
          console.warn(`[notify-energy-alerts] Invalid phone "${targetPhone}" for alert ${alert.id}, skipping`);
          skipped++;
          continue;
        }
        const remoteJid = `${phone}@s.whatsapp.net`;

        // 4. Get active WA instance for tenant
        const { data: waInstance } = await supabase
          .from("wa_instances")
          .select("id")
          .eq("tenant_id", alert.tenant_id)
          .eq("status", "connected")
          .limit(1)
          .maybeSingle();

        if (!waInstance) {
          console.warn(`[notify-energy-alerts] No connected WA instance for tenant ${alert.tenant_id}, skipping alert ${alert.id}`);
          skipped++;
          continue;
        }

        // 5. Build message
        const tipoLabel = ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type;
        const contextJson = alert.context_json as Record<string, any> | null;
        const detail = contextJson?.detail || contextJson?.diff_percent
          ? `Divergência: ${contextJson.diff_percent}%`
          : contextJson?.total_percent
          ? `Soma atual: ${contextJson.total_percent}%`
          : alert.description || "";

        const message = [
          `🚨 *Alerta Energético Crítico*`,
          ``,
          `UC: ${ucNome} (${ucCodigo})`,
          `Tipo: ${tipoLabel}`,
          detail ? `Detalhes: ${detail}` : null,
          ``,
          `Acesse o sistema para verificar.`,
        ].filter(Boolean).join("\n");

        // 6. Enqueue via RPC (same pattern as detect-upsell-opportunities)
        const idempKey = `energy_alert:${alert.id}:${new Date().toISOString().slice(0, 10)}`;

        const { error: enqueueErr } = await supabase.rpc("enqueue_wa_outbox_item", {
          p_tenant_id: alert.tenant_id,
          p_instance_id: waInstance.id,
          p_remote_jid: remoteJid,
          p_message_type: "text",
          p_content: message,
          p_conversation_id: null,
          p_message_id: null,
          p_idempotency_key: idempKey,
        });

        if (enqueueErr) {
          console.error(`[notify-energy-alerts] Enqueue error for alert ${alert.id}:`, enqueueErr.message);
          errors.push(`${alert.id}: ${enqueueErr.message}`);
          continue;
        }

        // 7. Mark notification_sent_at
        await supabase
          .from("energy_alerts")
          .update({ notification_sent_at: new Date().toISOString() })
          .eq("id", alert.id);

        sent++;
        console.log(`[notify-energy-alerts] Notified alert ${alert.id} → ${phone}`);

      } catch (alertErr: any) {
        console.error(`[notify-energy-alerts] Error processing alert ${alert.id}:`, alertErr.message);
        errors.push(`${alert.id}: ${alertErr.message}`);
      }
    }

    const result = { sent, skipped, errors: errors.length, total: alerts.length };
    console.log(`[notify-energy-alerts] Done:`, result);

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("[notify-energy-alerts] Fatal error:", err.message);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
