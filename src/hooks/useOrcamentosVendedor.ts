import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { LeadStatus } from "@/types/lead";
import { toCanonicalPhoneDigits } from "@/utils/phone/toCanonicalPhoneDigits";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { buildOperationalFilters, getTerminalStatusIds, calculateOperationalStats } from "@/modules/orcamentos/utils/operationalFilters";

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
  vendedor_id: string | null;
  visto: boolean;
  visto_admin: boolean;
  status_id: string | null;
  ultimo_contato: string | null;
  proxima_acao: string | null;
  data_proxima_acao: string | null;
  created_at: string;
  updated_at: string;
  proposta_token?: string | null;
}

interface UseOrcamentosVendedorOptions {
  vendedorId: string | null;
  vendedorNome: string | null;
  isAdminMode?: boolean;
  filterByVendedor?: boolean;
  searchTerm?: string;
  filterVisto?: string;
  filterEstado?: string;
  filterStatus?: string;
  excludeTerminal?: boolean;
  maxAgeDays?: number | null;
  operationalStatus?: string;
}

const VENDEDOR_PAGE_SIZE = 50;

const ORC_SELECT = `
  id, orc_code, lead_id, cep, estado, cidade, bairro, rua, numero, complemento,
  area, tipo_telhado, rede_atendimento, media_consumo, consumo_previsto,
  observacoes, arquivos_urls, consultor, consultor_id, visto, visto_admin,
  status_id, ultimo_contato, proxima_acao, data_proxima_acao, created_at, updated_at,
  leads!inner (
    id, lead_code, nome, telefone, telefone_normalized,
    propostas_nativas(id, status, public_token)
  )
`;

function mapRow(orc: any): OrcamentoVendedor {
  const propostas = orc.leads?.propostas_nativas || [];
  const propostaAtiva = propostas.find((p: any) => p.status === 'aceita') || 
                        propostas.find((p: any) => p.status === 'enviada') || 
                        propostas[0];

  return {
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
    vendedor: orc.consultor,
    vendedor_id: orc.consultor_id || null,
    visto: orc.visto,
    visto_admin: orc.visto_admin,
    status_id: orc.status_id,
    ultimo_contato: orc.ultimo_contato,
    proxima_acao: orc.proxima_acao,
    data_proxima_acao: orc.data_proxima_acao,
    created_at: orc.created_at,
    updated_at: orc.updated_at,
    proposta_token: propostaAtiva?.public_token || null,
  };
}

export function useOrcamentosVendedor({
  vendedorId,
  vendedorNome,
  isAdminMode = false,
  filterByVendedor = false,
  searchTerm = "",
  filterVisto = "todos",
  filterEstado = "todos",
  filterStatus = "todos",
  excludeTerminal = false,
  maxAgeDays = null, 
  operationalStatus = "todos",
}: UseOrcamentosVendedorOptions) {
  const isViewingAsVendedor = filterByVendedor;
  const [page, setPage] = useState(0);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const mustFilterByVendedor = (filterByVendedor || !isAdminMode) && (!!vendedorId || !!vendedorNome);

  const { data, isLoading: loading, refetch: fetchOrcamentos } = useQuery({
    queryKey: ["orcamentos-vendedor", vendedorId, vendedorNome, isAdminMode, searchTerm, filterVisto, filterEstado, filterStatus, page, excludeTerminal, maxAgeDays, operationalStatus, isViewingAsVendedor],
    queryFn: async () => {
      if (!vendedorId && !vendedorNome && !isAdminMode) {
        return { orcamentos: [], totalCount: 0, statuses: [], serverStats: null };
      }

      const from = page * VENDEDOR_PAGE_SIZE;
      const to = from + VENDEDOR_PAGE_SIZE - 1;

      // Stats fetch
      const { data: serverStats } = await supabase.rpc("get_consultor_stats", {
        _consultor_id: vendedorId,
        _consultor_nome: vendedorNome,
        _is_admin: isAdminMode
      });

      const buildBase = (terminalIds: string[] = []) => {
        let q = supabase
          .from("orcamentos")
          .select(ORC_SELECT, { count: "exact" })
          .order("created_at", { ascending: false });

        return buildOperationalFilters(q, {
          filterVisto,
          filterEstado,
          filterStatus,
          excludeTerminal,
          maxAgeDays, operationalStatus
        }, terminalIds);
      };

      let searchLeadIds: string[] | null = null;
      let searchActive = false;
      const term = (searchTerm || "").trim();
      if (term) {
        searchActive = true;
        const digits = toCanonicalPhoneDigits(term) || term.replace(/\D/g, "");
        const leadOr: string[] = [`nome.ilike.%${term}%`, `lead_code.ilike.%${term}%`];
        if (digits && digits.length >= 4) leadOr.push(`telefone_normalized.ilike.%${digits}%`);
        const { data: matchingLeads } = await supabase
          .from("leads")
          .select("id")
          .or(leadOr.join(","))
          .limit(500);
        searchLeadIds = (matchingLeads || []).map((l: any) => l.id);
      }

      const applySearch = (q: any) => {
        if (!searchActive) return q;
        const orParts: string[] = [`orc_code.ilike.%${term}%`, `cidade.ilike.%${term}%`];
        if (searchLeadIds && searchLeadIds.length > 0) {
          orParts.push(`lead_id.in.(${searchLeadIds.join(",")})`);
        }
        return q.or(orParts.join(","));
      };

      const statusesRes = await supabase.from("lead_status").select("id, nome, ordem, cor").order("ordem");
      const allStatuses = statusesRes.data || [];
      const terminalStatusIds = getTerminalStatusIds(allStatuses);

      let primaryRows: any[] = [];
      let primaryCount = 0;
      let legacyRows: any[] = [];

      if (mustFilterByVendedor) {
        if (vendedorId) {
          // RB-76 Fix: Filter by both consultor_id (direct user ID) OR consultor_id in leads table
          // Note: some leads might have consultores.id, others auth.users.id
          // We apply the filter rigorously
          const q1 = applySearch(buildBase(terminalStatusIds).eq("consultor_id", vendedorId)).range(from, to);
          const r1 = await q1;
          if (r1.error) throw r1.error;
          primaryRows = r1.data || [];
          primaryCount = r1.count || 0;
        }

        if (page === 0 && vendedorNome) {
          const q2 = applySearch(buildBase(terminalStatusIds).is("consultor_id", null).eq("consultor", vendedorNome)).limit(100);
          const r2 = await q2;
          if (!r2.error && r2.data) legacyRows = r2.data;
        }
      } else {
        const q1 = applySearch(buildBase(terminalStatusIds)).range(from, to);
        const r1 = await q1;
        if (r1.error) throw r1.error;
        primaryRows = r1.data || [];
        primaryCount = r1.count || 0;
      }

      const seen = new Set<string>();
      const mergedRaw: any[] = [];
      for (const row of [...legacyRows, ...primaryRows]) {
        if (!seen.has(row.id)) {
          seen.add(row.id);
          mergedRaw.push(row);
        }
      }
      mergedRaw.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

      return {
        orcamentos: mergedRaw.map(mapRow),
        totalCount: primaryCount + (page === 0 ? legacyRows.length : 0),
        statuses: allStatuses,
        serverStats
      };
    },
    staleTime: 2 * 60 * 1000,
  });

  const orcamentos = data?.orcamentos || [];
  const statuses = data?.statuses || [];
  const totalCount = data?.totalCount || 0;
  const serverStats = data?.serverStats;

  const toggleVisto = useCallback(async (orcamento: OrcamentoVendedor) => {
    const newVisto = !orcamento.visto;
    queryClient.setQueryData(["orcamentos-vendedor", vendedorId, vendedorNome, isAdminMode, searchTerm, filterVisto, filterEstado, filterStatus, page, excludeTerminal, maxAgeDays, operationalStatus, isViewingAsVendedor], (old: any) => {
      if (!old) return old;
      return {
        ...old,
        orcamentos: old.orcamentos.map((o: OrcamentoVendedor) => (o.id === orcamento.id ? { ...o, visto: newVisto } : o))
      };
    });
    try {
      const { error } = await supabase.from("orcamentos").update({ visto: newVisto }).eq("id", orcamento.id);
      if (error) throw error;
    } catch (error) {
      queryClient.invalidateQueries({ queryKey: ["orcamentos-vendedor"] });
      toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
    }
  }, [queryClient, vendedorId, vendedorNome, isAdminMode, searchTerm, filterVisto, filterEstado, filterStatus, page, excludeTerminal, maxAgeDays, operationalStatus, toast]);

  const updateStatus = useCallback(async (orcamentoId: string, newStatusId: string | null) => {
    try {
      const { error } = await supabase.from("orcamentos").update({ status_id: newStatusId, ultimo_contato: new Date().toISOString() }).eq("id", orcamentoId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["orcamentos-vendedor"] });
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível atualizar o status.", variant: "destructive" });
    }
  }, [queryClient, toast]);

  const deleteOrcamento = useCallback(async (orcamentoId: string) => {
    try {
      const { error } = await supabase.from("orcamentos").delete().eq("id", orcamentoId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["orcamentos-vendedor"] });
      toast({ title: "Orçamento excluído", description: "O orçamento foi excluído com sucesso." });
      return true;
    } catch (error) {
      toast({ title: "Erro", description: "Não foi possível excluir o orçamento.", variant: "destructive" });
      return false;
    }
  }, [queryClient, toast]);

  const handleRealtimeChanges = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["orcamentos-vendedor"] });
  }, [queryClient]);

  useEffect(() => {
    if (!vendedorId && !vendedorNome && !isAdminMode) return;
    
    const channelId = `orcamentos-vendedor-${vendedorId || "admin"}`;
    const channel = supabase.channel(channelId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orcamentos' }, handleRealtimeChanges)
      .subscribe();

    return () => { 
      supabase.removeChannel(channel); 
    };
  }, [vendedorId, vendedorNome, isAdminMode, handleRealtimeChanges]);

  const stats = calculateOperationalStats(orcamentos, statuses);

  const estados = [...new Set(orcamentos.map((o) => o.estado).filter(Boolean))].sort();
  const hasMore = totalCount > orcamentos.length;

  return {
    orcamentos,
    statuses,
    stats: serverStats || stats,
    serverStats,
    estados,
    loading,
    loadingMore: false,
    hasMore,
    totalCount,
    fetchOrcamentos,
    loadMore: () => setPage(p => p + 1),
    toggleVisto,
    updateStatus,
    deleteOrcamento,
    page,
    setPage,
  };
}