/**
 * useFeatureAccess — Central hook for checking feature access.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 * Uses resolveFeatureAccess from featureAccessService (SSOT).
 */
import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useTenantPlan } from "@/hooks/useTenantPlan";
import { resolveFeatureAccess, type FeatureAccessResult } from "@/services/billing/featureAccessService";

const STALE_TIME = 1000 * 60 * 5;

/**
 * Fetch user roles from user_roles table.
 */
function useUserRoles() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["user-roles-for-feature-access", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return (data ?? []).map((r) => r.role);
    },
    staleTime: STALE_TIME,
    enabled: !!user?.id,
  });
}

/**
 * Fetch tenant feature overrides (feature_key → enabled).
 */
function useTenantOverrides() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tenant-feature-overrides"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_feature_overrides")
        .select("feature_id, enabled, feature_flags_catalog!inner(feature_key)")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((row: any) => {
        const key = row.feature_flags_catalog?.feature_key;
        if (key) map[key] = row.enabled;
      });
      return map;
    },
    staleTime: STALE_TIME,
    enabled: !!user,
  });
}

/**
 * Main hook: resolves access for a single feature key.
 */
export function useFeatureAccess(featureKey: string): FeatureAccessResult & { isLoading: boolean } {
  const { subscription, features: planFeatures, loading: planLoading } = useTenantPlan();
  const { data: userRoles = [], isLoading: rolesLoading } = useUserRoles();
  const { data: overrides = {}, isLoading: overridesLoading } = useTenantOverrides();

  const isLoading = planLoading || rolesLoading || overridesLoading;

  const result = useMemo(() => {
    if (isLoading) {
      return {
        hasAccess: false,
        source: "none" as const,
        planCode: null,
        reason: "Carregando...",
      };
    }
    return resolveFeatureAccess({
      featureKey,
      userRoles,
      planCode: subscription?.plan_code ?? null,
      planFeatures,
      tenantOverrides: overrides,
    });
  }, [featureKey, userRoles, subscription?.plan_code, planFeatures, overrides, isLoading]);

  return { ...result, isLoading };
}
