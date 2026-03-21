/**
 * useGdOverflow — Hooks for GD overflow data.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { enqueueGdRecalc } from "@/services/energia/gdAutomationService";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

const STALE_TIME = 1000 * 60 * 5;

export interface GdMonthlyOverflow {
  id: string;
  tenant_id: string;
  snapshot_id: string;
  gd_group_id: string;
  from_uc_id: string;
  to_uc_id: string;
  overflow_kwh: number;
  created_at: string;
}

/**
 * Get overflow transfers for a given snapshot.
 */
export function useGdMonthlyOverflows(snapshotId: string | null) {
  return useQuery({
    queryKey: ["gd_monthly_overflows", snapshotId],
    queryFn: async () => {
      if (!snapshotId) return [];
      const { data, error } = await (supabase as any)
        .from("gd_monthly_overflows")
        .select("*, from_uc:from_uc_id(id, nome, codigo_uc), to_uc:to_uc_id(id, nome, codigo_uc)")
        .eq("snapshot_id", snapshotId)
        .order("overflow_kwh", { ascending: false });
      if (error) throw error;
      return (data || []) as (GdMonthlyOverflow & {
        from_uc: { id: string; nome: string; codigo_uc: string } | null;
        to_uc: { id: string; nome: string; codigo_uc: string } | null;
      })[];
    },
    staleTime: STALE_TIME,
    enabled: !!snapshotId,
  });
}

/**
 * Update beneficiary priority order.
 */
export function useUpdateGdBeneficiaryPriority() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, priority_order }: { id: string; priority_order: number | null }) => {
      const { error } = await supabase
        .from("gd_group_beneficiaries")
        .update({ priority_order, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_, vars) => {
      qc.invalidateQueries({ queryKey: ["gd_group_beneficiaries"] });
      // Enqueue recalc for current month
      try {
        const { tenantId } = await getCurrentTenantId();
        const { data: ben } = await supabase
          .from("gd_group_beneficiaries")
          .select("gd_group_id")
          .eq("id", vars.id)
          .single();
        if (ben) {
          const now = new Date();
          await enqueueGdRecalc({
            tenantId,
            gdGroupId: ben.gd_group_id,
            referenceYear: now.getFullYear(),
            referenceMonth: now.getMonth() + 1,
            triggerType: "allocation_change",
            triggerEntityType: "gd_group",
            triggerEntityId: ben.gd_group_id,
          });
          qc.invalidateQueries({ queryKey: ["gd_recalc_queue"] });
        }
      } catch { /* non-blocking */ }
    },
  });
}

/**
 * Toggle overflow_in/overflow_out for a beneficiary.
 */
export function useToggleGdBeneficiaryOverflow() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, field, value }: {
      id: string;
      field: "allow_overflow_in" | "allow_overflow_out";
      value: boolean;
    }) => {
      const { error } = await supabase
        .from("gd_group_beneficiaries")
        .update({ [field]: value, updated_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: async (_, vars) => {
      qc.invalidateQueries({ queryKey: ["gd_group_beneficiaries"] });
      try {
        const { tenantId } = await getCurrentTenantId();
        const { data: ben } = await supabase
          .from("gd_group_beneficiaries")
          .select("gd_group_id")
          .eq("id", vars.id)
          .single();
        if (ben) {
          const now = new Date();
          await enqueueGdRecalc({
            tenantId,
            gdGroupId: ben.gd_group_id,
            referenceYear: now.getFullYear(),
            referenceMonth: now.getMonth() + 1,
            triggerType: "allocation_change",
            triggerEntityType: "gd_group",
            triggerEntityId: ben.gd_group_id,
          });
          qc.invalidateQueries({ queryKey: ["gd_recalc_queue"] });
        }
      } catch { /* non-blocking */ }
    },
