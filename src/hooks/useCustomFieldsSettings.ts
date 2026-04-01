/**
 * useCustomFieldsSettings — Queries & mutations for CustomFieldsSettings.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_CONFIG = 1000 * 60 * 15; // 15 min — configurações

// ─── Query Keys ───
const QK_FIELDS = ["deal-custom-fields"] as const;
const QK_ACTIVITY_TYPES = ["deal-activity-types"] as const;
const QK_STAGES = ["pipeline-stages"] as const;
const QK_PIPELINES = ["pipelines-list"] as const;

// ─── Queries ───

export function useCustomFieldsList() {
  return useQuery({
    queryKey: QK_FIELDS,
    staleTime: STALE_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_custom_fields")
        .select("id, title, field_key, field_type, field_context, options, ordem, show_on_create, required_on_create, visible_on_funnel, important_on_funnel, required_on_funnel, required_on_proposal, is_active, visible_pipeline_ids, important_stage_ids, required_stage_ids, icon")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function useActivityTypesList() {
  return useQuery({
    queryKey: QK_ACTIVITY_TYPES,
    staleTime: STALE_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("deal_activity_types")
        .select("id, title, ordem, visible_on_funnel, is_active, icon, pipeline_ids")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export function usePipelineStages() {
  return useQuery({
    queryKey: QK_STAGES,
    staleTime: STALE_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, pipeline_id, position")
        .order("position");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string; pipeline_id: string; position: number }[];
    },
  });
}

export function usePipelinesList() {
  return useQuery({
    queryKey: QK_PIPELINES,
    staleTime: STALE_CONFIG,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .order("created_at");
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}

// ─── Helper: get tenant_id ───
async function getTenantId(): Promise<string | null> {
  const { data } = await supabase.from("profiles").select("tenant_id").limit(1).single();
  return (data as any)?.tenant_id ?? null;
}

// ─── Mutations: Custom Fields ───

export function useSaveCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; data: Record<string, any> }) => {
      const tenantId = await getTenantId();
      const fullPayload = { ...payload.data, tenant_id: tenantId };
      if (payload.id) {
        const { error } = await supabase.from("deal_custom_fields").update(fullPayload).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deal_custom_fields").insert(fullPayload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_FIELDS }),
  });
}

export function useDeleteCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_custom_fields").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_FIELDS }),
  });
}

export function useToggleCustomField() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, column, value }: { id: string; column: string; value: boolean }) => {
      const { error } = await supabase.from("deal_custom_fields").update({ [column]: value } as any).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_FIELDS }),
  });
}

// ─── Mutations: Activity Types ───

export function useSaveActivityType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { id?: string; data: Record<string, any> }) => {
      const tenantId = await getTenantId();
      const fullPayload = { ...payload.data, tenant_id: tenantId };
      if (payload.id) {
        const { error } = await supabase.from("deal_activity_types").update(fullPayload as any).eq("id", payload.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("deal_activity_types").insert(fullPayload as any);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_ACTIVITY_TYPES }),
  });
}

export function useDeleteActivityType() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("deal_activity_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QK_ACTIVITY_TYPES }),
  });
}
