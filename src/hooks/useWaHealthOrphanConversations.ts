import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { normalizeBrazilianPhone } from "@/utils/phone/normalizeBrazilianPhone";

export interface WaOrphanConversation {
  id: string;
  remote_jid: string;
  cliente_telefone: string | null;
  telefone_normalizado: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  created_at: string;
  message_count: number;
}

export function useWaHealthOrphanConversations() {
  return useQuery<WaOrphanConversation[]>({
    queryKey: ["wa-health-orphan-conversations"],
    staleTime: 60_000,
    refetchInterval: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_conversations")
        .select("id, remote_jid, cliente_telefone, last_message_preview, last_message_at, created_at")
        .is("lead_id", null)
        .is("cliente_id", null)
        .order("last_message_at", { ascending: false, nullsFirst: false })
        .limit(50);
      if (error) throw error;

      const ids = (data ?? []).map((c: any) => c.id);
      const counts: Record<string, number> = {};
      if (ids.length) {
        const { data: msgs } = await supabase
          .from("wa_messages")
          .select("conversation_id")
          .in("conversation_id", ids);
        (msgs ?? []).forEach((m: any) => {
          counts[m.conversation_id] = (counts[m.conversation_id] ?? 0) + 1;
        });
      }

      return (data ?? []).map((c: any) => {
        const norm = normalizeBrazilianPhone(c.cliente_telefone || c.remote_jid);
        return {
          id: c.id,
          remote_jid: c.remote_jid,
          cliente_telefone: c.cliente_telefone,
          telefone_normalizado: norm?.digits ?? null,
          last_message_preview: c.last_message_preview,
          last_message_at: c.last_message_at,
          created_at: c.created_at,
          message_count: counts[c.id] ?? 0,
        };
      });
    },
  });
}
