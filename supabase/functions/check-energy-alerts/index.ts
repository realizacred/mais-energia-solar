/**
 * check-energy-alerts — Proactive energy alert scanner.
 * Runs hourly via pg_cron. Scans for:
 * 1. Meter devices offline (>2h warning, >6h critical)
 * 2. Missing invoices (past day 15 = warning, 2 months = critical)
 * 3. Plants with no generation during solar hours (8h-17h BRT)
 * 4. GD allocation mismatch (≠100%)
 *
 * Deduplication: only creates alert if no unresolved alert of same type+entity exists.
 * AP-20: All queries use batch patterns — no N+1 loops.
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

/** Build a dedup key for an alert to match against existing unresolved alerts */
function alertDedupKey(alertType: string, entityId: string | null | undefined, entityField: string): string {
  return `${alertType}::${entityField}::${entityId || ""}`;
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

    // ─── Pre-fetch ALL unresolved alerts for deduplication (1 query total) ───
    const { data: unresolvedAlerts } = await supabase
      .from("energy_alerts")
      .select("id, alert_type, unit_id, plant_id, gd_group_id, tenant_id")
      .is("resolved_at", null);

    const existingAlertKeys = new Set<string>();
    for (const a of unresolvedAlerts || []) {
      // Index by all entity fields so we can match any combination
      if (a.unit_id) existingAlertKeys.add(alertDedupKey(a.alert_type, a.unit_id, "unit_id"));
      if (a.plant_id) existingAlertKeys.add(alertDedupKey(a.alert_type, a.plant_id, "plant_id"));
      if (a.gd_group_id) existingAlertKeys.add(alertDedupKey(a.alert_type, a.gd_group_id, "gd_group_id"));
      if (!a.unit_id && !a.plant_id && !a.gd_group_id) {
        existingAlertKeys.add(alertDedupKey(a.alert_type, a.tenant_id, "tenant_id"));
      }
    }

    /** Check dedup in memory, return true if alert already exists */
    function alertExists(payload: AlertPayload): boolean {
      if (payload.unit_id) return existingAlertKeys.has(alertDedupKey(payload.alert_type, payload.unit_id, "unit_id"));
      if (payload.plant_id) return existingAlertKeys.has(alertDedupKey(payload.alert_type, payload.plant_id, "plant_id"));
      if (payload.gd_group_id) return existingAlertKeys.has(alertDedupKey(payload.alert_type, payload.gd_group_id, "gd_group_id"));
      return existingAlertKeys.has(alertDedupKey(payload.alert_type, payload.tenant_id, "tenant_id"));
    }

    // Collect all new alerts, then batch insert at the end
    const newAlerts: AlertPayload[] = [];

    function enqueueAlert(payload: AlertPayload): boolean {
      if (alertExists(payload)) {
        stats.skipped_dedup++;
        return false;
      }
      newAlerts.push(payload);
      return true;
    }

    // ═══════════════════════════════════════════
    // 1. METERS OFFLINE (single query already — just remove per-item createAlertIfNew)
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
        if (enqueueAlert({
          tenant_id: meter.tenant_id,
          alert_type: "meter_offline",
          severity: "critical",
          title: `Medidor "${meter.name}" offline há mais de 6 horas`,
          description: `Último sinal recebido em ${new Date(meter.last_seen_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
          context_json: { meter_device_id: meter.id, hours_offline: Math.round(elapsed / 3600000) },
        })) stats.meters_offline++;
      } else if (elapsed > TWO_HOURS) {
        if (enqueueAlert({
          tenant_id: meter.tenant_id,
          alert_type: "meter_offline",
          severity: "warning",
          title: `Medidor "${meter.name}" offline há mais de 2 horas`,
          description: `Último sinal recebido em ${new Date(meter.last_seen_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
          context_json: { meter_device_id: meter.id, hours_offline: Math.round(elapsed / 3600000) },
        })) stats.meters_offline++;
      }
    }

    // ═══════════════════════════════════════════
    // 2. MISSING INVOICES — batch fetch invoices for all UCs at once
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

      if (ucs && ucs.length > 0) {
        const ucIds = ucs.map((uc: any) => uc.id);
        const prevMonth = currentMonth === 1 ? 12 : currentMonth - 1;
        const prevYear = currentMonth === 1 ? currentYear - 1 : currentYear;

        // BATCH: fetch all invoices for current AND previous month in one query
        const { data: allInvoices } = await supabase
          .from("unit_invoices")
          .select("id, unit_id, reference_month, reference_year")
          .in("unit_id", ucIds)
          .in("reference_month", [currentMonth, prevMonth])
          .in("reference_year", [currentYear, prevYear]);

        // Build lookup: unit_id → Set of "month-year"
        const invoiceMap = new Map<string, Set<string>>();
        for (const inv of allInvoices || []) {
          const key = inv.unit_id;
          if (!invoiceMap.has(key)) invoiceMap.set(key, new Set());
          invoiceMap.get(key)!.add(`${inv.reference_month}-${inv.reference_year}`);
        }

        for (const uc of ucs) {
          const ucInvoices = invoiceMap.get(uc.id);
          const hasCurrentMonth = ucInvoices?.has(`${currentMonth}-${currentYear}`) ?? false;

          if (!hasCurrentMonth) {
            const hasPrevMonth = ucInvoices?.has(`${prevMonth}-${prevYear}`) ?? false;
            const severity = !hasPrevMonth ? "critical" as const : "warning" as const;

            if (enqueueAlert({
              tenant_id: uc.tenant_id,
              unit_id: uc.id,
              alert_type: "missing_invoice",
              severity,
              title: severity === "critical"
                ? `UC "${uc.codigo_uc}" sem fatura há 2 meses`
                : `UC "${uc.codigo_uc}" sem fatura no mês atual`,
              description: `Verifique o email de recebimento ou faça upload manual da fatura.`,
              context_json: { month: currentMonth, year: currentYear },
            })) stats.missing_invoices++;
          }
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
          if (enqueueAlert({
            tenant_id: plant.tenant_id,
            plant_id: plant.id,
            alert_type: "no_generation",
            severity: "warning",
            title: `Usina "${plant.name}" sem geração hoje`,
            description: `Nenhuma energia gerada durante horário solar. Verifique o status do inversor e conexão.`,
            context_json: { today_energy_kwh: todayKwh, checked_at_hour_brt: brasiliaHour },
          })) stats.no_generation++;
        }
      }
    } else {
      console.log("[check-energy-alerts] Skipping plant generation check (outside solar hours, BRT:", brasiliaHour, ")");
    }

    // ═══════════════════════════════════════════
    // 4. GD ALLOCATION MISMATCH — batch fetch all beneficiaries
    // ═══════════════════════════════════════════
    console.log("[check-energy-alerts] Scanning GD allocation mismatches...");
    const { data: gdGroups } = await supabase
      .from("gd_groups")
      .select("id, tenant_id, nome")
      .eq("status", "active");

    if (gdGroups && gdGroups.length > 0) {
      const groupIds = gdGroups.map((g: any) => g.id);

      // BATCH: fetch all active beneficiaries for all groups in one query
      const { data: allBeneficiaries } = await supabase
        .from("gd_group_beneficiaries")
        .select("gd_group_id, allocation_percent")
        .in("gd_group_id", groupIds)
        .eq("is_active", true);

      // Build lookup: gd_group_id → total percent
      const allocationTotals = new Map<string, number>();
      for (const b of allBeneficiaries || []) {
        const current = allocationTotals.get(b.gd_group_id) || 0;
        allocationTotals.set(b.gd_group_id, current + (b.allocation_percent || 0));
      }

      for (const group of gdGroups) {
        const totalPercent = allocationTotals.get(group.id);
        if (totalPercent === undefined) continue; // no beneficiaries

        if (Math.abs(totalPercent - 100) >= 0.01) {
          if (enqueueAlert({
            tenant_id: group.tenant_id,
            gd_group_id: group.id,
            alert_type: "allocation_mismatch",
            severity: "warning",
            title: `Rateio do grupo "${group.nome}" não soma 100%`,
            description: `O rateio atual soma ${totalPercent.toFixed(1)}%. Ajuste as alocações das beneficiárias.`,
            context_json: { total_percent: totalPercent },
          })) stats.allocation_mismatch++;
        }
      }
    }

    // ═══════════════════════════════════════════
    // BATCH INSERT all new alerts in one operation
    // ═══════════════════════════════════════════
    if (newAlerts.length > 0) {
      const rows = newAlerts.map(p => ({
        tenant_id: p.tenant_id,
        gd_group_id: p.gd_group_id || null,
        unit_id: p.unit_id || null,
        plant_id: p.plant_id || null,
        alert_type: p.alert_type,
        severity: p.severity,
        title: p.title,
        description: p.description || null,
        context_json: p.context_json || {},
      }));

      const { error: insertError } = await supabase.from("energy_alerts").insert(rows);
      if (insertError) {
        console.error("[check-energy-alerts] Batch insert error:", insertError.message);
        stats.errors += rows.length;
      }
    }

    console.log("[check-energy-alerts] Scan complete:", stats, `(${newAlerts.length} alerts inserted in batch)`);

    return new Response(JSON.stringify({ ok: true, stats, alerts_created: newAlerts.length }), {
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
