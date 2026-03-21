/**
 * useGdEnergyReport — Hooks for multi-month energy report data.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface MonthlyReportRow {
  reference_year: number;
  reference_month: number;
  generation_kwh: number;
  total_compensated_kwh: number;
  total_surplus_kwh: number;
  total_deficit_kwh: number;
  total_allocated_kwh: number;
  calculation_status: string;
  generation_source_type: string;
  estimated_savings_brl: number;
}

/**
 * Get last N months of snapshots + savings for a GD group.
 */
export function useGdGroupEnergyHistory(gdGroupId: string | null, months = 12) {
  return useQuery({
    queryKey: ["gd_energy_history", gdGroupId, months],
    queryFn: async () => {
      if (!gdGroupId) return [];

      // Fetch last N snapshots ordered by date desc
      const { data: snapshots = [], error } = await (supabase as any)
        .from("gd_monthly_snapshots")
        .select("*")
        .eq("gd_group_id", gdGroupId)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false })
        .limit(months);

      if (error) throw error;
      if (snapshots.length === 0) return [];

      // Get allocations savings for these snapshots
      const snapshotIds = snapshots.map((s: any) => s.id);
      const { data: allocs = [] } = await (supabase as any)
        .from("gd_monthly_allocations")
        .select("snapshot_id, estimated_savings_brl")
        .in("snapshot_id", snapshotIds);

      // Aggregate savings per snapshot
      const savingsMap = new Map<string, number>();
      for (const a of allocs) {
        const cur = savingsMap.get(a.snapshot_id) || 0;
        savingsMap.set(a.snapshot_id, cur + Number(a.estimated_savings_brl || 0));
      }

      const rows: MonthlyReportRow[] = snapshots.map((s: any) => ({
        reference_year: s.reference_year,
        reference_month: s.reference_month,
        generation_kwh: Number(s.generation_kwh || 0),
        total_compensated_kwh: Number(s.total_compensated_kwh || 0),
        total_surplus_kwh: Number(s.total_surplus_kwh || 0),
        total_deficit_kwh: Number(s.total_deficit_kwh || 0),
        total_allocated_kwh: Number(s.total_allocated_kwh || 0),
        calculation_status: s.calculation_status || "pending",
        generation_source_type: s.generation_source_type || "missing",
        estimated_savings_brl: savingsMap.get(s.id) || 0,
      }));

      // Return chronological (oldest first)
      return rows.reverse();
    },
    staleTime: STALE_TIME,
    enabled: !!gdGroupId,
  });
}

/**
 * Get multi-month energy summary for a client across all their GD groups.
 */
export function useClienteEnergyHistory(clienteId: string | null, months = 12) {
  return useQuery({
    queryKey: ["cliente_energy_history", clienteId, months],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data: groups = [] } = await supabase
        .from("gd_groups")
        .select("id, nome")
        .eq("cliente_id", clienteId)
        .eq("status", "active");

      if (groups.length === 0) return [];

      const groupIds = groups.map((g) => g.id);
      const { data: snapshots = [] } = await (supabase as any)
        .from("gd_monthly_snapshots")
        .select("*")
        .in("gd_group_id", groupIds)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false })
        .limit(months * groups.length);

      if (snapshots.length === 0) return [];

      const snapshotIds = snapshots.map((s: any) => s.id);
      const { data: allocs = [] } = await (supabase as any)
        .from("gd_monthly_allocations")
        .select("snapshot_id, estimated_savings_brl")
        .in("snapshot_id", snapshotIds);

      const savingsMap = new Map<string, number>();
      for (const a of allocs) {
        savingsMap.set(a.snapshot_id, (savingsMap.get(a.snapshot_id) || 0) + Number(a.estimated_savings_brl || 0));
      }

      // Aggregate by month across groups
      const monthMap = new Map<string, MonthlyReportRow>();
      for (const s of snapshots as any[]) {
        const key = `${s.reference_year}-${s.reference_month}`;
        const existing = monthMap.get(key);
        const savings = savingsMap.get(s.id) || 0;

        if (existing) {
          existing.generation_kwh += Number(s.generation_kwh || 0);
          existing.total_compensated_kwh += Number(s.total_compensated_kwh || 0);
          existing.total_surplus_kwh += Number(s.total_surplus_kwh || 0);
          existing.total_deficit_kwh += Number(s.total_deficit_kwh || 0);
          existing.total_allocated_kwh += Number(s.total_allocated_kwh || 0);
          existing.estimated_savings_brl += savings;
        } else {
          monthMap.set(key, {
            reference_year: s.reference_year,
            reference_month: s.reference_month,
            generation_kwh: Number(s.generation_kwh || 0),
            total_compensated_kwh: Number(s.total_compensated_kwh || 0),
            total_surplus_kwh: Number(s.total_surplus_kwh || 0),
            total_deficit_kwh: Number(s.total_deficit_kwh || 0),
            total_allocated_kwh: Number(s.total_allocated_kwh || 0),
            calculation_status: s.calculation_status || "pending",
            generation_source_type: s.generation_source_type || "missing",
            estimated_savings_brl: savings,
          });
        }
      }

      return Array.from(monthMap.values()).sort(
        (a, b) => a.reference_year * 100 + a.reference_month - (b.reference_year * 100 + b.reference_month)
      );
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}

/**
 * Get total credit balance for a client across all GD groups.
 */
export function useClienteCreditBalance(clienteId: string | null) {
  return useQuery({
    queryKey: ["cliente_credit_balance", clienteId],
    queryFn: async () => {
      if (!clienteId) return { total_balance_kwh: 0, balances: [] };

      const { data: groups = [] } = await supabase
        .from("gd_groups")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("status", "active");

      if (groups.length === 0) return { total_balance_kwh: 0, balances: [] };

      const groupIds = groups.map((g) => g.id);
      const { data: balances = [] } = await (supabase as any)
        .from("gd_credit_balances")
        .select("*")
        .in("gd_group_id", groupIds);

      const total = balances.reduce((s: number, b: any) => s + Number(b.balance_kwh || 0), 0);
      return { total_balance_kwh: total, balances };
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId,
  });
}
