/**
 * useLayoutLearning — Hooks for layout learning events and rules.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LayoutLearningEvent {
  id: string;
  tenant_id: string;
  concessionaria_code: string;
  concessionaria_nome: string;
  source_invoice_id: string | null;
  source_extraction_run_id: string | null;
  layout_signature: string;
  file_type: string;
  original_filename: string | null;
  sample_storage_path: string | null;
  sample_text_excerpt: string | null;
  extraction_status: string;
  parser_used: string | null;
  parser_version: string | null;
  required_fields_found_json: string[];
  required_fields_missing_json: string[];
  warnings_json: string[];
  errors_json: string[];
  raw_extraction_json: Record<string, unknown> | null;
  occurrences_count: number;
  learning_status: string;
  first_seen_at: string;
  last_seen_at: string;
  created_at: string;
  updated_at: string;
}

export interface LayoutLearningRule {
  id: string;
  tenant_id: string;
  concessionaria_code: string;
  layout_signature: string | null;
  rule_name: string;
  field_name: string;
  extraction_type: string;
  pattern: string;
  fallback_pattern: string | null;
  priority_order: number;
  is_required: boolean;
  active: boolean;
  notes: string | null;
  usage_count: number;
  last_used_at: string | null;
  last_success_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

const STALE_TIME = 1000 * 60 * 5;
const EVENTS_KEY = "layout_learning_events" as const;
const RULES_KEY = "layout_learning_rules" as const;

export function useLayoutLearningEvents(filters?: {
  learning_status?: string;
  concessionaria_code?: string;
  extraction_status?: string;
}) {
  return useQuery({
    queryKey: [EVENTS_KEY, filters],
    queryFn: async () => {
      let q = supabase
        .from("invoice_layout_learning_events")
        .select("*")
        .order("last_seen_at", { ascending: false })
        .limit(200);

      if (filters?.learning_status) q = q.eq("learning_status", filters.learning_status);
      if (filters?.concessionaria_code) q = q.eq("concessionaria_code", filters.concessionaria_code);
      if (filters?.extraction_status) q = q.eq("extraction_status", filters.extraction_status);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as LayoutLearningEvent[];
    },
    staleTime: STALE_TIME,
  });
}

export function useLayoutLearningEventById(id: string | null) {
  return useQuery({
    queryKey: [EVENTS_KEY, "detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("invoice_layout_learning_events")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as LayoutLearningEvent;
    },
    staleTime: STALE_TIME,
    enabled: !!id,
  });
}

export function useLayoutLearningStats() {
  return useQuery({
    queryKey: [EVENTS_KEY, "stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_layout_learning_events")
        .select("learning_status, extraction_status, occurrences_count");
      if (error) throw error;
      const events = data || [];
      return {
        total: events.length,
        new_count: events.filter((e: any) => e.learning_status === "new").length,
        analyzing: events.filter((e: any) => e.learning_status === "analyzing").length,
        learned: events.filter((e: any) => e.learning_status === "learned").length,
        ignored: events.filter((e: any) => e.learning_status === "ignored").length,
        failures: events.filter((e: any) => e.extraction_status === "failed").length,
      };
    },
    staleTime: STALE_TIME,
  });
}

export function useUpdateLayoutEventStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, learning_status }: { id: string; learning_status: string }) => {
      const { error } = await supabase
        .from("invoice_layout_learning_events")
        .update({ learning_status, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [EVENTS_KEY] });
    },
  });
}

// --- Rules ---

export function useLayoutLearningRules(concessionariaCode?: string, layoutSignature?: string) {
  return useQuery({
    queryKey: [RULES_KEY, concessionariaCode, layoutSignature],
    queryFn: async () => {
      let q = supabase
        .from("invoice_layout_learning_rules")
        .select("*")
        .order("priority_order", { ascending: true });

      if (concessionariaCode) q = q.eq("concessionaria_code", concessionariaCode);
      if (layoutSignature) q = q.eq("layout_signature", layoutSignature);

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as unknown as LayoutLearningRule[];
    },
    staleTime: STALE_TIME,
  });
}

export function useSaveLayoutRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<LayoutLearningRule> & {
      concessionaria_code: string;
      field_name: string;
      rule_name: string;
      pattern: string;
    }) => {
      const { id, tenant_id, created_at, updated_at, usage_count, last_used_at, last_success_at, ...rest } = payload as any;

      if (id) {
        const { data, error } = await supabase
          .from("invoice_layout_learning_rules")
          .update({ ...rest, updated_at: new Date().toISOString() })
          .eq("id", id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await supabase
          .from("invoice_layout_learning_rules")
          .insert(rest)
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RULES_KEY] });
    },
  });
}

export function useDeleteLayoutRule() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoice_layout_learning_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [RULES_KEY] });
    },
  });
}
