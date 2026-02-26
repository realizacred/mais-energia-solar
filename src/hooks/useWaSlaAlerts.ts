import { useState, useEffect, useCallback, useRef } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface SlaAlert {
  id: string;
  tenant_id: string;
  conversation_id: string;
  tipo: string;
  assigned_to: string | null;
  ai_summary: string | null;
  tempo_sem_resposta_minutos: number | null;
  acknowledged: boolean;
  escalated: boolean;
  resolved: boolean;
  created_at: string;
  cliente_nome?: string | null;
}

export function useWaSlaAlerts() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const audioRef = useRef<AudioContext | null>(null);
  const prevCountRef = useRef(0);

  // Fetch SLA config
  const { data: slaConfig } = useQuery({
    queryKey: ["wa-sla-config"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("wa_sla_config")
        .select("id, ativo, prazo_resposta_minutos, escalonar_apos_minutos, alerta_visual, alerta_sonoro, gerar_resumo_ia, ignorar_fora_horario, horario_comercial_inicio, horario_comercial_fim")
        .maybeSingle();
      if (error) throw error;
      return data as any;
    },
    staleTime: 60 * 1000,
    enabled: !!user,
  });

  // Determine if user is admin
  const isAdminRef = useRef(false);
  const { data: userRoles } = useQuery({
    queryKey: ["user-roles-sla", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);
      return data || [];
    },
    enabled: !!user,
    staleTime: 60_000,
  });
  isAdminRef.current = (userRoles || []).some((r: any) =>
    ["admin", "gerente", "financeiro"].includes(r.role)
  );

  // Fetch active (unresolved) alerts — scoped by role
  const { data: alerts = [], isLoading } = useQuery({
    queryKey: ["wa-sla-alerts", isAdminRef.current, user?.id],
    queryFn: async () => {
      let query = (supabase as any)
        .from("wa_sla_alerts")
        .select("id, conversation_id, tipo, tempo_sem_resposta_minutos, assigned_to, escalated, escalated_at, acknowledged, acknowledged_at, acknowledged_by, ai_summary, resolved, resolved_at, created_at, wa_conversations(cliente_nome)")
        .eq("resolved", false)
        .order("created_at", { ascending: false })
        .limit(50);

      // 🔐 Consultores só veem alertas de conversas atribuídas a eles
      if (!isAdminRef.current && user?.id) {
        query = query.eq("assigned_to", user.id);
      }

      const { data, error } = await query;
      return ((data || []) as any[]).map((a) => ({
        ...a,
        cliente_nome: (Array.isArray(a.wa_conversations) ? a.wa_conversations[0]?.cliente_nome : a.wa_conversations?.cliente_nome) || null,
        wa_conversations: undefined,
      })) as SlaAlert[];
    },
    staleTime: 30 * 1000,
    refetchInterval: 60 * 1000,
    enabled: !!user,
  });

  // Sound alert for new SLA violations
  useEffect(() => {
    if (!slaConfig?.alerta_sonoro) return;
    const currentCount = alerts.filter((a) => !a.acknowledged).length;
    if (currentCount > prevCountRef.current && prevCountRef.current >= 0) {
      try {
        const ctx = audioRef.current || new AudioContext();
        audioRef.current = ctx;
        // Urgent double-beep
        [0, 0.2].forEach((delay) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.type = "triangle";
          osc.frequency.setValueAtTime(1200, ctx.currentTime + delay);
          gain.gain.setValueAtTime(0.5, ctx.currentTime + delay);
          gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.3);
          osc.start(ctx.currentTime + delay);
          osc.stop(ctx.currentTime + delay + 0.3);
        });
      } catch {
        // Audio not available
      }
    }
    prevCountRef.current = currentCount;
  }, [alerts, slaConfig?.alerta_sonoro]);

  // Realtime subscription for new alerts
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("sla-alerts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "wa_sla_alerts" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["wa-sla-alerts"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  const acknowledgeAlert = useCallback(async (alertId: string) => {
    await (supabase as any)
      .from("wa_sla_alerts")
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user?.id,
      })
      .eq("id", alertId);
    queryClient.invalidateQueries({ queryKey: ["wa-sla-alerts"] });
  }, [user, queryClient]);

  const resolveAlert = useCallback(async (alertId: string) => {
    await (supabase as any)
      .from("wa_sla_alerts")
      .update({
        resolved: true,
        resolved_at: new Date().toISOString(),
      })
      .eq("id", alertId);
    queryClient.invalidateQueries({ queryKey: ["wa-sla-alerts"] });
  }, [queryClient]);

  const pauseSla = useCallback(async (conversationId: string, hours: number) => {
    const pauseUntil = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    await (supabase as any)
      .from("wa_conversations")
      .update({ sla_paused_until: pauseUntil })
      .eq("id", conversationId);
    // Resolve existing alerts for this conversation
    const alertsForConv = alerts.filter((a) => a.conversation_id === conversationId && !a.resolved);
    if (alertsForConv.length) {
      await (supabase as any)
        .from("wa_sla_alerts")
        .update({ resolved: true, resolved_at: new Date().toISOString() })
        .in("id", alertsForConv.map((a) => a.id));
    }
    queryClient.invalidateQueries({ queryKey: ["wa-sla-alerts"] });
  }, [alerts, queryClient]);

  const acknowledgeAll = useCallback(async () => {
    const unacked = alerts.filter((a) => !a.acknowledged);
    if (!unacked.length) return;
    await (supabase as any)
      .from("wa_sla_alerts")
      .update({
        acknowledged: true,
        acknowledged_at: new Date().toISOString(),
        acknowledged_by: user?.id,
      })
      .in("id", unacked.map((a) => a.id));
    queryClient.invalidateQueries({ queryKey: ["wa-sla-alerts"] });
  }, [alerts, user, queryClient]);

  const myAlerts = alerts.filter((a) => a.assigned_to === user?.id);
  const unacknowledgedCount = alerts.filter((a) => !a.acknowledged).length;
  const myUnacknowledgedCount = myAlerts.filter((a) => !a.acknowledged).length;
  const escalatedCount = alerts.filter((a) => a.escalated && !a.acknowledged).length;

  return {
    alerts,
    myAlerts,
    slaConfig,
    isLoading,
    unacknowledgedCount,
    myUnacknowledgedCount,
    escalatedCount,
    acknowledgeAlert,
    resolveAlert,
    pauseSla,
    acknowledgeAll,
    isEnabled: !!slaConfig?.ativo,
  };
}
