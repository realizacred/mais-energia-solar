/**
 * useProposalMessageLogs.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "proposal-message-logs" as const;

export interface ProposalMessageLog {
  id: string;
  tipo_mensagem: string;
  estilo: string;
  canal: string;
  destinatario_tipo: string;
  destinatario_valor: string | null;
  conteudo: string;
  status: string;
  erro: string | null;
  sent_at: string | null;
  created_at: string;
}

export function useProposalMessageLogs(propostaId: string | null) {
  return useQuery({
    queryKey: [QUERY_KEY, propostaId],
    queryFn: async () => {
      if (!propostaId) return [];
      const { data, error } = await (supabase as any)
        .from("proposal_message_logs")
        .select("id, tipo_mensagem, estilo, canal, destinatario_tipo, destinatario_valor, conteudo, status, erro, sent_at, created_at")
        .eq("proposta_id", propostaId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as ProposalMessageLog[];
    },
    staleTime: STALE_TIME,
    enabled: !!propostaId,
  });
}
