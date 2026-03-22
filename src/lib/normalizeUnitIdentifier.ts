/**
 * normalizeUnitIdentifier — Normaliza identificadores de UC para comparação.
 * Remove espaços, barras, hífens e caracteres especiais.
 */
export function normalizeUnitIdentifier(raw: string | null | undefined): string {
  if (!raw) return "";
  return raw
    .replace(/[\s\-\/\\.\,\;\:\#\*\(\)]/g, "")
    .replace(/[^\w]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Compara dois identificadores normalizados e retorna status + score.
 */
export function compareIdentifiers(
  extracted: string | null | undefined,
  expected: string | null | undefined,
): { status: "valid" | "mismatch" | "unknown"; score: number } {
  const normExtracted = normalizeUnitIdentifier(extracted);
  const normExpected = normalizeUnitIdentifier(expected);

  if (!normExtracted || !normExpected) {
    return { status: "unknown", score: 0 };
  }

  if (normExtracted === normExpected) {
    return { status: "valid", score: 100 };
  }

  // Partial match: one contains the other
  if (normExtracted.includes(normExpected) || normExpected.includes(normExtracted)) {
    return { status: "valid", score: 80 };
  }

  return { status: "mismatch", score: 0 };
}
