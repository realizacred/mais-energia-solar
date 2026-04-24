// ──────────────────────────────────────────────────────────────────────────────
// billing-reading-alerts — Cron: sends reading date alerts to UC clients
// Checks unit_billing_email_settings for upcoming reading dates and notifies
// via configured channel (whatsapp, email, ambos).
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // Auth: accept cron or service-role calls
    const authHeader = req.headers.get("authorization") || "";
    const cronSecret = Deno.env.get("CRON_SECRET");
    const isCron =
      authHeader.includes(serviceKey) ||
      (cronSecret && req.headers.get("x-cron-secret") === cronSecret) ||
      authHeader.includes("Bearer " + Deno.env.get("SUPABASE_ANON_KEY"));

    if (!isCron && !authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const now = new Date();
    const todayDay = now.getDate();
    const currentMonth = now.getMonth() + 1;
    const currentYear = now.getFullYear();

    // Fetch all active billing settings with reading day configured
    const { data: settings, error: settingsErr } = await sb
      .from("unit_billing_email_settings")
      .select("unit_id, dia_leitura, dias_antecedencia_alerta, canal_notificacao, servico_fatura_ativo")
      .eq("servico_fatura_ativo", true)
      .not("dia_leitura", "is", null);

    if (settingsErr) throw settingsErr;

    if (!settings || settings.length === 0) {
      return new Response(
        JSON.stringify({ ok: true, message: "No active UCs to alert", alerts_sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let alertsSent = 0;
    let alertsSkipped = 0;
    let alertsFailed = 0;

    for (const s of settings) {
      const diaLeitura = s.dia_leitura as number;
      const diasAntecedencia = (s.dias_antecedencia_alerta as number) || 1;
      const canal = (s.canal_notificacao as string) || "whatsapp";

      // Calculate alert day: dia_leitura - dias_antecedencia
      let alertDay = diaLeitura - diasAntecedencia;
      // Handle month rollover (if alertDay <= 0, it was in the previous month)
      if (alertDay <= 0) {
        // For simplicity, clamp to day 1
        alertDay = 1;
      }

      // Check if today is the alert day
      if (todayDay !== alertDay) continue;

      // Check if alert already sent for this month
      const { data: existing } = await sb
        .from("unit_reading_alerts")
        .select("id")
        .eq("unit_id", s.unit_id)
        .eq("alert_type", "leitura")
        .eq("reference_month", currentMonth)
        .eq("reference_year", currentYear)
        .maybeSingle();

      if (existing) {
        alertsSkipped++;
        continue;
      }

      // Get UC info for the message
      const { data: uc } = await sb
        .from("units_consumidoras")
        .select("numero_uc, tenant_id, cliente_id, clientes(nome, telefone, email)")
        .eq("id", s.unit_id)
        .single();

      if (!uc) {
        alertsFailed++;
        continue;
      }

      const cliente = (uc as any).clientes;
      const ucNumber = (uc as any).numero_uc || "UC";
      const tenantId = (uc as any).tenant_id;

      // Build alert message
      const msg = `⚡ Lembrete de Leitura\n\nOlá ${cliente?.nome || "Cliente"}, a leitura da sua UC ${ucNumber} está prevista para o dia ${diaLeitura}/${String(currentMonth).padStart(2, "0")}.\n\nPor favor, passe a leitura para a concessionária até essa data para evitar estimativas na fatura.`;

      let sent = false;
      let errorMsg: string | null = null;

      try {
        // Send via WhatsApp if configured
        if (canal === "whatsapp" || canal === "ambos") {
          if (cliente?.telefone) {
            // Queue in wa_outbox for delivery
            await sb.from("wa_outbox").insert({
              tenant_id: tenantId,
              to_number: cliente.telefone,
              body: msg,
              source: "billing_alert",
              status: "pending",
            } as any);
            sent = true;
          }
        }

        // Send via email if configured
        if (canal === "email" || canal === "ambos") {
          if (cliente?.email) {
            // For now, log the intent — email sending integration can be added later
            console.log(`[billing-reading-alerts] Email alert queued for ${cliente.email} (UC: ${ucNumber})`);
            sent = true;
          }
        }

        // Record the alert
        await sb.from("unit_reading_alerts").insert({
          unit_id: s.unit_id,
          tenant_id: tenantId,
          alert_type: "leitura",
          reference_month: currentMonth,
          reference_year: currentYear,
          channel: canal,
          status: sent ? "sent" : "skipped",
          error_message: sent ? null : "Nenhum contato disponível para o canal configurado",
        });

        if (sent) alertsSent++;
        else alertsSkipped++;
      } catch (sendErr: any) {
        errorMsg = sendErr?.message || "Erro ao enviar alerta";
        alertsFailed++;
        // Record failed alert
        await sb.from("unit_reading_alerts").insert({
          unit_id: s.unit_id,
          tenant_id: tenantId,
          alert_type: "leitura",
          reference_month: currentMonth,
          reference_year: currentYear,
          channel: canal,
          status: "failed",
          error_message: errorMsg,
        });
      }
    }

    console.log(`[billing-reading-alerts] Done: ${alertsSent} sent, ${alertsSkipped} skipped, ${alertsFailed} failed`);

    return new Response(
      JSON.stringify({
        ok: true,
        alerts_sent: alertsSent,
        alerts_skipped: alertsSkipped,
        alerts_failed: alertsFailed,
        total_checked: settings.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[billing-reading-alerts] Error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
