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
  // If entry exists, interest should only apply to the remainder (body)
  const valorEntrada = item.entrada ? Math.max(0, item.valor_entrada ?? 0) : 0;
  const valorCorpo = Math.max(0, item.valor_base - valorEntrada);

  // No interest scenario
  if (item.juros_tipo === "sem_juros" || item.juros_valor <= 0) {
    return {
      effectiveResponsavel: item.juros_responsavel,
      valorJuros: 0,
      valorBase: item.valor_base,
      valorComJuros: item.valor_base,
      valorParaParcelas: item.valor_base,
      hasInterest: false,
    };
  }

  // Calculate interest amount based on valorCorpo (the part that actually gets financed)
  const valorJuros = item.juros_tipo === "percentual"
    ? round2(valorCorpo * (item.juros_valor / 100))
    : round2(item.juros_valor);

  const valorComJuros = round2(item.valor_base + valorJuros);

  // Defensive fallback: interest > 0 but responsavel "nao_aplica" → "cliente"
  const effectiveResponsavel: JurosResponsavel =
    item.juros_responsavel === "nao_aplica" ? "cliente" : item.juros_responsavel;

  // Client pays → installments include interest over the body
  // Company absorbs → installments only body value
  const corpoComJuros = effectiveResponsavel === "cliente" ? round2(valorCorpo + valorJuros) : valorCorpo;
  
  // Total to be split is Entrada + Body (with or without interest)
  const valorParaParcelas = round2(valorEntrada + corpoComJuros);

  return {
    effectiveResponsavel,
    valorJuros,
    valorBase: item.valor_base,
    valorComJuros,
    valorParaParcelas,
    hasInterest: true,
  };
}
