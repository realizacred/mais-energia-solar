/**
 * useConversationByPhone.ts
 * §16: Queries só em hooks — NUNCA em componentes
 * §23: staleTime obrigatório
 * 
 * Busca conversa WhatsApp e resumo IA por telefone do cliente.
 */

import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_TIME = 1000 * 60 * 5; // 5 min

export interface ConvSummary {
  id: string;
  cliente_nome: string | null;
  cliente_telefone: string;
  last_message_preview: string | null;
  last_message_at: string | null;
  last_message_direction: string | null;
  status: string;
}

export interface ConvWithSummary {
  conversation: ConvSummary | null;
  aiSummary: string | null;
}

export function useConversationByPhone(customerPhone: string, customerId: string | null) {
  return useQuery({
    queryKey: ["conversation-by-phone", customerPhone, customerId],
    queryFn: async (): Promise<ConvWithSummary> => {
      if (!customerPhone && !customerId) return { conversation: null, aiSummary: null };

      const digits = customerPhone.replace(/\D/g, "");
      if (digits.length < 8) return { conversation: null, aiSummary: null };

      const suffix = digits.slice(-8);
      const { data } = await supabase
        .from("wa_conversations")
        .select("id, cliente_nome, cliente_telefone, last_message_preview, last_message_at, last_message_direction, status")
        .or(`cliente_telefone.ilike.%${suffix}%,remote_jid.ilike.%${suffix}%`)
        .order("last_message_at", { ascending: false })
        .limit(1);

      const conv = (data?.[0] as ConvSummary | undefined) ?? null;
      if (!conv) return { conversation: null, aiSummary: null };

      // Try AI summary
      let aiSummary: string | null = null;
      try {
        const { data: summaryData } = await (supabase as any)
          .from("wa_conversation_summaries")
          .select("summary")
          .eq("conversation_id", conv.id)
          .maybeSingle();
        const raw = summaryData?.summary;
        if (raw) {
          const s = typeof raw === "string" ? raw : raw?.resumo;
          if (s) aiSummary = typeof s === "string" ? s : JSON.stringify(s);
        }
      } catch { /* ignore */ }

      return { conversation: conv, aiSummary };
    },
    staleTime: STALE_TIME,
    enabled: !!(customerPhone || customerId),
  });
}
