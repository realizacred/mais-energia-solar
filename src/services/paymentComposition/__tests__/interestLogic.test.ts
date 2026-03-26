import { describe, it, expect } from "vitest";
import { resolveJuros } from "../resolveJuros";
import { computeItem, computeSummary, validateComposition } from "../calculator";
import { createEmptyItem, type PaymentItemInput } from "../types";

function makeItem(overrides: Partial<PaymentItemInput> = {}): PaymentItemInput {
  return { ...createEmptyItem(), valor_base: 1000, ...overrides };
}

// ═══════════════════════════════════════════════════════
// resolveJuros — SSOT
// ═══════════════════════════════════════════════════════

describe("resolveJuros", () => {
  it("returns no interest for sem_juros", () => {
    const r = resolveJuros(makeItem({ juros_tipo: "sem_juros" }));
    expect(r.hasInterest).toBe(false);
    expect(r.valorJuros).toBe(0);
    expect(r.valorParaParcelas).toBe(1000);
  });

  it("returns no interest when juros_valor is 0", () => {
    const r = resolveJuros(makeItem({ juros_tipo: "percentual", juros_valor: 0 }));
    expect(r.hasInterest).toBe(false);
    expect(r.valorJuros).toBe(0);
  });

  it("calculates percentage interest for client", () => {
    const r = resolveJuros(makeItem({
      juros_tipo: "percentual",
      juros_valor: 10,
      juros_responsavel: "cliente",
    }));
    expect(r.hasInterest).toBe(true);
    expect(r.valorJuros).toBe(100);
    expect(r.valorComJuros).toBe(1100);
    expect(r.valorParaParcelas).toBe(1100);
    expect(r.effectiveResponsavel).toBe("cliente");
  });

  it("calculates fixed interest for company", () => {
    const r = resolveJuros(makeItem({
      juros_tipo: "valor_fixo",
      juros_valor: 50,
      juros_responsavel: "empresa",
    }));
    expect(r.hasInterest).toBe(true);
    expect(r.valorJuros).toBe(50);
    expect(r.valorComJuros).toBe(1050);
    // Company absorbs → parcelas use base
    expect(r.valorParaParcelas).toBe(1000);
    expect(r.effectiveResponsavel).toBe("empresa");
  });

  it("falls back nao_aplica to cliente when interest > 0", () => {
    const r = resolveJuros(makeItem({
      juros_tipo: "percentual",
      juros_valor: 5,
      juros_responsavel: "nao_aplica",
    }));
    expect(r.effectiveResponsavel).toBe("cliente");
    expect(r.valorJuros).toBe(50);
    expect(r.valorParaParcelas).toBe(1050);
  });
});

// ═══════════════════════════════════════════════════════
// computeItem — installment generation
// ═══════════════════════════════════════════════════════

describe("computeItem", () => {
  it("generates single installment without interest", () => {
    const c = computeItem(makeItem());
    expect(c.parcelas_detalhes).toHaveLength(1);
    expect(c.parcelas_detalhes[0].valor).toBe(1000);
  });

  it("generates multiple installments with client interest", () => {
    const c = computeItem(makeItem({
      forma_pagamento: "cartao_credito",
      parcelas: 4,
      juros_tipo: "percentual",
      juros_valor: 10,
      juros_responsavel: "cliente",
      data_primeiro_vencimento: "2026-04-01",
    }));
    expect(c.parcelas_detalhes).toHaveLength(4);
    const sum = c.parcelas_detalhes.reduce((s, p) => s + p.valor, 0);
    expect(Math.abs(sum - 1100)).toBeLessThan(0.02);
  });

  it("parcelas use base value when company absorbs", () => {
    const c = computeItem(makeItem({
      forma_pagamento: "boleto",
      parcelas: 2,
      juros_tipo: "valor_fixo",
      juros_valor: 100,
      juros_responsavel: "empresa",
      data_primeiro_vencimento: "2026-04-01",
    }));
    const sum = c.parcelas_detalhes.reduce((s, p) => s + p.valor, 0);
    expect(Math.abs(sum - 1000)).toBeLessThan(0.02);
  });
});

// ═══════════════════════════════════════════════════════
// computeSummary
// ═══════════════════════════════════════════════════════

describe("computeSummary", () => {
  it("valid summary with exact match", () => {
    const items = [makeItem({ valor_base: 5000 })];
    const s = computeSummary(items, 5000);
    expect(s.is_valid).toBe(true);
    expect(s.valor_restante).toBe(0);
  });

  it("tracks client interest correctly", () => {
    const items = [makeItem({
      valor_base: 5000,
      juros_tipo: "percentual",
      juros_valor: 10,
      juros_responsavel: "cliente",
    })];
    const s = computeSummary(items, 5000);
    expect(s.total_juros_cliente).toBe(500);
    expect(s.total_pago_cliente).toBe(5500);
  });

  it("tracks company interest correctly", () => {
    const items = [makeItem({
      valor_base: 5000,
      juros_tipo: "valor_fixo",
      juros_valor: 200,
      juros_responsavel: "empresa",
    })];
    const s = computeSummary(items, 5000);
    expect(s.total_juros_empresa).toBe(200);
    expect(s.total_pago_cliente).toBe(5000);
  });
});

// ═══════════════════════════════════════════════════════
// validateComposition
// ═══════════════════════════════════════════════════════

describe("validateComposition", () => {
  it("warns when interest active but responsavel is nao_aplica", () => {
    const items = [makeItem({
      juros_tipo: "percentual",
      juros_valor: 5,
      juros_responsavel: "nao_aplica",
    })];
    const errors = validateComposition(items, 1000);
    expect(errors.some((e) => e.includes("quem paga os juros"))).toBe(true);
  });

  it("warns when parcelas > 1 without first due date", () => {
    const items = [makeItem({
      forma_pagamento: "boleto",
      parcelas: 3,
      data_primeiro_vencimento: "",
    })];
    const errors = validateComposition(items, 1000);
    expect(errors.some((e) => e.includes("primeiro vencimento"))).toBe(true);
  });

  it("no errors for valid composition", () => {
    const items = [makeItem({ valor_base: 1000 })];
    const errors = validateComposition(items, 1000);
    expect(errors).toHaveLength(0);
  });
});
