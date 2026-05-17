import { useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Orcamento, OrcamentoWithLead } from "@/types/orcamento";
import type { LeadStatus } from "@/types/lead";
import { orcamentoService } from "@/services/leads/orcamentoService";

const QUERY_KEY = "orcamentos" as const;

interface UseOrcamentosOptions {
  autoFetch?: boolean;
  leadId?: string;
}

export function useOrcamentos({ autoFetch = true, leadId }: UseOrcamentosOptions = {}) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading: loading, refetch: fetchOrcamentos } = useQuery({
    queryKey: [QUERY_KEY, leadId],
    queryFn: () => orcamentoService.fetchOrcamentos(leadId),
    enabled: autoFetch,
    staleTime: 2 * 60 * 1000,
  });

  const orcamentos = data?.orcamentos || [];
  const statuses = data?.statuses || [];

  const toggleVistoMutation = useMutation({
    mutationFn: (params: { orcamento: Orcamento; field: "visto" | "visto_admin" }) => {
      const newVisto = !params.orcamento[params.field];
      return orcamentoService.toggleVisto(params.orcamento.id, params.field, newVisto);
    },
    onMutate: async ({ orcamento, field }) => {
      await queryClient.cancelQueries({ queryKey: [QUERY_KEY, leadId] });
      const previous = queryClient.getQueryData([QUERY_KEY, leadId]);
      
      queryClient.setQueryData([QUERY_KEY, leadId], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          orcamentos: old.orcamentos.map((o: any) => 
            o.id === orcamento.id ? { ...o, [field]: !o[field] } : o
          )
        };
      });
      
      return { previous };
    },
    onError: (err, variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData([QUERY_KEY, leadId], context.previous);
      }
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, leadId] });
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: (params: { orcamentoId: string; statusId: string | null }) => 
      orcamentoService.updateStatus(params.orcamentoId, params.statusId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, leadId] });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (orcamentoId: string) => orcamentoService.delete(orcamentoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY, leadId] });
      toast({
        title: "Orçamento excluído",
        description: "O orçamento foi excluído com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro",
        description: "Não foi possível excluir o orçamento.",
        variant: "destructive",
      });
    }
  });

  // Realtime subscription
  useEffect(() => {
    if (!autoFetch) return;

    const channel = supabase
      .channel('orcamentos-base-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, () => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEY, leadId] });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'leads' }, () => {
        queryClient.invalidateQueries({ queryKey: [QUERY_KEY, leadId] });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autoFetch, leadId, queryClient]);

  const toggleVisto = useCallback((orcamento: Orcamento, field: "visto" | "visto_admin" = "visto_admin") => {
    toggleVistoMutation.mutate({ orcamento, field });
  }, [toggleVistoMutation]);

  const updateStatus = useCallback((orcamentoId: string, statusId: string | null) => {
    updateStatusMutation.mutate({ orcamentoId, statusId });
  }, [updateStatusMutation]);

  const deleteOrcamento = useCallback(async (orcamentoId: string) => {
    try {
      await deleteMutation.mutateAsync(orcamentoId);
      return true;
    } catch {
      return false;
    }
  }, [deleteMutation]);

  const totalKwh = orcamentos.reduce((acc, o) => acc + (o.media_consumo || 0), 0);
  const uniqueEstados = new Set(orcamentos.map((o) => o.estado).filter(Boolean)).size;
  const uniqueVendedores = [...new Set(orcamentos.map((o) => o.vendedor).filter(Boolean))] as string[];
  const estadosList = [...new Set(orcamentos.map((o) => o.estado).filter(Boolean))].sort();

  return {
    orcamentos,
    statuses,
    loading: loading && !data,
    fetchOrcamentos,
    toggleVisto,
    updateStatus,
    deleteOrcamento,
    stats: {
      total: orcamentos.length,
      totalKwh,
      uniqueEstados,
    },
    filters: {
      vendedores: uniqueVendedores,
      estados: estadosList,
    },
  };
}
