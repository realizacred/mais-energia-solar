import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Orcamento, OrcamentoWithLead } from "@/types/orcamento";
import type { LeadStatus } from "@/types/lead";

interface UseOrcamentosOptions {
  autoFetch?: boolean;
  leadId?: string;
}

export function useOrcamentos({ autoFetch = true, leadId }: UseOrcamentosOptions = {}) {
  const [orcamentos, setOrcamentos] = useState<OrcamentoWithLead[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrcamentos = useCallback(async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from("orcamentos")
        .select(`
          *,
          lead:leads!inner(
            id,
            lead_code,
            nome,
            telefone,
            telefone_normalized
          )
        `)
        .order("created_at", { ascending: false });

      if (leadId) {
        query = query.eq("lead_id", leadId);
      }

      const [orcamentosRes, statusesRes] = await Promise.all([
        query,
        supabase.from("lead_status").select("*").order("ordem"),
      ]);

      if (orcamentosRes.error) throw orcamentosRes.error;
      
      // Transform the response to match our type
      const transformedOrcamentos: OrcamentoWithLead[] = (orcamentosRes.data || []).map((orc: any) => ({
        ...orc,
        lead: orc.lead,
      }));
      
      setOrcamentos(transformedOrcamentos);
      
      if (statusesRes.data) {
        setStatuses(statusesRes.data);
      }
    } catch (error) {
      console.error("Erro ao buscar orçamentos:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os orçamentos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, leadId]);

  const toggleVisto = useCallback(async (orcamento: Orcamento, field: "visto" | "visto_admin" = "visto_admin") => {
    const newVisto = !orcamento[field];
    
    // Optimistic update
    setOrcamentos((prev) =>
      prev.map((o) => (o.id === orcamento.id ? { ...o, [field]: newVisto } : o))
    );
    
    try {
      const { error } = await supabase
        .from("orcamentos")
        .update({ [field]: newVisto })
        .eq("id", orcamento.id);
        
      if (error) throw error;
    } catch (error) {
      console.error("Erro ao atualizar visto:", error);
      // Revert on error
      setOrcamentos((prev) =>
        prev.map((o) => (o.id === orcamento.id ? { ...o, [field]: !newVisto } : o))
      );
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const updateStatus = useCallback(async (orcamentoId: string, statusId: string | null) => {
    // Optimistic update
    setOrcamentos((prev) =>
      prev.map((o) => 
        o.id === orcamentoId 
          ? { ...o, status_id: statusId, ultimo_contato: new Date().toISOString() } 
          : o
      )
    );
    
    try {
      const { error } = await supabase
        .from("orcamentos")
        .update({ 
          status_id: statusId,
          ultimo_contato: new Date().toISOString(),
        })
        .eq("id", orcamentoId);
        
      if (error) throw error;
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
      // Revert on error - need to refetch to get correct state
      fetchOrcamentos();
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  }, [toast, fetchOrcamentos]);

  const deleteOrcamento = useCallback(async (orcamentoId: string) => {
    try {
      const { error } = await supabase
        .from("orcamentos")
        .delete()
        .eq("id", orcamentoId);

      if (error) throw error;

      setOrcamentos((prev) => prev.filter((o) => o.id !== orcamentoId));
      toast({
        title: "Orçamento excluído",
        description: "O orçamento foi excluído com sucesso.",
      });
      return true;
    } catch (error) {
      console.error("Erro ao excluir orçamento:", error);
      toast({
        title: "Erro",
        description: "Não foi possível excluir o orçamento.",
        variant: "destructive",
      });
      return false;
    }
  }, [toast]);

  useEffect(() => {
    if (autoFetch) {
      fetchOrcamentos();
    }
  }, [autoFetch, fetchOrcamentos]);

  // Computed values
  const totalKwh = orcamentos.reduce((acc, o) => acc + o.media_consumo, 0);
  const uniqueEstados = new Set(orcamentos.map((o) => o.estado)).size;
  const uniqueVendedores = [...new Set(orcamentos.map((o) => o.vendedor).filter(Boolean))] as string[];
  const estadosList = [...new Set(orcamentos.map((o) => o.estado))].sort();

  return {
    orcamentos,
    statuses,
    loading,
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
