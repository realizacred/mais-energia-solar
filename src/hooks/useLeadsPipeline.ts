/**
 * Hooks for LeadsPipeline data.
 * §16: Queries only in hooks. §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const LEADS_PAGE_SIZE = 25;

const LEADS_SELECT = "id, lead_code, nome, telefone, cidade, estado, media_consumo, consultor, status_id, created_at, ultimo_contato, visto";

export interface PipelineLead {
  id: string;
  lead_code: string | null;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  media_consumo: number;
  consultor: string | null;
  status_id: string | null;
  created_at: string;
  ultimo_contato?: string | null;
  visto?: boolean;
  potencia_kwp?: number | null;
  valor_projeto?: number | null;
  status_nome?: string | null;
}

export interface PipelineLeadStatus {
  id: string;
  nome: string;
  ordem: number;
  cor: string;
}

export interface PipelineMotivoPerda {
  id: string;
  nome: string;
}

/** Fetch paginated leads */
export function usePipelineLeads(page: number) {
  return useQuery({
    queryKey: ["pipeline_leads", page],
    queryFn: async () => {
      const from = page * LEADS_PAGE_SIZE;
      const to = from + LEADS_PAGE_SIZE - 1;
      const { data, error, count } = await supabase
        .from("leads")
        .select(LEADS_SELECT, { count: "exact" })
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .range(from, to);
      if (error) throw error;
      return { leads: (data ?? []) as PipelineLead[], totalCount: count ?? 0 };
    },
    staleTime: STALE_TIME,
  });
}

/** Fetch lead statuses */
export function usePipelineStatuses() {
  return useQuery({
    queryKey: ["pipeline_lead_statuses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_status")
        .select("id, nome, ordem, cor, motivo_perda_obrigatorio")
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as PipelineLeadStatus[];
    },
    staleTime: STALE_TIME,
  });
}

/** Fetch motivos de perda */
export function usePipelineMotivosPerda() {
  return useQuery({
    queryKey: ["pipeline_motivos_perda"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("motivos_perda")
        .select("id, nome")
        .eq("ativo", true)
        .order("ordem");
      if (error) throw error;
      return (data ?? []) as PipelineMotivoPerda[];
    },
    staleTime: STALE_TIME,
  });
}

/** Mutation: update lead fields */
export function useUpdatePipelineLead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Record<string, any> }) => {
      const { error } = await supabase.from("leads").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_leads"] });
    },
  });
}

/** Mutation: bulk update lead status */
export function useBulkUpdateLeadStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, status_id }: { ids: string[]; status_id: string }) => {
      const { error } = await supabase.from("leads").update({ status_id }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pipeline_leads"] });
    },
  });
}

export { LEADS_PAGE_SIZE };
