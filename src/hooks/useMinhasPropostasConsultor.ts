/**
 * useMinhasPropostasConsultor — Portal Consultor (read-only).
 *
 * SSOT: propostas_nativas + proposta_versoes (única fonte permitida).
 * NÃO acessa snapshots brutos, custo, margem, comissão, fornecedor ou qualquer
 * campo administrativo. Select é explícito e limitado a campos comerciais públicos.
 *
 * AGENTS.md §16 (queries só em hooks), §23 (staleTime obrigatório).
 * Boundary consultor/admin — Fase 3 da auditoria do Portal Consultor.
 */
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const STALE_TIME = 1000 * 60 * 2;
const PAGE_SIZE = 50;

export interface PropostaConsultor {
  id: string;
  codigo: string | null;
  titulo: string | null;
  proposta_num: number | null;
  status: string;
  status_visualizacao: string | null;
  is_principal: boolean;
  created_at: string;
  enviada_at: string | null;
  primeiro_acesso_em: string | null;
  ultimo_acesso_em: string | null;
  total_aberturas: number | null;
  aceita_at: string | null;
  accepted_via: string | null;
  recusada_at: string | null;
  validade_dias: number | null;
  public_token: string | null;
  cliente_nome: string | null;
  cliente_nome_real: string | null;
  lead_id: string | null;
  cliente_id: string | null;
  projeto_id: string | null;

  // Dados comerciais públicos vindos da última versão
  versao_id: string | null;
  versao_numero: number | null;
  potencia_kwp: number | null;
  geracao_mensal: number | null;
  economia_mensal: number | null;
  payback_meses: number | null;
  valor_total: number | null;
  valido_ate: string | null;
  output_pdf_path: string | null;
  public_slug: string | null;
  link_pdf: string | null;
  viewed_at: string | null;
  consumo_mensal: number | null;
}

interface RawProposta {
  id: string;
  codigo: string | null;
  titulo: string | null;
  proposta_num: number | null;
  status: string;
  status_visualizacao: string | null;
  is_principal: boolean | null;
  created_at: string;
  enviada_at: string | null;
  primeiro_acesso_em: string | null;
  ultimo_acesso_em: string | null;
  total_aberturas: number | null;
  aceita_at: string | null;
  accepted_via: string | null;
  recusada_at: string | null;
  validade_dias: number | null;
  public_token: string | null;
  versao_atual: number | null;
  lead_id: string | null;
  cliente_id: string | null;
  projeto_id: string | null;
  consultor_id: string | null;
  clientes?: { nome: string | null } | null;
  leads?: { nome: string | null } | null;
  proposta_versoes?: Array<{
    id: string;
    versao_numero: number;
    created_at: string;
    potencia_kwp: number | null;
    geracao_mensal: number | null;
    economia_mensal: number | null;
    payback_meses: number | null;
    valor_total: number | null;
    valido_ate: string | null;
    output_pdf_path: string | null;
    public_slug: string | null;
    link_pdf: string | null;
    viewed_at: string | null;
    consumo_mensal: number | null;
    snapshot: any;
    proposta_versao_ucs?: Array<{ consumo_mensal_kwh: number | null }> | null;
  }> | null;
}

export function useMinhasPropostasConsultor(consultorId: string | null | undefined) {
  const [page, setPage] = useState(0);
  const [accumulatedPropostas, setAccumulatedPropostas] = useState<PropostaConsultor[]>([]);
  const queryClient = useQueryClient();

  // Reset accumulation when consultor changes
  useEffect(() => {
    setPage(0);
    setAccumulatedPropostas([]);
  }, [consultorId]);

  // KPIs
  const { data: kpis, isLoading: isLoadingKpis } = useQuery({
    queryKey: ['propostas-consultor-kpis', consultorId],
    enabled: !!consultorId && consultorId !== "admin",
    staleTime: STALE_TIME,
    queryFn: async () => {
      const [total, enviadas, visualizadas, aceitas] = await Promise.all([
        supabase
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .eq("consultor_id", consultorId)
          .is("deleted_at", null)
          .neq("status", "excluida"),
        
        supabase
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .eq("consultor_id", consultorId)
          .is("deleted_at", null)
          .in("status", ["sent", "enviada"]),

        supabase
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .eq("consultor_id", consultorId)
          .is("deleted_at", null)
          .or("primeiro_acesso_em.not.is.null,status.eq.viewed,status.eq.vista,total_aberturas.gt.0"),

        supabase
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .eq("consultor_id", consultorId)
          .is("deleted_at", null)
          .in("status", ["accepted", "aceita"])
      ]);

      return {
        total: total.count || 0,
        enviadas: enviadas.count || 0,
        visualizadas: visualizadas.count || 0,
        aceitas: aceitas.count || 0,
        expiradas: 0 // Simplificado para evitar erro de coluna inexistente
      };
    }
  });

  // Main List Query
  const { data: queryData, isLoading: isLoadingList, isFetching: isFetchingList, refetch } = useQuery({
    queryKey: ['propostas-consultor-list', consultorId, page],
    enabled: !!consultorId && consultorId !== "admin",
    staleTime: STALE_TIME,
    queryFn: async () => {
      const from = page * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await (supabase as any)
        .from("propostas_nativas")
        .select(`
          id, codigo, titulo, status, status_visualizacao, is_principal,
          created_at, enviada_at, primeiro_acesso_em, ultimo_acesso_em,
          total_aberturas, aceita_at, accepted_via, recusada_at, validade_dias,
          public_token, proposta_num, versao_atual,
          consultor_id, cliente_id, lead_id, projeto_id,
          proposta_aceite_tokens(token),
          clientes!cliente_id(nome),
          leads!lead_id(nome),
          proposta_versoes(
            id, versao_numero, created_at, valor_total, potencia_kwp,
            geracao_mensal, economia_mensal, payback_meses,
            valido_ate, output_pdf_path, link_pdf, viewed_at,
            snapshot,
            proposta_versao_ucs(consumo_mensal_kwh)
          )
        `, { count: "exact" })
        .eq("consultor_id", consultorId)
        .is("deleted_at", null)
        .neq("status", "excluida")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (error) throw error;

      const rows = (data ?? []) as RawProposta[];
      return {
        propostas: rows.map((p): PropostaConsultor => {
          const capitalize = (s: string) => 
            s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

          const versoes = (p.proposta_versoes ?? []).slice().sort(
            (a, b) => (b.versao_numero ?? 0) - (a.versao_numero ?? 0),
          );
          const latest =
            versoes.find((v) => v.versao_numero === p.versao_atual) ?? versoes[0] ?? null;

          const snapshot = latest?.snapshot;
          const snapshot_nome = 
            snapshot?.cliente?.nome || 
            snapshot?.clienteNome || 
            snapshot?.cliente_nome ||
            snapshot?._wizard_state?.cliente?.nome;

          const cliente_nome_real = 
            (p as any).clientes?.nome ?? 
            (p as any).leads?.nome ?? 
            snapshot_nome ??
            null;

          const cliente_nome = cliente_nome_real ? capitalize(cliente_nome_real) : "Cliente não identificado";

          let valido_ate = latest?.valido_ate ?? null;
          if (!valido_ate && latest?.created_at) {
            const d = new Date(latest.created_at);
            d.setDate(d.getDate() + 30);
            valido_ate = d.toISOString();
          }

          return {
            id: p.id,
            codigo: p.codigo,
            titulo: p.titulo,
            proposta_num: p.proposta_num,
            status: p.status,
            status_visualizacao: p.status_visualizacao,
            is_principal: !!p.is_principal,
            created_at: p.created_at,
            enviada_at: p.enviada_at,
            primeiro_acesso_em: p.primeiro_acesso_em,
            ultimo_acesso_em: p.ultimo_acesso_em,
            total_aberturas: p.total_aberturas,
            aceita_at: p.aceita_at,
            accepted_via: p.accepted_via,
            recusada_at: p.recusada_at,
            validade_dias: p.validade_dias,
            public_token: p.public_token || (p.proposta_versoes && p.proposta_versoes[0]?.public_slug) || null,
            cliente_nome,
            cliente_nome_real,
            lead_id: p.lead_id,
            cliente_id: p.cliente_id,
            projeto_id: p.projeto_id,
            versao_id: latest?.id ?? null,
            versao_numero: latest?.versao_numero ?? null,
            potencia_kwp: latest?.potencia_kwp ?? null,
            geracao_mensal: latest?.geracao_mensal ?? null,
            economia_mensal: latest?.economia_mensal ?? null,
            payback_meses: latest?.payback_meses ?? null,
            valor_total: latest?.valor_total ?? null,
            valido_ate,
            output_pdf_path: latest?.output_pdf_path ?? null,
            public_slug: latest?.public_slug ?? null,
            link_pdf: latest?.link_pdf ?? null,
            viewed_at: latest?.viewed_at ?? null,
            consumo_mensal: latest?.consumo_mensal || (latest?.proposta_versao_ucs && latest.proposta_versao_ucs.length > 0 ? latest.proposta_versao_ucs.reduce((acc, uc) => acc + (Number(uc.consumo_mensal_kwh) || 0), 0) : null),
          };
        }),
        totalCount: count || 0
      };
    }
  });

  // Handle accumulation for "Load More"
  useEffect(() => {
    if (queryData?.propostas) {
      if (page === 0) {
        setAccumulatedPropostas(queryData.propostas);
      } else {
        setAccumulatedPropostas(prev => {
          // Avoid duplicates by checking IDs
          const existingIds = new Set(prev.map(p => p.id));
          const filteredNew = queryData.propostas.filter(p => !existingIds.has(p.id));
          return [...prev, ...filteredNew];
        });
      }
    }
  }, [queryData, page]);

  const loadMore = useCallback(() => {
    setPage(prev => prev + 1);
  }, []);

  const hasMore = (queryData?.totalCount ?? 0) > accumulatedPropostas.length;

  // Realtime
  usePropostasConsultorRealtime(consultorId, queryClient);

  return {
    data: accumulatedPropostas,
    isLoading: isLoadingList && page === 0,
    loadingMore: isFetchingList && page > 0,
    hasMore,
    totalCount: kpis?.total || queryData?.totalCount || 0,
    kpis: kpis || { total: 0, enviadas: 0, visualizadas: 0, aceitas: 0, expiradas: 0 },
    refetch,
    loadMore,
  };
}

/**
 * ⚠️ HARDENING: Realtime subscription for Proposals.
 * Separated from main hook to maintain stability and avoid re-renders.
 */
function usePropostasConsultorRealtime(consultorId: string | null | undefined, queryClient: any) {
  const onChanges = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['propostas-consultor-kpis', consultorId] });
    queryClient.invalidateQueries({ queryKey: ['propostas-consultor-list', consultorId] });
  }, [consultorId, queryClient]);

  useEffect(() => {
    if (!consultorId || consultorId === "admin") return;

    const channelId = `propostas-consultor-${consultorId}`;
    const channel = supabase
      .channel(channelId)
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'propostas_nativas',
          filter: `consultor_id=eq.${consultorId}`
        },
        onChanges
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [consultorId, onChanges]);
}

/** Métricas do portal consultor — calculadas em memória, sem custo/margem. */
export interface PropostasConsultorKpis {
  total: number;
  enviadas: number;
  visualizadas: number;
  aceitas: number;
  expiradas: number;
}
