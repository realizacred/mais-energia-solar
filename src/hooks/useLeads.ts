import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/errorHandler";
import type { Lead, LeadStatus } from "@/types/lead";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { leadService } from "@/services/leads/leadService";

const PAGE_SIZE = 50;

interface UseLeadsOptions {
  autoFetch?: boolean;
  pageSize?: number;
}

export interface VendedorFilter {
  id: string;
  nome: string;
}

export function useLeads({ autoFetch = true, pageSize = PAGE_SIZE }: UseLeadsOptions = {}) {
  const [page, setPage] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data, isLoading: loading, refetch: fetchLeads } = useQuery({
    queryKey: ["leads", page, pageSize],
    queryFn: () => leadService.fetchLeads({ page, pageSize }),
    enabled: autoFetch,
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  const leads = data?.leads || [];
  const statuses = data?.statuses || [];
  const totalCount = data?.totalCount || 0;

  const toggleVisto = useCallback(async (lead: Lead) => {
    const newVisto = !lead.visto_admin;
    
    // Optimistic update
    queryClient.setQueryData(["leads", page, pageSize], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        leads: old.leads.map((l: Lead) => (l.id === lead.id ? { ...l, visto_admin: newVisto } : l))
      };
    });
    
    try {
      await leadService.toggleVisto(lead.id, newVisto);
    } catch (error) {
      const appError = handleSupabaseError(error, "toggle_visto_lead", { entityId: lead.id });
      // Revert on error
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "Erro",
        description: appError.userMessage,
        variant: "destructive",
      });
    }
  }, [page, pageSize, queryClient, toast]);

  const archiveLead = useCallback(async (leadId: string) => {
    try {
      await leadService.delete(leadId);

      queryClient.invalidateQueries({ queryKey: ["leads"] });
      toast({
        title: "Lead excluído",
        description: "Lead e todos os vínculos (cliente, projetos, propostas, deals) foram removidos.",
      });
      return true;
    } catch (error) {
      const appError = handleSupabaseError(error, "delete_lead", { entityId: leadId });
      toast({
        title: "Erro",
        description: appError.userMessage,
        variant: "destructive",
      });
      return false;
    }
  }, [queryClient, toast]);

  const restoreLead = useCallback(async (leadId: string) => {
    try {
      await leadService.restore(leadId);

      toast({
        title: "Lead restaurado",
        description: "O lead foi restaurado com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["leads"] });
      return true;
    } catch (error) {
      const appError = handleSupabaseError(error, "restore_lead", { entityId: leadId });
      toast({
        title: "Erro",
        description: appError.userMessage,
        variant: "destructive",
      });
      return false;
    }
  }, [queryClient, toast]);

  // Realtime subscription
  useEffect(() => {
    if (!autoFetch) return;

    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          queryClient.invalidateQueries({ queryKey: ["leads"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autoFetch, queryClient]);

  const totalKwh = leads.reduce((acc, l) => acc + (l.media_consumo || 0), 0);
  const uniqueEstados = new Set(leads.map((l) => l.estado).filter(Boolean)).size;

  const vendedorFilterMap = new Map<string, string>();
  leads.forEach((l) => {
    if (l.consultor_id && l.consultor_nome) {
      vendedorFilterMap.set(l.consultor_id, l.consultor_nome);
    }
  });
  const uniqueVendedores: VendedorFilter[] = Array.from(vendedorFilterMap.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const estadosList = [...new Set(leads.map((l) => l.estado).filter(Boolean))].sort();
  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    leads,
    statuses,
    loading,
    fetchLeads,
    toggleVisto,
    deleteLead: archiveLead,
    restoreLead,
    page,
    setPage,
    totalCount,
    totalPages,
    pageSize,
    stats: {
      total: totalCount,
      totalKwh,
      uniqueEstados,
    },
    filters: {
      vendedores: uniqueVendedores,
      estados: estadosList,
    },
  };
}