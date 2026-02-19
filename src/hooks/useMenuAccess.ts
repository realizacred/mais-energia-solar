import { useMemo } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { useRolePermissions } from "@/hooks/useRolePermissions";
import { NAV_REGISTRY, type NavPermission } from "@/config/navRegistry";
import type { SidebarSection, MenuItem } from "@/components/admin/sidebar/sidebarConfig";

/**
 * Permission map derived from NAV_REGISTRY.
 * Single source of truth — no manual duplication.
 */
const PERMISSION_MAP = new Map<string, NavPermission>(
  NAV_REGISTRY.map((r) => [r.nav_key, r.permission])
);

function canAccessByRegistry(itemId: string, isAdmin: boolean): boolean {
  const rule = PERMISSION_MAP.get(itemId) ?? "all";
  if (rule === "all") return true;
  return isAdmin;
}

/**
 * Filters sidebar sections based on user role + role_permissions table.
 * Returns only sections that have at least one accessible item.
 */
export function useMenuAccess(sections: SidebarSection[]): SidebarSection[] {
  const { isAdmin, loading } = useUserPermissions();
  const { canViewModule, hasRolePermissions, loading: rpLoading } = useRolePermissions();

  return useMemo(() => {
    if (loading || rpLoading) {
      // While loading, show only items with permission "all"
      return sections.map((s) => ({
        ...s,
        items: s.items.filter((item) => (PERMISSION_MAP.get(item.id) ?? "all") === "all"),
      })).filter((s) => s.items.length > 0);
    }

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => {
          // First check: navRegistry permission (admin_only vs all)
          if (!canAccessByRegistry(item.id, isAdmin)) return false;

          // Second check: if role_permissions are configured, enforce them
          if (!isAdmin && hasRolePermissions) {
            return canViewModule(item.id);
          }

          return true;
        }),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, isAdmin, loading, rpLoading, canViewModule, hasRolePermissions]);
}

/**
 * Check if a single item is accessible.
 * Useful for favorites filtering.
 */
export function useCanAccessItem() {
  const { isAdmin } = useUserPermissions();
  const { canViewModule, hasRolePermissions } = useRolePermissions();

  return (itemId: string) => {
    if (!canAccessByRegistry(itemId, isAdmin)) return false;
    if (!isAdmin && hasRolePermissions) return canViewModule(itemId);
    return true;
  };
}
