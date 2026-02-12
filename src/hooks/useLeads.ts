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
          .select("*, vendedores:vendedor_id(id, nome)", { count: "exact" })
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
      const enrichedLeads: Lead[] = (leadsRes.data || []).map((l: any) => ({
        ...l,
        vendedor_nome: l.vendedores?.nome || l.vendedor || null,
        vendedores: undefined, // clean up join artifact
      }));

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
      const { error } = await supabase
        .from("leads")
        .delete()
        .eq("id", leadId);

      if (error) throw error;

      setLeads((prev) => prev.filter((l) => l.id !== leadId));
      setTotalCount((prev) => prev - 1);
      toast({
        title: "Lead excluído",
        description: "O lead foi excluído com sucesso.",
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

  useEffect(() => {
    if (autoFetch) {
      fetchLeads();
    }
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
