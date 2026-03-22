/**
 * usePlanoFeatures — Hooks for plan feature toggles.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QK_PREFIX = "plano_features" as const;

export interface PlanoFeatureRow {
  id: string;
  plano_id: string;
  feature_key: string;
  enabled: boolean;
}

/** Fetch enabled features for a specific plan */
export function usePlanoFeatures(planoId: string | null) {
  return useQuery({
    queryKey: [QK_PREFIX, planoId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("plano_servico_features" as any)
        .select("id, plano_id, feature_key, enabled")
        .eq("plano_id", planoId!);
      if (error) throw error;
      return (data ?? []) as unknown as PlanoFeatureRow[];
    },
    staleTime: STALE_TIME,
    enabled: !!planoId,
  });
}

/** Save (upsert) all features for a plan — replaces all with the given set */
export function useSavePlanoFeatures() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ planoId, enabledKeys }: { planoId: string; enabledKeys: string[] }) => {
      // Delete existing
      const { error: delErr } = await supabase
        .from("plano_servico_features" as any)
        .delete()
        .eq("plano_id", planoId);
      if (delErr) throw delErr;

      // Insert enabled ones
      if (enabledKeys.length > 0) {
        const rows = enabledKeys.map((key) => ({
          plano_id: planoId,
          feature_key: key,
          enabled: true,
        }));
        const { error: insErr } = await supabase
          .from("plano_servico_features" as any)
          .insert(rows as any);
        if (insErr) throw insErr;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [QK_PREFIX, vars.planoId] });
      qc.invalidateQueries({ queryKey: [QK_PREFIX] });
    },
  });
}

/** Check if a UC's plan includes a specific feature */
export function useUcPlanFeature(planoServicoId: string | null, featureKey: string) {
  const { data: features = [] } = usePlanoFeatures(planoServicoId);
  // If plan has no features configured, default to all enabled (backward compat)
  if (features.length === 0) return true;
  return features.some((f) => f.feature_key === featureKey && f.enabled);
}

/** Get all enabled feature keys for a plan */
export function useUcPlanFeatures(planoServicoId: string | null) {
  const { data: features = [], isLoading } = usePlanoFeatures(planoServicoId);
  const enabledKeys = new Set(features.filter((f) => f.enabled).map((f) => f.feature_key));
  // If no features configured, all are enabled (backward compat)
  const hasConfig = features.length > 0;
  return {
    isLoading,
    hasConfig,
    isEnabled: (key: string) => !hasConfig || enabledKeys.has(key),
    enabledKeys,
  };
}
