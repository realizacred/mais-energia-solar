// ──────────────────────────────────────────────────────────────────────────────
// notify-plant-offline — Cron: 0 11 * * * (8h BRT)
// Finds plants offline >2h with linked clients and sends WhatsApp notification.
// Deduplicates via monitor_string_alerts (1 notification per plant per 24h).
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

/** Format a timestamp to Brasília time string */
function formatBRT(isoStr: string): string {
  try {
    return new Date(isoStr).toLocaleString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return isoStr;
  }
}

/** Normalize phone to @s.whatsapp.net JID */
function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  // Ensure country code
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `${normalized}@s.whatsapp.net`;
}

const OFFLINE_THRESHOLD_HOURS = 2;
const DEDUP_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // ─── 1. Find offline plants with linked clients ───
    const cutoff = new Date(
      Date.now() - OFFLINE_THRESHOLD_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: offlinePlants, error: plantErr } = await sb
      .from("monitor_plants")
      .select("id, name, tenant_id, client_id, last_seen_at, installed_power_kwp")
      .eq("is_active", true)
      .not("client_id", "is", null)
      .lt("last_seen_at", cutoff);

    if (plantErr) throw plantErr;

    if (!offlinePlants || offlinePlants.length === 0) {
      return json({ ok: true, message: "No offline plants with clients", notified: 0 });
    }

    // ─── 2. Fetch client data for all linked clients ───
    const clientIds = [...new Set(offlinePlants.map((p) => p.client_id!))];
    const { data: clientes } = await sb
      .from("clientes")
      .select("id, nome, telefone, tenant_id")
      .in("id", clientIds);

    const clienteMap = new Map(
      (clientes || []).map((c: any) => [c.id, c])
    );

    // ─── 3. Check existing alerts (dedup: 1 per plant per 24h) ───
    const plantIds = offlinePlants.map((p) => p.id);
    const dedupCutoff = new Date(
      Date.now() - DEDUP_HOURS * 60 * 60 * 1000
    ).toISOString();

    const { data: existingAlerts } = await sb
      .from("monitor_string_alerts")
      .select("plant_id")
      .in("plant_id", plantIds)
      .eq("alert_type", "offline_notification")
      .gte("created_at", dedupCutoff);

    const alreadyNotified = new Set(
      (existingAlerts || []).map((a: any) => a.plant_id)
    );

    // ─── 4. For each tenant, find a connected WA instance ───
    const tenantIds = [...new Set(offlinePlants.map((p) => p.tenant_id))];
    const { data: instances } = await sb
      .from("wa_instances")
      .select("id, tenant_id")
      .in("tenant_id", tenantIds)
      .eq("status", "connected");

    const instanceMap = new Map<string, string>(); // tenant_id → instance_id
    (instances || []).forEach((inst: any) => {
      if (!instanceMap.has(inst.tenant_id)) {
        instanceMap.set(inst.tenant_id, inst.id);
      }
    });

    // ─── 5. Send notifications ───
    let notified = 0;
    let skipped = 0;
    let errors = 0;

    for (const plant of offlinePlants) {
      // Skip if already notified today
      if (alreadyNotified.has(plant.id)) {
        skipped++;
        continue;
      }

      const cliente = clienteMap.get(plant.client_id!);
      if (!cliente || !cliente.telefone) {
        skipped++;
        continue;
      }

      const instanceId = instanceMap.get(plant.tenant_id);
      if (!instanceId) {
        console.warn(
          `[notify-plant-offline] No connected WA instance for tenant ${plant.tenant_id}`
        );
        skipped++;
        continue;
      }

      // Calculate hours offline
      const horasOffline = Math.round(
        (Date.now() - new Date(plant.last_seen_at).getTime()) / (1000 * 60 * 60)
      );

      const mensagem = [
        `Olá ${cliente.nome}! ⚡`,
        "",
        `Identificamos que sua usina solar está offline há mais de ${horasOffline}h.`,
        "",
        "Não se preocupe, nossa equipe já foi notificada e entrará em contato em breve.",
        "",
        `📍 Usina: ${plant.name}`,
        `⏰ Offline desde: ${formatBRT(plant.last_seen_at)}`,
        "",
        "Mais Energia Solar 🌞",
      ].join("\n");

      const remoteJid = phoneToJid(cliente.telefone);
      const idempKey = `plant_offline:${plant.id}:${new Date().toISOString().slice(0, 10)}`;

      try {
        // Enqueue WhatsApp message
        await sb.from("wa_outbox").insert({
          tenant_id: plant.tenant_id,
          instance_id: instanceId,
          remote_jid: remoteJid,
          message_type: "text",
          content: mensagem,
          status: "pending",
          idempotency_key: idempKey,
        });

        // Record alert for dedup
        await sb.from("monitor_string_alerts").insert({
          plant_id: plant.id,
          tenant_id: plant.tenant_id,
          alert_type: "offline_notification",
          severity: "warning",
          status: "open",
          message: `Notificação offline enviada ao cliente ${cliente.nome}`,
          detected_at: new Date().toISOString(),
          context: {
            horas_offline: horasOffline,
            cliente_nome: cliente.nome,
            cliente_telefone: cliente.telefone,
          },
        });

        notified++;
      } catch (sendErr: any) {
        console.error(
          `[notify-plant-offline] Error for plant ${plant.id}: ${sendErr?.message}`
        );
        errors++;
      }
    }

    console.log(
      `[notify-plant-offline] Done: ${notified} notified, ${skipped} skipped, ${errors} errors`
    );

    return json({
      ok: true,
      total_offline: offlinePlants.length,
      notified,
      skipped,
      errors,
    });
  } catch (err: any) {
    console.error("[notify-plant-offline] Fatal:", err?.message);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});
