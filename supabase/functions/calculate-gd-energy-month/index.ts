import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.43.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface RequestBody {
  gd_group_id?: string;
  reference_year: number;
  reference_month: number;
  recalculate?: boolean;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const { gd_group_id, reference_year, reference_month, recalculate = false } = body;

    if (!reference_year || !reference_month) {
      return new Response(JSON.stringify({ error: "reference_year and reference_month are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let groupIds: string[] = [];
    if (gd_group_id) {
      groupIds = [gd_group_id];
    } else {
      const { data: groups } = await supabase
        .from("gd_groups")
        .select("id")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "active");
      groupIds = (groups || []).map((g: any) => g.id);
    }

    const results: any[] = [];
    const errors: any[] = [];

    for (const groupId of groupIds) {
      try {
        const snapshot = await calculateGroupMonth(supabase, groupId, reference_year, reference_month, recalculate);
        results.push(snapshot);
      } catch (err: any) {
        errors.push({ group_id: groupId, error: err.message });
      }
    }

    return new Response(
      JSON.stringify({ calculated: results.length, errors: errors.length, results, errors }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Generation Source Resolver (server-side) ───────────────────

async function resolveGenerationSource(
  supabase: any,
  ucGeradoraId: string,
  year: number,
  month: number
) {
  // Priority 1: Meter readings
  const meterResult = await getMeterGeneration(supabase, ucGeradoraId, year, month);
  if (meterResult) return meterResult;

  // Priority 2: Monitoring daily readings
  const monResult = await getMonitoringGeneration(supabase, ucGeradoraId, year, month);
  if (monResult) return monResult;

  // Priority 3: Invoice
  const invResult = await getInvoiceGeneration(supabase, ucGeradoraId, year, month);
  if (invResult) return invResult;

  // Priority 4: Missing
  return {
    generation_kwh: 0,
    generator_consumption_kwh: 0,
    source_type: "missing",
    source_id: null,
    confidence: "missing",
    notes: "Nenhuma fonte de geração encontrada",
    status: "missing_generation",
  };
}

async function getMeterGeneration(supabase: any, ucId: string, year: number, month: number) {
  const { data: links } = await supabase
    .from("unit_meter_links")
    .select("meter_device_id")
    .eq("unit_id", ucId)
    .eq("is_active", true);
  if (!links?.length) return null;

  const meterIds = links.map((l: any) => l.meter_device_id);
  const startDate = new Date(year, month - 1, 1).toISOString();
  const endDate = new Date(year, month, 1).toISOString();

  const { data: readings } = await supabase
    .from("meter_readings")
    .select("energy_export_kwh, energy_import_kwh, meter_device_id")
    .in("meter_device_id", meterIds)
    .gte("measured_at", startDate)
    .lt("measured_at", endDate);

  if (!readings?.length) return null;

  const groups = new Map<string, number[]>();
  for (const r of readings) {
    const v = Number(r.energy_export_kwh);
    if (isNaN(v) || v === 0) continue;
    if (!groups.has(r.meter_device_id)) groups.set(r.meter_device_id, []);
    groups.get(r.meter_device_id)!.push(v);
  }

  let totalExport = 0;
  let bestId: string | null = null;
  for (const [id, vals] of groups) {
    if (vals.length < 2) continue;
    const delta = Math.max(...vals) - Math.min(...vals);
    if (delta > 0) { totalExport += delta; bestId = id; }
  }
  if (totalExport <= 0) return null;

  const importGroups = new Map<string, number[]>();
  for (const r of readings) {
    const v = Number(r.energy_import_kwh);
    if (isNaN(v) || v === 0) continue;
    if (!importGroups.has(r.meter_device_id)) importGroups.set(r.meter_device_id, []);
    importGroups.get(r.meter_device_id)!.push(v);
  }
  let totalImport = 0;
  for (const vals of importGroups.values()) {
    if (vals.length >= 2) totalImport += Math.max(...vals) - Math.min(...vals);
  }

  return {
    generation_kwh: Math.round(totalExport * 100) / 100,
    generator_consumption_kwh: Math.round(totalImport * 100) / 100,
    source_type: "meter",
    source_id: bestId,
    confidence: "high",
    notes: `Medidor: ${readings.length} leituras`,
    status: "complete",
  };
}

async function getMonitoringGeneration(supabase: any, ucId: string, year: number, month: number) {
  const { data: plantLinks } = await supabase
    .from("unit_plant_links")
    .select("plant_id")
    .eq("unit_id", ucId)
    .eq("is_active", true);
  if (!plantLinks?.length) return null;

  const plantIds = plantLinks.map((l: any) => l.plant_id);
  const startDate = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const endDate = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;

  const { data: daily } = await supabase
    .from("monitor_readings_daily")
    .select("energy_kwh, plant_id")
    .in("plant_id", plantIds)
    .gte("date", startDate)
    .lte("date", endDate);

  if (!daily?.length) return null;

  let total = 0;
  let bestPlant: string | null = null;
  for (const r of daily) {
    const v = Number(r.energy_kwh);
    if (!isNaN(v) && v > 0) { total += v; bestPlant = r.plant_id; }
  }
  if (total <= 0) return null;

  const daysWithData = daily.filter((r: any) => Number(r.energy_kwh) > 0).length;
  const confidence = daysWithData >= lastDay * 0.9 ? "high" : daysWithData >= lastDay * 0.5 ? "medium" : "low";

  return {
    generation_kwh: Math.round(total * 100) / 100,
    generator_consumption_kwh: 0,
    source_type: "monitoring",
    source_id: bestPlant,
    confidence,
    notes: `Monitoramento: ${daysWithData}/${lastDay} dias`,
    status: "complete",
  };
}

async function getInvoiceGeneration(supabase: any, ucId: string, year: number, month: number) {
  const { data: invoice } = await supabase
    .from("unit_invoices")
    .select("id, energy_consumed_kwh, energy_injected_kwh, compensated_kwh")
    .eq("unit_id", ucId)
    .eq("reference_year", year)
    .eq("reference_month", month)
    .maybeSingle();

  if (!invoice) return null;
  const gen = Number(invoice.energy_injected_kwh ?? invoice.compensated_kwh ?? 0);
  const cons = Number(invoice.energy_consumed_kwh ?? 0);
  if (gen <= 0 && cons <= 0) return null;

  return {
    generation_kwh: gen,
    generator_consumption_kwh: cons,
    source_type: "invoice",
    source_id: invoice.id,
    confidence: gen > 0 ? "medium" : "low",
    notes: gen > 0 ? "Fatura: energia injetada" : "Fatura: sem geração",
    status: gen > 0 ? "complete" : "partial",
  };
}

// ─── Main Calculation ───────────────────────────────────────────

async function calculateGroupMonth(
  supabase: any,
  gdGroupId: string,
  year: number,
  month: number,
  recalculate: boolean
) {
  const { data: group, error: gErr } = await supabase
    .from("gd_groups")
    .select("id, tenant_id, uc_geradora_id, status")
    .eq("id", gdGroupId)
    .single();
  if (gErr || !group) throw new Error(`Group not found: ${gdGroupId}`);

  if (!recalculate) {
    const { data: existing } = await supabase
      .from("gd_monthly_snapshots")
      .select("*")
      .eq("gd_group_id", gdGroupId)
      .eq("reference_year", year)
      .eq("reference_month", month)
      .maybeSingle();
    if (existing?.calculation_status === "complete") return existing;
  }

  // Resolve generation with multi-source hierarchy
  const genSource = await resolveGenerationSource(supabase, group.uc_geradora_id, year, month);

  const { data: bens = [] } = await supabase
    .from("gd_group_beneficiaries")
    .select("id, uc_beneficiaria_id, allocation_percent, is_active")
    .eq("gd_group_id", gdGroupId)
    .eq("is_active", true);

  // AP-20 fix A: Batch-fetch all beneficiary invoices in one query
  const benUcIds = bens.map((b: any) => b.uc_beneficiaria_id);
  const { data: benInvoices = [] } = benUcIds.length > 0
    ? await supabase
        .from("unit_invoices")
        .select("id, unit_id, energy_consumed_kwh, total_amount")
        .in("unit_id", benUcIds)
        .eq("reference_year", year)
        .eq("reference_month", month)
    : { data: [] };

  const invoiceMap = new Map<string, any>();
  for (const inv of benInvoices) {
    invoiceMap.set(inv.unit_id, inv);
  }

  let totalAllocated = 0, totalCompensated = 0, totalSurplus = 0, totalDeficit = 0;
  let hasMissing = false;
  const allocations: any[] = [];

  for (const ben of bens) {
    const allocated_kwh = Math.round(genSource.generation_kwh * (ben.allocation_percent / 100) * 100) / 100;

    const benInvoice = invoiceMap.get(ben.uc_beneficiaria_id) || null;

    if (!benInvoice) hasMissing = true;
    const consumed_kwh = Number(benInvoice?.energy_consumed_kwh ?? 0);
    const compensated_kwh = Math.min(allocated_kwh, consumed_kwh);
    const surplus_kwh = Math.max(allocated_kwh - consumed_kwh, 0);
    const deficit_kwh = Math.max(consumed_kwh - allocated_kwh, 0);

    let estimated_savings_brl = null;
    if (benInvoice?.total_amount && consumed_kwh > 0 && compensated_kwh > 0) {
      const tariff = Number(benInvoice.total_amount) / consumed_kwh;
      estimated_savings_brl = Math.round(compensated_kwh * tariff * 100) / 100;
    }

    totalAllocated += allocated_kwh;
    totalCompensated += compensated_kwh;
    totalSurplus += surplus_kwh;
    totalDeficit += deficit_kwh;

    allocations.push({
      uc_beneficiaria_id: ben.uc_beneficiaria_id,
      allocation_percent: ben.allocation_percent,
      allocated_kwh, consumed_kwh, compensated_kwh, surplus_kwh, deficit_kwh,
      estimated_savings_brl,
      source_invoice_id: benInvoice?.id || null,
    });
  }

  let calcStatus = genSource.status;
  if (calcStatus === "complete" && hasMissing) calcStatus = "missing_beneficiary_invoice";

  const { data: snapshot, error: snapErr } = await supabase
    .from("gd_monthly_snapshots")
    .upsert({
      gd_group_id: gdGroupId,
      tenant_id: group.tenant_id,
      reference_year: year,
      reference_month: month,
      generation_kwh: genSource.generation_kwh,
      generator_consumption_kwh: genSource.generator_consumption_kwh,
      total_allocated_kwh: Math.round(totalAllocated * 100) / 100,
      total_compensated_kwh: Math.round(totalCompensated * 100) / 100,
      total_surplus_kwh: Math.round(totalSurplus * 100) / 100,
      total_deficit_kwh: Math.round(totalDeficit * 100) / 100,
      calculation_status: calcStatus,
      generation_source_type: genSource.source_type,
      generation_source_id: genSource.source_id,
      generation_source_confidence: genSource.confidence,
      generation_source_notes: genSource.notes,
      updated_at: new Date().toISOString(),
    }, { onConflict: "gd_group_id,reference_year,reference_month" })
    .select("*")
    .single();

  if (snapErr) throw new Error(`Snapshot error: ${snapErr.message}`);

  // AP-20 fix B: Batch upsert all allocations in one call
  if (allocations.length > 0) {
    const allocationRows = allocations.map(alloc => ({
      snapshot_id: snapshot.id,
      gd_group_id: gdGroupId,
      tenant_id: group.tenant_id,
      ...alloc,
      updated_at: new Date().toISOString(),
    }));
    await supabase
      .from("gd_monthly_allocations")
      .upsert(allocationRows, { onConflict: "snapshot_id,uc_beneficiaria_id" });
  }

  // AP-20 fix C: Batch-fetch existing credit balances, then batch insert/update
  const surplusAllocs = allocations.filter(a => a.surplus_kwh > 0);
  if (surplusAllocs.length > 0) {
    const surplusUcIds = surplusAllocs.map(a => a.uc_beneficiaria_id);

    const { data: existingCredits = [] } = await supabase
      .from("gd_credit_balances")
      .select("id, uc_id, balance_kwh")
      .eq("gd_group_id", gdGroupId)
      .in("uc_id", surplusUcIds);

    const creditMap = new Map<string, any>();
    for (const c of existingCredits) {
      creditMap.set(c.uc_id, c);
    }

    const creditsToInsert: any[] = [];
    const creditsToUpdate: { id: string; balance_kwh: number }[] = [];

    for (const alloc of surplusAllocs) {
      const existing = creditMap.get(alloc.uc_beneficiaria_id);
      if (existing) {
        creditsToUpdate.push({
          id: existing.id,
          balance_kwh: Number(existing.balance_kwh) + alloc.surplus_kwh,
        });
      } else {
        creditsToInsert.push({
          gd_group_id: gdGroupId,
          uc_id: alloc.uc_beneficiaria_id,
          tenant_id: group.tenant_id,
          balance_kwh: alloc.surplus_kwh,
          last_reference_year: year,
          last_reference_month: month,
        });
      }
    }

    if (creditsToInsert.length > 0) {
      await supabase.from("gd_credit_balances").insert(creditsToInsert);
    }

    // Updates have individual balance values, but we eliminated the N+1 SELECT
    for (const upd of creditsToUpdate) {
      await supabase
        .from("gd_credit_balances")
        .update({
          balance_kwh: upd.balance_kwh,
          last_reference_year: year,
          last_reference_month: month,
          updated_at: new Date().toISOString(),
        })
        .eq("id", upd.id);
    }
  }

  return snapshot;
}
