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

/**
 * Mapeia o enum comercial `tipo_projeto_solar` (projetos / proposta_versoes)
 * para o enum técnico `tipo_sistema` usado em `proposta_kits`.
 *
 * - ampliacao  → on_grid + flag is_ampliacao = true
 * - bombeamento → off_grid
 * - on_grid / hibrido / off_grid → 1:1
 *
 * Não altera engine financeira; serve apenas para coerência de gravação
 * do kit quando o projeto carrega um tipo derivado.
 */
export type KitTipoSistema = "on_grid" | "hibrido" | "off_grid";

export function mapTipoProjetoToKitTipoSistema(
  value?: string | null
): { tipo_sistema: KitTipoSistema; is_ampliacao: boolean } {
  switch (value) {
    case "hibrido":
      return { tipo_sistema: "hibrido", is_ampliacao: false };
    case "off_grid":
    case "bombeamento":
      return { tipo_sistema: "off_grid", is_ampliacao: false };
    case "ampliacao":
      return { tipo_sistema: "on_grid", is_ampliacao: true };
    case "on_grid":
    default:
      return { tipo_sistema: "on_grid", is_ampliacao: false };
  }
}

/** Normaliza label de topologia ("Tradicional"/"Microinversor"/"Otimizador") para o enum DB. */
export type KitTopologia = "tradicional" | "microinversor" | "otimizador";

export function normalizeKitTopologia(value?: string | null): KitTopologia {
  const v = (value ?? "").toString().trim().toLowerCase();
  if (v === "microinversor" || v === "micro") return "microinversor";
  if (v === "otimizador" || v === "otimizador de potência" || v === "otimizador de potencia") return "otimizador";
  return "tradicional";
}

