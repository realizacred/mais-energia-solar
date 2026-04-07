/**
 * Provider que ativa o heartbeat de Realtime globalmente.
 * Resolve R14 do Risk Map: WebSocket disconnect sem detecção.
 */
import { useAuth } from "@/hooks/useAuth";
import { useRealtimeHeartbeat } from "@/hooks/useRealtimeHeartbeat";

export function RealtimeHeartbeatProvider() {
  const { user, loading } = useAuth();

  useRealtimeHeartbeat({ enabled: !loading && !!user });

  return null;
}
