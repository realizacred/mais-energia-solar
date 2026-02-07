import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Lead, LeadStatus } from "@/types/lead";

interface UseLeadsOptions {
  autoFetch?: boolean;
}

export function useLeads({ autoFetch = true }: UseLeadsOptions = {}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchLeads = useCallback(async () => {
    try {
      setLoading(true);
      const [leadsRes, statusesRes] = await Promise.all([
        supabase
          .from("leads")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("lead_status")
          .select("*")
          .order("ordem"),
      ]);

      if (leadsRes.error) throw leadsRes.error;
      setLeads(leadsRes.data || []);
      
      if (statusesRes.data) {
        setStatuses(statusesRes.data);
      }
    } catch (error) {
      console.error("Erro ao buscar leads:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os leads.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

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
      console.error("Erro ao atualizar visto:", error);
      // Revert on error
      setLeads((prev) =>
        prev.map((l) => (l.id === lead.id ? { ...l, visto_admin: lead.visto_admin } : l))
      );
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
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
      toast({
        title: "Lead excluído",
        description: "O lead foi excluído com sucesso.",
      });
      return true;
    } catch (error) {
      console.error("Erro ao excluir lead:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o lead.",
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

  // Computed values
  const totalKwh = leads.reduce((acc, l) => acc + l.media_consumo, 0);
  const uniqueEstados = new Set(leads.map((l) => l.estado)).size;
  const uniqueVendedores = [...new Set(leads.map((l) => l.vendedor).filter(Boolean))] as string[];
  const estadosList = [...new Set(leads.map((l) => l.estado))].sort();

  return {
    leads,
    statuses,
    loading,
    fetchLeads,
    toggleVisto,
    deleteLead,
    stats: {
      total: leads.length,
      totalKwh,
      uniqueEstados,
    },
    filters: {
      vendedores: uniqueVendedores,
      estados: estadosList,
    },
  };
}
