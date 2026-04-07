/**
 * Realtime heartbeat — detecta disconnect silencioso e reconecta.
 * Resolve R14 do Risk Map: WebSocket disconnect sem detecção.
 * 
 * Uso: chamar uma vez no App.tsx ou layout raiz.
 */
import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

const HEARTBEAT_INTERVAL_MS = 30_000; // 30s
const RECONNECT_DELAY_MS = 3_000;

interface UseRealtimeHeartbeatOptions {
  enabled?: boolean;
}

export function useRealtimeHeartbeat({ enabled = true }: UseRealtimeHeartbeatOptions = {}) {
  const queryClient = useQueryClient();
  const wasDisconnectedRef = useRef(false);
  const hasConnectedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!enabled) {
      wasDisconnectedRef.current = false;
      hasConnectedRef.current = false;
      toast.dismiss("realtime-disconnect");
      return;
    }

    const channel = supabase.channel("heartbeat-monitor");

    const clearReconnectTimeout = () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };

    const notifyDisconnected = () => {
      if (!hasConnectedRef.current || !navigator.onLine) return;

      if (!wasDisconnectedRef.current) {
        wasDisconnectedRef.current = true;
        toast.warning("Conexão em tempo real perdida. Reconectando...", {
          id: "realtime-disconnect",
          duration: Infinity,
        });
      }
    };

    const scheduleReconnect = () => {
      if (reconnectTimeoutRef.current) return;

      reconnectTimeoutRef.current = setTimeout(() => {
        reconnectTimeoutRef.current = null;

        if (channel.state !== "joined" && channel.state !== "joining") {
          channel.subscribe();
        }
      }, RECONNECT_DELAY_MS);
    };

    const handleDisconnected = () => {
      notifyDisconnected();
      scheduleReconnect();
    };

    const handleReconnected = () => {
      clearReconnectTimeout();

      if (!wasDisconnectedRef.current) return;

      wasDisconnectedRef.current = false;
      toast.success("Conexão restabelecida!", {
        id: "realtime-disconnect",
        duration: 3000,
      });

      queryClient.invalidateQueries();
    };

    const checkConnection = () => {
      const state = channel.state;

      if (state === "closed" || state === "errored") {
        handleDisconnected();
      } else if (state === "joined") {
        handleReconnected();
      }
    };

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        hasConnectedRef.current = true;
        handleReconnected();
      }

      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        handleDisconnected();
      }
    });

    intervalRef.current = setInterval(checkConnection, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      clearReconnectTimeout();
      toast.dismiss("realtime-disconnect");
      supabase.removeChannel(channel);
    };
  }, [enabled, queryClient]);
}
