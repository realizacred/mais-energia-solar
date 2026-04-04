/**
 * usePropostaExpandedData.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * 
 * Hook para carregar dados expandidos de uma proposta no card do projeto.
 * Substitui queries diretas no PropostaExpandedDetail (AP-01 fix).
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min

export interface UCDetailData {
  id: string;
  nome: string;
  consumo_mensal_kwh: number;
  geracao_mensal_estimada: number | null;
  tarifa_energia: number | null;
  percentual_atendimento: number | null;
}

export function usePropostaExpandedSnapshot(versaoId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["proposta-expanded-snapshot", versaoId],
    queryFn: async () => {
      if (!versaoId) return null;
      const { data, error } = await supabase
        .from("proposta_versoes")
        .select("snapshot")
        .eq("id", versaoId)
        .single();
      if (error) throw error;
      return (data?.snapshot as Record<string, any>) || null;
    },
    staleTime: STALE_TIME,
    enabled: !!versaoId && enabled,
  });
}

export function usePropostaExpandedUcs(versaoId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["proposta-expanded-ucs", versaoId],
    queryFn: async () => {
      if (!versaoId) return [];
      const { data, error } = await supabase
        .from("proposta_versao_ucs" as any)
        .select("id, nome, consumo_mensal_kwh, geracao_mensal_estimada, tarifa_energia, percentual_atendimento")
        .eq("versao_id", versaoId)
        .order("ordem");
      if (error) throw error;
      return (data as unknown as UCDetailData[]) || [];
    },
    staleTime: STALE_TIME,
    enabled: !!versaoId && enabled,
  });
}

export function usePropostaAuditLogs(propostaId: string | null, versaoIds: string[], enabled: boolean) {
  return useQuery({
    queryKey: ["proposta-audit-logs", propostaId, versaoIds],
    queryFn: async () => {
      if (!propostaId) return [];
      const { data, error } = await supabase
        .from("audit_logs")
        .select("id, acao, tabela, user_email, created_at")
        .or(`and(tabela.eq.propostas_nativas,registro_id.eq.${propostaId}),and(tabela.eq.proposta_versoes,registro_id.in.(${versaoIds.join(",")}))`)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as Array<{ id: string; acao: string; tabela: string; user_email: string | null; created_at: string }>) || [];
    },
    staleTime: STALE_TIME,
    enabled: !!propostaId && versaoIds.length > 0 && enabled,
  });
}

export interface ProposalEventEntry {
  id: string;
  tipo: string;
  payload: Record<string, any> | null;
  created_at: string;
}

export function usePropostaEvents(propostaId: string | null, enabled: boolean) {
  return useQuery({
    queryKey: ["proposta-events", propostaId],
    queryFn: async () => {
      if (!propostaId) return [];
      const { data, error } = await (supabase as any)
        .from("proposal_events")
        .select("id, tipo, payload, created_at")
        .eq("proposta_id", propostaId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ProposalEventEntry[];
    },
    staleTime: STALE_TIME,
    enabled: !!propostaId && enabled,
  });
}
