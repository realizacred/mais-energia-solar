import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;

export function useKanbanAutomations(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ["kanban-automations", pipelineId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_automations")
        .select("id, nome, ativo, stage_id, tipo_gatilho, tempo_horas, tipo_acao, destino_stage_id")
        .eq("pipeline_id", pipelineId!)
        .eq("ativo", true);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!pipelineId,
    staleTime: STALE_TIME,
  });
}

export function useKanbanStagePermissions(stageIds: string[]) {
  return useQuery({
    queryKey: ["kanban-stage-permissions", stageIds],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_stage_permissions")
        .select("stage_id, restricao_tipo")
        .in("stage_id", stageIds);
      if (error) throw error;
      const map = new Map<string, string>();
      (data || []).forEach((p: any) => map.set(p.stage_id, p.restricao_tipo));
      return map;
    },
    enabled: stageIds.length > 0,
    staleTime: STALE_TIME,
  });
}
