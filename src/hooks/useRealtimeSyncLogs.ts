/**
 * useRealtimeSyncLogs — Realtime subscription for sync log updates.
 * All users in the tenant see sync progress live via Supabase Realtime.
 * §16: Query in hook. §23: staleTime mandatory.
 */
import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * Subscribes to realtime changes on solar_market_sync_logs.
 * Invalidates the "sm-sync-logs" query key on any INSERT or UPDATE,
 * so ALL users viewing the page see live progress updates.
 */
export function useRealtimeSyncLogs() {
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("sm-sync-logs-realtime")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "solar_market_sync_logs",
        },
        () => {
          qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });
          qc.invalidateQueries({ queryKey: ["sm-sync-progress"] });
          qc.invalidateQueries({ queryKey: ["sm-operation-runs"] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
