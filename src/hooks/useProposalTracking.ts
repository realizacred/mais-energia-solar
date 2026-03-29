// §16: Queries só em hooks — NUNCA em componentes
// §23: staleTime obrigatório

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 minutos

export interface TokenData {
  id: string;
  token: string;
  decisao: string | null;
  aceite_nome: string | null;
  aceite_documento: string | null;
  aceite_observacoes: string | null;
  assinatura_url: string | null;
  recusa_motivo: string | null;
  recusa_at: string | null;
  view_count: number;
  first_viewed_at: string | null;
  last_viewed_at: string | null;
  used_at: string | null;
  created_at: string;
  expires_at: string;
  cenario_aceito_id: string | null;
  duracao_total_segundos: number;
}

export interface ProposalEventData {
  id: string;
  tipo: string;
  payload: Record<string, any> | null;
  created_at: string;
}

export interface ViewData {
  id: string;
  user_agent: string | null;
  ip_address: string | null;
  referrer: string | null;
  created_at: string;
}

export interface EnvioData {
  id: string;
  canal: string;
  status: string;
  enviado_em: string;
  destinatario: string | null;
}

/**
 * Hook to fetch all tracking data for a proposal (views, tokens, envios).
 */
export function useProposalTracking(propostaId: string | null, versaoId?: string) {
  return useQuery({
    queryKey: ["proposal-tracking", propostaId, versaoId],
    queryFn: async () => {
      if (!propostaId) return { views: [], totalViews: 0, tokens: [], envios: [] };

      const viewsPromise = (supabase as any)
        .from("proposta_views")
        .select("id, ip_address, user_agent, referrer, created_at", { count: "exact" })
        .eq("proposta_id", propostaId)
        .order("created_at", { ascending: false })
        .limit(200);

      const tokensPromise = (supabase as any)
        .from("proposta_aceite_tokens")
        .select("id, token, decisao, aceite_nome, aceite_documento, aceite_observacoes, assinatura_url, recusa_motivo, recusa_at, view_count, first_viewed_at, last_viewed_at, used_at, created_at, expires_at, cenario_aceito_id, duracao_total_segundos")
        .eq("proposta_id", propostaId)
        .order("created_at", { ascending: false });

      const enviosPromise = versaoId
        ? (supabase as any)
            .from("proposta_envios")
            .select("id, canal, status, enviado_em, destinatario")
            .eq("versao_id", versaoId)
            .order("enviado_em", { ascending: false })
        : Promise.resolve({ data: [] });

      const eventsPromise = (supabase as any)
        .from("proposal_events")
        .select("id, tipo, payload, created_at")
        .eq("proposta_id", propostaId)
        .in("tipo", ["proposta_visualizada", "proposta_enviada", "proposta_aceita", "proposta_recusada", "status_change", "version_created"])
        .order("created_at", { ascending: false })
        .limit(30);

      const [viewsRes, tokensRes, enviosRes, eventsRes] = await Promise.all([
        viewsPromise, tokensPromise, enviosPromise, eventsPromise,
      ]);

      return {
        views: (viewsRes.data || []) as ViewData[],
        totalViews: (viewsRes.count || 0) as number,
        tokens: (tokensRes.data || []) as TokenData[],
        envios: (enviosRes.data || []) as EnvioData[],
        events: (eventsRes.data || []) as ProposalEventData[],
      };
    },
    staleTime: STALE_TIME,
    enabled: !!propostaId,
  });
}
