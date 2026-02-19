/**
 * ═══════════════════════════════════════════════════════════════
 * Widget Registry — Registra todos os widgets disponíveis
 * ═══════════════════════════════════════════════════════════════
 */

import type { WidgetRegistryEntry, WidgetCategory, BlockType } from "./types";

export const WIDGET_CATEGORIES: { key: WidgetCategory; label: string }[] = [
  { key: "layout", label: "LAYOUT" },
  { key: "basic", label: "BÁSICO" },
  { key: "advanced", label: "AVANÇADO" },
  { key: "system", label: "SISTEMA" },
];

const defaultStyle = {
  marginTop: "0", marginRight: "0", marginBottom: "0", marginLeft: "0",
  paddingTop: "15", paddingRight: "15", paddingBottom: "15", paddingLeft: "15",
  backgroundColor: "transparent", useGradient: false,
  borderWidth: "0", borderColor: "#E2E8F0", borderRadius: "0",
  fontFamily: "Inter", fontSize: "16", fontWeight: "400",
  textAlign: "left", color: "#1E293B",
  animation: "none", animationDuration: "0.5",
};

export const WIDGET_REGISTRY: WidgetRegistryEntry[] = [
  // ── LAYOUT ─────────────────────────────────────────────────
  {
    key: "section",
    label: "Seção",
    icon: "LayoutTemplate",
    category: "layout",
    defaultBlock: {
      type: "section",
      content: "",
      style: { ...defaultStyle, paddingTop: "0", paddingRight: "0", paddingBottom: "0", paddingLeft: "0", contentWidth: "boxed", justifyContent: "center" },
      isVisible: true,
    },
    allowedParents: [],
  },
  {
    key: "column",
    label: "Coluna",
    icon: "Columns3",
    category: "layout",
    defaultBlock: {
      type: "column",
      content: "",
      style: { ...defaultStyle, width: 100, alignItems: "center" },
      isVisible: true,
    },
    allowedParents: ["section"],
  },
  {
    key: "inner_section",
    label: "Seção Interna",
    icon: "LayoutGrid",
    category: "layout",
    defaultBlock: {
      type: "inner_section",
      content: "",
      style: { ...defaultStyle, verticalAlign: "middle", justifyContent: "center" },
      isVisible: true,
    },
    allowedParents: ["column"],
  },

  // ── BÁSICO ─────────────────────────────────────────────────
  {
    key: "editor",
    label: "Editor de texto",
    icon: "AlignLeft",
    category: "basic",
    defaultBlock: {
      type: "editor",
      content: "<p>Digite seu texto aqui...</p>",
      style: defaultStyle,
      isVisible: true,
    },
    allowedParents: ["column", "inner_section"],
  },
  {
    key: "image",
    label: "Imagem",
    icon: "ImageIcon",
    category: "basic",
    defaultBlock: {
      type: "image",
      content: "",
      style: { ...defaultStyle, textAlign: "center" },
      isVisible: true,
    },
    allowedParents: ["column", "inner_section"],
  },
  {
    key: "video",
    label: "Vídeo",
    icon: "Play",
    category: "basic",
    defaultBlock: {
      type: "video",
      content: "",
      style: defaultStyle,
      isVisible: true,
    },
    allowedParents: ["column", "inner_section"],
  },
  {
    key: "button",
    label: "Botão",
    icon: "RectangleHorizontal",
    category: "basic",
    defaultBlock: {
      type: "button",
      content: "Clique aqui",
      style: { ...defaultStyle, textAlign: "center", backgroundColor: "#3B82F6", color: "#FFFFFF", borderRadius: "8" },
      isVisible: true,
    },
    allowedParents: ["column", "inner_section"],
  },
  {
    key: "divider",
    label: "Divisor",
    icon: "Minus",
    category: "basic",
    defaultBlock: {
      type: "divider",
      content: "",
      style: { ...defaultStyle, paddingTop: "0", paddingRight: "0", paddingBottom: "0", paddingLeft: "0" },
      isVisible: true,
    },
    allowedParents: ["column", "inner_section"],
  },

  // ── AVANÇADO ───────────────────────────────────────────────
  {
    key: "carousel",
    label: "Carrossel",
    icon: "GalleryHorizontal",
    category: "advanced",
    defaultBlock: {
      type: "carousel",
      content: "[]",
      style: defaultStyle,
      isVisible: true,
    },
    allowedParents: ["column", "inner_section"],
  },
  {
    key: "gallery",
    label: "Galeria",
    icon: "LayoutGrid",
    category: "advanced",
    defaultBlock: {
      type: "gallery",
      content: "[]",
      style: defaultStyle,
      isVisible: true,
    },
    allowedParents: ["column", "inner_section"],
  },
  {
    key: "accordion",
    label: "Sanfona",
    icon: "ListCollapse",
    category: "advanced",
    defaultBlock: {
      type: "accordion",
      content: "[]",
      style: defaultStyle,
      isVisible: true,
    },
    allowedParents: ["column", "inner_section"],
  },
  {
    key: "tabs",
    label: "Abas",
    icon: "PanelTop",
    category: "advanced",
    defaultBlock: {
      type: "tabs",
      content: "[]",
      style: defaultStyle,
      isVisible: true,
    },
    allowedParents: ["column", "inner_section"],
  },
];

/** Get widgets by category */
export function getWidgetsByCategory(category: WidgetCategory): WidgetRegistryEntry[] {
  return WIDGET_REGISTRY.filter(w => w.category === category);
}

/** Get widget definition by key */
export function getWidgetDef(key: BlockType): WidgetRegistryEntry | undefined {
  return WIDGET_REGISTRY.find(w => w.key === key);
}

/** Validate if a block type can be placed inside a parent type */
export function canPlaceInside(childType: BlockType, parentType: BlockType | null): boolean {
  const widget = getWidgetDef(childType);
  if (!widget) return false;
  if (parentType === null) return widget.allowedParents.length === 0; // root only for section
  return widget.allowedParents.includes(parentType);
}
