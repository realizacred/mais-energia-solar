/**
 * useGdEnergyEngine — Hooks for GD Energy monthly snapshots and allocations.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calculateGdMonth, type GdMonthlySnapshot, type GdMonthlyAllocation, type GdCreditBalance } from "@/services/energia/gdEnergyEngine";

const STALE_TIME = 1000 * 60 * 5;

// ─── Snapshot ────────────────────────────────────────────────────

export function useGdMonthlySnapshot(gdGroupId: string | null, year: number, month: number) {
  return useQuery({
    queryKey: ["gd_monthly_snapshot", gdGroupId, year, month],
    queryFn: async () => {
      if (!gdGroupId) return null;
      const { data, error } = await (supabase as any)
        .from("gd_monthly_snapshots")
        .select("*")
        .eq("gd_group_id", gdGroupId)
        .eq("reference_year", year)
        .eq("reference_month", month)
        .maybeSingle();
      if (error) throw error;
      return data as GdMonthlySnapshot | null;
    },
    staleTime: STALE_TIME,
    enabled: !!gdGroupId && year > 0 && month > 0,
  });
}

// ─── Allocations ─────────────────────────────────────────────────

export function useGdMonthlyAllocations(snapshotId: string | null) {
  return useQuery({
    queryKey: ["gd_monthly_allocations", snapshotId],
    queryFn: async () => {
      if (!snapshotId) return [];
      const { data, error } = await (supabase as any)
        .from("gd_monthly_allocations")
        .select("*")
        .eq("snapshot_id", snapshotId)
        .order("allocation_percent", { ascending: false });
      if (error) throw error;
      return (data || []) as GdMonthlyAllocation[];
    },
    staleTime: STALE_TIME,
    enabled: !!snapshotId,
  });
}

// ─── Credit Balance ──────────────────────────────────────────────

export function useGdCreditBalance(gdGroupId: string | null, ucId?: string | null) {
  return useQuery({
    queryKey: ["gd_credit_balances", gdGroupId, ucId],
    queryFn: async () => {
      if (!gdGroupId) return [];
      let q = (supabase as any)
        .from("gd_credit_balances")
        .select("*")
        .eq("gd_group_id", gdGroupId);
      if (ucId) q = q.eq("uc_id", ucId);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as GdCreditBalance[];
    },
    staleTime: STALE_TIME,
    enabled: !!gdGroupId,
  });
}

// ─── Calculate Mutation ──────────────────────────────────────────

export function useCalculateGdMonth() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gdGroupId, year, month, recalculate }: {
      gdGroupId: string;
      year: number;
      month: number;
      recalculate?: boolean;
    }) => {
      return calculateGdMonth(gdGroupId, year, month, recalculate ?? true);
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["gd_monthly_snapshot"] });
      qc.invalidateQueries({ queryKey: ["gd_monthly_allocations"] });
      qc.invalidateQueries({ queryKey: ["gd_credit_balances"] });
      qc.invalidateQueries({ queryKey: ["gd_reconciliation"] });
    },
  });
}

// ─── UC Energy Summary (for UC detail page) ─────────────────────

export function useUcEnergiaResumo(ucId: string | null, year: number, month: number) {
  return useQuery({
    queryKey: ["uc_energia_resumo", ucId, year, month],
    queryFn: async () => {
      if (!ucId) return null;

      // Check if UC is beneficiary in any allocation this month
      const { data: allocations } = await (supabase as any)
        .from("gd_monthly_allocations")
        .select("*, snapshot:snapshot_id(reference_year, reference_month, gd_group_id)")
        .eq("uc_beneficiaria_id", ucId);

      const monthAlloc = (allocations || []).find((a: any) =>
        a.snapshot?.reference_year === year && a.snapshot?.reference_month === month
      );

      // Check if UC is geradora in any group
      const { data: asGeradora } = await supabase
        .from("gd_groups")
        .select("id, nome")
        .eq("uc_geradora_id", ucId)
        .eq("status", "active")
        .maybeSingle();

      let geradoraSnapshot = null;
      if (asGeradora) {
        const { data: snap } = await (supabase as any)
          .from("gd_monthly_snapshots")
          .select("*")
          .eq("gd_group_id", asGeradora.id)
          .eq("reference_year", year)
          .eq("reference_month", month)
          .maybeSingle();
        geradoraSnapshot = snap;
      }

      // Credit balance
      const { data: balances } = await (supabase as any)
        .from("gd_credit_balances")
        .select("*")
        .eq("uc_id", ucId);

      return {
        asBeneficiary: monthAlloc || null,
        asGeradora: asGeradora ? { group: asGeradora, snapshot: geradoraSnapshot } : null,
        creditBalances: balances || [],
      };
    },
    staleTime: STALE_TIME,
    enabled: !!ucId && year > 0 && month > 0,
  });
}

// ─── Client Energy Summary ───────────────────────────────────────

export function useClienteEnergiaResumo(clienteId: string | null, year: number, month: number) {
  return useQuery({
    queryKey: ["cliente_energia_resumo", clienteId, year, month],
    queryFn: async () => {
      if (!clienteId) return null;

      // Get groups for this client
      const { data: groups = [] } = await supabase
        .from("gd_groups")
        .select("id, nome")
        .eq("cliente_id", clienteId)
        .eq("status", "active");

      if (groups.length === 0) return { groups: [], totalCompensated: 0, totalSavings: 0, snapshots: [] };

      const groupIds = groups.map((g) => g.id);
      const { data: snapshots = [] } = await (supabase as any)
        .from("gd_monthly_snapshots")
        .select("*")
        .in("gd_group_id", groupIds)
        .eq("reference_year", year)
        .eq("reference_month", month);

      const totalCompensated = snapshots.reduce((s: number, snap: any) => s + Number(snap.total_compensated_kwh || 0), 0);

      // Get allocations for savings
      const snapshotIds = snapshots.map((s: any) => s.id);
      let totalSavings = 0;
      if (snapshotIds.length > 0) {
        const { data: allocs = [] } = await (supabase as any)
          .from("gd_monthly_allocations")
          .select("estimated_savings_brl")
          .in("snapshot_id", snapshotIds);
        totalSavings = allocs.reduce((s: number, a: any) => s + Number(a.estimated_savings_brl || 0), 0);
      }

      return { groups, totalCompensated, totalSavings, snapshots };
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId && year > 0 && month > 0,
  });
}
