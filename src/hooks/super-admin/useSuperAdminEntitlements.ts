/**
 * useSuperAdminEntitlements — PR-3 hooks (Features, Limits, Usage, Health).
 * SSOT: feature_flags_catalog + plan_features + plan_limits + tenant_*_overrides + usage_counters.
 * §16: queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const STALE = 1000 * 30;

export interface EntitlementsFeature {
  feature_key: string;
  name: string;
  category: string | null;
  plan_enabled: boolean | null;
  override_enabled: boolean | null;
  override_source: string | null;
  override_expires_at: string | null;
  override_reason: string | null;
  effective: boolean;
}

export interface EntitlementsLimit {
  limit_key: string;
  plan_limit: number | null;
  override_limit: number | null;
  override_expires_at: string | null;
  override_reason: string | null;
  effective_limit: number | null;
  current_value: number;
}

export interface TenantEntitlements {
  features: EntitlementsFeature[];
  limits: EntitlementsLimit[];
  lock_state: {
    level: "none" | "soft" | "hard";
    reason: string;
    subscription_status: string | null;
    grace_until: string | null;
    overdue_since: string | null;
  };
  health: {
    score: number;
    breakdown: Record<string, any>;
    computed_at: string;
  };
}

export function useTenantEntitlements(tenantId: string | undefined) {
  return useQuery({
    queryKey: ["sa-entitlements", tenantId],
    enabled: !!tenantId,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "super_admin_get_tenant_entitlements" as any,
        { _tenant_id: tenantId! },
      );
      if (error) throw error;
      return data as unknown as TenantEntitlements;
    },
  });
}

export function useTenantUsageEvents(tenantId: string | undefined, limit = 100) {
  return useQuery({
    queryKey: ["sa-usage-events", tenantId, limit],
    enabled: !!tenantId,
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "super_admin_get_tenant_usage_events" as any,
        { _tenant_id: tenantId!, _limit: limit },
      );
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
}

export function useGlobalHealth() {
  return useQuery({
    queryKey: ["sa-global-health"],
    staleTime: STALE,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("super_admin_global_health" as any);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });
}

export function useFeatureCatalog() {
  return useQuery({
    queryKey: ["sa-feature-catalog"],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feature_flags_catalog")
        .select("id, feature_key, name, description, category, is_active")
        .eq("is_active", true)
        .order("category")
        .order("feature_key");
      if (error) throw error;
      return data ?? [];
    },
  });
}

interface SetFeatureInput {
  tenant_id: string;
  feature_key: string;
  enabled: boolean;
  source?: string;
  expires_at?: string | null;
  reason?: string | null;
}

export function useSetFeatureOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: SetFeatureInput) => {
      const { data, error } = await supabase.rpc(
        "super_admin_set_feature_override" as any,
        {
          _tenant_id: i.tenant_id,
          _feature_key: i.feature_key,
          _enabled: i.enabled,
          _source: i.source ?? "manual",
          _expires_at: i.expires_at ?? null,
          _reason: i.reason ?? null,
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      toast.success("Feature atualizada");
      qc.invalidateQueries({ queryKey: ["sa-entitlements", v.tenant_id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar feature"),
  });
}

interface SetLimitInput {
  tenant_id: string;
  limit_key: string;
  limit_value: number;
  expires_at?: string | null;
  reason?: string | null;
}

export function useSetLimitOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: SetLimitInput) => {
      const { data, error } = await supabase.rpc(
        "super_admin_set_limit_override" as any,
        {
          _tenant_id: i.tenant_id,
          _limit_key: i.limit_key,
          _limit_value: i.limit_value,
          _expires_at: i.expires_at ?? null,
          _reason: i.reason ?? null,
        },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      toast.success("Limite atualizado");
      qc.invalidateQueries({ queryKey: ["sa-entitlements", v.tenant_id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao atualizar limite"),
  });
}

export function useResetUsage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (i: { tenant_id: string; metric_key: string }) => {
      const { data, error } = await supabase.rpc(
        "super_admin_reset_usage" as any,
        { _tenant_id: i.tenant_id, _metric_key: i.metric_key },
      );
      if (error) throw error;
      return data;
    },
    onSuccess: (_d, v) => {
      toast.success("Contador zerado");
      qc.invalidateQueries({ queryKey: ["sa-entitlements", v.tenant_id] });
      qc.invalidateQueries({ queryKey: ["sa-usage-events", v.tenant_id] });
    },
    onError: (e: any) => toast.error(e?.message ?? "Falha ao resetar"),
  });
}

export function useValidatePlanTransition() {
  return useMutation({
    mutationFn: async (i: { tenant_id: string; to_plan_id: string }) => {
      const { data, error } = await supabase.rpc(
        "validate_plan_transition" as any,
        { _tenant_id: i.tenant_id, _to_plan_id: i.to_plan_id },
      );
      if (error) throw error;
      return data as { allowed: boolean; blockers: any[] };
    },
  });
}
