import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface WaHealthMetrics {
  inbound_24h: number;
  outbound_24h: number;
  inbound_7d: number;
  outbound_7d: number;
  outbox_pending: number;
  outbox_failed: number;
  outbox_sent: number;
  webhooks_total: number;
  webhooks_unprocessed: number;
  conversations_total: number;
  conversations_orphan: number;
  instances_total: number;
  instances_connected: number;
  instances_inactive: number; // > 6h sem last_seen
}

const STALE = 60 * 1000;

export function useWaHealthMetrics() {
  return useQuery<WaHealthMetrics>({
    queryKey: ["wa-health-metrics"],
    staleTime: STALE,
    refetchInterval: STALE,
    queryFn: async () => {
      const now = Date.now();
      const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString();
      const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString();
      const since6h = new Date(now - 6 * 60 * 60 * 1000).toISOString();

      const [
        msgIn24,
        msgOut24,
        msgIn7,
        msgOut7,
        outPending,
        outFailed,
        outSent,
        webhooksTotal,
        webhooksUnp,
        convTotal,
        convOrphan,
        instTotal,
        instConn,
        instInactive,
      ] = await Promise.all([
        supabase.from("wa_messages").select("id", { count: "exact", head: true }).eq("direction", "in").gte("created_at", since24h),
        supabase.from("wa_messages").select("id", { count: "exact", head: true }).eq("direction", "out").gte("created_at", since24h),
        supabase.from("wa_messages").select("id", { count: "exact", head: true }).eq("direction", "in").gte("created_at", since7d),
        supabase.from("wa_messages").select("id", { count: "exact", head: true }).eq("direction", "out").gte("created_at", since7d),
        supabase.from("wa_outbox").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("wa_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("wa_outbox").select("id", { count: "exact", head: true }).eq("status", "sent").gte("created_at", since24h),
        supabase.from("wa_webhook_events").select("id", { count: "exact", head: true }),
        supabase.from("wa_webhook_events").select("id", { count: "exact", head: true }).eq("processed", false),
        supabase.from("wa_conversations").select("id", { count: "exact", head: true }),
        supabase.from("wa_conversations").select("id", { count: "exact", head: true }).is("lead_id", null).is("cliente_id", null),
        supabase.from("wa_instances").select("id", { count: "exact", head: true }),
        supabase.from("wa_instances").select("id", { count: "exact", head: true }).eq("status", "connected"),
        supabase.from("wa_instances").select("id", { count: "exact", head: true }).or(`last_seen_at.is.null,last_seen_at.lt.${since6h}`),
      ]);

      return {
        inbound_24h: msgIn24.count ?? 0,
        outbound_24h: msgOut24.count ?? 0,
        inbound_7d: msgIn7.count ?? 0,
        outbound_7d: msgOut7.count ?? 0,
        outbox_pending: outPending.count ?? 0,
        outbox_failed: outFailed.count ?? 0,
        outbox_sent: outSent.count ?? 0,
        webhooks_total: webhooksTotal.count ?? 0,
        webhooks_unprocessed: webhooksUnp.count ?? 0,
        conversations_total: convTotal.count ?? 0,
        conversations_orphan: convOrphan.count ?? 0,
        instances_total: instTotal.count ?? 0,
        instances_connected: instConn.count ?? 0,
        instances_inactive: instInactive.count ?? 0,
      };
    },
  });
}
