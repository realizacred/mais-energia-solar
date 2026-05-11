/**
 * Hook read-only para a Central de Recuperação Comercial (/admin/followup-comercial).
 * Reaproveita: vw_proposal_followup_inbox + RPC get_followup_kpis (Phase 0).
 * RB-76: não duplicar — view já consolida propostas + versões + atividade + memória.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type FollowupClasse =
  | "sem_resposta"
  | "visualizada_sem_retorno"
  | "esquecida"
  | "negociacao_quente"
  | "outro";

export interface FollowupInboxRow {
  proposta_id: string;
  versao_id: string | null;
  versao_numero: number | null;
  titulo: string | null;
  codigo: string | null;
  status: string | null;
  is_principal: boolean | null;
  cliente_id: string | null;
  cliente_nome: string | null;
  cliente_email: string | null;
  telefone_normalized: string | null;
  consultor_id: string | null;
  deal_id: string | null;
  lead_id: string | null;
  tenant_id: string | null;
  valor_total: number | null;
  potencia_kwp: number | null;
  enviada_at: string | null;
  aceita_at: string | null;
  recusada_at: string | null;
  valido_ate: string | null;
  primeiro_acesso_em: string | null;
  ultimo_acesso_em: string | null;
  total_aberturas: number | null;
  versao_viewed_at: string | null;
  status_visualizacao: string | null;
  ultimo_followup_em: string | null;
  qtd_followups: number | null;
  ultimo_canal: string | null;
  ultimo_outcome: string | null;
  ultima_mensagem: string | null;
  bloqueado_ate: string | null;
  temperatura: string | null;
  score_ia: number | null;
  objecao_principal: string | null;
  sugestao_ia: string | null;
  proxima_acao_em: string | null;
  classe_followup: FollowupClasse | string | null;
  dias_parado: number | null;
  ultima_atividade_em: string | null;
}

export interface FollowupKpis {
  sem_resposta: number;
  visualizadas_sem_retorno: number;
  esquecidas_30d: number;
  esquecidas_60d: number;
  esquecidas_90d: number;
  quentes: number;
  frias: number;
  followups_pendentes: number;
  recuperadas_30d: number;
}

export function useFollowupComercialKpis() {
  return useQuery({
    queryKey: ["followup-comercial-kpis"],
    queryFn: async (): Promise<FollowupKpis> => {
      const { data, error } = await supabase.rpc("get_followup_kpis");
      if (error) throw error;
      const k = (data ?? {}) as Record<string, number>;
      return {
        sem_resposta: Number(k.sem_resposta ?? 0),
        visualizadas_sem_retorno: Number(k.visualizadas_sem_retorno ?? 0),
        esquecidas_30d: Number(k.esquecidas_30d ?? 0),
        esquecidas_60d: Number(k.esquecidas_60d ?? 0),
        esquecidas_90d: Number(k.esquecidas_90d ?? 0),
        quentes: Number(k.quentes ?? 0),
        frias: Number(k.frias ?? 0),
        followups_pendentes: Number(k.followups_pendentes ?? 0),
        recuperadas_30d: Number(k.recuperadas_30d ?? 0),
      };
    },
    staleTime: 60 * 1000,
  });
}

export interface FollowupInboxFilters {
  classe?: FollowupClasse | "todos";
  consultorId?: string | null;
  diasMin?: number | null;
  search?: string | null;
}

export function useFollowupComercialInbox(filters: FollowupInboxFilters = {}) {
  return useQuery({
    queryKey: ["followup-comercial-inbox", filters],
    queryFn: async (): Promise<FollowupInboxRow[]> => {
      let q = supabase
        .from("vw_proposal_followup_inbox")
        .select("*")
        .order("dias_parado", { ascending: false, nullsFirst: false })
        .limit(300);

      if (filters.classe && filters.classe !== "todos") {
        q = q.eq("classe_followup", filters.classe);
      }
      if (filters.consultorId) {
        q = q.eq("consultor_id", filters.consultorId);
      }
      if (filters.diasMin && filters.diasMin > 0) {
        q = q.gte("dias_parado", filters.diasMin);
      }
      if (filters.search && filters.search.trim().length >= 2) {
        const term = `%${filters.search.trim()}%`;
        q = q.or(
          `cliente_nome.ilike.${term},titulo.ilike.${term},codigo.ilike.${term}`
        );
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data ?? []) as FollowupInboxRow[];
    },
    staleTime: 30 * 1000,
  });
}
