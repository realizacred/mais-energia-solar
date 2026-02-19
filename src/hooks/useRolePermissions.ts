import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

interface RolePermission {
  module_key: string;
  can_view: boolean;
  can_edit: boolean;
}

/**
 * Fetches role-based module permissions for the current user's role.
 * Returns a lookup map: module_key → { canView, canEdit }
 * 
 * Admins bypass this entirely (always have full access).
 */
export function useRolePermissions() {
  const { user } = useAuth();

  const { data, isLoading } = useQuery({
    queryKey: ["user-role-permissions", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000, // 5 min cache
    queryFn: async () => {
      // 1. Get user's role
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id);

      const userRoles = (roles ?? []).map((r) => r.role);
      const isAdmin = userRoles.some((r) => ["admin", "gerente", "financeiro"].includes(r));

      if (isAdmin) {
        return { isAdmin: true, permissions: new Map<string, { canView: boolean; canEdit: boolean }>(), userRoles };
      }

      // 2. Fetch role_permissions for user's roles
      const { data: perms } = await supabase
        .from("role_permissions")
        .select("module_key, can_view, can_edit, role")
        .in("role", userRoles);

      const permMap = new Map<string, { canView: boolean; canEdit: boolean }>();

      // Merge permissions across roles (most permissive wins)
      (perms ?? []).forEach((p: RolePermission) => {
        const existing = permMap.get(p.module_key);
        if (existing) {
          permMap.set(p.module_key, {
            canView: existing.canView || p.can_view,
            canEdit: existing.canEdit || p.can_edit,
          });
        } else {
          permMap.set(p.module_key, { canView: p.can_view, canEdit: p.can_edit });
        }
      });

      return { isAdmin: false, permissions: permMap, userRoles };
    },
  });

  /**
   * Check if user can view a specific module.
   * If no role_permissions record exists, falls back to navRegistry logic.
   */
  const canViewModule = (moduleKey: string): boolean => {
    if (!data) return true; // loading — show everything
    if (data.isAdmin) return true;

    const perm = data.permissions.get(moduleKey);
    if (perm !== undefined) return perm.canView;

    // No DB record = fallback to default behavior (navRegistry permission)
    return true; // allow by default if not configured
  };

  const canEditModule = (moduleKey: string): boolean => {
    if (!data) return false;
    if (data.isAdmin) return true;

    const perm = data.permissions.get(moduleKey);
    if (perm !== undefined) return perm.canEdit;

    return false;
  };

  return {
    canViewModule,
    canEditModule,
    isAdmin: data?.isAdmin ?? false,
    userRoles: data?.userRoles ?? [],
    loading: isLoading,
    hasRolePermissions: (data?.permissions?.size ?? 0) > 0,
  };
}
