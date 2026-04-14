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

  const getProfileTenantId = async (): Promise<string | null> => {
    if (!session?.user?.id) return null;
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", session.user.id)
      .single();
    return profile?.tenant_id ?? null;
  };

  const expireNow = async () => {
    const tenantId = await getProfileTenantId();
    if (!tenantId) return 0;

    try {
      const { data, error } = await (supabase as any).rpc("expire_stale_sm_operations", {
        p_tenant_id: tenantId,
      });

      if (error) {
        console.error("[useExpireStaleSmOperations] RPC error:", error);
        return 0;
      }

      const expiredCount = data?.expired_count ?? 0;
      if (expiredCount > 0) {
        qc.invalidateQueries({ queryKey: ["sm-operation-runs"] });
      }
      return expiredCount;
    } catch (err) {
      console.error("[useExpireStaleSmOperations] Unexpected error:", err);
      return 0;
    }
  };

  /** Force-cancel ANY active operation regardless of heartbeat age */
  const forceCancelActive = async () => {
    const tenantId = await getProfileTenantId();
    if (!tenantId) return 0;

    try {
      const { data, error } = await supabase
        .from("sm_operation_runs")
        .update({
          status: "failed",
          finished_at: new Date().toISOString(),
          error_summary: "Forçado pelo usuário via botão Forçar Parada",
        } as any)
        .eq("tenant_id", tenantId)
        .in("status", ["queued", "running"])
        .select("id");

      if (error) {
        console.error("[useExpireStaleSmOperations] forceCancelActive error:", error);
        return 0;
      }

      const count = data?.length ?? 0;
      if (count > 0) {
        qc.invalidateQueries({ queryKey: ["sm-operation-runs"] });
        qc.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });
        qc.invalidateQueries({ queryKey: ["sm-proposals"] });
      }
      return count;
    } catch (err) {
      console.error("[useExpireStaleSmOperations] forceCancelActive unexpected:", err);
      return 0;
    }
  };

  // Auto-run once on mount
  useEffect(() => {
    if (!session?.user?.id || didRunRef.current) return;
    didRunRef.current = true;
    expireNow();
  }, [session?.user?.id]);

  return { expireNow, forceCancelActive };
}
