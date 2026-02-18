import {
  Home,
  Factory,
  Building2,
  Warehouse,
  Layers,
  TreePine,
  Sun,
  LayoutGrid,
  type LucideIcon,
} from "lucide-react";

/**
 * Maps roof type labels to icons.
 * Used across the system: wizard, lead forms, ORC forms, premissas.
 */
export const ROOF_TYPE_ICONS: Record<string, LucideIcon> = {
  // Built-in types (matched by label)
  "Fibrocimento": Layers,
  "Metálico": Factory,
  "Laje": Building2,
  "Cerâmico": Home,
  "Solo": Sun,
  "Carport": Warehouse,
  "Shingle": LayoutGrid,
  "Zipado": Factory,
  "Outro": Layers,
  // Custom types may fall through to default
  "_default": Home,
};

/** Get icon for a roof type label */
export function getRoofTypeIcon(label: string): LucideIcon {
  return ROOF_TYPE_ICONS[label] || ROOF_TYPE_ICONS["_default"];
}
