// ─── Smart Etiqueta (Tag) System ─────────────────────────────
// Centralized tag definitions for Fornecedor, Pagamento and Prioridade.
// All components MUST import from here to ensure visual consistency.

export interface EtiquetaConfig {
  value: string;
  label: string;
  grupo: "fornecedor" | "pagamento" | "prioridade";
  grupoLabel: string;
  /** Tailwind classes for the badge */
  className: string;
  /** Short abbreviation for compact card view */
  short?: string;
  icon?: string; // emoji or icon hint
}

export const ETIQUETA_GRUPOS = [
  { value: "fornecedor", label: "Fornecedor" },
  { value: "pagamento", label: "Forma de pagamento" },
  { value: "prioridade", label: "Prioridade / Alertas" },
] as const;

export const ETIQUETAS: EtiquetaConfig[] = [
  // ── Fornecedores ──
  {
    value: "weg",
    label: "WEG",
    grupo: "fornecedor",
    grupoLabel: "Fornecedor",
    className: "bg-[hsl(210,80%,92%)] text-[hsl(210,80%,30%)] border-[hsl(210,60%,80%)]",
    short: "WEG",
    icon: "🟦",
  },
  {
    value: "growatt",
    label: "Growatt",
    grupo: "fornecedor",
    grupoLabel: "Fornecedor",
    className: "bg-[hsl(0,60%,93%)] text-[hsl(0,50%,30%)] border-[hsl(0,40%,80%)]",
    short: "GRW",
    icon: "🟥",
  },
  {
    value: "canadian",
    label: "Canadian",
    grupo: "fornecedor",
    grupoLabel: "Fornecedor",
    className: "bg-[hsl(0,0%,93%)] text-[hsl(0,0%,15%)] border-[hsl(0,0%,80%)]",
    short: "CAN",
    icon: "⬜",
  },

  // ── Forma de Pagamento ──
  {
    value: "financiado",
    label: "Financiado",
    grupo: "pagamento",
    grupoLabel: "Pagamento",
    className: "bg-warning/15 text-warning border-warning/30",
    short: "FIN",
    icon: "🏦",
  },
  {
    value: "a_vista",
    label: "À Vista",
    grupo: "pagamento",
    grupoLabel: "Pagamento",
    className: "bg-success/15 text-success border-success/30",
    short: "AV",
    icon: "💵",
  },
  {
    value: "boleto_parcelado",
    label: "Boleto Parcelado",
    grupo: "pagamento",
    grupoLabel: "Pagamento",
    className: "bg-[hsl(270,50%,92%)] text-[hsl(270,60%,35%)] border-[hsl(270,40%,80%)]",
    short: "BOL",
    icon: "📄",
  },

  // ── Prioridade / Alertas ──
  {
    value: "urgente",
    label: "Urgente",
    grupo: "prioridade",
    grupoLabel: "Prioridade",
    className: "bg-destructive text-destructive-foreground border-destructive",
    short: "URG",
    icon: "🔴",
  },
  {
    value: "aguardando_cliente",
    label: "Aguardando Cliente",
    grupo: "prioridade",
    grupoLabel: "Prioridade",
    className: "bg-primary/15 text-primary border-primary/30",
    short: "AGC",
    icon: "🟠",
  },
  {
    value: "documentacao_ok",
    label: "Documentação OK",
    grupo: "prioridade",
    grupoLabel: "Prioridade",
    className: "bg-success/15 text-success border-success/30",
    short: "DOC✓",
    icon: "✅",
  },
];

/** Lookup an etiqueta config by value */
export function getEtiquetaConfig(value: string | null | undefined): EtiquetaConfig | null {
  if (!value) return null;
  return ETIQUETAS.find(e => e.value === value) || null;
}

/** Get all etiquetas for a specific group */
export function getEtiquetasByGrupo(grupo: string): EtiquetaConfig[] {
  return ETIQUETAS.filter(e => e.grupo === grupo);
}
