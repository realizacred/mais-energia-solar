/**
 * ═══════════════════════════════════════════════════════════════
 * Visual Proposal Builder — Canonical Types
 * ═══════════════════════════════════════════════════════════════
 * 
 * JSON é a FONTE CANÔNICA. Toda manipulação do builder opera
 * sobre arrays de TemplateBlock. A árvore é derivada via buildTree.
 */

// ── Block Types ──────────────────────────────────────────────

export type BlockType =
  // Layout
  | "section"
  | "column"
  | "inner_section"
  // Básico
  | "editor"
  | "image"
  | "video"
  | "button"
  | "divider"
  // Avançado
  | "carousel"
  | "gallery"
  | "accordion"
  | "tabs";

export type ProposalType = "grid" | "hybrid" | "dual";

// ── Block Style ──────────────────────────────────────────────

export interface BlockStyle {
  // Spacing
  marginTop?: string;
  marginRight?: string;
  marginBottom?: string;
  marginLeft?: string;
  paddingTop?: string;
  paddingRight?: string;
  paddingBottom?: string;
  paddingLeft?: string;
  
  // Background
  backgroundColor?: string;
  backgroundGradient?: string;
  useGradient?: boolean;
  gradientStart?: string;
  gradientEnd?: string;
  gradientDirection?: string;
  useAnimatedGradient?: boolean;
  gradientColor1?: string;
  gradientColor2?: string;
  gradientColor3?: string;
  gradientColor4?: string;
  gradientAngle?: number;
  staticGradientAngle?: number;
  
  // Border
  borderWidth?: string;
  borderColor?: string;
  borderRadius?: string;
  boxShadow?: string;
  useGradientBorder?: boolean;
  borderGradientStart?: string;
  borderGradientEnd?: string;
  borderGradientAngle?: number;
  
  // Typography
  fontFamily?: string;
  fontSize?: string;
  fontWeight?: string;
  textAlign?: string;
  color?: string;
  
  // Animation
  animation?: string;
  animationDuration?: string;
  
  // Shape Dividers
  useShapeDividerTop?: boolean;
  shapeDividerTopType?: string;
  shapeDividerTopColor?: string;
  shapeDividerTopHeight?: number;
  shapeDividerTopWidth?: number;
  useShapeDividerBottom?: boolean;
  shapeDividerBottomType?: string;
  shapeDividerBottomColor?: string;
  shapeDividerBottomHeight?: number;
  shapeDividerBottomWidth?: number;
  
  // Layout
  width?: number;
  alignItems?: string;
  alignSelf?: string;
  contentWidth?: string;
  justifyContent?: string;
  verticalAlign?: string;
  
  // Section-specific
  btnShadowStyle?: string;
  
  // Mobile-specific
  mobileColumnLayout?: string;
  columnGap?: string;
  dividerHeight?: number;
  
  // Catch-all for extra props from JSON
  [key: string]: unknown;
}

// ── Template Block (flat, as stored in JSON) ─────────────────

export interface TemplateBlock {
  id: string;
  type: BlockType;
  content: string;
  style: BlockStyle;
  isVisible: boolean;
  parentId: string | null;
  order: number;
  _proposalType: ProposalType;
  mobileStyle?: Partial<BlockStyle>;
  mobileContent?: string;
  pageId?: string;
}

// ── Tree Node (derived for rendering) ────────────────────────

export interface TreeNode {
  block: TemplateBlock;
  children: TreeNode[];
}

// ── Editor State ─────────────────────────────────────────────

export type DevicePreview = "desktop" | "tablet" | "mobile";
export type EditorMode = "edit" | "preview";

export interface BuilderState {
  blocks: TemplateBlock[];
  selectedBlockId: string | null;
  hoveredBlockId: string | null;
  device: DevicePreview;
  mode: EditorMode;
  proposalType: ProposalType;
  undoStack: TemplateBlock[][];
  redoStack: TemplateBlock[][];
  isDirty: boolean;
}

// ── Widget Registry Entry ────────────────────────────────────

export interface WidgetRegistryEntry {
  key: BlockType;
  label: string;
  icon: string; // Lucide icon name
  category: WidgetCategory;
  defaultBlock: Partial<TemplateBlock>;
  allowedParents: BlockType[];
  requiredVariables?: string[];
}

export type WidgetCategory = "layout" | "basic" | "advanced" | "system";

// ── Actions ──────────────────────────────────────────────────

export type BuilderAction =
  | { type: "SET_BLOCKS"; blocks: TemplateBlock[] }
  | { type: "SELECT_BLOCK"; id: string | null }
  | { type: "HOVER_BLOCK"; id: string | null }
  | { type: "ADD_BLOCK"; block: TemplateBlock; parentId: string | null; index?: number }
  | { type: "REMOVE_BLOCK"; id: string }
  | { type: "UPDATE_BLOCK"; id: string; updates: Partial<TemplateBlock> }
  | { type: "MOVE_BLOCK"; id: string; newParentId: string | null; newIndex: number }
  | { type: "SET_DEVICE"; device: DevicePreview }
  | { type: "SET_MODE"; mode: EditorMode }
  | { type: "SET_PROPOSAL_TYPE"; proposalType: ProposalType }
  | { type: "UNDO" }
  | { type: "REDO" }
  | { type: "MARK_CLEAN" };
