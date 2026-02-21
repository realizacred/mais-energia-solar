// ─── Grupo Consistency Validation ──────────────────────────
// Ensures all UCs in a proposal belong to the same tariff group (A or B).
// This is a regulatory requirement — mixed groups have incompatible tariff structures.

export type GrupoTarifario = "A" | "B";

export interface GrupoValidationResult {
  valid: boolean;
  grupo: GrupoTarifario | null;
  error?: "mixed_grupos" | "grupo_indefinido";
  /** Indices of UCs that diverge from the majority grupo */
  divergentIndices?: number[];
  /** Per-UC resolved grupo */
  grupos: (GrupoTarifario | null)[];
}

const SUBGRUPOS_A = ["A1", "A2", "A3", "A3a", "A4", "AS"];
const SUBGRUPOS_B = ["B1", "B2", "B3"];

/**
 * Resolves the tariff group for a single UC based on subgrupo.
 * If subgrupo is missing/empty, returns null (indeterminate).
 */
export function resolveGrupoFromSubgrupo(subgrupo: string | undefined | null): GrupoTarifario | null {
  if (!subgrupo) return null;
  const upper = subgrupo.toUpperCase();
  if (SUBGRUPOS_A.some(s => s.toUpperCase() === upper)) return "A";
  if (SUBGRUPOS_B.some(s => s.toUpperCase() === upper)) return "B";
  // Fallback: if starts with A → A, B → B
  if (upper.startsWith("A")) return "A";
  if (upper.startsWith("B")) return "B";
  return null;
}

/**
 * Validates that all UCs have the same tariff group.
 * Returns validation result with divergent UC indices.
 */
export function validateGrupoConsistency(
  ucs: Array<{ subgrupo?: string; grupo_tarifario?: string }>
): GrupoValidationResult {
  const grupos: (GrupoTarifario | null)[] = ucs.map(uc => {
    // First try subgrupo (authoritative)
    const fromSubgrupo = resolveGrupoFromSubgrupo(uc.subgrupo);
    if (fromSubgrupo) return fromSubgrupo;
    // Fallback to grupo_tarifario field
    if (uc.grupo_tarifario === "A" || uc.grupo_tarifario === "B") return uc.grupo_tarifario;
    return null;
  });

  // Check for undefined
  const undefinedIdx = grupos.findIndex(g => g === null);
  if (undefinedIdx >= 0) {
    return {
      valid: false,
      grupo: null,
      error: "grupo_indefinido",
      divergentIndices: grupos.map((g, i) => g === null ? i : -1).filter(i => i >= 0),
      grupos,
    };
  }

  // Check for mixed
  const uniqueGrupos = new Set(grupos);
  if (uniqueGrupos.size > 1) {
    // Find the majority grupo
    const countA = grupos.filter(g => g === "A").length;
    const countB = grupos.filter(g => g === "B").length;
    const majority: GrupoTarifario = countA >= countB ? "A" : "B";
    const divergent = grupos.map((g, i) => g !== majority ? i : -1).filter(i => i >= 0);

    return {
      valid: false,
      grupo: majority,
      error: "mixed_grupos",
      divergentIndices: divergent,
      grupos,
    };
  }

  return {
    valid: true,
    grupo: grupos[0] as GrupoTarifario,
    grupos,
  };
}

// ─── Calculation Engine Router ─────────────────────────────
// Architecture: separate calc paths for A vs B

export interface CalcGrupoAResult {
  // Placeholder — Grupo A motor not yet implemented
  placeholder: true;
  message: string;
}

/**
 * Placeholder for Grupo A calculation engine.
 * Will be implemented when Grupo A tariff rules are finalized.
 */
export function calcGrupoA(_input: unknown): CalcGrupoAResult {
  return {
    placeholder: true,
    message: "Motor de cálculo Grupo A ainda não implementado. Use o wizard apenas para Grupo B.",
  };
}
