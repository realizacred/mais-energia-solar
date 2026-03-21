/**
 * useGdReconciliation — Hook for GD generation source reconciliation.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface GdReconciliationRecord {
  id: string;
  gd_group_id: string;
  snapshot_id: string | null;
  reference_year: number;
  reference_month: number;
  meter_kwh: number | null;
  monitoring_kwh: number | null;
  invoice_kwh: number | null;
  selected_source: string;
  diff_percent: number;
  status: "ok" | "warning" | "critical";
  notes: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Fetch reconciliation for a group + month.
 */
export function useGdReconciliation(gdGroupId: string | null, year: number, month: number) {
  return useQuery({
    queryKey: ["gd_reconciliation", gdGroupId, year, month],
    queryFn: async () => {
      if (!gdGroupId) return null;
      const { data, error } = await (supabase as any)
        .from("gd_generation_reconciliation")
        .select("*")
        .eq("gd_group_id", gdGroupId)
        .eq("reference_year", year)
        .eq("reference_month", month)
        .maybeSingle();
      if (error) throw error;
      return data as GdReconciliationRecord | null;
    },
    staleTime: STALE_TIME,
    enabled: !!gdGroupId && year > 0 && month > 0,
  });
}

/**
 * Fetch reconciliation history for a group (last 12 months).
 */
export function useGdReconciliationHistory(gdGroupId: string | null) {
  return useQuery({
    queryKey: ["gd_reconciliation_history", gdGroupId],
    queryFn: async () => {
      if (!gdGroupId) return [];
      const { data, error } = await (supabase as any)
        .from("gd_generation_reconciliation")
        .select("*")
        .eq("gd_group_id", gdGroupId)
        .order("reference_year", { ascending: false })
        .order("reference_month", { ascending: false })
        .limit(12);
      if (error) throw error;
      return (data || []) as GdReconciliationRecord[];
    },
    staleTime: STALE_TIME,
    enabled: !!gdGroupId,
  });
}

/**
 * Fetch reconciliation for all groups of a client (latest month).
 */
export function useClienteReconciliationSummary(clienteId: string | null, year: number, month: number) {
  return useQuery({
    queryKey: ["cliente_reconciliation_summary", clienteId, year, month],
    queryFn: async () => {
      if (!clienteId) return [];

      const { data: groups = [] } = await supabase
        .from("gd_groups")
        .select("id, nome")
        .eq("cliente_id", clienteId)
        .eq("status", "active");

      if (groups.length === 0) return [];

      const groupIds = groups.map((g) => g.id);
      const { data: recs = [] } = await (supabase as any)
        .from("gd_generation_reconciliation")
        .select("*")
        .in("gd_group_id", groupIds)
        .eq("reference_year", year)
        .eq("reference_month", month);

      return (recs || []).map((r: any) => ({
        ...r,
        group_nome: groups.find((g) => g.id === r.gd_group_id)?.nome || "—",
      }));
    },
    staleTime: STALE_TIME,
    enabled: !!clienteId && year > 0 && month > 0,
  });
}
