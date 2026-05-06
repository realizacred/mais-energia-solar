/**
 * useTenantLockState — PR-4.
 * SSOT: tenant_lock_state RPC (subscriptions canonical).
 * §16: queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface TenantLockState {
  level: "none" | "soft" | "hard";
  reason: string | null;
  since: string | null;
}

const STALE = 60_000;

async function resolveTenantId(): Promise<string | null> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return null;
  const { data: p } = await supabase
    .from("profiles")
    .select("tenant_id")
    .eq("user_id", u.user.id)
    .maybeSingle();
  return p?.tenant_id ?? null;
}

export function useTenantLockState() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["tenant-lock-state", user?.id],
    queryFn: async (): Promise<TenantLockState> => {
      const tid = await resolveTenantId();
      if (!tid) return { level: "none", reason: null, since: null };
      const { data, error } = await supabase.rpc("tenant_lock_state", { _tenant_id: tid });
      if (error) return { level: "none", reason: null, since: null };
      return (data ?? { level: "none", reason: null, since: null }) as unknown as TenantLockState;
    },
    enabled: !!user,
    staleTime: STALE,
  });
}

/**
 * Frontend gate: can this operation run under current lock state?
 * - hard → only "read" allowed
 * - soft → blocks "write" / "ai" / "automation" (allows "send" e "read")
 */
export function isOperationAllowed(
  level: TenantLockState["level"],
  operation: "read" | "write" | "ai" | "automation" | "send",
): boolean {
  if (level === "hard") return operation === "read";
  if (level === "soft") return operation === "read" || operation === "send";
  return true;
}
