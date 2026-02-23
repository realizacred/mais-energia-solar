import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { handleSupabaseError } from "@/lib/errorHandler";
import type { OrcamentoDisplayItem } from "@/types/orcamento";
import type { LeadStatus } from "@/types/lead";
import type { VendedorFilter } from "@/hooks/useLeads";

const PAGE_SIZE = 25;

// ⚠️ HARDENING: Explicit columns — never SELECT * on hot paths
const ORC_ADMIN_SELECT = `
  id, orc_code, lead_id, cep, estado, cidade, bairro, rua, numero, complemento,
  area, tipo_telhado, rede_atendimento, media_consumo, consumo_previsto,
  observacoes, arquivos_urls, consultor, consultor_id, visto, visto_admin,
  status_id, ultimo_contato, proxima_acao, data_proxima_acao, created_at, updated_at,
  leads!inner (
    id, lead_code, nome, telefone, telefone_normalized,
    consultor_id, consultor,
    consultores:consultor_id(id, nome)
  ),
  orc_consultores:consultor_id(id, nome)
`;

interface UseOrcamentosAdminOptions {
  autoFetch?: boolean;
  pageSize?: number;
}

export function useOrcamentosAdmin({ autoFetch = true, pageSize = PAGE_SIZE }: UseOrcamentosAdminOptions = {}) {
  const [orcamentos, setOrcamentos] = useState<OrcamentoDisplayItem[]>([]);
  const [statuses, setStatuses] = useState<LeadStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const fetchOrcamentos = useCallback(async () => {
    try {
      setLoading(true);
      const from = page * pageSize;
      const to = from + pageSize - 1;
      
      const [orcamentosRes, statusesRes] = await Promise.all([
        supabase
          .from("orcamentos")
          .select(ORC_ADMIN_SELECT, { count: "exact" })
          .order("created_at", { ascending: false })
          .order("id", { ascending: false })
          .range(from, to),
        supabase
          .from("lead_status")
          .select("id, nome, ordem, cor")
          .order("ordem"),
      ]);

      if (orcamentosRes.error) throw orcamentosRes.error;
      
      // Transform to flat display format
      const displayItems: OrcamentoDisplayItem[] = (orcamentosRes.data || []).map((orc: any) => {
        const leadVendedorNome = orc.orc_consultores?.nome || orc.leads?.consultores?.nome || orc.leads?.consultor || orc.consultor || null;
        const leadVendedorId = orc.consultor_id || orc.leads?.consultor_id || null;

        return {
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
          complemento: orc.complemento || null,
          area: orc.area,
          tipo_telhado: orc.tipo_telhado,
          rede_atendimento: orc.rede_atendimento,
          media_consumo: orc.media_consumo,
          consumo_previsto: orc.consumo_previsto,
          arquivos_urls: orc.arquivos_urls,
          observacoes: orc.observacoes,
          vendedor: orc.consultor, // keep text for backward compat
          vendedor_id: leadVendedorId,
          vendedor_nome: leadVendedorNome,
          status_id: orc.status_id,
          visto: orc.visto,
          visto_admin: orc.visto_admin,
          ultimo_contato: orc.ultimo_contato,
          proxima_acao: orc.proxima_acao,
          data_proxima_acao: orc.data_proxima_acao,
          created_at: orc.created_at,
          updated_at: orc.updated_at,
        };
      });

      setOrcamentos(displayItems);
      setTotalCount(orcamentosRes.count || 0);
      
      if (statusesRes.data) {
        setStatuses(statusesRes.data);
      }
    } catch (error) {
      const appError = handleSupabaseError(error, "fetch_orcamentos");
      toast({
        title: "Erro",
        description: appError.userMessage,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast, page, pageSize]);

  const toggleVisto = useCallback(async (orcamento: OrcamentoDisplayItem) => {
    const newVisto = !orcamento.visto_admin;
    
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
      const appError = handleSupabaseError(error, "toggle_visto_orcamento", { entityId: orcamento.id });
      setOrcamentos((prev) =>
        prev.map((o) => (o.id === orcamento.id ? { ...o, visto_admin: orcamento.visto_admin } : o))
      );
      toast({
        title: "Erro",
        description: appError.userMessage,
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
      setTotalCount((prev) => prev - 1);
      toast({
        title: "Orçamento excluído",
        description: "O orçamento foi excluído com sucesso.",
      });
      return true;
    } catch (error) {
      const appError = handleSupabaseError(error, "delete_orcamento", { entityId: orcamentoId });
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
      fetchOrcamentos();
    }
  }, [autoFetch, fetchOrcamentos]);

  // ⚠️ HARDENING: Realtime with debounce, local updates for UPDATE, no full refetch
  useEffect(() => {
    if (!autoFetch) return;

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const channel = supabase
      .channel('orcamentos-admin-changes')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'orcamentos' },
        () => {
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchOrcamentos(), 500);
        }
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'orcamentos' },
        (payload) => {
          if (payload.new) {
            const updated = payload.new as any;
            setOrcamentos(prev => prev.map(o =>
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
            ));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'orcamentos' },
        (payload) => {
          if (payload.old) {
            const deletedId = (payload.old as any).id;
            setOrcamentos(prev => prev.filter(o => o.id !== deletedId));
            setTotalCount(prev => Math.max(0, prev - 1));
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'leads' },
        () => {
          // Lead name/phone/status changed — debounced refetch
          if (debounceTimer) clearTimeout(debounceTimer);
          debounceTimer = setTimeout(() => fetchOrcamentos(), 800);
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [autoFetch, fetchOrcamentos]);

  // Computed values — filter by vendedor_id
  const totalKwh = orcamentos.reduce((acc, o) => acc + o.media_consumo, 0);
  const uniqueEstados = new Set(orcamentos.map((o) => o.estado)).size;

  const vendedorFilterMap = new Map<string, string>();
  orcamentos.forEach((o) => {
    if (o.vendedor_id && o.vendedor_nome) {
      vendedorFilterMap.set(o.vendedor_id, o.vendedor_nome);
    }
  });
  const uniqueVendedores: VendedorFilter[] = Array.from(vendedorFilterMap.entries())
    .map(([id, nome]) => ({ id, nome }))
    .sort((a, b) => a.nome.localeCompare(b.nome));

  const estadosList = [...new Set(orcamentos.map((o) => o.estado))].sort();

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    orcamentos,
    statuses,
    loading,
    fetchOrcamentos,
    toggleVisto,
    deleteOrcamento,
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
