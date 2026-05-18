import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AutomationFlow, AutomationFlowNode } from "@/types/automation-flow";

const QUERY_KEY = "pipeline-automations" as const;

export function useAutomationFlow(automationId: string | null) {
  return useQuery({
    queryKey: ["automation-flow", automationId],
    queryFn: async () => {
      if (!automationId) return { nodes: [] } as AutomationFlow;
      
      const { data, error } = await supabase
        .from("pipeline_automations")
        .select("*")
        .eq("id", automationId)
        .single();
        
      if (error) throw error;
      
      if (!data) return { nodes: [] } as AutomationFlow;

      // Se tem metadata com nodes, usa ele
      if ((data.metadata as any)?.nodes?.length > 0) {
        return data.metadata as any as AutomationFlow;
      }

      // Retrocompatibilidade: reconstruir do schema flat
      const nodes: AutomationFlowNode[] = [];
      
      if (data.tipo_gatilho) {
        nodes.push({
          id: 'trigger-1',
          type: 'trigger',
          order: 1,
          config: {
            triggerType: data.tipo_gatilho as any,
            funil_id: data.projeto_funil_id,
            etapa_id: data.projeto_etapa_id,
          }
        });
      }

      if (data.canal_notificacao) {
        nodes.push({
          id: 'action-1',
          type: 'action',
          order: 2,
          config: {
            actionType: data.canal_notificacao as any,
            webhook_url: data.webhook_url,
            wa_content_template: data.template_mensagem,
          }
        });
      }

      return { nodes } as AutomationFlow;
    },
    enabled: !!automationId,
    staleTime: 1000 * 60 * 5,
  });
}

export function useSaveAutomationFlow() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ 
      automationId, 
      flow, 
      basicData 
    }: { 
      automationId: string | null; 
      flow: AutomationFlow;
      basicData: { nome: string; ativo: boolean; tenant_id: string }
    }) => {
      // Map first trigger and action to root columns for indexing
      const trigger = flow.nodes.find(n => n.type === "trigger");
      const action = flow.nodes.find(n => n.type === "action");
      
      const payload: any = {
        tenant_id: basicData.tenant_id,
        nome: basicData.nome.trim(),
        ativo: basicData.ativo,
        tipo_gatilho: trigger?.config.triggerType ?? null,
        projeto_funil_id: trigger?.config.funil_id ?? null,
        projeto_etapa_id: trigger?.config.etapa_id ?? null,
        canal_notificacao: action?.config.actionType ?? null,
        webhook_url: action?.config.webhook_url ?? null,
        template_mensagem: action?.config.wa_content_template ?? null,
        metadata: flow as any,
      };

      if (automationId) {
        const { error } = await supabase
          .from("pipeline_automations")
          .update(payload)
          .eq("id", automationId)
          .eq("tenant_id", basicData.tenant_id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pipeline_automations")
          .insert([payload]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["automation-flow"] });
    },
  });
}

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
  stage_id: string | null;
  pipeline_id: string | null;
  projeto_funil_id: string | null;
  projeto_etapa_id: string | null;
  destino_etapa_projeto_id: string | null;
  execucoes_total: number;
  ultima_execucao: string | null;
}

const STALE_TIME = 1000 * 60 * 5;

export function usePipelineAutomations(pipelineId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      const { data, error } = await supabase
        .from("pipeline_automations")
        .select("*")
        .or(`pipeline_id.eq.${pipelineId},projeto_funil_id.eq.${pipelineId}`)
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
