import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/errorHandler";
import type { Lead, LeadStatus } from "@/types/lead";

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
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const from = page * pageSize;
      const to = from + pageSize - 1;

      const [leadsRes, statusesRes] = await Promise.all([
        supabase
          .from("leads")
          .select("*, consultores:consultor_id(id, nome), clientes!clientes_lead_id_fkey(id, potencia_kwp, valor_projeto)", { count: "exact" })
          .is("deleted_at", null)
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
        supabase
          .from("lead_status")
          .select("*")
          .order("ordem"),
      ]);

      if (leadsRes.error) throw leadsRes.error;

      // Resolve vendedor_nome from join, fallback to vendedor text
      // Also attach client data if lead was converted
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

      setLeads(enrichedLeads);
      setTotalCount(leadsRes.count || 0);
      
      if (statusesRes.data) {
        setStatuses(statusesRes.data);
      }
    } catch (error) {
      const appError = handleSupabaseError(error, "fetch_leads");
      toast({
        title: "Erro",
        description: appError.userMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, page, pageSize]);

  const toggleVisto = useCallback(async (lead: Lead) => {
    const newVisto = !lead.visto_admin;
    
    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === lead.id ? { ...l, visto_admin: newVisto } : l))
    );
    
    try {
      const { error } = await supabase
        .from("leads")
        .update({ visto_admin: newVisto })
        .eq("id", lead.id);
        
      if (error) throw error;
    } catch (error) {
      const appError = handleSupabaseError(error, "toggle_visto_lead", { entityId: lead.id });
      // Revert on error
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, visto_admin: lead.visto_admin } : l))
      );
      toast({
        title: "Erro",
        description: appError.userMessage,
        variant: "destructive",
      });
    }
  }, [toast]);

  const deleteLead = useCallback(async (leadId: string) => {
    try {
      // Soft delete: marca deleted_at em vez de remover do banco
      const { error } = await supabase
        .from("leads")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", leadId);

      if (error) throw error;

      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setTotalCount((prev) => prev - 1);
      toast({
        title: "Lead movido para lixeira",
        description: "O lead foi movido para a lixeira e pode ser restaurado.",
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
  }, [toast]);

  const restoreLead = useCallback(async (leadId: string) => {
    try {
      const { error } = await supabase
        .from("leads")
        .update({ deleted_at: null, deleted_by: null })
        .eq("id", leadId);

      if (error) throw error;

      toast({
        title: "Lead restaurado",
        description: "O lead foi restaurado com sucesso.",
      });
      fetchLeads();
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
  }, [toast, fetchLeads]);

  useEffect(() => {
    if (autoFetch) {
      fetchLeads();
    }
  }, [autoFetch, fetchLeads]);

  // ⚠️ HARDENING: Realtime subscription for cross-user sync
  useEffect(() => {
    if (!autoFetch) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('leads-realtime')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'leads' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchLeads(), 500);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'leads' },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as any;
            // Soft-deleted leads must be removed from active list
            if (updated.deleted_at) {
              setLeads(prev => prev.filter(l => l.id !== updated.id));
              setTotalCount(prev => Math.max(0, prev - 1));
              return;
            }
            setLeads(prev => prev.map(l =>
              l.id === updated.id
                ? {
                    ...l,
                    visto_admin: updated.visto_admin,
                    status_id: updated.status_id,
                    ultimo_contato: updated.ultimo_contato,
                    proxima_acao: updated.proxima_acao,
                    data_proxima_acao: updated.data_proxima_acao,
                    nome: updated.nome ?? l.nome,
                    telefone: updated.telefone ?? l.telefone,
                  }
                : l
            ));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'leads' },
        (payload) => {
          if (payload.old) {
            const deletedId = (payload.old as any).id;
            setLeads(prev => prev.filter(l => l.id !== deletedId));
            setTotalCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [autoFetch, fetchLeads]);

  // Computed values — use vendedor_id as source of truth for filters
  const totalKwh = leads.reduce((acc, l) => acc + l.media_consumo, 0);
  const uniqueEstados = new Set(leads.map((l) => l.estado)).size;

  // Build vendedor filter options from vendedor_id + resolved name
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
    deleteLead,
    restoreLead,
    // Pagination
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
