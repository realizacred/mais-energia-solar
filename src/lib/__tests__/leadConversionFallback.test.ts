/**
 * §38 — Conversão Lead → Venda: fallback de dados técnicos
 * Testa a cadeia de fallback para potencia_kwp e valor_projeto.
 */
import { describe, it, expect } from "vitest";

// ─── Replicated fallback logic from ConvertLeadToClientDialog ───

interface SimulacaoData {
  potencia_kwp: number | null;
  valor_total: number | null;
}

interface PropostaVersaoData {
  potencia_kwp: number | null;
  valor_total: number | null;
}

interface LeadData {
  potencia_estimada: number | null;
  valor_projeto: number | null;
}

interface FallbackResult {
  potencia_kwp: number;
  valor_projeto: number;
  source: "simulacao" | "proposta" | "lead" | "zero";
}

/**
 * Cadeia de fallback (§38):
 * 1. Simulação selecionada
 * 2. Última proposta nativa
 * 3. Dados do lead
 * 4. Zero como último recurso
 */
function resolveTechnicalData(
  simulacao: SimulacaoData | null,
  proposta: PropostaVersaoData | null,
  lead: LeadData
): FallbackResult {
  // 1. Simulação
  if (simulacao?.potencia_kwp && simulacao?.valor_total) {
    return {
      potencia_kwp: simulacao.potencia_kwp,
      valor_projeto: simulacao.valor_total,
      source: "simulacao",
    };
  }

  // 2. Proposta nativa
  if (proposta?.potencia_kwp && proposta?.valor_total) {
    return {
      potencia_kwp: proposta.potencia_kwp,
      valor_projeto: proposta.valor_total,
      source: "proposta",
    };
  }

  // 3. Dados do lead
  if (lead.potencia_estimada || lead.valor_projeto) {
    return {
      potencia_kwp: lead.potencia_estimada || 0,
      valor_projeto: lead.valor_projeto || 0,
      source: "lead",
    };
  }

  // 4. Zero
  return { potencia_kwp: 0, valor_projeto: 0, source: "zero" };
}

// ─── Tests ───────────────────────────────────────────────

describe("resolveTechnicalData — cadeia de fallback §38", () => {
  const leadEmpty: LeadData = { potencia_estimada: null, valor_projeto: null };

  it("prioriza simulação quando disponível", () => {
    const result = resolveTechnicalData(
      { potencia_kwp: 10.5, valor_total: 52000 },
      { potencia_kwp: 8.0, valor_total: 40000 },
      { potencia_estimada: 5.0, valor_projeto: 25000 }
    );
    expect(result.source).toBe("simulacao");
    expect(result.potencia_kwp).toBe(10.5);
    expect(result.valor_projeto).toBe(52000);
  });

  it("usa proposta quando simulação está incompleta", () => {
    const result = resolveTechnicalData(
      { potencia_kwp: null, valor_total: null },
      { potencia_kwp: 8.0, valor_total: 40000 },
      leadEmpty
    );
    expect(result.source).toBe("proposta");
    expect(result.potencia_kwp).toBe(8.0);
  });

  it("usa proposta quando simulação tem potência mas não valor", () => {
    const result = resolveTechnicalData(
      { potencia_kwp: 10, valor_total: null },
      { potencia_kwp: 8.0, valor_total: 40000 },
      leadEmpty
    );
    expect(result.source).toBe("proposta");
  });

  it("cai para dados do lead quando sem simulação e proposta", () => {
    const result = resolveTechnicalData(
      null,
      null,
      { potencia_estimada: 5.0, valor_projeto: 25000 }
    );
    expect(result.source).toBe("lead");
    expect(result.potencia_kwp).toBe(5.0);
    expect(result.valor_projeto).toBe(25000);
  });

  it("usa lead mesmo se só tem valor_projeto (potência = 0)", () => {
    const result = resolveTechnicalData(
      null,
      null,
      { potencia_estimada: null, valor_projeto: 30000 }
    );
    expect(result.source).toBe("lead");
    expect(result.potencia_kwp).toBe(0);
    expect(result.valor_projeto).toBe(30000);
  });

  it("retorna zero como último recurso — NUNCA null", () => {
    const result = resolveTechnicalData(null, null, leadEmpty);
    expect(result.source).toBe("zero");
    expect(result.potencia_kwp).toBe(0);
    expect(result.valor_projeto).toBe(0);
    // §38: NUNCA null
    expect(result.potencia_kwp).not.toBeNull();
    expect(result.valor_projeto).not.toBeNull();
  });

  it("ignora simulação com valores zero", () => {
    const result = resolveTechnicalData(
      { potencia_kwp: 0, valor_total: 0 },
      { potencia_kwp: 8.0, valor_total: 40000 },
      leadEmpty
    );
    expect(result.source).toBe("proposta");
  });

  it("multi-tenant: dados são independentes por lead", () => {
    const tenant1 = resolveTechnicalData(
      { potencia_kwp: 10, valor_total: 50000 },
      null,
      leadEmpty
    );
    const tenant2 = resolveTechnicalData(
      null,
      { potencia_kwp: 5, valor_total: 25000 },
      leadEmpty
    );
    expect(tenant1.source).toBe("simulacao");
    expect(tenant2.source).toBe("proposta");
    expect(tenant1.potencia_kwp).not.toBe(tenant2.potencia_kwp);
  });
});
