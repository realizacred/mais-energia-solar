/**
 * SMOKE TEST — Fluxo Crítico: Cliente → Proposta → PDF
 *
 * Testa a cadeia completa de lógica de negócio sem banco real:
 * 1. Resolver de variáveis detecta dados obrigatórios
 * 2. Resolver gera mapa completo quando contexto é válido
 * 3. PDF é gerado como Blob válido a partir dos dados
 * 4. Download helper cria filename correto
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  resolveProposalVariables,
  type ProposalResolverContext,
} from "@/lib/resolveProposalVariables";
import { generateProposalPdf, downloadProposalPdf } from "@/lib/proposalPdf";

// ── Fixtures ────────────────────────────────────────────────

const VALID_CLIENT = {
  nome: "Maria Energia Solar",
  cidade: "Uberlândia",
  estado: "MG",
  bairro: "Centro",
  celular: "(34) 99999-0000",
  email: "maria@email.com",
  cnpj_cpf: "123.456.789-00",
};

const VALID_UC = {
  id: "uc-1",
  uc_index: 1,
  nome: "UC Principal",
  is_geradora: true,
  consumo_mensal: 600,
  distribuidora: "CEMIG",
  fase: "trifasico",
  tipo_telhado: "Metálico",
  tarifa_distribuidora: 0.89,
  custo_disponibilidade_kwh: 100,
  tensao_rede: "220V",
};

function buildFullContext(): ProposalResolverContext {
  return {
    cliente: VALID_CLIENT,
    ucs: [VALID_UC] as any,
    potenciaKwp: 8.8,
    precoTotal: 42000,
    geracaoMensal: 1050,
    economiaMensal: 480,
    economiaAnual: 5760,
    economia25Anos: 144000,
    paybackAnos: 3.5,
    co2Evitado: 2800,
    consultorNome: "João Vendedor",
    consultorCodigo: "JV001",
    empresaNome: "Solar Tech LTDA",
    empresaTelefone: "(34) 3333-4444",
    tariffVersion: {
      te_kwh: 0.45,
      tusd_total_kwh: 0.44,
      fio_b_real_kwh: 0.28,
      precisao: "exato",
      origem: "ANEEL",
      vigencia_inicio: "2026-01-01",
    },
    gdResult: {
      geracao_kwh: 1050,
      consumo_kwh: 600,
      custo_disponibilidade_kwh: 100,
      consumo_compensavel_kwh: 500,
      energia_compensada_kwh: 500,
      regra_aplicada: "GD_II",
      fio_b_percent_cobrado: 0.6,
      valor_credito_kwh: 0.59,
      valor_credito_breakdown: {
        te: 0.45,
        fio_b_compensado: 0.14,
        fio_b_fonte: "real" as const,
      },
      precisao: "exato",
      precisao_motivo: "Fio B real disponível",
      economia_mensal_rs: 480,
      vigencia_tariff: "2026-01-01",
      origem_tariff: "ANEEL",
      incompleto_gd3: false,
      regra_nao_modelada: false,
      alertas: [],
    },
  };
}

// ── 1. Resolver: detecta dados faltantes ────────────────────

describe("Smoke: Resolver — detecção de dados obrigatórios", () => {
  it("bloqueia PDF quando cliente.nome está ausente", () => {
    const ctx: ProposalResolverContext = {
      ucs: [VALID_UC] as any,
      potenciaKwp: 8.8,
      precoTotal: 42000,
    };
    const result = resolveProposalVariables(ctx);
    expect(result.canGeneratePdf).toBe(false);
    expect(result.missing_required).toContain("cliente.nome");
  });

  it("bloqueia PDF quando precoTotal está ausente", () => {
    const ctx: ProposalResolverContext = {
      cliente: VALID_CLIENT,
      ucs: [VALID_UC] as any,
      potenciaKwp: 8.8,
    };
    const result = resolveProposalVariables(ctx);
    expect(result.canGeneratePdf).toBe(false);
    expect(result.missing_required).toContain("financeiro.preco_total");
  });

  it("bloqueia PDF quando potenciaKwp está ausente", () => {
    const ctx: ProposalResolverContext = {
      cliente: VALID_CLIENT,
      ucs: [VALID_UC] as any,
      precoTotal: 42000,
    };
    const result = resolveProposalVariables(ctx);
    expect(result.canGeneratePdf).toBe(false);
    expect(result.missing_required).toContain("sistema_solar.potencia_sistema");
  });

  it("bloqueia PDF quando contexto está completamente vazio", () => {
    const result = resolveProposalVariables({});
    expect(result.canGeneratePdf).toBe(false);
    expect(result.missing_required.length).toBeGreaterThanOrEqual(4);
  });
});

// ── 2. Resolver: gera variáveis completas ───────────────────

describe("Smoke: Resolver — contexto completo", () => {
  it("permite PDF com contexto completo", () => {
    const ctx = buildFullContext();
    const result = resolveProposalVariables(ctx);
    expect(result.canGeneratePdf).toBe(true);
    expect(result.missing_required).toEqual([]);
  });

  it("resolve nome do cliente corretamente", () => {
    const result = resolveProposalVariables(buildFullContext());
    expect(result.variables["cliente.nome"]).toBe("Maria Energia Solar");
  });

  it("resolve preço total formatado em BRL", () => {
    const result = resolveProposalVariables(buildFullContext());
    expect(result.variables["financeiro.preco_total"]).toContain("42.000");
  });

  it("resolve economia mensal do GD result", () => {
    const result = resolveProposalVariables(buildFullContext());
    expect(result.variables["calculo.economia_mensal_rs"]).toContain("480");
  });

  it("não retorna nenhum valor undefined", () => {
    const result = resolveProposalVariables(buildFullContext());
    for (const [, value] of Object.entries(result.variables)) {
      expect(value).toBeDefined();
      expect(typeof value).toBe("string");
    }
  });

  it("precisao é 'exato' quando fio_b_real existe", () => {
    const result = resolveProposalVariables(buildFullContext());
    expect(result.precisao).toBe("exato");
  });
});

// ── 3. PDF Generation ───────────────────────────────────────

describe("Smoke: PDF Generation", () => {
  it("gera PDF como Blob válido", async () => {
    const blob = await generateProposalPdf({
      clienteNome: "Maria Energia Solar",
      clienteTelefone: "(34) 99999-0000",
      clienteCidade: "Uberlândia",
      clienteEstado: "MG",
      clienteBairro: "Centro",
      consumoMedio: 600,
      tipoTelhado: "Metálico",
      redeAtendimento: "Trifásico",
      area: "50m²",
      potenciaKwp: 8.8,
      numeroPlacas: 16,
      geracaoMensal: 1050,
      economiaMensal: 480,
      economiaAnual: 5760,
      economia25Anos: 144000,
      co2Evitado: 2800,
      investimentoEstimado: 42000,
      paybackAnos: 3.5,
      consultorNome: "João Vendedor",
      empresaNome: "Solar Tech LTDA",
      empresaTelefone: "(34) 3333-4444",
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000); // PDF válido tem > 1KB
    expect(blob.type).toBe("application/pdf");
  });

  it("gera PDF com financiamento opcional", async () => {
    const blob = await generateProposalPdf({
      clienteNome: "Carlos Test",
      clienteTelefone: "(11) 91111-2222",
      clienteCidade: "São Paulo",
      clienteEstado: "SP",
      consumoMedio: 300,
      tipoTelhado: "Cerâmico",
      redeAtendimento: "Bifásico",
      area: "30m²",
      potenciaKwp: 4.4,
      numeroPlacas: 8,
      geracaoMensal: 550,
      economiaMensal: 250,
      economiaAnual: 3000,
      economia25Anos: 75000,
      co2Evitado: 1400,
      investimentoEstimado: 22000,
      paybackAnos: 4.2,
      financiamento: {
        banco: "BV Financeira",
        parcelas: 60,
        valorParcela: 450,
        taxaMensal: 1.29,
      },
    });

    expect(blob).toBeInstanceOf(Blob);
    expect(blob.size).toBeGreaterThan(1000);
  });
});

// ── 4. Download Helper ──────────────────────────────────────

describe("Smoke: downloadProposalPdf", () => {
  beforeEach(() => {
    // Mock DOM APIs
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:mock-url"),
      revokeObjectURL: vi.fn(),
    });
  });

  it("cria link com filename sanitizado", () => {
    const mockLink = {
      href: "",
      download: "",
      click: vi.fn(),
    };
    vi.spyOn(document, "createElement").mockReturnValue(mockLink as any);
    vi.spyOn(document.body, "appendChild").mockImplementation(() => mockLink as any);
    vi.spyOn(document.body, "removeChild").mockImplementation(() => mockLink as any);

    const blob = new Blob(["fake"], { type: "application/pdf" });
    downloadProposalPdf(blob, "Maria & João / Teste");

    expect(mockLink.download).toMatch(/^Proposta_Maria___Jo_o___Teste_/);
    expect(mockLink.download).toMatch(/\.pdf$/);
    expect(mockLink.click).toHaveBeenCalledOnce();
  });
});
