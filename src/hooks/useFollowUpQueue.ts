import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { getCurrentTenantId } from "@/lib/storagePaths";

export interface FollowUpItem {
  id: string;
  conversation_id: string;
  tenant_id: string;
  ai_context: 'ai_active' | 'ai_paused' | 'needs_human_review' | 'waiting_customer' | 'human_active';
  ai_context_updated_at: string | null;
  ai_context_reason: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  remote_jid: string | null;
  projeto?: {
    id: string;
    nome: string;
  } | null;
  proposta?: {
    id: string;
    titulo: string;
  } | null;
  queue_item?: {
    id: string;
    status: string;
    scheduled_at: string | null;
    tentativas: number;
    max_tentativas: number;
    ultimo_erro: string | null;
    motivo_followup: string | null;
    gatilho: string | null;
  } | null;
  last_sent_message?: {
    id: string;
    content: string | null;
    created_at: string;
  } | null;
}

export function useFollowUpQueue() {
  const [tenantId, setTenantId] = useState<string | null>(null);

  useEffect(() => {
    getCurrentTenantId().then(setTenantId);
  }, []);

  return useQuery({
    queryKey: ["wa-followup-queue", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // 1. Get conversations with active AI context and pending follow-up queue items
      // Note: We use a join or multiple queries if needed. Supabase can handle nested selects.
      const { data, error } = await supabase
        .from("wa_conversations")
        .select(`
          id,
          tenant_id,
          ai_context,
          ai_context_updated_at,
          ai_context_reason,
          cliente_nome,
          cliente_telefone,
          remote_jid,
          projeto_id,
          proposta_id,
          projeto:projetos(id, nome),
          proposta:propostas_nativas(id, titulo),
          queue_items:wa_followup_queue!conversation_id(
            id,
            status,
            scheduled_at,
            tentativas,
            max_tentativas,
            ultimo_erro,
            motivo_followup,
            gatilho
          )
        `)
        .eq("tenant_id", tenantId)
        .in("ai_context", ['ai_active', 'ai_paused', 'needs_human_review', 'waiting_customer'])
        .not("wa_followup_queue", "is", null);

      if (error) throw error;

      // Filter and transform
      const items: FollowUpItem[] = await Promise.all(
        (data || [])
          .map(async (conv: any) => {
            // Find active queue item (not completed/cancelled)
            const activeQueueItem = conv.queue_items?.find(
              (q: any) => !['completed', 'cancelled'].includes(q.status)
            );

            if (!activeQueueItem) return null;

            // Get last outgoing message
            const { data: lastMsg } = await supabase
              .from("wa_messages")
              .select("id, content, created_at")
              .eq("conversation_id", conv.id)
              .eq("direction", "out")
              .order("created_at", { ascending: false })
              .limit(1)
              .maybeSingle();

            return {
              id: conv.id,
              conversation_id: conv.id,
              tenant_id: conv.tenant_id,
              ai_context: conv.ai_context,
              ai_context_updated_at: conv.ai_context_updated_at,
              ai_context_reason: conv.ai_context_reason,
              cliente_nome: conv.cliente_nome,
              cliente_telefone: conv.cliente_telefone,
              remote_jid: conv.remote_jid,
              projeto: conv.projeto,
              proposta: conv.proposta,
              queue_item: activeQueueItem,
              last_sent_message: lastMsg
            };
          })
      ).then(results => results.filter(Boolean) as FollowUpItem[]);

      // Sorting: needs_human_review first, then ai_paused, then ai_active, then scheduled_at ASC
      const contextOrder = {
        'needs_human_review': 0,
        'ai_paused': 1,
        'ai_active': 2,
        'waiting_customer': 3,
        'human_active': 4
      };

      return items.sort((a, b) => {
        const orderA = contextOrder[a.ai_context] ?? 99;
        const orderB = contextOrder[b.ai_context] ?? 99;
        if (orderA !== orderB) return orderA - orderB;
        
        const dateA = a.queue_item?.scheduled_at ? new Date(a.queue_item.scheduled_at).getTime() : Infinity;
        const dateB = b.queue_item?.scheduled_at ? new Date(b.queue_item.scheduled_at).getTime() : Infinity;
        return dateA - dateB;
      });
    },
    enabled: !!tenantId,
    refetchInterval: 60000,
  });
}
