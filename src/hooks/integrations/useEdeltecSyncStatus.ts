/**
 * useEdeltecSyncStatus — Hook para status da sincronização Edeltec.
 * §16: Queries só em hooks. RB-04. RB-05: staleTime.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EdeltecSyncState {
  id: string;
  tenant_id: string;
  provider: string;
  mode: string;
  current_page: number;
  total_pages: number | null;
  batch_size: number;
  processed_items: number;
  inserted_items: number;
  updated_items: number;
  ignored_items: number;
  status: string;
  started_at: string | null;
  last_run_at: string | null;
  completed_at: string | null;
  last_error: string | null;
  metadata: Record<string, any>;
}

export interface EdeltecSyncLog {
  id: string;
  tenant_id: string;
  provider: string;
  level: string;
  message: string;
  payload: Record<string, any>;
  created_at: string;
}

const STALE_TIME = 1000 * 30; // 30s — real-time-ish

export function useEdeltecSyncStatus(tenantId: string | null) {
  return useQuery({
    queryKey: ["edeltec-sync-status", tenantId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("integration_sync_state")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", "edeltec")
        .maybeSingle();
      if (error) throw error;
      return data as EdeltecSyncState | null;
    },
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  });
}

export function useEdeltecSyncLogs(tenantId: string | null, limit = 50) {
  return useQuery({
    queryKey: ["edeltec-sync-logs", tenantId, limit],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("integration_sync_logs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("provider", "edeltec")
        .order("created_at", { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data || []) as EdeltecSyncLog[];
    },
    staleTime: STALE_TIME,
    enabled: !!tenantId,
  });
}
