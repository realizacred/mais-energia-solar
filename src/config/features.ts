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
  {
    id: "fiscal-tirar-nota",
    selector: "#btn-tirar-nota",
    title: "Emissão de Notas Fiscais",
    description: "As notas de serviço são enviadas automaticamente para o Asaas após o pagamento ser confirmado via Webhook.",
    routes: ["/admin/fiscal"],
    version: 1,
  },
  {
    id: "fiscal-xml-upload",
    selector: "#fiscal-xml-dropzone",
    title: "Importação de XMLs",
    description: "Arraste os XMLs de compra dos seus kits solares para manter o controle de entrada fiscal.",
    routes: ["/admin/fiscal"],
    version: 1,
  },
];
