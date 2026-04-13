/**
 * useExpireStaleSmOperations — Proactively expires stale SM operation runs.
 * Prevents "stuck" UI when user navigates away during migration and returns.
 * §16: Query in hook. §23: staleTime mandatory.
 */
import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

/**
 * Auto-expires stale sm_operation_runs on mount (once per page load).
 * Also provides a manual expireNow() for force-expire buttons.
 */
export function useExpireStaleSmOperations() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const didRunRef = useRef(false);

  const expireNow = async () => {
    if (!session?.user?.id) return 0;

    try {
      // Get tenant_id from profile
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", session.user.id)
        .single();

      if (!profile?.tenant_id) return 0;

      const { data, error } = await (supabase as any).rpc("expire_stale_sm_operations", {
        p_tenant_id: profile.tenant_id,
      });

      if (error) {
        console.error("[useExpireStaleSmOperations] RPC error:", error);
        return 0;
      }

      const expiredCount = data?.expired_count ?? 0;
      if (expiredCount > 0) {
        // Refresh operation-related queries
        qc.invalidateQueries({ queryKey: ["sm-operation-runs"] });
      }
      return expiredCount;
    } catch (err) {
      console.error("[useExpireStaleSmOperations] Unexpected error:", err);
      return 0;
    }
  };

  // Auto-run once on mount
  useEffect(() => {
    if (!session?.user?.id || didRunRef.current) return;
    didRunRef.current = true;
    expireNow();
  }, [session?.user?.id]);

  return { expireNow };
}
