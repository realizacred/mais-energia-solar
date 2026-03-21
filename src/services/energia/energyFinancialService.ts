/**
 * energyFinancialService — Financial layer over GD energy engine.
 * §17: Business logic in services. §20: SRP.
 * Consumes gd_monthly_allocations, gd_monthly_snapshots, gd_credit_balances as SSOT.
 */
import { supabase } from "@/integrations/supabase/client";

// ─── Types ─────────────────────────────────────────────────────

export interface FinancialOverview {
  total_savings_brl: number;
  current_month_savings_brl: number;
  active_clients: number;
  active_gd_groups: number;
  total_credit_balance_kwh: number;
}

export interface GroupFinancialSummary {
  gd_group_id: string;
  group_name: string;
  cliente_id: string | null;
  cliente_name: string | null;
  total_savings_brl: number;
  current_month_savings_brl: number;
  total_compensated_kwh: number;
  current_credit_balance_kwh: number;
  months_count: number;
}

export interface ClienteFinancialSummary {
  cliente_id: string;
  cliente_name: string;
  total_savings_brl: number;
  current_month_savings_brl: number;
  total_compensated_kwh: number;
  current_credit_balance_kwh: number;
  active_groups: number;
  active_ucs: number;
}

export interface UcFinancialSummary {
  unit_id: string;
  unit_name: string;
  total_savings_brl: number;
  current_month_savings_brl: number;
  total_compensated_kwh: number;
}

export interface MonthlyFinancialPoint {
  year: number;
  month: number;
  label: string;
  savings_brl: number;
  compensated_kwh: number;
}

// ─── Helpers ───────────────────────────────────────────────────

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function getCurrentPeriod() {
  const now = new Date();
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  let m = br.getMonth();
  let y = br.getFullYear();
  if (m === 0) { m = 12; y--; }
  return { year: y, month: m };
}

// ─── Service Functions ─────────────────────────────────────────

/**
 * Global financial overview for the tenant.
 */
export async function getEnergyFinancialOverview(): Promise<FinancialOverview> {
  const { year, month } = getCurrentPeriod();

  // Total savings from all allocations
  const { data: allAllocs = [] } = await (supabase as any)
    .from("gd_monthly_allocations")
    .select("estimated_savings_brl, snapshot_id");

  const totalSavings = allAllocs.reduce((s: number, a: any) => s + Number(a.estimated_savings_brl || 0), 0);

  // Current month snapshots
  const { data: currentSnapshots = [] } = await (supabase as any)
    .from("gd_monthly_snapshots")
    .select("id")
    .eq("reference_year", year)
    .eq("reference_month", month);

  const currentSnapshotIds = currentSnapshots.map((s: any) => s.id);
  let currentMonthSavings = 0;
  if (currentSnapshotIds.length > 0) {
    const { data: currentAllocs = [] } = await (supabase as any)
      .from("gd_monthly_allocations")
      .select("estimated_savings_brl")
      .in("snapshot_id", currentSnapshotIds);
    currentMonthSavings = currentAllocs.reduce((s: number, a: any) => s + Number(a.estimated_savings_brl || 0), 0);
  }

  // Active GD groups
  const { count: activeGroups = 0 } = await supabase
    .from("gd_groups")
    .select("id", { count: "exact", head: true })
    .eq("status", "active");

  // Active clients with GD
  const { data: groupClients = [] } = await supabase
    .from("gd_groups")
    .select("cliente_id")
    .eq("status", "active");
  const uniqueClients = new Set(groupClients.map((g: any) => g.cliente_id).filter(Boolean));

  // Credit balances
  const { data: balances = [] } = await (supabase as any)
    .from("gd_credit_balances")
    .select("balance_kwh");
  const totalBalance = balances.reduce((s: number, b: any) => s + Number(b.balance_kwh || 0), 0);

  return {
    total_savings_brl: Math.round(totalSavings * 100) / 100,
    current_month_savings_brl: Math.round(currentMonthSavings * 100) / 100,
    active_clients: uniqueClients.size,
    active_gd_groups: activeGroups || 0,
    total_credit_balance_kwh: Math.round(totalBalance * 100) / 100,
  };
}

/**
 * Financial summary for a single GD group.
 */
export async function getGdFinancialSummary(gdGroupId: string, months = 12): Promise<{
  summary: GroupFinancialSummary;
  history: MonthlyFinancialPoint[];
}> {
  const { year, month } = getCurrentPeriod();

  // Group info
  const { data: group } = await supabase
    .from("gd_groups")
    .select("id, nome, cliente_id")
    .eq("id", gdGroupId)
    .single();

  let clienteName: string | null = null;
  if (group?.cliente_id) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("nome")
      .eq("id", group.cliente_id)
      .single();
    clienteName = cliente?.nome || null;
  }

  // Snapshots
  const { data: snapshots = [] } = await (supabase as any)
    .from("gd_monthly_snapshots")
    .select("id, reference_year, reference_month, total_compensated_kwh")
    .eq("gd_group_id", gdGroupId)
    .order("reference_year", { ascending: false })
    .order("reference_month", { ascending: false })
    .limit(months);

  const snapshotIds = snapshots.map((s: any) => s.id);
  let allocs: any[] = [];
  if (snapshotIds.length > 0) {
    const { data = [] } = await (supabase as any)
      .from("gd_monthly_allocations")
      .select("snapshot_id, estimated_savings_brl, compensated_kwh")
      .in("snapshot_id", snapshotIds);
    allocs = data;
  }

  // Aggregate per snapshot
  const snapshotSavings = new Map<string, number>();
  const snapshotCompensated = new Map<string, number>();
  for (const a of allocs) {
    snapshotSavings.set(a.snapshot_id, (snapshotSavings.get(a.snapshot_id) || 0) + Number(a.estimated_savings_brl || 0));
    snapshotCompensated.set(a.snapshot_id, (snapshotCompensated.get(a.snapshot_id) || 0) + Number(a.compensated_kwh || 0));
  }

  let totalSavings = 0;
  let totalCompensated = 0;
  let currentMonthSavings = 0;
  const history: MonthlyFinancialPoint[] = [];

  for (const s of snapshots) {
    const savings = snapshotSavings.get(s.id) || 0;
    const compensated = snapshotCompensated.get(s.id) || 0;
    totalSavings += savings;
    totalCompensated += compensated;
    if (s.reference_year === year && s.reference_month === month) {
      currentMonthSavings = savings;
    }
    history.push({
      year: s.reference_year,
      month: s.reference_month,
      label: `${MONTHS_PT[s.reference_month - 1]}/${s.reference_year}`,
      savings_brl: Math.round(savings * 100) / 100,
      compensated_kwh: Math.round(compensated * 100) / 100,
    });
  }

  // Credit balance
  const { data: balances = [] } = await (supabase as any)
    .from("gd_credit_balances")
    .select("balance_kwh")
    .eq("gd_group_id", gdGroupId);
  const creditBalance = balances.reduce((s: number, b: any) => s + Number(b.balance_kwh || 0), 0);

  return {
    summary: {
      gd_group_id: gdGroupId,
      group_name: group?.nome || "",
      cliente_id: group?.cliente_id || null,
      cliente_name: clienteName,
      total_savings_brl: Math.round(totalSavings * 100) / 100,
      current_month_savings_brl: Math.round(currentMonthSavings * 100) / 100,
      total_compensated_kwh: Math.round(totalCompensated * 100) / 100,
      current_credit_balance_kwh: Math.round(creditBalance * 100) / 100,
      months_count: snapshots.length,
    },
    history: history.reverse(),
  };
}

/**
 * Financial summary for a client across all GD groups.
 */
export async function getClienteFinancialSummary(clienteId: string): Promise<ClienteFinancialSummary> {
  const { year, month } = getCurrentPeriod();

  const { data: cliente } = await supabase
    .from("clientes")
    .select("nome")
    .eq("id", clienteId)
    .single();

  const { data: groups = [] } = await supabase
    .from("gd_groups")
    .select("id")
    .eq("cliente_id", clienteId)
    .eq("status", "active");

  if (groups.length === 0) {
    return {
      cliente_id: clienteId,
      cliente_name: cliente?.nome || "",
      total_savings_brl: 0,
      current_month_savings_brl: 0,
      total_compensated_kwh: 0,
      current_credit_balance_kwh: 0,
      active_groups: 0,
      active_ucs: 0,
    };
  }

  const groupIds = groups.map(g => g.id);

  const { data: snapshots = [] } = await (supabase as any)
    .from("gd_monthly_snapshots")
    .select("id, reference_year, reference_month")
    .in("gd_group_id", groupIds);

  const snapshotIds = snapshots.map((s: any) => s.id);
  let allocs: any[] = [];
  if (snapshotIds.length > 0) {
    const { data = [] } = await (supabase as any)
      .from("gd_monthly_allocations")
      .select("snapshot_id, estimated_savings_brl, compensated_kwh")
      .in("snapshot_id", snapshotIds);
    allocs = data;
  }

  const snapshotMap = new Map<string, any>(snapshots.map((s: any) => [s.id, s]));
  let totalSavings = 0;
  let currentMonthSavings = 0;
  let totalCompensated = 0;

  for (const a of allocs) {
    const savings = Number(a.estimated_savings_brl || 0);
    totalSavings += savings;
    totalCompensated += Number(a.compensated_kwh || 0);
    const snap = snapshotMap.get(a.snapshot_id);
    if (snap && snap.reference_year === year && snap.reference_month === month) {
      currentMonthSavings += savings;
    }
  }

  // Credit balance
  const { data: balances = [] } = await (supabase as any)
    .from("gd_credit_balances")
    .select("balance_kwh")
    .in("gd_group_id", groupIds);
  const creditBalance = balances.reduce((s: number, b: any) => s + Number(b.balance_kwh || 0), 0);

  // Active UCs
  const { data: bens = [] } = await (supabase as any)
    .from("gd_group_beneficiaries")
    .select("uc_beneficiaria_id")
    .in("gd_group_id", groupIds)
    .eq("is_active", true);
  const uniqueUcs = new Set(bens.map((b: any) => b.uc_beneficiaria_id));

  return {
    cliente_id: clienteId,
    cliente_name: cliente?.nome || "",
    total_savings_brl: Math.round(totalSavings * 100) / 100,
    current_month_savings_brl: Math.round(currentMonthSavings * 100) / 100,
    total_compensated_kwh: Math.round(totalCompensated * 100) / 100,
    current_credit_balance_kwh: Math.round(creditBalance * 100) / 100,
    active_groups: groups.length,
    active_ucs: uniqueUcs.size,
  };
}

/**
 * Ranking: top groups/clients by savings.
 */
export async function getEnergyFinancialRanking(limit = 10): Promise<{
  topGroups: GroupFinancialSummary[];
  topClients: ClienteFinancialSummary[];
}> {
  // Get all snapshots with allocations
  const { data: allAllocs = [] } = await (supabase as any)
    .from("gd_monthly_allocations")
    .select("snapshot_id, estimated_savings_brl, compensated_kwh, uc_beneficiaria_id");

  const { data: allSnapshots = [] } = await (supabase as any)
    .from("gd_monthly_snapshots")
    .select("id, gd_group_id");

  const snapshotGroupMap = new Map<string, string>(allSnapshots.map((s: any) => [s.id, s.gd_group_id]));

  // Aggregate by group
  const groupTotals = new Map<string, { savings: number; compensated: number }>();
  for (const a of allAllocs) {
    const groupId = snapshotGroupMap.get(a.snapshot_id);
    if (!groupId) continue;
    const cur = groupTotals.get(groupId) || { savings: 0, compensated: 0 };
    cur.savings += Number(a.estimated_savings_brl || 0);
    cur.compensated += Number(a.compensated_kwh || 0);
    groupTotals.set(groupId, cur);
  }

  // Get group info
  const groupIds = Array.from(groupTotals.keys());
  const { data: groups = [] } = await supabase
    .from("gd_groups")
    .select("id, nome, cliente_id")
    .in("id", groupIds.length > 0 ? groupIds : ["__none__"]);

  const { data: clientes = [] } = await supabase
    .from("clientes")
    .select("id, nome");
  const clienteMap = new Map(clientes.map(c => [c.id, c.nome]));

  const topGroups: GroupFinancialSummary[] = groups
    .map(g => {
      const totals = groupTotals.get(g.id) || { savings: 0, compensated: 0 };
      return {
        gd_group_id: g.id,
        group_name: g.nome,
        cliente_id: g.cliente_id,
        cliente_name: g.cliente_id ? clienteMap.get(g.cliente_id) || null : null,
        total_savings_brl: Math.round(totals.savings * 100) / 100,
        current_month_savings_brl: 0,
        total_compensated_kwh: Math.round(totals.compensated * 100) / 100,
        current_credit_balance_kwh: 0,
        months_count: 0,
      };
    })
    .sort((a, b) => b.total_savings_brl - a.total_savings_brl)
    .slice(0, limit);

  // Aggregate by client
  const clienteTotals = new Map<string, { savings: number; compensated: number; groups: Set<string> }>();
  for (const g of groups) {
    if (!g.cliente_id) continue;
    const totals = groupTotals.get(g.id) || { savings: 0, compensated: 0 };
    const cur = clienteTotals.get(g.cliente_id) || { savings: 0, compensated: 0, groups: new Set() };
    cur.savings += totals.savings;
    cur.compensated += totals.compensated;
    cur.groups.add(g.id);
    clienteTotals.set(g.cliente_id, cur);
  }

  const topClients: ClienteFinancialSummary[] = Array.from(clienteTotals.entries())
    .map(([clienteId, totals]) => ({
      cliente_id: clienteId,
      cliente_name: clienteMap.get(clienteId) || "",
      total_savings_brl: Math.round(totals.savings * 100) / 100,
      current_month_savings_brl: 0,
      total_compensated_kwh: Math.round(totals.compensated * 100) / 100,
      current_credit_balance_kwh: 0,
      active_groups: totals.groups.size,
      active_ucs: 0,
    }))
    .sort((a, b) => b.total_savings_brl - a.total_savings_brl)
    .slice(0, limit);

  return { topGroups, topClients };
}

/**
 * Monthly financial history across all GD groups (for chart).
 */
export async function getEnergyFinancialHistory(months = 12): Promise<MonthlyFinancialPoint[]> {
  const { data: snapshots = [] } = await (supabase as any)
    .from("gd_monthly_snapshots")
    .select("id, reference_year, reference_month")
    .order("reference_year", { ascending: false })
    .order("reference_month", { ascending: false })
    .limit(months * 20);

  if (snapshots.length === 0) return [];

  const snapshotIds = snapshots.map((s: any) => s.id);
  const { data: allocs = [] } = await (supabase as any)
    .from("gd_monthly_allocations")
    .select("snapshot_id, estimated_savings_brl, compensated_kwh")
    .in("snapshot_id", snapshotIds);

  const snapshotMap = new Map(snapshots.map((s: any) => [s.id, s]));
  const monthMap = new Map<string, { savings: number; compensated: number; year: number; month: number }>();

  for (const a of allocs) {
    const snap = snapshotMap.get(a.snapshot_id);
    if (!snap) continue;
    const key = `${snap.reference_year}-${snap.reference_month}`;
    const cur = monthMap.get(key) || { savings: 0, compensated: 0, year: snap.reference_year, month: snap.reference_month };
    cur.savings += Number(a.estimated_savings_brl || 0);
    cur.compensated += Number(a.compensated_kwh || 0);
    monthMap.set(key, cur);
  }

  return Array.from(monthMap.values())
    .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))
    .slice(-months)
    .map(p => ({
      year: p.year,
      month: p.month,
      label: `${MONTHS_PT[p.month - 1]}/${p.year}`,
      savings_brl: Math.round(p.savings * 100) / 100,
      compensated_kwh: Math.round(p.compensated * 100) / 100,
    }));
}
