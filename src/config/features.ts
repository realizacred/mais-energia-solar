/**
 * Feature Discovery Registry — Single Source of Truth
 *
 * To announce a new feature:
 * 1. Add an `id` attribute to the target element in JSX (e.g. id="wa-media-tab")
 * 2. Add an entry here with `selector` matching that id
 * 3. Done — the SmartBeacon appears automatically for users who haven't seen it
 */
export interface FeatureHint {
  /** Unique stable key — never reuse or rename */
  id: string;
  /** CSS selector for the target element (use #id for safety) */
  selector: string;
  /** Short title shown in the tooltip / popover */
  title: string;
  /** One-line description */
  description: string;
  /** Optional: restrict to specific routes (prefix match). Empty = all routes. */
  routes?: string[];
  /** Version tag — bump to re-show to users who dismissed an older version */
  version?: number;
}

export const FEATURE_HINTS: FeatureHint[] = [
  // Example entries — remove or replace with real features
  // {
  //   id: "wa-media-tab",
  //   selector: "#wa-media-tab",
  //   title: "Galeria de Mídia",
  //   description: "Veja todas as fotos e documentos da conversa aqui.",
  //   routes: ["/admin/inbox"],
  //   version: 1,
  // },
];
