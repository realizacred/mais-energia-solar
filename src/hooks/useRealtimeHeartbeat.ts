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

export function useRealtimeHeartbeat() {
  const queryClient = useQueryClient();
  const wasDisconnectedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const channel = supabase.channel("heartbeat-monitor");

    const checkConnection = () => {
      const state = channel.state;
      
      if (state === "closed" || state === "errored") {
        if (!wasDisconnectedRef.current) {
          wasDisconnectedRef.current = true;
          toast.warning("Conexão em tempo real perdida. Reconectando...", {
            id: "realtime-disconnect",
            duration: Infinity,
          });
        }

        // Tentar reconectar
        setTimeout(() => {
          channel.subscribe();
        }, RECONNECT_DELAY_MS);
      } else if (state === "joined" && wasDisconnectedRef.current) {
        wasDisconnectedRef.current = false;
        toast.success("Conexão restabelecida!", {
          id: "realtime-disconnect",
          duration: 3000,
        });
        // Invalidar todas as queries para garantir dados frescos
        queryClient.invalidateQueries();
      }
    };

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        wasDisconnectedRef.current = false;
      }
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        wasDisconnectedRef.current = true;
        toast.warning("Conexão em tempo real perdida. Reconectando...", {
          id: "realtime-disconnect",
          duration: Infinity,
        });
      }
    });

    intervalRef.current = setInterval(checkConnection, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      supabase.removeChannel(channel);
    };
  }, [queryClient]);
}
