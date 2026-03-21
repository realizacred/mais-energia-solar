/**
 * usePlanLimitsAdmin — CRUD for plan_limits table (admin).
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QK = "plan_limits_admin" as const;

export interface PlanLimitRow {
  id: string;
  plan_id: string;
  limit_key: string;
  limit_value: number;
  created_at: string;
}

export function usePlanLimitsAdmin(planId: string | null) {
  return useQuery({
    queryKey: [QK, planId],
    queryFn: async () => {
      if (!planId) return [];
      const { data, error } = await supabase
        .from("plan_limits")
        .select("*")
        .eq("plan_id", planId)
        .order("limit_key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlanLimitRow[];
    },
    staleTime: STALE_TIME,
    enabled: !!planId,
  });
}

export function useUpsertPlanLimit() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, limitKey, limitValue }: { planId: string; limitKey: string; limitValue: number }) => {
      const { data: existing } = await supabase
        .from("plan_limits")
        .select("id")
        .eq("plan_id", planId)
        .eq("limit_key", limitKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("plan_limits")
          .update({ limit_value: limitValue })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("plan_limits")
          .insert({ plan_id: planId, limit_key: limitKey, limit_value: limitValue });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [QK, vars.planId] });
      qc.invalidateQueries({ queryKey: ["tenant-plan-limits"] });
    },
  });
}
