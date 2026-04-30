/**
 * useIntegrationLogsPage — Adapter fino (RB-76).
 * Reaproveita: integration_events + integration_sync_logs (read-only).
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface IntegrationLogRow {
  id: string;
  created_at: string;
  provider: string;
  event_type: string;
  status: string;
  message: string | null;
  source: "events" | "sync_logs";
}

export function useIntegrationLogsPage() {
  return useQuery({
    queryKey: ["integrations", "connections", "logs"],
    queryFn: async (): Promise<IntegrationLogRow[]> => {
      const [evRes, logRes] = await Promise.all([
        supabase
          .from("integration_events")
          .select("id, provider, level, message, created_at")
          .order("created_at", { ascending: false })
          .limit(150),
        supabase
          .from("integration_sync_logs")
          .select("id, provider, action, status, error_message, created_at")
          .order("created_at", { ascending: false })
          .limit(150),
      ]);

      const events: IntegrationLogRow[] = (evRes.data ?? []).map((r: any) => ({
        id: `ev-${r.id}`,
        created_at: r.created_at,
        provider: r.provider,
        event_type: "event",
        status: r.level ?? "info",
        message: r.message,
        source: "events",
      }));

      const logs: IntegrationLogRow[] = (logRes.data ?? []).map((r: any) => ({
        id: `sl-${r.id}`,
        created_at: r.created_at,
        provider: r.provider,
        event_type: r.action ?? "sync",
        status: r.status ?? "info",
        message: r.error_message,
        source: "sync_logs",
      }));

      return [...events, ...logs].sort((a, b) =>
        (b.created_at ?? "").localeCompare(a.created_at ?? "")
      );
    },
    staleTime: 1000 * 30,
  });
}
