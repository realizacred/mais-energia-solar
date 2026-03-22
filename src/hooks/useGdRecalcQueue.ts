/**
 * useGdRecalcQueue — Hooks for GD recalculation queue.
 * §16: Queries only in hooks. §23: staleTime mandatory.
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invalidateUcQueries } from "@/lib/invalidateUcQueries";
import {
  enqueueGdRecalc,
  processSingleQueueItem,
  type EnqueueRecalcInput,
} from "@/services/energia/gdAutomationService";

const STALE_TIME = 1000 * 60 * 2; // 2 min — queue needs fresher data
const QK = "gd_recalc_queue" as const;

export interface GdRecalcQueueItem {
  id: string;
  tenant_id: string;
  gd_group_id: string;
  reference_year: number;
  reference_month: number;
  trigger_type: string;
  trigger_entity_type: string | null;
  trigger_entity_id: string | null;
  status: string;
  attempts: number;
  last_error: string | null;
  requested_by: string | null;
  created_at: string;
  updated_at: string;
  processed_at: string | null;
}

/**
 * List queue items with optional status filter.
 */
export function useGdRecalcQueue(statusFilter?: string | null) {
  return useQuery({
    queryKey: [QK, statusFilter],
    queryFn: async () => {
      let q = (supabase as any)
        .from("gd_recalc_queue")
        .select("*, gd_groups(nome)")
        .order("created_at", { ascending: false })
        .limit(100);

      if (statusFilter) {
        q = q.eq("status", statusFilter);
      }

      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as (GdRecalcQueueItem & {
        gd_groups: { nome: string } | null;
      })[];
    },
    staleTime: STALE_TIME,
  });
}

/**
 * Summary KPIs for the queue.
 */
export function useGdAutomationSummary() {
  return useQuery({
    queryKey: [QK, "summary"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("gd_recalc_queue")
        .select("status");

      if (error) throw error;
      const items = data || [];

      const today = new Date().toISOString().slice(0, 10);

      // For completed today count, we need processed_at
      const { data: completedToday } = await (supabase as any)
        .from("gd_recalc_queue")
        .select("id")
        .eq("status", "completed")
        .gte("processed_at", `${today}T00:00:00-03:00`);

      return {
        pending: items.filter((i: any) => i.status === "pending").length,
        processing: items.filter((i: any) => i.status === "processing").length,
        completedToday: completedToday?.length || 0,
        failed: items.filter((i: any) => i.status === "failed").length,
      };
    },
    staleTime: STALE_TIME,
  });
}

/**
 * Enqueue a recalculation.
 */
export function useEnqueueGdRecalc() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: EnqueueRecalcInput) => {
      await enqueueGdRecalc(input);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
    },
  });
}

/**
 * Process a single queue item.
 */
export function useProcessGdRecalcItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (itemId: string) => {
      return processSingleQueueItem(itemId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [QK] });
      invalidateUcQueries(qc);
    },
  });
}
