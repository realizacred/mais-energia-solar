import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const STALE_REALTIME = 1000 * 30; // 30s — §23

export interface HealthRow {
  id: string;
  integration_name: string;
  status: string;
  last_check_at: string | null;
  latency_ms: number | null;
  error_message: string | null;
  details: Record<string, unknown> | null;
  updated_at: string;
}

export interface OutboxStats {
  pending: number;
  sending: number;
  failed: number;
  sent: number;
  totalRetries: number;
  recentFailures: { id: string; error_message: string | null; created_at: string; retry_count: number }[];
}

export interface WaIntegrityAudit {
  duplicate_conversations: number;
  technical_previews: number;
  orphan_messages: number;
  loading: boolean;
}

export function useSystemHealth() {
  // 1. Integration health cache
  const { data: integrations = [], isLoading: loadingIntegrations } = useQuery({
    queryKey: ["system-health-integrations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_health_cache")
        .select("id, tenant_id, integration_name, status, last_check_at, latency_ms, error_message, details, created_at, updated_at")
        .order("integration_name");
      if (error) throw error;
      return (data || []) as HealthRow[];
    },
    staleTime: STALE_REALTIME,
    refetchInterval: STALE_REALTIME,
  });

  // 2. WA outbox queue stats
  const { data: outboxStats, isLoading: loadingOutbox } = useQuery({
    queryKey: ["system-health-outbox"],
    queryFn: async () => {
      const [pendingRes, failedRes, sentRes, recentFailRes] = await Promise.all([
        supabase.from("wa_outbox").select("id", { count: "exact", head: true }).in("status", ["pending", "sending"]),
        supabase.from("wa_outbox").select("id", { count: "exact", head: true }).eq("status", "failed"),
        supabase.from("wa_outbox").select("id", { count: "exact", head: true }).eq("status", "sent"),
        supabase.from("wa_outbox")
          .select("id, error_message, created_at, retry_count")
          .eq("status", "failed")
          .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
          .order("created_at", { ascending: false })
          .limit(10),
      ]);

      const recentFails = recentFailRes.data || [];
      const totalRetries = recentFails.reduce((s, r) => s + (r.retry_count || 0), 0);

      return {
        pending: pendingRes.count || 0,
        sending: 0,
        failed: failedRes.count || 0,
        sent: sentRes.count || 0,
        totalRetries,
        recentFailures: recentFails,
      } as OutboxStats;
    },
    staleTime: STALE_REALTIME,
    refetchInterval: STALE_REALTIME,
  });

  // 3. WA integrity audit — checks for duplicates and technical previews
  const { data: integrityAudit, isLoading: loadingIntegrity } = useQuery({
    queryKey: ["system-health-wa-integrity"],
    queryFn: async () => {
      const [dupRes, previewRes, orphanRes] = await Promise.all([
        // Check duplicate conversations (same instance_id + phone, different remote_jid variants)
        supabase.rpc("check_wa_duplicate_conversations" as any).maybeSingle(),
        // Check technical previews still in DB
        supabase
          .from("wa_conversations")
          .select("id", { count: "exact", head: true })
          .or("last_message_preview.like.[text]%,last_message_preview.like.[contact]%,last_message_preview.like.[image]%,last_message_preview.like.[video]%,last_message_preview.like.[audio]%,last_message_preview.like.[document]%"),
        // Check orphan messages (no conversation)
        supabase.rpc("check_wa_orphan_messages" as any).maybeSingle(),
      ]);

      return {
        duplicate_conversations: (dupRes.data as any)?.count ?? 0,
        technical_previews: previewRes.count ?? 0,
        orphan_messages: (orphanRes.data as any)?.count ?? 0,
      };
    },
    staleTime: 1000 * 60 * 5, // 5 min
  });

  // Derived metrics
  const healthy = integrations.filter((i) => i.status === "healthy").length;
  const degraded = integrations.filter((i) => i.status === "degraded").length;
  const down = integrations.filter((i) => i.status === "down").length;
  const notConfigured = integrations.filter((i) => i.status === "not_configured").length;

  const avgLatency = (() => {
    const withLatency = integrations.filter((i) => i.latency_ms != null);
    if (withLatency.length === 0) return null;
    return Math.round(withLatency.reduce((s, i) => s + (i.latency_ms || 0), 0) / withLatency.length);
  })();

  const errorRate = (() => {
    const total = integrations.length;
    if (total === 0) return 0;
    return Math.round(((degraded + down) / total) * 100);
  })();

  // Overall status
  const overallStatus: "green" | "yellow" | "red" = 
    down > 0 || errorRate > 5 ? "red" :
    degraded > 0 ? "yellow" : "green";

  return {
    integrations,
    outboxStats: outboxStats || { pending: 0, sending: 0, failed: 0, sent: 0, totalRetries: 0, recentFailures: [] },
    integrityAudit: integrityAudit || { duplicate_conversations: 0, technical_previews: 0, orphan_messages: 0 },
    integrityLoading: loadingIntegrity,
    healthy,
    degraded,
    down,
    notConfigured,
    avgLatency,
    errorRate,
    overallStatus,
    isLoading: loadingIntegrations || loadingOutbox,
  };
}
