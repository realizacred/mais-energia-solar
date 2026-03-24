/**
 * useExtractionConfigs — Hooks for invoice extraction configuration per concessionária.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

export type ExtractionStrategyMode = "native" | "provider" | "auto";
export type ExtractionRunStatus = "success" | "partial" | "failed" | "needs_ocr";

export interface ExtractionConfig {
  id: string;
  tenant_id: string | null;
  concessionaria_id: string | null;
  concessionaria_code: string;
  concessionaria_nome: string;
  strategy_mode: ExtractionStrategyMode;
  native_enabled: boolean;
  provider_enabled: boolean;
  provider_name: string | null;
  provider_endpoint_key: string | null;
  provider_requires_base64: boolean;
  provider_requires_password: boolean;
  fallback_enabled: boolean;
  recovery_enabled: boolean;
  required_fields: string[];
  required_fields_geradora: string[];
  required_fields_beneficiaria: string[];
  required_fields_mista: string[];
  required_fields_consumo: string[];
  desired_fields: string[];
  blocking_fields: string[];
  geradora_signals: string[];
  beneficiaria_signals: string[];
  mista_signals: string[];
  source_type_supported: string;
  layout_rules: any[];
  identifier_field: string | null;
  optional_fields: string[];
  parser_version: string | null;
  active: boolean;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExtractionRun {
  id: string;
  tenant_id: string;
  config_id: string | null;
  invoice_id: string | null;
  uc_id: string | null;
  concessionaria_code: string;
  strategy_used: ExtractionStrategyMode;
  provider_used: string | null;
  parser_version: string | null;
  status: ExtractionRunStatus;
  error_reason: string | null;
  required_fields_found: string[];
  required_fields_missing: string[];
  response_excerpt: Record<string, unknown> | null;
  confidence_score: number | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
}

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "extraction_configs" as const;
const RUNS_KEY = "extraction_runs" as const;

export function useExtractionConfigs() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_extraction_configs")
        .select("*")
        .order("concessionaria_nome");
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        is_system_default: !d.tenant_id,
      })) as unknown as (ExtractionConfig & { is_system_default: boolean })[];
    },
    staleTime: STALE_TIME,
  });
}

export function useExtractionConfigById(id: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, "detail", id],
    queryFn: async () => {
      if (!id) return null;
      const { data, error } = await supabase
        .from("invoice_extraction_configs")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data as unknown as ExtractionConfig;
    },
    staleTime: STALE_TIME,
    enabled: !!id,
  });
}

export function useSaveExtractionConfig() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (payload: Partial<ExtractionConfig> & { concessionaria_code: string; concessionaria_nome: string }) => {
      const { tenantId } = await getCurrentTenantId();
      const { id, tenant_id, created_at, updated_at, is_system_default, ...rest } = payload as any;
      const now = new Date().toISOString();

      // If editing a global/system config (tenant_id IS NULL), create a tenant-specific override
      const isSystemDefault = is_system_default === true || (id && !tenant_id);

      if (id && !isSystemDefault) {
        const { data, error } = await supabase
          .from("invoice_extraction_configs")
          .update({ ...rest, updated_at: now })
          .eq("id", id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Não foi possível atualizar. Verifique permissões.");
        return data;
      }

      const { data: existingOverride, error: existingOverrideError } = await supabase
        .from("invoice_extraction_configs")
        .select("id")
        .eq("concessionaria_code", rest.concessionaria_code)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existingOverrideError) throw existingOverrideError;

      if (existingOverride?.id) {
        const { data, error } = await supabase
          .from("invoice_extraction_configs")
          .update({ ...rest, updated_at: now })
          .eq("id", existingOverride.id)
          .select()
          .maybeSingle();
        if (error) throw error;
        if (!data) throw new Error("Não foi possível atualizar. Verifique permissões.");
        return data;
      }

      const { data, error } = await supabase
        .from("invoice_extraction_configs")
        .upsert(
          { ...rest, tenant_id: tenantId, updated_at: now },
          { onConflict: "tenant_id,concessionaria_code" }
        )
        .select()
        .maybeSingle();
      if (error) throw error;
      if (!data) throw new Error("Não foi possível criar. Verifique permissões.");
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeleteExtractionConfig() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("invoice_extraction_configs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useExtractionRuns(configId?: string, limit = 50) {
  return useQuery({
    queryKey: [RUNS_KEY, configId, limit],
    queryFn: async () => {
      let query = supabase
        .from("invoice_extraction_runs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);

      if (configId) {
        query = query.eq("config_id", configId);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as ExtractionRun[];
    },
    staleTime: 1000 * 30,
  });
}

export function useExtractionRunStats() {
  return useQuery({
    queryKey: [RUNS_KEY, "stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_extraction_runs")
        .select("status, strategy_used, concessionaria_code")
        .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());
      if (error) throw error;

      const runs = data || [];

      // Per-concessionária breakdown
      const byConc: Record<string, { total: number; success: number; partial: number; failed: number }> = {};
      for (const r of runs) {
        const code = r.concessionaria_code || "unknown";
        if (!byConc[code]) byConc[code] = { total: 0, success: 0, partial: 0, failed: 0 };
        byConc[code].total++;
        if (r.status === "success") byConc[code].success++;
        else if (r.status === "partial") byConc[code].partial++;
        else if (r.status === "failed") byConc[code].failed++;
      }

      return {
        total: runs.length,
        success: runs.filter(r => r.status === "success").length,
        partial: runs.filter(r => r.status === "partial").length,
        failed: runs.filter(r => r.status === "failed").length,
        nativeUsed: runs.filter(r => r.strategy_used === "native").length,
        providerUsed: runs.filter(r => r.strategy_used === "provider").length,
        byConcessionaria: byConc,
      };
    },
    staleTime: STALE_TIME,
  });
}
