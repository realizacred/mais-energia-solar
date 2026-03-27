/**
 * Utilitários de deduplicação para importação de equipamentos.
 * Camada 1: Normalização local (sem custo)
 * Camada 2: Levenshtein para detecção de suspeitos (local, sem API)
 * Camada 3: Verificação via IA (sob demanda, chamada pelo usuário)
 */

/** Remove tudo que não é alfanumérico e converte para lowercase */
export function normalizeForDedup(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

/** Chave de deduplicação normalizada */
export function dedupKeyNormalized(
  fabricante: string,
  modelo: string,
  potenciaOuCapacidade: number
): string {
  return `${normalizeForDedup(fabricante)}|${normalizeForDedup(modelo)}|${potenciaOuCapacidade}`;
}

/** Distância de Levenshtein entre duas strings */
export function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

/** Score de similaridade entre 0 e 1 (1 = idêntico) usando Levenshtein */
export function similarityScore(a: string, b: string): number {
  const normA = normalizeForDedup(a);
  const normB = normalizeForDedup(b);
  const maxLen = Math.max(normA.length, normB.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(normA, normB) / maxLen;
}

const SIMILARITY_THRESHOLD = 0.85;

export interface SuspectMatch {
  existingFabricante: string;
  existingModelo: string;
  existingPotencia: number;
  existingId: string;
  score: number;
}

/**
 * Encontra itens suspeitos (similares mas não duplicatas exatas).
 * Compara fabricante+modelo concatenado contra existentes no banco.
 */
export function findSuspects(
  newFabricante: string,
  newModelo: string,
  newPotencia: number,
  existingItems: Array<{ id: string; fabricante: string; modelo: string; potencia: number }>
): SuspectMatch | null {
  const newStr = `${newFabricante} ${newModelo}`;
  let bestMatch: SuspectMatch | null = null;
  let bestScore = 0;

  for (const existing of existingItems) {
    // Skip if potencia differs by more than 20%
    if (
      newPotencia > 0 &&
      existing.potencia > 0 &&
      Math.abs(newPotencia - existing.potencia) / Math.max(newPotencia, existing.potencia) > 0.2
    ) {
      continue;
    }

    const existingStr = `${existing.fabricante} ${existing.modelo}`;
    const score = similarityScore(newStr, existingStr);

    if (score >= SIMILARITY_THRESHOLD && score < 1.0 && score > bestScore) {
      bestScore = score;
      bestMatch = {
        existingFabricante: existing.fabricante,
        existingModelo: existing.modelo,
        existingPotencia: existing.potencia,
        existingId: existing.id,
        score,
      };
    }
  }

  return bestMatch;
}
