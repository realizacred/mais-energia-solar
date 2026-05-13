/**
 * Normalização TEMPORÁRIA de exibição da TIR.
 *
 * Contexto: `proposta_versoes.tir` historicamente coexiste em duas escalas:
 *   - decimal      → 0.6023 representa 60,23%
 *   - percentual   → 32.5   representa 32,5%
 *
 * Heurística de detecção:
 *   - tir <= 1.5  → tratada como decimal (multiplica por 100)
 *   - caso contrário → tratada como percentual já normalizado
 *
 * Faixa válida 0..1.5 cobre TIRs reais até 150% a.a. em escala decimal,
 * e qualquer valor >1.5 só faz sentido como percentual (ex.: 32 = 32%).
 *
 * TODO(financeiro): unificar `proposta_versoes.tir` em uma única escala
 * (preferencialmente percentual) via migration + recálculo controlado,
 * e então remover esta heurística. Ver auditoria B1+B8.
 */
export function normalizeTirPercent(raw: unknown): number | null {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  if (!Number.isFinite(n)) return null;
  const abs = Math.abs(n);
  if (abs <= 1.5) return n * 100;
  return n;
}

/** Formata TIR já normalizada com vírgula BR. Retorna "—" quando ausente. */
export function formatTirPercent(raw: unknown, fractionDigits = 2): string {
  const v = normalizeTirPercent(raw);
  if (v === null) return "—";
  return `${v.toFixed(fractionDigits).replace(".", ",")}%`;
}
