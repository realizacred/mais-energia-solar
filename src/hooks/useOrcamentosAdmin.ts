import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { LeadStatus } from "@/types/lead";

interface UseOrcamentosAdminOptions {
  autoFetch?: boolean;
}

export function useOrcamentosAdmin({ autoFetch = true }: UseOrcamentosAdminOptions = {}) {
  const [orcamentos, setOrcamentos] = useState<OrcamentoDisplayItem[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrcamentos = useCallback(async () => {
    try {
      setLoading(true);
      
      // Fetch orcamentos with lead data joined
      const [orcamentosRes, statusesRes] = await Promise.all([
        supabase
          .from("orcamentos")
          .select(`
            *,
            leads!inner (
              id,
              lead_code,
              nome,
              telefone,
              telefone_normalized
            )
          `)
          .order("created_at", { ascending: false }),
        supabase
          .from("lead_status")
          .select("*")
          .order("ordem"),
      ]);

      if (orcamentosRes.error) throw orcamentosRes.error;
      
      // Transform to flat display format
      const displayItems: OrcamentoDisplayItem[] = (orcamentosRes.data || []).map((orc: any) => ({
        id: orc.id,
        orc_code: orc.orc_code,
        lead_id: orc.lead_id,
        lead_code: orc.leads?.lead_code || null,
        nome: orc.leads?.nome || "",
        telefone: orc.leads?.telefone || "",
        cep: orc.cep,
        estado: orc.estado,
        cidade: orc.cidade,
        bairro: orc.bairro,
        rua: orc.rua,
        numero: orc.numero,
        area: orc.area,
        tipo_telhado: orc.tipo_telhado,
        rede_atendimento: orc.rede_atendimento,
        media_consumo: orc.media_consumo,
        consumo_previsto: orc.consumo_previsto,
        arquivos_urls: orc.arquivos_urls,
        observacoes: orc.observacoes,
        vendedor: orc.vendedor,
        status_id: orc.status_id,
        visto: orc.visto,
        visto_admin: orc.visto_admin,
        ultimo_contato: orc.ultimo_contato,
        proxima_acao: orc.proxima_acao,
        data_proxima_acao: orc.data_proxima_acao,
        created_at: orc.created_at,
        updated_at: orc.updated_at,
      }));

      setOrcamentos(displayItems);
      
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
  }, [toast]);

  const toggleVisto = useCallback(async (orcamento: OrcamentoDisplayItem) => {
    const newVisto = !orcamento.visto_admin;
    
    // Optimistic update
    setOrcamentos((prev) =>
      prev.map((o) => (o.id === orcamento.id ? { ...o, visto_admin: newVisto } : o))
    );
    
    try {
      const { error } = await supabase
        .from("orcamentos")
        .update({ visto_admin: newVisto })
        .eq("id", orcamento.id);
        
      if (error) throw error;
    } catch (error) {
      console.error("Erro ao atualizar visto:", error);
      // Revert on error
      setOrcamentos((prev) =>
        prev.map((o) => (o.id === orcamento.id ? { ...o, visto_admin: orcamento.visto_admin } : o))
      );
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  }, [toast]);

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

  // Realtime subscription for orcamentos updates
  useEffect(() => {
    if (!autoFetch) return;

    const channel = supabase
      .channel('orcamentos-admin-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orcamentos',
        },
        (payload) => {
          console.log('Realtime update received:', payload.eventType);
          // Refetch all data to ensure consistency with joins
          fetchOrcamentos();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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
