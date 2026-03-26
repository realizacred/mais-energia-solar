// ═══════════════════════════════════════════════════════
// SSOT — Resolve Interest Logic
// Single Source of Truth for interest responsibility
// ═══════════════════════════════════════════════════════

import type { PaymentItemInput, JurosResponsavel } from "./types";

export interface ResolvedJuros {
  /** Effective responsible party (never "nao_aplica" when interest > 0) */
  effectiveResponsavel: JurosResponsavel;
  /** Interest amount in BRL */
  valorJuros: number;
  /** Base value without interest */
  valorBase: number;
  /** Base + interest (if client pays) */
  valorComJuros: number;
  /** Value to split across installments */
  valorParaParcelas: number;
  /** Whether interest is active */
  hasInterest: boolean;
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/**
 * Central interest resolver — SSOT.
 *
 * Rules:
 * 1. If juros_tipo === "sem_juros" OR juros_valor <= 0 → no interest
 * 2. If interest exists but responsavel === "nao_aplica" → fallback to "cliente"
 * 3. If responsavel === "cliente" → parcelas use valorComJuros
 * 4. If responsavel === "empresa" → parcelas use valorBase (empresa absorbs)
 */
export function resolveJuros(item: PaymentItemInput): ResolvedJuros {
  const valorBase = item.valor_base;

  // No interest scenario
  if (item.juros_tipo === "sem_juros" || item.juros_valor <= 0) {
    return {
      effectiveResponsavel: item.juros_responsavel,
      valorJuros: 0,
      valorBase,
      valorComJuros: valorBase,
      valorParaParcelas: valorBase,
      hasInterest: false,
    };
  }

  // Calculate interest amount
  const valorJuros = item.juros_tipo === "percentual"
    ? round2(valorBase * (item.juros_valor / 100))
    : round2(item.juros_valor);

  const valorComJuros = round2(valorBase + valorJuros);

  // Defensive fallback: interest > 0 but responsavel "nao_aplica" → "cliente"
  const effectiveResponsavel: JurosResponsavel =
    item.juros_responsavel === "nao_aplica" ? "cliente" : item.juros_responsavel;

  // Client pays → installments include interest
  // Company absorbs → installments only base value
  const valorParaParcelas =
    effectiveResponsavel === "cliente" ? valorComJuros : valorBase;

  return {
    effectiveResponsavel,
    valorJuros,
    valorBase,
    valorComJuros,
    valorParaParcelas,
    hasInterest: true,
  };
}
