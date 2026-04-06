/**
 * Provider que ativa o heartbeat de Realtime globalmente.
 * Resolve R14 do Risk Map: WebSocket disconnect sem detecção.
 */
import { useRealtimeHeartbeat } from "@/hooks/useRealtimeHeartbeat";

export function RealtimeHeartbeatProvider() {
  useRealtimeHeartbeat();
  return null;
}
