/**
 * useTenantFeatureOverrides — Admin CRUD for per-tenant overrides.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QK = "admin_tenant_feature_overrides" as const;

export interface TenantOverride {
  id: string;
  tenant_id: string;
  feature_id: string;
  enabled: boolean;
  reason: string | null;
  created_at: string;
  updated_at: string;
  feature_flags_catalog?: { feature_key: string; name: string; category: string | null } | null;
}

export function useTenantFeatureOverridesAdmin(tenantId: string | null) {
  return useQuery({
    queryKey: [QK, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data, error } = await supabase
        .from("tenant_feature_overrides")
        .select("*, feature_flags_catalog(feature_key, name, category)")
        .eq("tenant_id", tenantId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TenantOverride[];
    },
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  });
}

export function useUpsertTenantOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      tenantId,
      featureId,
      enabled,
      reason,
    }: {
      tenantId: string;
      featureId: string;
      enabled: boolean;
      reason?: string;
    }) => {
      // Check for existing override
      const { data: existing } = await supabase
        .from("tenant_feature_overrides")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("feature_id", featureId)
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("tenant_feature_overrides")
          .update({ enabled, reason: reason ?? null })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tenant_feature_overrides")
          .insert({ tenant_id: tenantId, feature_id: featureId, enabled, reason: reason ?? null });
        if (error) throw error;
      }
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [QK, vars.tenantId] });
      qc.invalidateQueries({ queryKey: ["tenant-feature-overrides"] });
    },
  });
}

export function useDeleteTenantOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, tenantId }: { id: string; tenantId: string }) => {
      const { error } = await supabase
        .from("tenant_feature_overrides")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return tenantId;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: [QK, vars.tenantId] });
      qc.invalidateQueries({ queryKey: ["tenant-feature-overrides"] });
    },
  });
}
