/**
 * useClienteDashboard — Hooks for client energy dashboard.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 * Reuses existing hooks/services, adding thin aggregation layer.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getClienteFinancialSummary } from "@/services/energia/energyFinancialService";

const STALE_TIME = 1000 * 60 * 5;

const MONTHS_PT = ["Jan","Fev","Mar","Abr","Mai","Jun","Jul","Ago","Set","Out","Nov","Dez"];

function getCurrentPeriod() {
  const now = new Date();
  const br = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  let m = br.getMonth();
  let y = br.getFullYear();
  if (m === 0) { m = 12; y--; }
  return { year: y, month: m };
}

/** Dashboard hero: savings, credits, balance */
export function useClienteDashboardResumo(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente_dashboard_resumo", clienteId],
    queryFn: () => getClienteFinancialSummary(clienteId!),
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

/** Monthly history for chart */
export function useClienteDashboardHistorico(clienteId: string | null, months = 12) {
  return useQuery({
    queryKey: ["cliente_dashboard_historico", clienteId, months],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data: groups = [] } = await supabase
        .from("gd_groups")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("status", "active");

      if (groups.length === 0) return [];
      const groupIds = groups.map(g => g.id);

      const { data: snapshots = [] } = await (supabase as any)
        .from("gd_monthly_snapshots")
        .select("id, reference_year, reference_month")
        .in("gd_group_id", groupIds)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false })
        .limit(months * groupIds.length);

      if (snapshots.length === 0) return [];

      const snapshotIds = snapshots.map((s: any) => s.id);
      const { data: allocs = [] } = await (supabase as any)
        .from("gd_monthly_allocations")
        .select("snapshot_id, estimated_savings_brl, compensated_kwh")
        .in("snapshot_id", snapshotIds);

      const snapMap = new Map<string, any>(snapshots.map((s: any) => [s.id, s]));
      const monthAgg = new Map<string, { year: number; month: number; savings: number; compensated: number }>();

      for (const a of allocs) {
        const snap = snapMap.get(a.snapshot_id);
        if (!snap) continue;
        const key = `${snap.reference_year}-${snap.reference_month}`;
        const cur = monthAgg.get(key) || { year: snap.reference_year, month: snap.reference_month, savings: 0, compensated: 0 };
        cur.savings += Number(a.estimated_savings_brl || 0);
        cur.compensated += Number(a.compensated_kwh || 0);
        monthAgg.set(key, cur);
      }

      return Array.from(monthAgg.values())
        .sort((a, b) => a.year * 100 + a.month - (b.year * 100 + b.month))
        .slice(-months)
        .map(p => ({
          label: `${MONTHS_PT[p.month - 1]}/${p.year}`,
          savings_brl: Math.round(p.savings * 100) / 100,
          compensated_kwh: Math.round(p.compensated * 100) / 100,
        }));
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

/** UCs with monthly energy data */
export function useClienteDashboardUCs(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente_dashboard_ucs", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { year, month } = getCurrentPeriod();

      const { data: ucs = [] } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc, tipo_uc, papel_gd")
        .eq("cliente_id", clienteId)
        .eq("is_archived", false)
        .order("nome");

      if (ucs.length === 0) return [];

      // Get current month allocations for these UCs
      const { data: groups = [] } = await supabase
        .from("gd_groups")
        .select("id")
        .eq("cliente_id", clienteId);
      const groupIds = groups.map(g => g.id);

      if (groupIds.length === 0) return ucs.map((uc: any) => ({ ...uc, compensated_kwh: 0, savings_brl: 0 }));

      const { data: snapshots = [] } = await (supabase as any)
        .from("gd_monthly_snapshots")
        .select("id")
        .in("gd_group_id", groupIds)
        .eq("reference_year", year)
        .eq("reference_month", month);

      const snapshotIds = snapshots.map((s: any) => s.id);
      let allocMap = new Map<string, { compensated: number; savings: number }>();

      if (snapshotIds.length > 0) {
        const { data: allocs = [] } = await (supabase as any)
          .from("gd_monthly_allocations")
          .select("uc_beneficiaria_id, compensated_kwh, estimated_savings_brl")
          .in("snapshot_id", snapshotIds);

        for (const a of allocs) {
          const cur = allocMap.get(a.uc_beneficiaria_id) || { compensated: 0, savings: 0 };
          cur.compensated += Number(a.compensated_kwh || 0);
          cur.savings += Number(a.estimated_savings_brl || 0);
          allocMap.set(a.uc_beneficiaria_id, cur);
        }
      }

      return ucs.map((uc: any) => {
        const data = allocMap.get(uc.id);
        return {
          ...uc,
          compensated_kwh: Math.round((data?.compensated || 0) * 100) / 100,
          savings_brl: Math.round((data?.savings || 0) * 100) / 100,
        };
      });
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

/** GD groups with current month data */
export function useClienteDashboardGD(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente_dashboard_gd", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];
      const { year, month } = getCurrentPeriod();

      const { data: groups = [] } = await supabase
        .from("gd_groups")
        .select("id, nome, status, uc_geradora_id")
        .eq("cliente_id", clienteId)
        .order("nome");

      if (groups.length === 0) return [];

      const groupIds = groups.map(g => g.id);
      const { data: snapshots = [] } = await (supabase as any)
        .from("gd_monthly_snapshots")
        .select("id, gd_group_id, generation_kwh, total_compensated_kwh, total_surplus_kwh")
        .in("gd_group_id", groupIds)
        .eq("reference_year", year)
        .eq("reference_month", month);

      const snapMap = new Map<string, any>(snapshots.map((s: any) => [s.gd_group_id, s]));

      // Get savings per group
      const snapshotIds = snapshots.map((s: any) => s.id);
      const savingsMap = new Map<string, number>();
      if (snapshotIds.length > 0) {
        const { data: allocs = [] } = await (supabase as any)
          .from("gd_monthly_allocations")
          .select("snapshot_id, estimated_savings_brl")
          .in("snapshot_id", snapshotIds);
        for (const a of allocs) {
          const gId = snapshots.find((s: any) => s.id === a.snapshot_id)?.gd_group_id;
          if (gId) savingsMap.set(gId, (savingsMap.get(gId) || 0) + Number(a.estimated_savings_brl || 0));
        }
      }

      // Credit balances
      const { data: balances = [] } = await (supabase as any)
        .from("gd_credit_balances")
        .select("gd_group_id, balance_kwh")
        .in("gd_group_id", groupIds);
      const balanceMap = new Map<string, number>();
      for (const b of balances) {
        balanceMap.set(b.gd_group_id, (balanceMap.get(b.gd_group_id) || 0) + Number(b.balance_kwh || 0));
      }

      // UC geradora names
      const genIds = groups.map(g => g.uc_geradora_id).filter(Boolean);
      let genMap = new Map<string, string>();
      if (genIds.length > 0) {
        const { data: gens = [] } = await supabase
          .from("units_consumidoras")
          .select("id, nome, codigo_uc")
          .in("id", genIds);
        genMap = new Map(gens.map(g => [g.id, g.codigo_uc || g.nome]));
      }

      return groups.map(g => {
        const snap = snapMap.get(g.id);
        return {
          id: g.id,
          nome: g.nome,
          status: g.status,
          uc_geradora_label: g.uc_geradora_id ? genMap.get(g.uc_geradora_id) || "—" : "—",
          generation_kwh: Math.round(Number(snap?.generation_kwh || 0) * 100) / 100,
          compensated_kwh: Math.round(Number(snap?.total_compensated_kwh || 0) * 100) / 100,
          savings_brl: Math.round((savingsMap.get(g.id) || 0) * 100) / 100,
          credit_balance_kwh: Math.round((balanceMap.get(g.id) || 0) * 100) / 100,
        };
      });
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

/** Recent invoices for the client's UCs */
export function useClienteDashboardFaturas(clienteId: string | null, limit = 10) {
  return useQuery({
    queryKey: ["cliente_dashboard_faturas", clienteId, limit],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data: ucs = [] } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc")
        .eq("cliente_id", clienteId)
        .eq("is_archived", false);

      if (ucs.length === 0) return [];
      const ucIds = ucs.map(u => u.id);
      const ucMap = new Map(ucs.map(u => [u.id, u.codigo_uc || u.nome]));

      const { data: invoices = [] } = await (supabase as any)
        .from("unit_invoices")
        .select("id, unit_id, reference_month, reference_year, total_amount, due_date, status, pdf_url")
        .in("unit_id", ucIds)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false })
        .limit(limit);

      return invoices.map((inv: any) => ({
        ...inv,
        uc_label: ucMap.get(inv.unit_id) || "—",
        month_label: `${MONTHS_PT[(inv.reference_month || 1) - 1]}/${inv.reference_year}`,
      }));
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

/** Client-facing alerts (simple language) */
export function useClienteDashboardAlertas(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente_dashboard_alertas", clienteId],
    queryFn: async () => {
      if (!clienteId) return [];

      // Get groups for client
      const { data: groups = [] } = await supabase
        .from("gd_groups")
        .select("id")
        .eq("cliente_id", clienteId);

      if (groups.length === 0) return [];
      const groupIds = groups.map(g => g.id);

      const { data: alerts = [] } = await (supabase as any)
        .from("energy_alerts")
        .select("id, alert_type, severity, title, description, status, created_at")
        .in("gd_group_id", groupIds)
        .in("status", ["open", "acknowledged"])
        .in("severity", ["warning", "critical"])
        .order("created_at", { ascending: false })
        .limit(10);

      return (alerts || []).map((a: any) => ({
        id: a.id,
        severity: a.severity,
        title: a.title || simplifyAlertType(a.alert_type),
        description: a.description || "",
        created_at: a.created_at,
      }));
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

function simplifyAlertType(type: string): string {
  const map: Record<string, string> = {
    no_generation: "Sem geração detectada neste mês",
    missing_invoice: "Fatura não encontrada para uma unidade",
    invalid_allocation: "Distribuição de créditos precisa de ajuste",
    meter_offline: "Medidor sem comunicação",
    critical_divergence: "Divergência nos dados de geração",
  };
  return map[type] || "Alerta do sistema";
}
