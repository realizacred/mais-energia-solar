/**
 * useLeadOrigens — CRUD para origens de lead configuráveis.
 * §16: Queries só em hooks — §23: staleTime obrigatório.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface LeadOrigem {
  id: string;
  tenant_id: string;
  nome: string;
  ativo: boolean;
  ordem: number;
  created_at: string;
}

const QUERY_KEY = "lead_origens" as const;
const STALE_TIME = 1000 * 60 * 5;

/** Origens ativas — para dropdowns em formulários */
export function useLeadOrigensAtivas() {
  return useQuery<LeadOrigem[]>({
    queryKey: [QUERY_KEY, "ativas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_origens")
        .select("id, tenant_id, nome, ativo, ordem, created_at")
        .eq("ativo", true)
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as LeadOrigem[];
    },
    staleTime: STALE_TIME,
  });
}

/** Todas origens (ativas + inativas) — para admin */
export function useLeadOrigensTodas() {
  return useQuery<LeadOrigem[]>({
    queryKey: [QUERY_KEY, "todas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("lead_origens")
        .select("id, tenant_id, nome, ativo, ordem, created_at")
        .order("ordem", { ascending: true });
      if (error) throw error;
      return (data || []) as LeadOrigem[];
    },
    staleTime: STALE_TIME,
  });
}

export function useCriarLeadOrigem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: { nome: string; ordem?: number }) => {
      const { error } = await supabase
        .from("lead_origens")
        .insert({ nome: payload.nome, ordem: payload.ordem ?? 0 } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useAtualizarLeadOrigem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Partial<Pick<LeadOrigem, "nome" | "ativo" | "ordem">> }) => {
      const { error } = await supabase
        .from("lead_origens")
        .update(patch as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useDeletarLeadOrigem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      // Check if any leads reference this origin
      const { count, error: countErr } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("lead_origem_id", id);
      if (countErr) throw countErr;

      if (count && count > 0) {
        // Deactivate instead of delete
        const { error } = await supabase
          .from("lead_origens")
          .update({ ativo: false } as any)
          .eq("id", id);
        if (error) throw error;
        return { deactivated: true, count };
      }

      const { error } = await supabase
        .from("lead_origens")
        .delete()
        .eq("id", id);
      if (error) throw error;
      return { deactivated: false, count: 0 };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

export function useReordenarLeadOrigens() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (items: { id: string; ordem: number }[]) => {
      for (const item of items) {
        const { error } = await supabase
          .from("lead_origens")
          .update({ ordem: item.ordem } as any)
          .eq("id", item.id);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}
