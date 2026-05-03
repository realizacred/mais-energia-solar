// Catálogo do tipo de projeto solar (Fase C — UI/persistência).
// Reflete o enum criado em DB (projetos.tipo_projeto_solar e proposta_versoes.tipo_projeto_solar).
// NÃO confundir com `inversores.tipo_sistema` (topologia técnica do equipamento)
// nem com `proposta_kits.tipo_sistema` (legado do kit).

export type TipoProjetoSolar =
  | "on_grid"
  | "hibrido"
  | "off_grid"
  | "ampliacao"
  | "bombeamento";

export const TIPO_PROJETO_SOLAR_OPTIONS: {
  value: TipoProjetoSolar;
  label: string;
  /** Tailwind classes para badge (usar tokens semânticos). */
  badgeClass: string;
  description: string;
}[] = [
  {
    value: "on_grid",
    label: "On-grid",
    badgeClass: "bg-info/10 text-info border-info/20",
    description: "Conectado à rede, sem bateria.",
  },
  {
    value: "hibrido",
    label: "Híbrido",
    badgeClass: "bg-primary/10 text-primary border-primary/20",
    description: "Conectado à rede com armazenamento (bateria).",
  },
  {
    value: "off_grid",
    label: "Off-grid",
    badgeClass: "bg-warning/10 text-warning border-warning/20",
    description: "Sistema isolado da rede com bateria.",
  },
  {
    value: "ampliacao",
    label: "Ampliação",
    badgeClass: "bg-accent/10 text-accent-foreground border-accent/30",
    description: "Expansão de sistema existente.",
  },
  {
    value: "bombeamento",
    label: "Bombeamento",
    badgeClass: "bg-success/10 text-success border-success/20",
    description: "Bombeamento solar / irrigação.",
  },
];

export const DEFAULT_TIPO_PROJETO_SOLAR: TipoProjetoSolar = "on_grid";

/**
 * Tipos cujo engine de cálculo / kit / template ainda NÃO foi totalmente
 * adaptado. UI deve sinalizar com badge "Em adaptação" e avisos.
 * (Fase C — apenas UX informativo, não bloqueia uso.)
 */
const TIPOS_EM_ADAPTACAO: ReadonlySet<TipoProjetoSolar> = new Set([
  "hibrido",
  "off_grid",
  "ampliacao",
  "bombeamento",
]);

export function isTipoProjetoEmAdaptacao(value?: string | null): boolean {
  return !!value && TIPOS_EM_ADAPTACAO.has(value as TipoProjetoSolar);
}

/**
 * Tipos com impacto financeiro ainda não suportado pelo engine on-grid.
 * Exibir alerta dedicado sobre cálculo financeiro.
 */
const TIPOS_FINANCEIRO_PENDENTE: ReadonlySet<TipoProjetoSolar> = new Set([
  "hibrido",
  "off_grid",
]);

export function isTipoProjetoFinanceiroPendente(value?: string | null): boolean {
  return !!value && TIPOS_FINANCEIRO_PENDENTE.has(value as TipoProjetoSolar);
}

export function getTipoProjetoSolarLabel(value?: string | null): string {
  return (
    TIPO_PROJETO_SOLAR_OPTIONS.find((o) => o.value === value)?.label || "On-grid"
  );
}

export function getTipoProjetoSolarBadgeClass(value?: string | null): string {
  return (
    TIPO_PROJETO_SOLAR_OPTIONS.find((o) => o.value === value)?.badgeClass ||
    "bg-info/10 text-info border-info/20"
  );
}
