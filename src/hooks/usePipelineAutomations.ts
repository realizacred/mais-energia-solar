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
        .select("metadata")
        .eq("id", automationId)
        .single();
        
      if (error) throw error;
      
      if (!data?.metadata || Object.keys(data.metadata).length === 0) {
        const { data: fullAuto } = await supabase
          .from("pipeline_automations")
          .select("*")
          .eq("id", automationId)
          .single();
          
        if (fullAuto) {
          const nodes: AutomationFlowNode[] = [
            {
              id: "trigger-1",
              type: "trigger",
              order: 0,
              config: {
                triggerType: fullAuto.tipo_gatilho as any,
                funil_id: fullAuto.projeto_funil_id || fullAuto.pipeline_id || undefined,
                etapa_id: fullAuto.projeto_etapa_id || fullAuto.stage_id || undefined,
              }
            },
            {
              id: "action-1",
              type: "action",
              order: 1,
              config: {
                actionType: fullAuto.tipo_acao as any,
                webhook_url: fullAuto.webhook_url || undefined,
                webhook_secret: fullAuto.webhook_secret || undefined,
                webhook_headers: fullAuto.webhook_headers as any,
                canal_notificacao: fullAuto.canal_notificacao || undefined,
                template_mensagem: fullAuto.template_mensagem || undefined,
                destino_etapa_id: fullAuto.destino_etapa_projeto_id || fullAuto.destino_stage_id || undefined,
              }
            }
          ];
          return { nodes } as AutomationFlow;
        }
      }
      
      return (data?.metadata as any as AutomationFlow) || { nodes: [] };
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
        ...basicData,
        metadata: flow as any,
        tipo_gatilho: trigger?.config.triggerType || "manual",
        tipo_acao: action?.config.actionType || "notificar_responsavel",
      };
      
      if (trigger?.config.funil_id) {
        // Gatilhos de projeto usam projeto_funil_id, deals usam pipeline_id
        const isLegacy = trigger.config.triggerType === "projeto_movido" || trigger.config.triggerType === "projeto_criado";
        if (isLegacy) {
          payload.projeto_funil_id = trigger.config.funil_id;
          payload.projeto_etapa_id = trigger.config.etapa_id;
        } else {
          payload.pipeline_id = trigger.config.funil_id;
          payload.stage_id = trigger.config.etapa_id;
        }
      }
      
      if (action?.config.actionType === "mover_etapa") {
        const isLegacy = trigger?.config.triggerType === "projeto_movido";
        if (isLegacy) {
          payload.destino_etapa_projeto_id = action.config.destino_etapa_id;
        } else {
          payload.destino_stage_id = action.config.destino_etapa_id;
        }
      }
      
      if (action?.config.webhook_url) {
        payload.webhook_url = action.config.webhook_url;
        payload.webhook_secret = action.config.webhook_secret;
        payload.webhook_headers = action.config.webhook_headers;
      }
      
      if (action?.config.template_mensagem) {
        payload.template_mensagem = action.config.template_mensagem;
        payload.canal_notificacao = action.config.canal_notificacao;
      }

      if (automationId) {
        const { error } = await supabase
          .from("pipeline_automations")
          .update(payload)
          .eq("id", automationId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("pipeline_automations")
          .insert(payload);
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
