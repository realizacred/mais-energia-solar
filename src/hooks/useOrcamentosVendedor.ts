import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { LeadStatus } from "@/types/lead";

export interface OrcamentoVendedor {
  id: string;
  orc_code: string | null;
  lead_id: string;
  lead_code: string | null;
  nome: string;
  telefone: string;
  cep: string | null;
  estado: string;
  cidade: string;
  bairro: string | null;
  rua: string | null;
  numero: string | null;
  complemento: string | null;
  area: string;
  tipo_telhado: string;
  rede_atendimento: string;
  media_consumo: number;
  consumo_previsto: number;
  observacoes: string | null;
  arquivos_urls: string[];
  vendedor: string | null;
  visto: boolean;
  visto_admin: boolean;
  status_id: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  created_at: string;
  updated_at: string;
}

interface UseOrcamentosVendedorOptions {
  vendedorNome: string | null;
  isAdminMode?: boolean;
  filterByVendedor?: boolean; // Force filter even in admin mode (for "viewing as" feature)
}

export function useOrcamentosVendedor({ vendedorNome, isAdminMode = false, filterByVendedor = false }: UseOrcamentosVendedorOptions) {
  const [orcamentos, setOrcamentos] = useState<OrcamentoVendedor[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchOrcamentos = useCallback(async () => {
    if (!vendedorNome && !isAdminMode) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Build query for orcamentos joined with leads
      let query = supabase
        .from("orcamentos")
        .select(`
          *,
          leads!inner (id, lead_code, nome, telefone, telefone_normalized)
        `)
        .order("created_at", { ascending: false });

      // Filter by vendedor unless in admin mode viewing all
      // If filterByVendedor is true, always filter even in admin mode
      if (filterByVendedor && vendedorNome) {
        query = query.eq("vendedor", vendedorNome);
      } else if (!isAdminMode && vendedorNome) {
        query = query.eq("vendedor", vendedorNome);
      }

      const [orcRes, statusesRes] = await Promise.all([
        query,
        supabase
          .from("lead_status")
          .select("*")
          .order("ordem"),
      ]);

      if (orcRes.error) throw orcRes.error;

      // Transform data to include lead info
      const transformedData: OrcamentoVendedor[] = (orcRes.data || []).map((orc: any) => ({
        id: orc.id,
        orc_code: orc.orc_code,
        lead_id: orc.lead_id,
        lead_code: orc.leads?.lead_code || null,
        nome: orc.leads?.nome || "Desconhecido",
        telefone: orc.leads?.telefone || "",
        cep: orc.cep,
        estado: orc.estado,
        cidade: orc.cidade,
        bairro: orc.bairro,
        rua: orc.rua,
        numero: orc.numero,
        complemento: orc.complemento,
        area: orc.area,
        tipo_telhado: orc.tipo_telhado,
        rede_atendimento: orc.rede_atendimento,
        media_consumo: orc.media_consumo,
        consumo_previsto: orc.consumo_previsto,
        observacoes: orc.observacoes,
        arquivos_urls: orc.arquivos_urls || [],
        vendedor: orc.vendedor,
        visto: orc.visto,
        visto_admin: orc.visto_admin,
        status_id: orc.status_id,
        ultimo_contato: orc.ultimo_contato,
        proxima_acao: orc.proxima_acao,
        data_proxima_acao: orc.data_proxima_acao,
        created_at: orc.created_at,
        updated_at: orc.updated_at,
      }));

      setOrcamentos(transformedData);

      if (statusesRes.data) {
        setStatuses(statusesRes.data);
      }
    } catch (error) {
      console.error("Erro ao buscar orçamentos do vendedor:", error);
      toast({
        title: "Erro",
        description: "Não foi possível carregar os orçamentos.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [vendedorNome, isAdminMode, filterByVendedor, toast]);

  const toggleVisto = useCallback(async (orcamento: OrcamentoVendedor) => {
    const newVisto = !orcamento.visto;

    // Optimistic update
    setOrcamentos((prev) =>
      prev.map((o) => (o.id === orcamento.id ? { ...o, visto: newVisto } : o))
    );

    try {
      const { error } = await supabase
        .from("orcamentos")
        .update({ visto: newVisto })
        .eq("id", orcamento.id);

      if (error) throw error;
    } catch (error) {
      console.error("Erro ao atualizar visto:", error);
      // Revert on error
      setOrcamentos((prev) =>
        prev.map((o) => (o.id === orcamento.id ? { ...o, visto: orcamento.visto } : o))
      );
      toast({
        title: "Erro",
        description: "Não foi possível atualizar o status.",
        variant: "destructive",
      });
    }
  }, [toast]);

  const updateStatus = useCallback(async (orcamentoId: string, newStatusId: string | null) => {
    // Optimistic update
    setOrcamentos((prev) =>
      prev.map((o) =>
        o.id === orcamentoId
          ? { ...o, status_id: newStatusId, ultimo_contato: new Date().toISOString() }
          : o
      )
    );

    try {
      const { error } = await supabase
        .from("orcamentos")
        .update({ 
          status_id: newStatusId,
          ultimo_contato: new Date().toISOString(),
        })
        .eq("id", orcamentoId);

      if (error) throw error;
    } catch (error) {
      console.error("Erro ao atualizar status:", error);
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
    fetchOrcamentos();
  }, [fetchOrcamentos]);

  // Realtime subscription for orcamentos updates
  useEffect(() => {
    if (!vendedorNome && !isAdminMode) return;

    const channel = supabase
      .channel(`orcamentos-vendedor-${vendedorNome || 'admin'}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orcamentos',
        },
        (payload) => {
          console.log('Realtime update received:', payload.eventType);
          
          // For INSERT/DELETE, refetch to get lead info via join
          if (payload.eventType === 'INSERT' || payload.eventType === 'DELETE') {
            fetchOrcamentos();
            return;
          }
          
          // For UPDATE, apply changes locally without refetch (optimistic updates already done)
          if (payload.eventType === 'UPDATE' && payload.new) {
            const updated = payload.new as any;
            setOrcamentos((prev) => 
              prev.map((o) => 
                o.id === updated.id 
                  ? { 
                      ...o, 
                      visto: updated.visto,
                      visto_admin: updated.visto_admin,
                      status_id: updated.status_id,
                      ultimo_contato: updated.ultimo_contato,
                      proxima_acao: updated.proxima_acao,
                      data_proxima_acao: updated.data_proxima_acao,
                    } 
                  : o
              )
            );
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [vendedorNome, isAdminMode, fetchOrcamentos]);

  // Computed stats
  const stats = {
    total: orcamentos.length,
    novos: orcamentos.filter((o) => !o.visto).length,
    esteMes: orcamentos.filter((o) => {
      const date = new Date(o.created_at);
      const now = new Date();
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
    }).length,
  };

  const estados = [...new Set(orcamentos.map((o) => o.estado))].sort();

  return {
    orcamentos,
    statuses,
    loading,
    stats,
    estados,
    fetchOrcamentos,
    toggleVisto,
    updateStatus,
    deleteOrcamento,
  };
}
