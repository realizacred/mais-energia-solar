import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface RealtimeNotification {
  id: string;
  tenant_id: string;
  lead_id: string;
  lead?: {
    id: string;
    nome: string;
    telefone: string;
  };
  tipo_notificacao: "mudanca_temperamento" | "nova_dor" | "urgencia_alta";
  temperamento_anterior: string | null;
  temperamento_novo: string | null;
  urgencia_score: number;
  sugestao_resposta: string | null;
  contexto_json: Record<string, unknown>;
  lida: boolean;
  created_at: string;
}

/**
 * Fetch unread (or all) realtime intelligence notifications for tenant.
 * §23: staleTime 30s for realtime data.
 */
export function useRealtimeNotifications(tenantId: string | null, unreadOnly = true) {
  return useQuery({
    queryKey: ["realtime-notifications", tenantId, unreadOnly],
    queryFn: async () => {
      let query = supabase
        .from("intelligence_realtime_notifications" as any)
        .select(`*`)
        .eq("tenant_id", tenantId!)
        .order("created_at", { ascending: false })
        .limit(50);

      if (unreadOnly) {
        query = query.eq("lida", false);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as unknown as RealtimeNotification[];
    },
    staleTime: 1000 * 30,
    refetchInterval: 1000 * 30,
    enabled: !!tenantId,
  });
}

/**
 * Mark a notification as read.
 */
export function useMarcarNotificacaoLida() {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("intelligence_realtime_notifications" as any)
        .update({ lida: true })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["realtime-notifications"] });
    },
  });
}

/**
 * Subscribe to Supabase Realtime INSERT events for intelligence notifications.
 * Invalidates queries on new notifications.
 */
export function useRealtimeIntelligenceSubscription(tenantId: string | null, leadId?: string) {
  const qc = useQueryClient();

  useEffect(() => {
    if (!tenantId) return;

    const filter = leadId
      ? `tenant_id=eq.${tenantId},lead_id=eq.${leadId}`
      : `tenant_id=eq.${tenantId}`;

    const channel = supabase
      .channel(`intelligence-rt-${tenantId}-${leadId || "all"}`)
      .on(
        "postgres_changes" as any,
        {
          event: "INSERT",
          schema: "public",
          table: "intelligence_realtime_notifications",
          filter,
        },
        () => {
          qc.invalidateQueries({ queryKey: ["realtime-notifications"] });
          if (leadId) {
            qc.invalidateQueries({ queryKey: ["lead-intelligence", leadId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [tenantId, leadId, qc]);
}
