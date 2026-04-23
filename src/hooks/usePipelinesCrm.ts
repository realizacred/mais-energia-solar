/**
 * usePipelinesCrm — lista pipelines ativos do tenant com contagem de stages.
 * Usado no Step 2 do wizard de migração SolarMarket para vincular um funil
 * do SM a um pipeline nativo do CRM.
 *
 * Governança:
 *  - RB-04: query em hook dedicado
 *  - RB-05: staleTime obrigatório
 *  - RB-58: mutation crítica usa .select() para confirmar gravação
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export interface PipelineCrmRow {
  id: string;
  name: string;
  qtd_stages: number;
}

export function usePipelinesCrm(tenantId: string | null | undefined) {
  return useQuery<PipelineCrmRow[]>({
    queryKey: ["pipelines-crm", tenantId],
    enabled: !!tenantId,
    staleTime: STALE_TIME,
    queryFn: async () => {
      const { data: pipelines, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .eq("tenant_id", tenantId!)
        .eq("is_active", true)
        .order("name");

      if (error) throw new Error(error.message);

      const ids = (pipelines ?? []).map((p) => p.id);
      if (ids.length === 0) return [];

      const { data: stages, error: stErr } = await supabase
        .from("pipeline_stages")
        .select("pipeline_id")
        .in("pipeline_id", ids);

      if (stErr) throw new Error(stErr.message);

      const counts = new Map<string, number>();
      for (const s of stages ?? []) {
        counts.set(s.pipeline_id, (counts.get(s.pipeline_id) ?? 0) + 1);
      }

      return (pipelines ?? []).map((p) => ({
        id: p.id,
        name: p.name,
        qtd_stages: counts.get(p.id) ?? 0,
      }));
    },
  });
}

interface CreatePipelineInput {
  tenantId: string;
  name: string;
}

export function useCreatePipelineCrm() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ tenantId, name }: CreatePipelineInput) => {
      const trimmed = name.trim();
      if (!trimmed) throw new Error("Informe um nome para o pipeline.");

      // RB-58: confirmar gravação com .select()
      const { data, error } = await supabase
        .from("pipelines")
        .insert({
          tenant_id: tenantId,
          name: trimmed,
          is_active: true,
        })
        .select("id, name")
        .single();

      if (error) throw new Error(error.message);
      if (!data) throw new Error("Falha ao criar pipeline.");
      return data as { id: string; name: string };
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["pipelines-crm", vars.tenantId] });
    },
  });
}
