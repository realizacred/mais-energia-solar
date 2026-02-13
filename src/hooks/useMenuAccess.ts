import { useMemo } from "react";
import { useUserPermissions } from "@/hooks/useUserPermissions";
import { NAV_REGISTRY, type NavPermission } from "@/config/navRegistry";
import type { SidebarSection, MenuItem } from "@/components/admin/sidebar/sidebarConfig";

/**
 * Permission map derived from NAV_REGISTRY.
 * Single source of truth — no manual duplication.
 */
const PERMISSION_MAP = new Map<string, NavPermission>(
  NAV_REGISTRY.map((r) => [r.nav_key, r.permission])
);

function canAccess(itemId: string, isAdmin: boolean): boolean {
  const rule = PERMISSION_MAP.get(itemId) ?? "all";
  if (rule === "all") return true;
  return isAdmin;
}

/**
 * Filters sidebar sections based on user role.
 * Returns only sections that have at least one accessible item.
 */
export function useMenuAccess(sections: SidebarSection[]): SidebarSection[] {
  const { isAdmin, loading } = useUserPermissions();

  return useMemo(() => {
    if (loading) {
      return sections.map((s) => ({
        ...s,
        items: s.items.filter((item) => (PERMISSION_MAP.get(item.id) ?? "all") === "all"),
      })).filter((s) => s.items.length > 0);
    }

    return sections
      .map((section) => ({
        ...section,
        items: section.items.filter((item) => canAccess(item.id, isAdmin)),
      }))
      .filter((section) => section.items.length > 0);
  }, [sections, isAdmin, loading]);
}

/**
 * Check if a single item is accessible.
 * Useful for favorites filtering.
 */
export function useCanAccessItem() {
  const { isAdmin } = useUserPermissions();
  return (itemId: string) => canAccess(itemId, isAdmin);
}
