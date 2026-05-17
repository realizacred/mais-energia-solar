import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

export type ValidationType = 
  | 'documento_obrigatorio' 
  | 'valor_minimo' 
  | 'campo_preenchido' 
  | 'fornecedor_vinculado' 
  | 'aprovacao_manual';

export interface StageValidation {
  id: string;
  tenant_id: string;
  stage_id: string;
  tipo_validacao: ValidationType;
  configuracao: any;
  mensagem_bloqueio: string | null;
  bloquear_avanco: boolean;
  ativo: boolean;
  created_at: string;
}

export function useStageValidations(stageId?: string) {
  return useQuery({
    queryKey: ["stage_validations", stageId],
    enabled: !!stageId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("pipeline_stage_validations")
        .select("*")
        .eq("stage_id", stageId)
        .eq("ativo", true)
        .order("created_at");
      if (error) throw error;
      return data as StageValidation[];
    },
  });
}

export function usePipelineStageValidations(pipelineId?: string) {
  return useQuery({
    queryKey: ["pipeline_validations", pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data: stages } = await supabase
        .from("pipeline_stages")
        .select("id")
        .eq("pipeline_id", pipelineId);
      
      if (!stages || stages.length === 0) return [];
      
      const stageIds = stages.map(s => s.id);
      
      const { data, error } = await (supabase as any)
        .from("pipeline_stage_validations")
        .select("*")
        .in("stage_id", stageIds)
        .order("created_at");
      if (error) throw error;
      return data as StageValidation[];
    },
  });
}

export function useSaveStageValidation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (payload: Partial<StageValidation>) => {
      const { tenantId } = await getCurrentTenantId();
      
      if (payload.id) {
        const { data, error } = await (supabase as any)
          .from("pipeline_stage_validations")
          .update(payload)
          .eq("id", payload.id)
          .select()
          .single();
        if (error) throw error;
        return data;
      } else {
        const { data, error } = await (supabase as any)
          .from("pipeline_stage_validations")
          .insert({ ...payload, tenant_id: tenantId })
          .select()
          .single();
        if (error) throw error;
        return data;
      }
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stage_validations", variables.stage_id] });
      queryClient.invalidateQueries({ queryKey: ["pipeline_validations"] });
    },
  });
}

export function useDeleteStageValidation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id }: { id: string, stage_id: string }) => {
      const { error } = await (supabase as any)
        .from("pipeline_stage_validations")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["stage_validations", variables.stage_id] });
      queryClient.invalidateQueries({ queryKey: ["pipeline_validations"] });
    },
  });
}
