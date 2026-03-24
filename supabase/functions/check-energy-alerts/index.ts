/**
 * check-energy-alerts — Proactive energy alert scanner.
 * Runs hourly via pg_cron. Scans for:
 * 1. Meter devices offline (>2h warning, >6h critical)
 * 2. Missing invoices (past day 15 = warning, 2 months = critical)
 * 3. Plants with no generation during solar hours (8h-17h BRT)
 * 4. GD allocation mismatch (≠100%)
 *
 * Deduplication: only creates alert if no unresolved alert of same type+entity exists.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function getBrasiliaHour(): number {
  const now = new Date();
  const brasiliaTime = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  return brasiliaTime.getHours();
}

interface AlertPayload {
  tenant_id: string;
  gd_group_id?: string | null;
  unit_id?: string | null;
  plant_id?: string | null;
  alert_type: string;
  severity: "info" | "warning" | "critical";
  title: string;
  description?: string | null;
  context_json?: Record<string, unknown>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const stats = { meters_offline: 0, missing_invoices: 0, no_generation: 0, allocation_mismatch: 0, skipped_dedup: 0, errors: 0 };

    // ─── Helper: deduplicated alert insert ───
    async function createAlertIfNew(payload: AlertPayload): Promise<boolean> {
      let q = supabase
        .from("energy_alerts")
        .select("id")
        .eq("alert_type", payload.alert_type)
        .is("resolved_at", null);

      if (payload.unit_id) q = q.eq("unit_id", payload.unit_id);
      if (payload.plant_id) q = q.eq("plant_id", payload.plant_id);
      if (payload.gd_group_id) q = q.eq("gd_group_id", payload.gd_group_id);
      if (!payload.unit_id && !payload.plant_id && !payload.gd_group_id) {
        q = q.eq("tenant_id", payload.tenant_id);
      }

      const { data: existing } = await q.limit(1);
      if (existing && existing.length > 0) {
        stats.skipped_dedup++;
        return false;
      }

      const { error } = await supabase.from("energy_alerts").insert({
        tenant_id: payload.tenant_id,
        gd_group_id: payload.gd_group_id || null,
        unit_id: payload.unit_id || null,
        plant_id: payload.plant_id || null,
        alert_type: payload.alert_type,
        severity: payload.severity,
        title: payload.title,
        description: payload.description || null,
        context_json: payload.context_json || {},
      });

      if (error) {
        console.error(`[check-energy-alerts] Insert error for ${payload.alert_type}:`, error.message);
        stats.errors++;
        return false;
      }
      return true;
    }

    // ═══════════════════════════════════════════
    // 1. METERS OFFLINE
    // ═══════════════════════════════════════════
    console.log("[check-energy-alerts] Scanning meters offline...");
    const { data: meters } = await supabase
      .from("meter_devices")
      .select("id, tenant_id, name, last_seen_at")
      .eq("is_active", true);

    const now = Date.now();
    const TWO_HOURS = 2 * 60 * 60 * 1000;
    const SIX_HOURS = 6 * 60 * 60 * 1000;

    for (const meter of meters || []) {
      if (!meter.last_seen_at) continue;
      const elapsed = now - new Date(meter.last_seen_at).getTime();

      if (elapsed > SIX_HOURS) {
        const created = await createAlertIfNew({
          tenant_id: meter.tenant_id,
          alert_type: "meter_offline",
          severity: "critical",
          title: `Medidor "${meter.name}" offline há mais de 6 horas`,
          description: `Último sinal recebido em ${new Date(meter.last_seen_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
          context_json: { meter_device_id: meter.id, hours_offline: Math.round(elapsed / 3600000) },
        });
        if (created) stats.meters_offline++;
      } else if (elapsed > TWO_HOURS) {
        const created = await createAlertIfNew({
          tenant_id: meter.tenant_id,
          alert_type: "meter_offline",
          severity: "warning",
          title: `Medidor "${meter.name}" offline há mais de 2 horas`,
          description: `Último sinal recebido em ${new Date(meter.last_seen_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
          context_json: { meter_device_id: meter.id, hours_offline: Math.round(elapsed / 3600000) },
        });
        if (created) stats.meters_offline++;
      }
    }

    // ═══════════════════════════════════════════
    // 2. MISSING INVOICES
    // ═══════════════════════════════════════════
    console.log("[check-energy-alerts] Scanning missing invoices...");
    const brasiliaDate = new Date(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const currentDay = brasiliaDate.getDate();
    const currentMonth = brasiliaDate.getMonth() + 1;
    const currentYear = brasiliaDate.getFullYear();

    if (currentDay >= 15) {
      const { data: ucs } = await supabase
        .from("units_consumidoras")
        .select("id, tenant_id, nome, codigo_uc, leitura_automatica_email")
        .eq("leitura_automatica_email", true)
        .eq("is_archived", false);

      for (const uc of ucs || []) {
        // Check current month invoice in unit_invoices
        const { data: currentInvoice } = await supabase
          .from("unit_invoices")
          .select("id")
          .eq("unit_id", uc.id)
          .eq("reference_month", currentMonth)
          .eq("reference_year", currentYear)
          .limit(1);

        if (!currentInvoice || currentInvoice.length === 0) {
          // Check previous month for critical severity
          const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
          const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

          const { data: prevInvoice } = await supabase
            .from("unit_invoices")
            .select("id")
            .eq("unit_id", uc.id)
            .eq("reference_month", prevMonth)
            .eq("reference_year", prevYear)
            .limit(1);

          const severity = (!prevInvoice || prevInvoice.length === 0) ? "critical" as const : "warning" as const;

          const created = await createAlertIfNew({
            tenant_id: uc.tenant_id,
            unit_id: uc.id,
            alert_type: "missing_invoice",
            severity,
            title: severity === "critical"
              ? `UC "${uc.codigo_uc}" sem fatura há 2 meses`
              : `UC "${uc.codigo_uc}" sem fatura no mês atual`,
            description: `Verifique o email de recebimento ou faça upload manual da fatura.`,
            context_json: { month: currentMonth, year: currentYear },
          });
          if (created) stats.missing_invoices++;
        }
      }
    }

    // ═══════════════════════════════════════════
    // 3. PLANTS WITH NO GENERATION (solar hours only)
    // ═══════════════════════════════════════════
    const brasiliaHour = getBrasiliaHour();
    if (brasiliaHour >= 8 && brasiliaHour <= 17) {
      console.log("[check-energy-alerts] Scanning plants with no generation (hour BRT:", brasiliaHour, ")...");
      const { data: plants } = await supabase
        .from("monitor_plants_with_metrics")
        .select("id, tenant_id, name, today_energy_kwh, status, capacity_kw");

      for (const plant of plants || []) {
        if (plant.status === "inactive") continue;
        const todayKwh = plant.today_energy_kwh ?? 0;

        if (todayKwh === 0) {
          const created = await createAlertIfNew({
            tenant_id: plant.tenant_id,
            plant_id: plant.id,
            alert_type: "no_generation",
            severity: "warning",
            title: `Usina "${plant.name}" sem geração hoje`,
            description: `Nenhuma energia gerada durante horário solar. Verifique o status do inversor e conexão.`,
            context_json: { today_energy_kwh: todayKwh, checked_at_hour_brt: brasiliaHour },
          });
          if (created) stats.no_generation++;
        }
      }
    } else {
      console.log("[check-energy-alerts] Skipping plant generation check (outside solar hours, BRT:", brasiliaHour, ")");
    }

    // ═══════════════════════════════════════════
    // 4. GD ALLOCATION MISMATCH
    // ═══════════════════════════════════════════
    console.log("[check-energy-alerts] Scanning GD allocation mismatches...");
    const { data: gdGroups } = await supabase
      .from("gd_groups")
      .select("id, tenant_id, nome")
      .eq("status", "active");

    for (const group of gdGroups || []) {
      const { data: allocations } = await supabase
        .from("gd_group_beneficiaries")
        .select("allocation_percent")
        .eq("gd_group_id", group.id)
        .eq("is_active", true);

      if (!allocations || allocations.length === 0) continue;

      const totalPercent = allocations.reduce(
        (sum: number, a: { allocation_percent: number | null }) => sum + (a.allocation_percent || 0),
        0
      );

      if (Math.abs(totalPercent - 100) >= 0.01) {
        const created = await createAlertIfNew({
          tenant_id: group.tenant_id,
          gd_group_id: group.id,
          alert_type: "allocation_mismatch",
          severity: "warning",
          title: `Rateio do grupo "${group.nome}" não soma 100%`,
          description: `O rateio atual soma ${totalPercent.toFixed(1)}%. Ajuste as alocações das beneficiárias.`,
          context_json: { total_percent: totalPercent },
        });
        if (created) stats.allocation_mismatch++;
      }
    }

    console.log("[check-energy-alerts] Scan complete:", stats);

    return new Response(JSON.stringify({ ok: true, stats }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[check-energy-alerts] Fatal error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
