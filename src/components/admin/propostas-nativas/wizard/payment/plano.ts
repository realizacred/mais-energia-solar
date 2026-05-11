// ═══════════════════════════════════════════════════════════════════════
// Payment Plan — Canonical Model (Phase 2)
// ═══════════════════════════════════════════════════════════════════════
//
// Modelo canônico de composição de pagamento.
// Diferente de `PagamentoOpcao[]` (alternativas, cada uma 100% do total),
// `PagamentoPlano` representa a COMPOSIÇÃO real: somatório dos itens = total.
//
// Este módulo é PURO (sem React, sem Supabase). Todas as funções são
// determinísticas e idempotentes — pode ser chamado em useMemo, em testes,
// em edge functions, no PDF, na proposta web.
//
// Phase 2: apenas o modelo + helpers. Não altera estado do wizard.
// Phase 3: snapshot bridge (liftLegacyToPlano).
// Phase 4: UI consome plano canônico.
// ═══════════════════════════════════════════════════════════════════════

import type { PagamentoOpcao } from "../types";

export type PagamentoItemTipo = PagamentoOpcao["tipo"];

/** Item canônico de uma composição de pagamento. */
export interface PagamentoItem {
  id: string;
  nome: string;
  tipo: PagamentoItemTipo;
  /** ★ Valor alocado deste item dentro do total. Σ itens = total_proposta. */
  valor_alocado: number;
  entrada: number;
  num_parcelas: number;
  taxa_mensal: number;
  carencia_meses: number;
  valor_parcela: number;
  banco_id?: string;
  forma_pagamento?: string;
  /** Ordem de prioridade na composição (1 = primeiro). */
  prioridade: number;
}

/** Plano canônico (composição) — soma dos itens deve igualar `total_proposta`. */
export interface PagamentoPlano {
  total_proposta: number;
  itens: PagamentoItem[];
  /**
   * Alternativas legadas (cada uma 100% do total). Mantido para retro-
   * compatibilidade com propostas que usam múltiplas opções de fechamento.
   */
  alternativas?: PagamentoOpcao[];
}

/** Resumo de validação do plano. */
export interface PagamentoPlanoSummary {
  total_proposta: number;
  total_alocado: number;
  valor_restante: number; // total_proposta - total_alocado
  is_valid: boolean;
  excedente: boolean;
  errors: string[];
  warnings: string[];
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const safe = (n: unknown) => (typeof n === "number" && Number.isFinite(n) ? n : 0);

// ─── Builders ──────────────────────────────────────────────────────────

export function createEmptyPlano(total: number): PagamentoPlano {
  return { total_proposta: r2(safe(total)), itens: [] };
}

export function itemFromOpcao(op: PagamentoOpcao, valor_alocado: number, prioridade = 1): PagamentoItem {
  return {
    id: op.id || crypto.randomUUID(),
    nome: op.nome || "Pagamento",
    tipo: op.tipo,
    valor_alocado: r2(safe(valor_alocado)),
    entrada: r2(safe(op.entrada)),
    num_parcelas: Math.max(1, Math.floor(safe(op.num_parcelas) || 1)),
    taxa_mensal: safe(op.taxa_mensal),
    carencia_meses: Math.max(0, Math.floor(safe(op.carencia_meses))),
    valor_parcela: r2(safe(op.valor_parcela)),
    forma_pagamento: op.forma_pagamento,
    prioridade,
  };
}

// ─── Lift: legado (PagamentoOpcao[]) → canônico (PagamentoPlano) ───────

/**
 * Promove o estado legado para o modelo canônico.
 *
 * Regras:
 *  - 0 opções → plano vazio
 *  - 1 opção  → 1 item com valor_alocado = total_proposta
 *  - N opções (mesmo tipo "direto" misturado) → trata como composição:
 *      cada item recebe valor_alocado proporcional ao seu valor_financiado
 *      (ou entrada, se for à vista). Resíduo vai para o último item.
 *  - N opções alternativas (cada uma 100%) → 1 item placeholder + alternativas[]
 *
 * Heurística para distinguir composição vs alternativas:
 *  - Se TODAS as opções têm `valor_financiado >= total * 0.95`, são alternativas.
 *  - Caso contrário, é composição (split payment).
 */
export function liftLegacyToPlano(
  opcoes: PagamentoOpcao[] | undefined | null,
  total_proposta: number,
): PagamentoPlano {
  const total = r2(safe(total_proposta));
  const list = Array.isArray(opcoes) ? opcoes.filter(Boolean) : [];

  if (list.length === 0) return { total_proposta: total, itens: [] };

  if (list.length === 1) {
    return {
      total_proposta: total,
      itens: [itemFromOpcao(list[0], total, 1)],
    };
  }

  // Detecta alternativas (cada opção cobre quase todo o total)
  const limiar = total * 0.95;
  const todasCobremTotal = total > 0 && list.every((op) => {
    const valorOp = safe(op.valor_financiado) + safe(op.entrada);
    return valorOp >= limiar;
  });

  if (todasCobremTotal) {
    // Tratamento: 1 item primário (a primeira) + alternativas restantes
    return {
      total_proposta: total,
      itens: [itemFromOpcao(list[0], total, 1)],
      alternativas: list.slice(1),
    };
  }

  // Composição real: distribui valor_alocado proporcional
  const pesos = list.map((op) => safe(op.valor_financiado) || safe(op.entrada) || 0);
  const somaPesos = pesos.reduce((a, b) => a + b, 0);

  if (somaPesos <= 0) {
    // Sem pesos: divide igualmente
    const fatia = r2(total / list.length);
    const itens = list.map((op, i) => itemFromOpcao(op, fatia, i + 1));
    // Ajusta resíduo no último
    const soma = itens.reduce((a, b) => a + b.valor_alocado, 0);
    if (itens.length > 0) itens[itens.length - 1].valor_alocado = r2(itens[itens.length - 1].valor_alocado + (total - soma));
    return { total_proposta: total, itens };
  }

  const itens: PagamentoItem[] = [];
  let alocadoAcum = 0;
  list.forEach((op, i) => {
    const isLast = i === list.length - 1;
    const fatia = isLast ? r2(total - alocadoAcum) : r2((pesos[i] / somaPesos) * total);
    alocadoAcum += fatia;
    itens.push(itemFromOpcao(op, fatia, i + 1));
  });
  return { total_proposta: total, itens };
}

// ─── Project: canônico → legado (PagamentoOpcao[]) ─────────────────────

/** Projeta o plano canônico para o formato legado consumido pelo PDF/web atual. */
export function projectPlanoToOpcoes(plano: PagamentoPlano): PagamentoOpcao[] {
  const itens = plano.itens.map<PagamentoOpcao>((it) => ({
    id: it.id,
    nome: it.nome,
    tipo: it.tipo,
    // Mantém compat: para tipo "a_vista" valor_financiado costuma ser o total à vista
    valor_financiado: it.valor_alocado,
    entrada: it.entrada,
    taxa_mensal: it.taxa_mensal,
    carencia_meses: it.carencia_meses,
    num_parcelas: it.num_parcelas,
    valor_parcela: it.valor_parcela,
    forma_pagamento: it.forma_pagamento,
  }));
  if (plano.alternativas && plano.alternativas.length > 0) {
    return [...itens, ...plano.alternativas];
  }
  return itens;
}

// ─── Recalc parcela (puro) ─────────────────────────────────────────────

export function recalcParcela(item: PagamentoItem): PagamentoItem {
  const principal = Math.max(0, r2(item.valor_alocado - item.entrada));
  const n = Math.max(1, Math.floor(item.num_parcelas));
  const i = Math.max(0, item.taxa_mensal) / 100;
  let parcela = principal / n;
  if (i > 0 && n > 1) {
    const f = (i * Math.pow(1 + i, n)) / (Math.pow(1 + i, n) - 1);
    parcela = principal * f;
  }
  return { ...item, valor_parcela: r2(parcela) };
}

// ─── Validation ────────────────────────────────────────────────────────

export function validatePagamentoPlano(plano: PagamentoPlano): PagamentoPlanoSummary {
  const errors: string[] = [];
  const warnings: string[] = [];
  const total = r2(safe(plano.total_proposta));
  const total_alocado = r2(plano.itens.reduce((a, b) => a + safe(b.valor_alocado), 0));
  const valor_restante = r2(total - total_alocado);
  const tolerancia = 0.01;

  for (const it of plano.itens) {
    if (it.entrada < 0) errors.push(`Entrada negativa em "${it.nome}".`);
    if (it.entrada > it.valor_alocado + tolerancia) {
      errors.push(`Entrada (${it.entrada}) maior que valor alocado (${it.valor_alocado}) em "${it.nome}".`);
    }
    if (it.num_parcelas < 1) errors.push(`Número de parcelas inválido em "${it.nome}".`);
    if (it.taxa_mensal < 0) errors.push(`Taxa negativa em "${it.nome}".`);
  }

  if (plano.itens.length > 0 && Math.abs(valor_restante) > tolerancia) {
    if (valor_restante > 0) {
      errors.push(`Faltam R$ ${valor_restante.toFixed(2)} para completar o total.`);
    } else {
      errors.push(`Excedente de R$ ${Math.abs(valor_restante).toFixed(2)} acima do total.`);
    }
  }

  return {
    total_proposta: total,
    total_alocado,
    valor_restante,
    is_valid: errors.length === 0,
    excedente: valor_restante < -tolerancia,
    errors,
    warnings,
  };
}

// ─── Reconcile (helpers para Phase 4 UI) ───────────────────────────────

/** Distribui automaticamente o restante no item de menor prioridade (último). */
export function distribuirRestante(plano: PagamentoPlano): PagamentoPlano {
  if (plano.itens.length === 0) return plano;
  const summary = validatePagamentoPlano(plano);
  if (Math.abs(summary.valor_restante) < 0.01) return plano;
  const sorted = [...plano.itens].sort((a, b) => b.prioridade - a.prioridade);
  const ultimo = sorted[0];
  const novoValor = r2(ultimo.valor_alocado + summary.valor_restante);
  if (novoValor < 0) return plano;
  const itens = plano.itens.map((it) =>
    it.id === ultimo.id ? recalcParcela({ ...it, valor_alocado: novoValor }) : it,
  );
  return { ...plano, itens };
}
