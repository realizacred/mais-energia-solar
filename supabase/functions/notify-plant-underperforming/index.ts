// ──────────────────────────────────────────────────────────────────────────────
// notify-plant-underperforming — Cron: 0 17 * * * (14h BRT)
// Finds active plants generating <80% of expected output and sends WhatsApp alert.
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

function phoneToJid(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("55") ? digits : `55${digits}`;
  return `${normalized}@s.whatsapp.net`;
}

const PERFORMANCE_THRESHOLD = 0.80; // 80%
const PEAK_HOURS_ESTIMATE = 4; // conservative solar peak hours
const DEDUP_HOURS = 24;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // ─── 1. Get today's date in BRT ───
    const now = new Date();
    const todayBRT = now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // YYYY-MM-DD

    // ─── 2. Get active plants with installed power ───
    const { data: plants, error: plantErr } = await sb
      .from("monitor_plants")
      .select("id, name, tenant_id, client_id, installed_power_kwp, last_seen_at")
      .eq("is_active", true)
      .gt("installed_power_kwp", 0);

    if (plantErr) throw plantErr;
    if (!plants || plants.length === 0) {
      return json({ ok: true, message: "No active plants with power data", notified: 0 });
    }

    // ─── 3. Get today's daily readings ───
    const plantIds = plants.map((p) => p.id);
    const { data: readings } = await sb
      .from("monitor_readings_daily")
      .select("plant_id, energy_kwh")
      .in("plant_id", plantIds)
      .eq("date", todayBRT);

    const readingMap = new Map<string, number>();
    (readings || []).forEach((r: any) => {
      readingMap.set(r.plant_id, r.energy_kwh ?? 0);
    });

    // ─── 4. Find underperforming plants ───
    const underperforming: Array<{
      plant: any;
      expected: number;
      actual: number;
      pct: number;
    }> = [];

    for (const plant of plants) {
      const expected = plant.installed_power_kwp * PEAK_HOURS_ESTIMATE;
      const actual = readingMap.get(plant.id) ?? 0;

      // Skip plants with no reading yet today (might be early morning)
      if (actual === 0 && !readingMap.has(plant.id)) continue;

      const pct = expected > 0 ? actual / expected : 0;
      if (pct < PERFORMANCE_THRESHOLD) {
        underperforming.push({ plant, expected, actual, pct });
      }
    }

    if (underperforming.length === 0) {
      return json({ ok: true, message: "All plants performing above threshold", checked: plants.length, notified: 0 });
    }

    // ─── 5. Dedup: check alerts sent in last 24h ───
    const upIds = underperforming.map((u) => u.plant.id);
    const dedupCutoff = new Date(Date.now() - DEDUP_HOURS * 60 * 60 * 1000).toISOString();

    const { data: existingAlerts } = await sb
      .from("monitor_string_alerts")
      .select("plant_id")
      .in("plant_id", upIds)
      .eq("alert_type", "underperformance_notification")
      .gte("created_at", dedupCutoff);

    const alreadyNotified = new Set((existingAlerts || []).map((a: any) => a.plant_id));

    // ─── 6. Fetch client data for linked plants ───
    const clientIds = [...new Set(underperforming.filter((u) => u.plant.client_id).map((u) => u.plant.client_id!))];
    const { data: clientes } = clientIds.length > 0
      ? await sb.from("clientes").select("id, nome, telefone, tenant_id").in("id", clientIds)
      : { data: [] };
    const clienteMap = new Map((clientes || []).map((c: any) => [c.id, c]));

    // ─── 7. Get connected WA instances per tenant ───
    const tenantIds = [...new Set(underperforming.map((u) => u.plant.tenant_id))];
    const { data: instances } = await sb
      .from("wa_instances")
      .select("id, tenant_id")
      .in("tenant_id", tenantIds)
      .eq("status", "connected");

    const instanceMap = new Map<string, string>();
    (instances || []).forEach((inst: any) => {
      if (!instanceMap.has(inst.tenant_id)) {
        instanceMap.set(inst.tenant_id, inst.id);
      }
    });

    // ─── 8. Send notifications ───
    let notified = 0;
    let skipped = 0;
    let errors = 0;

    for (const { plant, expected, actual, pct } of underperforming) {
      if (alreadyNotified.has(plant.id)) { skipped++; continue; }

      const cliente = plant.client_id ? clienteMap.get(plant.client_id) : null;
      if (!cliente || !cliente.telefone) { skipped++; continue; }

      const instanceId = instanceMap.get(plant.tenant_id);
      if (!instanceId) { skipped++; continue; }

      const pctStr = Math.round(pct * 100);
      const mensagem = [
        `⚡ Alerta de Performance`,
        ``,
        `Usina: ${plant.name}`,
        `Geração hoje: ${actual.toFixed(1)} kWh (${pctStr}% do esperado)`,
        `Esperado: ${expected.toFixed(1)} kWh`,
        `Potência: ${plant.installed_power_kwp} kWp`,
        ``,
        `Verifique possíveis sombreamentos ou falhas.`,
        ``,
        `Mais Energia Solar 🌞`,
      ].join("\n");

      const remoteJid = phoneToJid(cliente.telefone);
      const idempKey = `plant_underperf:${plant.id}:${todayBRT}`;

      try {
        await sb.from("wa_outbox").insert({
          tenant_id: plant.tenant_id,
          instance_id: instanceId,
          remote_jid: remoteJid,
          message_type: "text",
          content: mensagem,
          status: "pending",
          idempotency_key: idempKey,
        });

        await sb.from("monitor_string_alerts").insert({
          plant_id: plant.id,
          tenant_id: plant.tenant_id,
          alert_type: "underperformance_notification",
          severity: "warning",
          status: "open",
          message: `Performance ${pctStr}% — ${actual.toFixed(1)}/${expected.toFixed(1)} kWh`,
          detected_at: new Date().toISOString(),
          context: {
            expected_kwh: expected,
            actual_kwh: actual,
            performance_pct: pctStr,
            cliente_nome: cliente.nome,
          },
        });

        notified++;
      } catch (sendErr: any) {
        console.error(`[notify-plant-underperforming] Error for plant ${plant.id}: ${sendErr?.message}`);
        errors++;
      }
    }

    console.log(`[notify-plant-underperforming] Done: ${notified} notified, ${skipped} skipped, ${errors} errors out of ${underperforming.length} underperforming`);

    return json({
      ok: true,
      total_checked: plants.length,
      underperforming: underperforming.length,
      notified,
      skipped,
      errors,
    });
  } catch (err: any) {
    console.error("[notify-plant-underperforming] Fatal:", err?.message);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});
