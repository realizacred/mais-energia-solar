/**
 * syncLogger — Canonical utility for logging integration sync runs.
 * SSOT for integration_sync_runs table operations.
 */
import { supabase } from "@/integrations/supabase/client";

export interface SyncRunInput {
  provider: string;
  sync_type: string;
  integration_config_id?: string;
}

export interface SyncRunResult {
  items_processed?: number;
  items_created?: number;
  items_updated?: number;
  items_failed?: number;
  metadata?: Record<string, any>;
}

export const syncLogger = {
  /** Start a new sync run */
  async start(input: SyncRunInput) {
    const { data, error } = await supabase
      .from("integration_sync_runs")
      .insert({
        provider: input.provider,
        sync_type: input.sync_type,
        integration_config_id: input.integration_config_id || null,
        status: "running",
        started_at: new Date().toISOString(),
      } as any)
      .select("id")
      .single();
    if (error) throw error;
    return { id: data.id };
  },

  /** Mark sync run as completed */
  async finish(runId: string, result: SyncRunResult) {
    const { error } = await supabase
      .from("integration_sync_runs")
      .update({
        status: "completed",
        finished_at: new Date().toISOString(),
        items_processed: result.items_processed ?? 0,
        items_created: result.items_created ?? 0,
        items_updated: result.items_updated ?? 0,
        items_failed: result.items_failed ?? 0,
        metadata: result.metadata ?? {},
      } as any)
      .eq("id", runId);
    if (error) console.error("[syncLogger] finish error:", error.message);
  },

  /** Mark sync run as failed */
  async error(runId: string, errorMsg: string) {
    const { error } = await supabase
      .from("integration_sync_runs")
      .update({
        status: "error",
        finished_at: new Date().toISOString(),
        error_summary: errorMsg.slice(0, 1000),
      } as any)
      .eq("id", runId);
    if (error) console.error("[syncLogger] error logging:", error.message);
  },
};
