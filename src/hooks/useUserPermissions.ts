import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export type FeatureKey = "view_groups" | "view_hidden";

const ADMIN_ROLES = ["admin", "gerente", "financeiro"];

export function useUserPermissions(targetUserId?: string | null) {
  const { user } = useAuth();
  const effectiveUserId = targetUserId || user?.id;

  const { data, isLoading } = useQuery({
    queryKey: ["user-feature-permissions", effectiveUserId],
    enabled: !!effectiveUserId,
    staleTime: 60 * 1000,
    queryFn: async () => {
      // Check if effective user is admin (admins have all permissions)
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", effectiveUserId!);

      const isAdmin = (roles ?? []).some((r) => ADMIN_ROLES.includes(r.role));
      if (isAdmin) return { isAdmin: true, permissions: {} as Record<string, boolean> };

      // Fetch feature permissions
      const { data: perms } = await supabase
        .from("user_feature_permissions")
        .select("feature, enabled")
        .eq("user_id", effectiveUserId!);

      const permissions: Record<string, boolean> = {};
      (perms ?? []).forEach((p) => {
        permissions[p.feature] = p.enabled;
      });

      return { isAdmin: false, permissions };
    },
  });

  const hasPermission = (feature: FeatureKey): boolean => {
    if (!data) return false;
    if (data.isAdmin) return true;
    return data.permissions[feature] ?? false;
  };

  return {
    hasPermission,
    isAdmin: data?.isAdmin ?? false,
    loading: isLoading,
  };
}
