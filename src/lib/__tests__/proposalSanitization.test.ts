/**
 * §33 — Proposal sanitization + whitelist + grupo normalization
 * Tests the pure logic extracted from useWizardPersistence.
 */
import { describe, it, expect } from "vitest";

// ─── Replicated pure functions (module-private in useWizardPersistence) ───

function normalizeGrupo(g: string | null | undefined): string | null {
  if (!g) return null;
  if (g.startsWith("A")) return "A";
  if (g.startsWith("B")) return "B";
  return null;
}

function sanitizeSnapshot(snapshot: any): Record<string, unknown> | null {
  if (!snapshot) return snapshot;
  const { mapSnapshots, ...rest } = snapshot;
  return { ...rest, grupo: normalizeGrupo(rest.grupo) };
}

// ─── Whitelist of allowed UC fields for backend payload (§33) ───
const UC_WHITELIST = new Set([
  "nome", "tipo_dimensionamento", "distribuidora", "distribuidora_id",
  "subgrupo", "estado", "cidade", "fase", "tensao_rede",
  "consumo_mensal", "consumo_meses", "consumo_mensal_p", "consumo_mensal_fp",
  "tarifa_distribuidora", "tarifa_te_p", "tarifa_tusd_p", "tarifa_te_fp", "tarifa_tusd_fp",
  "demanda_preco", "demanda_contratada", "demanda_adicional",
  "custo_disponibilidade_kwh", "custo_disponibilidade_valor",
  "outros_encargos_atual", "outros_encargos_novo",
  "distancia", "tipo_telhado", "inclinacao", "desvio_azimutal",
  "taxa_desempenho", "regra_compensacao", "rateio_sugerido_creditos",
  "rateio_creditos", "imposto_energia", "fator_simultaneidade",
]);

const FORBIDDEN_UC_FIELDS = [
  "is_geradora", "regra", "grupo_tarifario", "fase_tensao",
  "demanda_consumo_rs", "demanda_geracao_rs",
  "tarifa_fio_b", "tarifa_fio_b_p", "tarifa_fio_b_fp",
  "tarifa_tarifacao_p", "tarifa_tarifacao_fp",
  "consumo_meses_p", "consumo_meses_fp",
];

function filterUcFields(uc: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};
  for (const key of Object.keys(uc)) {
    if (UC_WHITELIST.has(key)) result[key] = uc[key];
  }
  return result;
}

// ─── Tests ───────────────────────────────────────────────

describe("normalizeGrupo (§33)", () => {
  it("normalizes 'A1' to 'A'", () => expect(normalizeGrupo("A1")).toBe("A"));
  it("normalizes 'A4' to 'A'", () => expect(normalizeGrupo("A4")).toBe("A"));
  it("normalizes 'B1' to 'B'", () => expect(normalizeGrupo("B1")).toBe("B"));
  it("normalizes 'B2' to 'B'", () => expect(normalizeGrupo("B2")).toBe("B"));
  it("normalizes 'B' to 'B'", () => expect(normalizeGrupo("B")).toBe("B"));
  it("returns null for empty string", () => expect(normalizeGrupo("")).toBeNull());
  it("returns null for null", () => expect(normalizeGrupo(null)).toBeNull());
  it("returns null for undefined", () => expect(normalizeGrupo(undefined)).toBeNull());
  it("returns null for invalid group 'C1'", () => expect(normalizeGrupo("C1")).toBeNull());
});

describe("sanitizeSnapshot (§33)", () => {
  it("removes mapSnapshots from payload", () => {
    const snapshot = {
      grupo: "B1",
      potencia: 10,
      mapSnapshots: { lat: -23, lng: -46, img: "base64verylong..." },
    };
    const result = sanitizeSnapshot(snapshot);
    expect(result).not.toHaveProperty("mapSnapshots");
    expect(result).toHaveProperty("potencia", 10);
  });

  it("normalizes grupo in snapshot", () => {
    const result = sanitizeSnapshot({ grupo: "A3", valor: 100 });
    expect(result?.grupo).toBe("A");
  });

  it("handles null snapshot gracefully", () => {
    expect(sanitizeSnapshot(null)).toBeNull();
  });

  it("handles undefined snapshot gracefully", () => {
    expect(sanitizeSnapshot(undefined)).toBeUndefined();
  });

  it("preserves all other fields", () => {
    const snapshot = { grupo: "B2", nome: "Teste", potencia_kwp: 5.5 };
    const result = sanitizeSnapshot(snapshot);
    expect(result).toEqual({ grupo: "B", nome: "Teste", potencia_kwp: 5.5 });
  });
});

describe("UC field whitelist (§33)", () => {
  it("filters out forbidden frontend-only fields", () => {
    const uc: Record<string, any> = {
      nome: "UC Principal",
      tipo_dimensionamento: "BT",
      consumo_mensal: 500,
      // forbidden fields:
      is_geradora: true,
      regra: "some_rule",
      grupo_tarifario: "B1",
      fase_tensao: "tri",
      demanda_consumo_rs: 100,
      tarifa_fio_b: 0.5,
      consumo_meses_p: { jan: 100 },
    };

    const filtered = filterUcFields(uc);
    expect(filtered).toHaveProperty("nome", "UC Principal");
    expect(filtered).toHaveProperty("consumo_mensal", 500);
    
    for (const forbidden of FORBIDDEN_UC_FIELDS) {
      expect(filtered).not.toHaveProperty(forbidden);
    }
  });

  it("passes through all whitelisted fields", () => {
    const uc: Record<string, any> = {};
    UC_WHITELIST.forEach((k) => (uc[k] = "test"));
    const filtered = filterUcFields(uc);
    expect(Object.keys(filtered).length).toBe(UC_WHITELIST.size);
  });
});
