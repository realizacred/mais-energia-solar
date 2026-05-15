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
import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

const STALE_TIME = 1000 * 60 * 2;

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
    proposta_versao_ucs?: Array<{ consumo_mensal_kwh: number | null }> | null;
  }> | null;
}

const PAGE_SIZE = 50;

export function useMinhasPropostasConsultor(consultorId: string | null | undefined) {
  const [propostas, setPropostas] = useState<PropostaConsultor[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const propostasLenRef = useRef(0);
  useEffect(() => {
    propostasLenRef.current = propostas.length;
  }, [propostas.length]);

  // CORREÇÃO: Buscar KPIs direto do banco para garantir precisão com paginação
  const { data: kpis, isLoading: isLoadingKpis } = useQuery({
    queryKey: ['propostas-consultor-kpis', consultorId],
    enabled: !!consultorId && consultorId !== "admin",
    staleTime: STALE_TIME,
    queryFn: async () => {
      const today = new Date().toISOString();
      
      const [total, enviadas, visualizadas, aceitas, expiradas] = await Promise.all([
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
          .eq("status", "enviada"),

        supabase
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .eq("consultor_id", consultorId)
          .is("deleted_at", null)
          .or("primeiro_acesso_em.not.is.null,status.eq.vista"),

        supabase
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .eq("consultor_id", consultorId)
          .is("deleted_at", null)
          .eq("status", "aceita"),

        supabase
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .eq("consultor_id", consultorId)
          .is("deleted_at", null)
          .neq("status", "aceita")
          .lt("valido_ate", today)
      ]);

      return {
        total: total.count || 0,
        enviadas: enviadas.count || 0,
        visualizadas: visualizadas.count || 0,
        aceitas: aceitas.count || 0,
        expiradas: expiradas.count || 0
      };
    }
  });

  const fetchPropostas = useCallback(async (append = false) => {
    if (!consultorId || consultorId === "admin") {
      setLoading(false);
      return;
    }

    try {
      if (append) setLoadingMore(true);
      else setLoading(true);

      const from = append ? propostasLenRef.current : 0;
      const to = from + PAGE_SIZE - 1;

      const { data, error, count } = await (supabase as any)
        .from("propostas_nativas")
        .select(`
          id, codigo, titulo, status, consultor_id,
          cliente_id, lead_id, template_id,
          proposta_num, status_visualizacao, is_principal,
          created_at, enviada_at, primeiro_acesso_em,
          ultimo_acesso_em, total_aberturas, aceita_at,
          recusada_at, validade_dias, public_token, versao_atual,
          proposta_aceite_tokens(token),
          clientes!cliente_id(id, nome, cidade, estado),
          leads!lead_id(id, nome),
          proposta_versoes(
            id, versao_numero, valor_total, potencia_kwp,
            geracao_mensal, economia_mensal, payback_meses,
            valido_ate, output_pdf_path, primeiro_acesso_em,
            created_at, public_slug, link_pdf, viewed_at, consumo_mensal,
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
      const newData = rows.map((p): PropostaConsultor => {
        const capitalize = (s: string) => 
          s.trim().split(/\s+/).map(w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ');

        const versoes = (p.proposta_versoes ?? []).slice().sort(
          (a, b) => (b.versao_numero ?? 0) - (a.versao_numero ?? 0),
        );
        const latest =
          versoes.find((v) => v.versao_numero === p.versao_atual) ?? versoes[0] ?? null;

        const clienteNomeRealRaw = p.clientes?.nome || p.leads?.nome;
        const cliente_nome_real = clienteNomeRealRaw ? capitalize(clienteNomeRealRaw) : null;
        
        const cliente_nome = cliente_nome_real || (p.titulo ? capitalize(p.titulo) : "Cliente não identificado");

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
          recusada_at: p.recusada_at,
          validade_dias: p.validade_dias,
          public_token: p.public_token || p.proposta_versoes?.[0]?.public_slug || null,
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
      });

      const total = count || 0;
      setTotalCount(total);

      if (append) {
        setPropostas(prev => [...prev, ...newData]);
        setHasMore(propostasLenRef.current + newData.length < total);
      } else {
        setPropostas(newData);
        setHasMore(newData.length < total);
      }
    } catch (error) {
      console.error("Erro ao carregar propostas:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [consultorId]);

  useEffect(() => {
    fetchPropostas();
  }, [fetchPropostas]);

  return {
    data: propostas,
    isLoading: loading || isLoadingKpis,
    loadingMore,
    hasMore,
    totalCount: kpis?.total || totalCount,
    kpis: kpis || { total: 0, enviadas: 0, visualizadas: 0, aceitas: 0, expiradas: 0 },
    refetch: () => fetchPropostas(),
    loadMore: () => fetchPropostas(true),
  };
}

/** Métricas do portal consultor — calculadas em memória, sem custo/margem. */
export interface PropostasConsultorKpis {
  total: number;
  enviadas: number;
  visualizadas: number;
  aceitas: number;
  expiradas: number;
}

// export function computePropostasKpis(rows: PropostaConsultor[]): PropostasConsultorKpis {
//   ... (mantido comentado caso queira restaurar ou para referência de lógica)
// }
