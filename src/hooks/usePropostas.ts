/**
 * usePropostas.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * 
 * Read model via RPC proposal_list (single query, server-side joins).
 */

import { useCallback, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { proposalService } from "@/services/proposal/proposalService";
import type { Proposta, PropostaFilters, PropostaFormData } from "@/services/proposal/types";

const STALE_TIME = 1000 * 60 * 5; // 5 min
const QUERY_KEY = "propostas-listagem" as const;
const PAGE_SIZE = 50;

export type { Proposta, PropostaFilters, PropostaFormData };

function usePropostasRealtimeSync() {
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const invalidate = () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
        queryClient.invalidateQueries({ queryKey: ["deal-pipeline"] });
        queryClient.invalidateQueries({ queryKey: ["proposal-detail"] });
        queryClient.invalidateQueries({ queryKey: ["deal-proposals-count"] });
      }, 400);
    };

    const channel = supabase
      .channel("propostas-listagem-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "propostas_nativas" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "proposta_versoes" }, invalidate)
      .on("postgres_changes", { event: "*", schema: "public", table: "generated_documents" }, invalidate)
      .subscribe();

    const handleVisibility = () => {
      if (document.visibilityState === "visible") invalidate();
    };

    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [queryClient]);
}

/**
 * Hook para listar propostas via RPC proposal_list.
 * Suporta filtros e paginação server-side.
 */
export function usePropostas(filters: PropostaFilters = {}) {
  const queryClient = useQueryClient();
  const filtersKey = JSON.stringify(filters);

  usePropostasRealtimeSync();

  const { data, isLoading: loading } = useQuery({
    queryKey: [QUERY_KEY, filtersKey],
    queryFn: () => proposalService.fetchPropostas(filters, PAGE_SIZE),
    staleTime: STALE_TIME,
  });

  const propostas = data?.propostas ?? [];
  const total = data?.total ?? 0;

  const createMutation = useMutation({
    mutationFn: (data: PropostaFormData) => proposalService.create(data),
    onSuccess: () => {
      toast({ title: "Proposta criada com sucesso!" });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar proposta", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => proposalService.delete(id),
    onSuccess: () => {
      toast({ title: "Proposta excluída" });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["deal-pipeline"] });
      queryClient.invalidateQueries({ queryKey: ["propostas-projeto-tab"] });
      queryClient.invalidateQueries({ queryKey: ["projeto-detalhe"] });
      queryClient.invalidateQueries({ queryKey: ["deal-proposals-count"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: (params: { id: string; status: string; motivo?: string }) => 
      proposalService.updateStatus(params.id, params.status, params.motivo),
    onSuccess: (result: any) => {
      toast({ title: `Status atualizado para "${result.new_status}"` });
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      queryClient.invalidateQueries({ queryKey: ["projeto-detalhe"] });
      queryClient.invalidateQueries({ queryKey: ["deal-proposals-count"] });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao atualizar status", description: err.message, variant: "destructive" });
    },
  });

  const createProposta = useCallback(
    async (data: PropostaFormData) => {
      try {
        await createMutation.mutateAsync(data);
        return true;
      } catch {
        return false;
      }
    },
    [createMutation]
  );

  const deleteProposta = useCallback(
    (id: string) => deleteMutation.mutate(id),
    [deleteMutation]
  );

  const updateStatus = useCallback(
    (id: string, status: string, motivo?: string) => updateStatusMutation.mutate({ id, status, motivo }),
    [updateStatusMutation]
  );

  return {
    propostas,
    total,
    loading,
    creating: createMutation.isPending,
    fetchPropostas: () => queryClient.invalidateQueries({ queryKey: [QUERY_KEY] }),
    createProposta,
    deleteProposta,
    updateStatus,
  };
}
