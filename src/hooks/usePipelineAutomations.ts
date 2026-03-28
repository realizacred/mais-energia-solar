/**
 * Hook para CRUD de pipeline_automations (ProjetoAutomacaoConfig).
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface PipelineAutomation {
  id: string;
  nome: string;
  ativo: boolean;
  tipo_gatilho: string;
  tempo_horas: number;
  tipo_acao: string;
  destino_stage_id: string | null;
  notificar_responsavel: boolean;
  mensagem_notificacao: string | null;
  stage_id: string;
  pipeline_id: string;
  execucoes_total: number;
  ultima_execucao: string | null;
}

const QUERY_KEY = "pipeline-automations" as const;
const STALE_TIME = 1000 * 60 * 5;

export function usePipelineAutomations(pipelineId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      const { data, error } = await supabase
        .from("pipeline_automations")
        .select("id, nome, ativo, tipo_gatilho, tempo_horas, tipo_acao, destino_stage_id, notificar_responsavel, mensagem_notificacao, stage_id, pipeline_id, execucoes_total, ultima_execucao")
        .eq("pipeline_id", pipelineId)
        .order("created_at");
      if (error) throw error;
      return (data as PipelineAutomation[]) || [];
    },
    staleTime: STALE_TIME,
    enabled: !!pipelineId,
  });
}

export function useCriarAutomacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => {
      const { error } = await supabase
        .from("pipeline_automations")
        .insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useAtualizarAutomacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const { error } = await supabase
        .from("pipeline_automations")
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeletarAutomacao() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("pipeline_automations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
