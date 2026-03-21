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

    // Verify JWT
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant
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

    // Determine which groups to calculate
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

async function calculateGroupMonth(
  supabase: any,
  gdGroupId: string,
  year: number,
  month: number,
  recalculate: boolean
) {
  // Load group
  const { data: group, error: gErr } = await supabase
    .from("gd_groups")
    .select("id, tenant_id, uc_geradora_id, status")
    .eq("id", gdGroupId)
    .single();
  if (gErr || !group) throw new Error(`Group not found: ${gdGroupId}`);

  // Check existing
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

  // Get generation from invoice
  const { data: genInvoice } = await supabase
    .from("unit_invoices")
    .select("id, energy_consumed_kwh, energy_injected_kwh, compensated_kwh")
    .eq("unit_id", group.uc_geradora_id)
    .eq("reference_year", year)
    .eq("reference_month", month)
    .maybeSingle();

  const generation_kwh = Number(genInvoice?.energy_injected_kwh ?? genInvoice?.compensated_kwh ?? 0);
  const generator_consumption_kwh = Number(genInvoice?.energy_consumed_kwh ?? 0);
  const genStatus = !genInvoice ? "missing_generation" : generation_kwh > 0 ? "complete" : "partial";

  // Get beneficiaries
  const { data: bens = [] } = await supabase
    .from("gd_group_beneficiaries")
    .select("id, uc_beneficiaria_id, allocation_percent, is_active")
    .eq("gd_group_id", gdGroupId)
    .eq("is_active", true);

  let totalAllocated = 0, totalCompensated = 0, totalSurplus = 0, totalDeficit = 0;
  let hasMissing = false;
  const allocations: any[] = [];

  for (const ben of bens) {
    const allocated_kwh = Math.round(generation_kwh * (ben.allocation_percent / 100) * 100) / 100;

    const { data: benInvoice } = await supabase
      .from("unit_invoices")
      .select("id, energy_consumed_kwh, total_amount")
      .eq("unit_id", ben.uc_beneficiaria_id)
      .eq("reference_year", year)
      .eq("reference_month", month)
      .maybeSingle();

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

  let calcStatus = "complete";
  if (genStatus === "missing_generation") calcStatus = "missing_generation";
  else if (hasMissing) calcStatus = "missing_beneficiary_invoice";
  else if (genStatus === "partial") calcStatus = "partial";

  // Upsert snapshot
  const { data: snapshot, error: snapErr } = await supabase
    .from("gd_monthly_snapshots")
    .upsert({
      gd_group_id: gdGroupId,
      tenant_id: group.tenant_id,
      reference_year: year,
      reference_month: month,
      generation_kwh,
      generator_consumption_kwh,
      total_allocated_kwh: Math.round(totalAllocated * 100) / 100,
      total_compensated_kwh: Math.round(totalCompensated * 100) / 100,
      total_surplus_kwh: Math.round(totalSurplus * 100) / 100,
      total_deficit_kwh: Math.round(totalDeficit * 100) / 100,
      calculation_status: calcStatus,
      updated_at: new Date().toISOString(),
    }, { onConflict: "gd_group_id,reference_year,reference_month" })
    .select("*")
    .single();

  if (snapErr) throw new Error(`Snapshot error: ${snapErr.message}`);

  // Upsert allocations
  for (const alloc of allocations) {
    await supabase
      .from("gd_monthly_allocations")
      .upsert({
        snapshot_id: snapshot.id,
        gd_group_id: gdGroupId,
        tenant_id: group.tenant_id,
        ...alloc,
        updated_at: new Date().toISOString(),
      }, { onConflict: "snapshot_id,uc_beneficiaria_id" });
  }

  // Update credit balances
  for (const alloc of allocations) {
    if (alloc.surplus_kwh > 0) {
      const { data: existing } = await supabase
        .from("gd_credit_balances")
        .select("id, balance_kwh")
        .eq("gd_group_id", gdGroupId)
        .eq("uc_id", alloc.uc_beneficiaria_id)
        .maybeSingle();

      if (existing) {
        await supabase
          .from("gd_credit_balances")
          .update({
            balance_kwh: Number(existing.balance_kwh) + alloc.surplus_kwh,
            last_reference_year: year,
            last_reference_month: month,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("gd_credit_balances")
          .insert({
            gd_group_id: gdGroupId,
            uc_id: alloc.uc_beneficiaria_id,
            tenant_id: group.tenant_id,
            balance_kwh: alloc.surplus_kwh,
            last_reference_year: year,
            last_reference_month: month,
          });
      }
    }
  }

  return snapshot;
}
