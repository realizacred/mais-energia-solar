// ═══════════════════════════════════════════════════════
// Payment Composition Engine — Calculator & Validator
// ═══════════════════════════════════════════════════════

import {
  type PaymentItemInput,
  type PaymentItemComputed,
  type ParcelaDetalhe,
  type CompositionSummary,
  FORMAS_PARCELAVEIS,
} from "./types";
import { resolveJuros } from "./resolveJuros";

/**
 * Calculates interest for a single payment item.
 * Delegates to resolveJuros (SSOT).
 */
export function calculateInterest(item: PaymentItemInput): { valor_juros: number; valor_com_juros: number } {
  const resolved = resolveJuros(item);
  return {
    valor_juros: resolved.valorJuros,
    valor_com_juros: resolved.valorComJuros,
  };
}

/**
 * Generates installment details for a payment item.
 */
export function generateInstallments(item: PaymentItemInput, valorTotal: number): ParcelaDetalhe[] {
  const parcelas: ParcelaDetalhe[] = [];
  const numParcelas = Math.max(1, item.parcelas);

  if (numParcelas === 1 || !FORMAS_PARCELAVEIS.includes(item.forma_pagamento)) {
    // Single payment
    parcelas.push({
      numero_parcela: 1,
      tipo_parcela: item.entrada ? "entrada" : "regular",
      valor: round2(valorTotal),
      vencimento: item.data_pagamento || item.data_primeiro_vencimento || new Date().toISOString().split("T")[0],
    });
    return parcelas;
  }

  // Multiple installments
  const valorParcela = round2(valorTotal / numParcelas);
  const diff = round2(valorTotal - valorParcela * numParcelas);

  const baseDate = item.data_primeiro_vencimento || item.data_pagamento || new Date().toISOString().split("T")[0];

  for (let i = 0; i < numParcelas; i++) {
    const vencimento = addDays(baseDate, i * item.intervalo_dias);
    const isFirst = i === 0;
    const isLast = i === numParcelas - 1;

    parcelas.push({
      numero_parcela: i + 1,
      tipo_parcela: isFirst && item.entrada ? "entrada" : isLast ? "final" : "regular",
      valor: round2(valorParcela + (isLast ? diff : 0)),
      vencimento,
    });
  }

  return parcelas;
}

/**
 * Computes a full payment item with interest and installments.
 * Uses resolveJuros (SSOT) for interest logic.
 */
export function computeItem(item: PaymentItemInput): PaymentItemComputed {
  const resolved = resolveJuros(item);
  const parcelas_detalhes = generateInstallments(item, resolved.valorParaParcelas);

  return {
    ...item,
    valor_juros: resolved.valorJuros,
    valor_com_juros: resolved.valorComJuros,
    parcelas_detalhes,
  };
}

/**
 * Computes the full composition summary from a list of items.
 * Uses resolveJuros (SSOT) — no inline logic duplication.
 */
export function computeSummary(items: PaymentItemInput[], valorVenda: number): CompositionSummary {
  let total_alocado = 0;
  let total_juros_cliente = 0;
  let total_juros_empresa = 0;
  let total_pago_cliente = 0;

  for (const item of items) {
    const resolved = resolveJuros(item);
    total_alocado += item.valor_base;

    if (resolved.effectiveResponsavel === "cliente") {
      total_juros_cliente += resolved.valorJuros;
      total_pago_cliente += resolved.valorComJuros;
    } else if (resolved.effectiveResponsavel === "empresa") {
      total_juros_empresa += resolved.valorJuros;
      total_pago_cliente += item.valor_base;
    } else {
      total_pago_cliente += item.valor_base;
    }
  }

  const valor_restante = round2(valorVenda - total_alocado);
  const valor_liquido_empresa = round2(total_pago_cliente - total_juros_empresa);

  return {
    valor_venda: valorVenda,
    total_alocado: round2(total_alocado),
    valor_restante,
    total_juros_cliente: round2(total_juros_cliente),
    total_juros_empresa: round2(total_juros_empresa),
    total_pago_cliente: round2(total_pago_cliente),
    valor_liquido_empresa,
    is_valid: Math.abs(valor_restante) < 0.01,
  };
}

/**
 * Validates the composition and returns error messages.
 */
export function validateComposition(
  items: PaymentItemInput[],
  valorVenda: number
): string[] {
  const errors: string[] = [];

  if (items.length === 0) {
    errors.push("Adicione pelo menos um item de pagamento.");
    return errors;
  }

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.valor_base <= 0) {
      errors.push(`Item ${i + 1}: valor deve ser maior que zero.`);
    }
    if (FORMAS_PARCELAVEIS.includes(item.forma_pagamento) && item.parcelas > 1 && !item.data_primeiro_vencimento) {
      errors.push(`Item ${i + 1}: informe a data do primeiro vencimento.`);
    }
    // Validate interest responsibility
    if (item.juros_tipo !== "sem_juros" && item.juros_valor > 0 && item.juros_responsavel === "nao_aplica") {
      errors.push(`Item ${i + 1}: defina quem paga os juros (cliente ou empresa).`);
    }
  }

  const summary = computeSummary(items, valorVenda);
  if (!summary.is_valid) {
    const diff = summary.valor_restante;
    if (diff > 0) {
      errors.push(`Faltam R$ ${diff.toFixed(2)} para completar o valor da venda.`);
    } else {
      errors.push(`Valor alocado excede a venda em R$ ${Math.abs(diff).toFixed(2)}.`);
    }
  }

  return errors;
}

// ── Helpers ───────────────────────────────────────────

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T12:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().split("T")[0];
}
