import { describe, it, expect } from "vitest";
import { resolveProposalVariables, type ProposalResolverContext } from "../resolveProposalVariables";
import { extractTemplateVariables, auditTemplate } from "../extractTemplateVariables";

// ── resolveProposalVariables ─────────────────────────────────

describe("resolveProposalVariables", () => {
  const baseCtx: ProposalResolverContext = {
    cliente: { nome: "João Silva", cidade: "Belo Horizonte", estado: "MG" },
    ucs: [{
      id: "1", uc_index: 1, nome: "UC1", is_geradora: true,
      consumo_mensal: 500, distribuidora: "CEMIG",
      fase: "bifasico", tipo_telhado: "Cerâmico",
    }] as any,
    potenciaKwp: 6.6,
    precoTotal: 35000,
    tariffVersion: {
      te_kwh: 0.45,
      tusd_total_kwh: 0.35,
      fio_b_real_kwh: null,
      precisao: "estimado",
      precisao_motivo: "Fio B real indisponível; TUSD total usado como proxy.",
      origem: "ANEEL",
      vigencia_inicio: "2026-01-15",
    },
    gdResult: {
      geracao_kwh: 480,
      consumo_kwh: 500,
      custo_disponibilidade_kwh: 50,
      consumo_compensavel_kwh: 450,
      energia_compensada_kwh: 450,
      regra_aplicada: "GD_II",
      fio_b_percent_cobrado: 0.60,
      valor_credito_kwh: 0.59,
      valor_credito_breakdown: {
        te: 0.45,
        fio_b_compensado: 0.14,
        fio_b_fonte: "tusd_proxy" as const,
      },
      precisao: "estimado",
      precisao_motivo: "Fio B real indisponível; TUSD total usado como proxy.",
      economia_mensal_rs: 265.50,
      vigencia_tariff: "2026-01-15",
      origem_tariff: "ANEEL",
      incompleto_gd3: false,
      regra_nao_modelada: false,
      alertas: [],
    },
  };

  it("resolves required variables without missing", () => {
    const result = resolveProposalVariables(baseCtx);
    expect(result.missing_required).toEqual([]);
    expect(result.canGeneratePdf).toBe(true);
  });

  it("detects missing required variables", () => {
    const ctx: ProposalResolverContext = {};
    const result = resolveProposalVariables(ctx);
    expect(result.missing_required).toContain("cliente.nome");
    expect(result.canGeneratePdf).toBe(false);
  });

  it("resolves tariff precision correctly", () => {
    const result = resolveProposalVariables(baseCtx);
    expect(result.precisao).toBe("estimado");
    expect(result.variables["tarifa.precisao"]).toBe("ESTIMADO");
  });

  it("resolves EXATO precision when fio_b_real exists", () => {
    const ctx = {
      ...baseCtx,
      tariffVersion: { ...baseCtx.tariffVersion!, fio_b_real_kwh: 0.28, precisao: "exato" as const },
    };
    const result = resolveProposalVariables(ctx);
    expect(result.precisao).toBe("exato");
    expect(result.variables["tarifa.precisao"]).toBe("EXATO");
  });

  it("includes ESTIMADO alert text when precision is estimated", () => {
    const result = resolveProposalVariables(baseCtx);
    expect(result.variables["alerta.estimado.texto_pdf"]).toContain("ATENÇÃO");
  });

  it("returns empty alert text when precision is exact", () => {
    const ctx = {
      ...baseCtx,
      tariffVersion: { ...baseCtx.tariffVersion!, fio_b_real_kwh: 0.28, precisao: "exato" as const },
    };
    const result = resolveProposalVariables(ctx);
    expect(result.variables["alerta.estimado.texto_pdf"]).toBe("");
  });

  it("populates GD variables", () => {
    const result = resolveProposalVariables(baseCtx);
    expect(result.variables["gd.regra"]).toBe("GD II");
    expect(result.variables["gd.fio_b_percent_cobrado"]).toContain("60");
  });

  it("never returns undefined values", () => {
    const result = resolveProposalVariables(baseCtx);
    for (const [key, value] of Object.entries(result.variables)) {
      expect(value).not.toBeUndefined();
      expect(typeof value).toBe("string");
    }
  });
});

// ── extractTemplateVariables ─────────────────────────────────

describe("extractTemplateVariables", () => {
  it("extracts mustache variables", () => {
    const vars = extractTemplateVariables("Olá {{cliente.nome}}, seu consumo é {{entrada.consumo_mensal}} kWh.");
    expect(vars).toHaveLength(2);
    expect(vars[0].raw).toBe("{{cliente.nome}}");
    expect(vars[0].registered).toBe(true);
  });

  it("extracts legacy bracket variables", () => {
    const vars = extractTemplateVariables("Preço: [preco_total]");
    expect(vars).toHaveLength(1);
    expect(vars[0].raw).toBe("[preco_total]");
  });

  it("deduplicates same variable", () => {
    const vars = extractTemplateVariables("{{cliente.nome}} e {{cliente.nome}}");
    expect(vars).toHaveLength(1);
  });

  it("detects unregistered variables", () => {
    const vars = extractTemplateVariables("{{nao.existe}}");
    expect(vars[0].registered).toBe(false);
  });
});

// ── auditTemplate ────────────────────────────────────────────

describe("auditTemplate", () => {
  it("reports unregistered variables", () => {
    const result = auditTemplate("{{cliente.nome}} {{fake.variable}}");
    expect(result.totalUnregistered).toBe(1);
    expect(result.unregistered).toContain("{{fake.variable}}");
  });

  it("reports orphaned catalog entries", () => {
    const result = auditTemplate("{{cliente.nome}}");
    expect(result.orphaned.length).toBeGreaterThan(0);
  });
});
