/**
 * usePlanFeatures — Features linked to a specific plan.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QK = "plan_features_admin" as const;

export interface PlanFeatureRow {
  id: string;
  plan_id: string;
  feature_key: string;
  enabled: boolean;
  created_at: string;
}

export function usePlanFeatures(planId: string | null) {
  return useQuery({
    queryKey: [QK, planId],
    queryFn: async () => {
      if (!planId) return [];
      const { data, error } = await supabase
        .from("plan_features")
        .select("*")
        .eq("plan_id", planId)
        .order("feature_key", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PlanFeatureRow[];
    },
    staleTime: STALE_TIME,
    enabled: !!planId,
  });
}

/**
 * Upsert a single plan_feature toggle.
 */
export function useTogglePlanFeature() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planId, featureKey, enabled }: { planId: string; featureKey: string; enabled: boolean }) => {
      // Try update first
      const { data: existing } = await supabase
        .from("plan_features")
        .select("id")
        .eq("plan_id", planId)
        .eq("feature_key", featureKey)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("plan_features")
          .update({ enabled })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("plan_features")
          .insert({ plan_id: planId, feature_key: featureKey, enabled });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [QK, vars.planId] });
      qc.invalidateQueries({ queryKey: ["tenant-plan-features"] });
    },
  });
}
