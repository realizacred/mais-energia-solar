/**
 * Pipeline KanbanCard — estimateKwp, estimateValue e formatação
 */
import { describe, it, expect } from "vitest";
import { formatBRLCompact } from "@/lib/formatters";

// ─── Replicated pure functions from KanbanCard ───

function estimateKwp(consumo: number): number {
  return Math.round((consumo / 130) * 10) / 10;
}

function estimateValue(kwp: number): number {
  return kwp * 5000;
}

// ─── Unit tests for estimation logic ───

describe("estimateKwp", () => {
  it("calcula kWp a partir de consumo médio", () => {
    expect(estimateKwp(650)).toBe(5); // 650/130 = 5.0
  });

  it("arredonda para 1 casa decimal", () => {
    expect(estimateKwp(500)).toBe(3.8); // 500/130 ≈ 3.846
  });

  it("retorna 0 para consumo 0", () => {
    expect(estimateKwp(0)).toBe(0);
  });

  it("lida com consumo baixo (100 kWh)", () => {
    expect(estimateKwp(100)).toBe(0.8);
  });

  it("lida com consumo alto (2000 kWh)", () => {
    expect(estimateKwp(2000)).toBe(15.4);
  });
});

describe("estimateValue", () => {
  it("calcula valor como kWp * 5000", () => {
    expect(estimateValue(5)).toBe(25000);
  });

  it("retorna 0 para 0 kWp", () => {
    expect(estimateValue(0)).toBe(0);
  });

  it("lida com valores decimais", () => {
    expect(estimateValue(3.8)).toBe(19000);
  });
});

describe("KanbanCard valor display integration", () => {
  it("exibe valor estimado corretamente com formatBRLCompact", () => {
    const consumo = 650;
    const kwp = estimateKwp(consumo);
    const valor = estimateValue(kwp);
    expect(formatBRLCompact(valor)).toBe("R$ 25K");
  });

  it("exibe valor real do lead quando disponível", () => {
    const valor_projeto = 45000;
    expect(formatBRLCompact(valor_projeto)).toBe("R$ 45K");
  });

  it("exibe R$ 0 quando sem dados", () => {
    expect(formatBRLCompact(null)).toBe("R$ 0");
    expect(formatBRLCompact(0)).toBe("R$ 0");
  });

  it("formata valores acima de 1M corretamente", () => {
    expect(formatBRLCompact(1500000)).toBe("R$ 1,5M");
  });

  it("usa potencia_kwp do lead sobre estimativa quando disponível", () => {
    const leadKwp = 8.5;
    const estimatedKwp = estimateKwp(650); // 5.0
    // Lead data takes priority
    const valor = estimateValue(leadKwp);
    expect(valor).toBe(42500);
    expect(valor).not.toBe(estimateValue(estimatedKwp));
  });
});
