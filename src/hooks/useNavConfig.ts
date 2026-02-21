import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  NAV_REGISTRY,
  NAV_SECTION_DEFAULTS,
  type NavRegistryItem,
  type NavSectionMeta,
} from "@/config/navRegistry";
import type { SidebarSection, MenuItem } from "@/components/admin/sidebar/sidebarConfig";
import * as Icons from "lucide-react";

// Derive indicator CSS class from the indicatorBg Tailwind class
// e.g. "bg-sidebar-commercial" → "sidebar-indicator-commercial"
function deriveIndicatorClass(indicatorBg: string): string {
  const match = indicatorBg.match(/bg-sidebar-(\w+)/);
  return match ? `sidebar-indicator-${match[1]}` : "sidebar-indicator-admin";
}

// Derive icon text color from the indicatorBg Tailwind class
// e.g. "bg-sidebar-commercial" → "text-sidebar-commercial"
function deriveIconColor(indicatorBg: string): string {
  const match = indicatorBg.match(/bg-sidebar-(\w+)/);
  return match ? `text-sidebar-${match[1]}` : "text-sidebar-admin";
}

// ─── Types ───────────────────────────────────────────────────

interface NavOverride {
  nav_key: string;
  label_override: string | null;
  group_override: string | null;
  order_override: number | null;
  visible_override: boolean;
}

// ─── Icon resolver ───────────────────────────────────────────

const iconCache = new Map<string, React.ComponentType<{ className?: string }>>();

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  if (iconCache.has(name)) return iconCache.get(name)!;
  const icon = (Icons as Record<string, any>)[name];
  if (icon) {
    iconCache.set(name, icon);
    return icon;
  }
  // Fallback
  const fallback = Icons.Circle;
  iconCache.set(name, fallback);
  return fallback;
}

// ─── Hook ────────────────────────────────────────────────────

/**
 * Merges the immutable NAV_REGISTRY with tenant-specific overrides from DB.
 * Returns SidebarSection[] compatible with existing AdminSidebar.
 *
 * Guarantees:
 *  - system_critical items: never hidden, never moved
 *  - business_critical items: never hidden, can be reordered
 *  - permissions (ITEM_ACCESS) are NOT affected by overrides
 *  - routes are NOT affected by overrides
 */
export function useNavConfig(): {
  sections: SidebarSection[];
  isLoading: boolean;
} {
  const { user } = useAuth();

  const { data: overrides, isLoading } = useQuery({
    queryKey: ["nav-overrides", user?.id],
    enabled: !!user,
    staleTime: 5 * 60 * 1000, // 5 min cache
    gcTime: 15 * 60 * 1000,
    queryFn: async (): Promise<NavOverride[]> => {
      const { data, error } = await supabase
        .from("nav_overrides")
        .select("nav_key, label_override, group_override, order_override, visible_override")
        .is("role_filter", null); // tenant-wide only (no per-role yet)

      if (error) {
        console.warn("[useNavConfig] Failed to load overrides:", error.message);
        return [];
      }
      return (data ?? []) as NavOverride[];
    },
  });

  const sections = useMemo(() => {
    const overrideMap = new Map<string, NavOverride>();
    (overrides ?? []).forEach((o) => overrideMap.set(o.nav_key, o));

    // Build resolved items
    const resolvedItems: Array<{
      item: MenuItem;
      group: string;
      order: number;
      registry: NavRegistryItem;
    }> = [];

    for (const reg of NAV_REGISTRY) {
      const ov = overrideMap.get(reg.nav_key);

      // Visibility check (respecting criticality)
      let visible = true;
      if (ov && ov.visible_override === false) {
        // system_critical and business_critical CANNOT be hidden
        if (reg.criticality === "normal") {
          visible = false;
        }
      }
      if (!visible) continue;

      // Determine group (respecting criticality)
      let group = reg.group_default;
      if (ov?.group_override) {
        // system_critical items CANNOT be moved
        if (reg.criticality !== "system_critical") {
          // Validate group exists
          const validGroups = NAV_SECTION_DEFAULTS.map((s) => s.label);
          if (validGroups.includes(ov.group_override)) {
            group = ov.group_override;
          }
        }
      }

      // Determine order
      const order = ov?.order_override ?? reg.order_default;

      // Determine label
      const label = ov?.label_override ?? reg.label_default;

      const menuItem: MenuItem = {
        id: reg.nav_key,
        title: label,
        icon: resolveIcon(reg.icon),
        description: reg.description,
        keywords: reg.keywords,
        separator: reg.separator,
        subsectionLabel: reg.subsectionLabel,
      };

      resolvedItems.push({ item: menuItem, group, order, registry: reg });
    }

    // Group items by section
    const groupedMap = new Map<string, typeof resolvedItems>();
    for (const ri of resolvedItems) {
      const list = groupedMap.get(ri.group) ?? [];
      list.push(ri);
      groupedMap.set(ri.group, list);
    }

    // Build sections in default order
    const sectionMetas = [...NAV_SECTION_DEFAULTS].sort((a, b) => a.order - b.order);
    const result: SidebarSection[] = [];

    for (const meta of sectionMetas) {
      const items = groupedMap.get(meta.label);
      if (!items || items.length === 0) continue;

      // Sort items by order
      items.sort((a, b) => a.order - b.order);

      result.push({
        label: meta.label,
        labelIcon: resolveIcon(meta.icon),
        indicatorBg: meta.indicatorBg,
        indicatorClass: meta.indicatorClass || deriveIndicatorClass(meta.indicatorBg),
        iconColor: meta.iconColor || deriveIconColor(meta.indicatorBg),
        activeClass: meta.activeClass,
        hoverClass: meta.hoverClass,
        labelClass: meta.labelClass,
        defaultOpen: meta.defaultOpen,
        items: items.map((i) => i.item),
      });
    }

    return result;
  }, [overrides]);

  return { sections, isLoading };
}
