import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/errorHandler";
import type { Lead, LeadStatus } from "@/types/lead";
import { useQuery, useQueryClient } from "@tanstack/react-query";

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
    queryFn: async () => {
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const [leadsRes, statusesRes] = await Promise.all([
        supabase
          .from("leads")
          .select("id, nome, email, telefone, status_id, consultor_id, origem, media_consumo, valor_estimado, created_at, visto_admin, estado, cidade, consultores:consultor_id(id, nome), clientes!clientes_lead_id_fkey(id, potencia_kwp, valor_projeto)", { count: "exact" })
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
        supabase
          .from("lead_status")
          .select("id, nome, cor, ordem, probabilidade_peso, motivo_perda_obrigatorio")
          .order("ordem"),
      ]);

      if (leadsRes.error) throw leadsRes.error;

      const enrichedLeads: Lead[] = (leadsRes.data || []).map((l: any) => {
        const cliente = Array.isArray(l.clientes) ? l.clientes[0] : l.clientes;
        return {
          ...l,
          consultor_nome: l.consultores?.nome || l.consultor || null,
          cliente_potencia_kwp: cliente?.potencia_kwp ?? null,
          cliente_valor_projeto: cliente?.valor_projeto ?? null,
          cliente_id_vinculado: cliente?.id ?? null,
          consultores: undefined,
          clientes: undefined,
        };
      });

      return {
        leads: enrichedLeads,
        statuses: statusesRes.data || [],
        totalCount: leadsRes.count || 0,
      };
    },
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
      const { error } = await supabase
        .from("leads")
        .update({ visto_admin: newVisto })
        .eq("id", lead.id);
        
      if (error) throw error;
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
      const { error } = await supabase.rpc("delete_lead_cascade", { p_lead_id: leadId });
      if (error) throw error;

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
      const { data: defaultStatus, error: statusError } = await supabase
        .from("lead_status")
        .select("id")
        .neq("nome", "Arquivado")
        .order("ordem", { ascending: true })
        .limit(1)
        .single();

      if (statusError || !defaultStatus) {
        toast({
          title: "Erro",
          description: "Não foi possível determinar o status padrão para restauração.",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from("leads")
        .update({ status_id: defaultStatus.id })
        .eq("id", leadId);

      if (error) throw error;

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

  // ⚠️ HARDENING: Realtime subscription
  const handleRealtimeChanges = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["leads"] });
  }, [queryClient]);

  useEffect(() => {
    if (!autoFetch) return;

    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        handleRealtimeChanges
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [autoFetch, handleRealtimeChanges]);

  const totalKwh = leads.reduce((acc, l) => acc + l.media_consumo, 0);
  const uniqueEstados = new Set(leads.map((l) => l.estado)).size;

  const vendedorFilterMap = new Map<string, string>();
  leads.forEach((l) => {
    if (l.consultor_id && l.consultor_nome) {
      vendedorFilterMap.set(l.consultor_id, l.consultor_nome);
    }
  });
  const uniqueVendedores: VendedorFilter[] = Array.from(vendedorFilterMap.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const estadosList = [...new Set(leads.map((l) => l.estado))].sort();
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