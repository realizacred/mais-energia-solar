import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

export type TenantGuardStatus =
  | "loading"
  | "active"
  | "suspended"
  | "disabled"
  | "pending"
  | "user_deactivated"
  | "unknown"
  | "no_auth";

interface TenantGuardState {
  status: TenantGuardStatus;
  tenantName?: string;
  suspendedAt?: string | null;
  suspendedReason?: string | null;
}

/**
 * Checks tenant status + user ativo before rendering the app.
 * Runs once on mount and on auth change.
 */
export function useTenantGuard(userId: string | undefined) {
  const [state, setState] = useState<TenantGuardState>({ status: "loading" });

  const check = useCallback(async () => {
    if (!userId) {
      setState({ status: "no_auth" });
      return;
    }

    try {
      // 1) Check user ativo
      const { data: profile } = await supabase
        .from("profiles")
        .select("ativo, tenant_id")
        .eq("user_id", userId)
        .maybeSingle();

      if (!profile) {
        setState({ status: "no_auth" });
        return;
      }

      if (profile.ativo === false) {
        setState({ status: "user_deactivated" });
        return;
      }

      // 2) Check tenant status via RPC
      const { data: tenantInfo, error } = await supabase.rpc("get_my_tenant_status");

      if (error || !tenantInfo) {
        // Fallback: if RPC fails, allow access (anti-fragile: don't block on transient error)
        console.warn("[TenantGuard] RPC failed, allowing access:", error?.message);
        setState({ status: "active" });
        return;
      }

      const info = tenantInfo as any;
      const tenantStatus = info.status as string;

      if (tenantStatus === "active" && !info.deleted_at) {
        setState({ status: "active" });
      } else if (tenantStatus === "suspended") {
        setState({
          status: "suspended",
          tenantName: info.tenant_name,
          suspendedAt: info.suspended_at,
          suspendedReason: info.suspended_reason,
        });
      } else if (tenantStatus === "disabled" || info.deleted_at) {
        setState({ status: "disabled", tenantName: info.tenant_name });
      } else if (tenantStatus === "pending") {
        setState({ status: "pending", tenantName: info.tenant_name });
      } else {
        setState({ status: "unknown" });
      }
    } catch (err) {
      console.warn("[TenantGuard] Error, allowing access (anti-fragile):", err);
      setState({ status: "active" });
    }
  }, [userId]);

  useEffect(() => {
    check();
  }, [check]);

  return state;
}
