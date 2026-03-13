/**
 * Sidebar types — shared by AdminSidebar, useNavConfig, useMenuAccess.
 *
 * ⚠️ GOVERNANCE NOTE:
 * The actual menu structure is driven by src/config/navRegistry.ts (SSOT)
 * merged with tenant overrides via useNavConfig().
 *
 * This file ONLY exports type definitions.
 * Do NOT add item/section data here — all data lives in navRegistry.ts.
 */

export interface MenuItem {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  /** Search keywords for sidebar search */
  keywords?: string[];
  /** Renders a thin divider above this item */
  separator?: boolean;
  /** Visual sub-section label rendered above the item */
  subsectionLabel?: string;
}

export interface SidebarSection {
  label: string;
  labelIcon: React.ComponentType<{ className?: string }>;
  items: MenuItem[];
  /** Tailwind classes applied to the active item */
  activeClass: string;
  /** Tailwind hover classes for inactive items */
  hoverClass: string;
  /** Tailwind classes for the section label text */
  labelClass: string;
  /** Tailwind bg class for the small colored indicator square */
  indicatorBg: string;
  /** CSS class for the indicator square (maps to sidebar-indicator-* classes) */
  indicatorClass: string;
  /** Tailwind text color class for item icons in this section */
  iconColor: string;
  /** Whether the section is expanded by default */
  defaultOpen?: boolean;
}
