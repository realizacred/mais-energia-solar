/**
 * Distribui o consumo médio mensal proporcionalmente à irradiação solar mensal.
 *
 * A lógica: meses com mais sol → maior consumo esperado da rede (ou pelo menos
 * uma distribuição que reflete a sazonalidade energética da localidade).
 *
 * Se não houver dados de irradiação, faz distribuição uniforme (fallback).
 *
 * @param consumoMedio - Consumo médio mensal em kWh
 * @param ghiSeries - Série mensal de irradiação (m01..m12) em kWh/m²/dia
 * @returns Record com chaves jan..dez e valores inteiros de consumo
 */

const MESES_KEYS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"] as const;
const GHI_KEYS = ["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10", "m11", "m12"] as const;

/**
 * Distribui consumo médio por 12 meses usando pesos de irradiação.
 * 
 * Lógica invertida: meses com MENOS irradiação tendem a ter MAIS consumo
 * (mais uso de ar condicionado, iluminação etc. nos meses de inverno/nublados).
 * Porém, para energia solar o padrão brasileiro é que consumo é relativamente
 * uniforme ao longo do ano. Usamos distribuição PROPORCIONAL DIRETA à irradiação
 * como proxy de sazonalidade energética regional.
 * 
 * Se `inverso = true`, usa peso inverso (mais sol = menos consumo).
 */
export function distribuirConsumoPorIrradiacao(
  consumoMedio: number,
  ghiSeries?: Record<string, number> | null,
  options?: { inverso?: boolean }
): Record<string, number> {
  if (!consumoMedio || consumoMedio <= 0) {
    return Object.fromEntries(MESES_KEYS.map(m => [m, 0]));
  }

  // Sem dados de irradiação → distribuição uniforme
  if (!ghiSeries || Object.keys(ghiSeries).length === 0) {
    return Object.fromEntries(MESES_KEYS.map(m => [m, consumoMedio]));
  }

  // Extrair valores mensais de GHI
  const valores = GHI_KEYS.map(k => Math.max(ghiSeries[k] ?? 0, 0.01));
  const inverso = options?.inverso ?? false;

  // Calcular pesos
  let pesos: number[];
  if (inverso) {
    // Peso inverso: 1/ghi normalizado
    const inversos = valores.map(v => 1 / v);
    const somaInversos = inversos.reduce((a, b) => a + b, 0);
    pesos = inversos.map(v => v / somaInversos);
  } else {
    // Peso proporcional direto
    const soma = valores.reduce((a, b) => a + b, 0);
    pesos = valores.map(v => v / soma);
  }

  // Consumo total anual = média × 12
  const consumoAnual = consumoMedio * 12;

  // Distribuir proporcionalmente, arredondando
  const distribuido = pesos.map(p => Math.round(consumoAnual * p));

  // Ajustar arredondamento para somar exatamente consumoAnual
  const somaDistribuida = distribuido.reduce((a, b) => a + b, 0);
  const diff = consumoAnual - somaDistribuida;
  if (diff !== 0) {
    // Aplica diferença no mês com maior peso
    const maxIdx = pesos.indexOf(Math.max(...pesos));
    distribuido[maxIdx] += diff;
  }

  return Object.fromEntries(MESES_KEYS.map((m, i) => [m, distribuido[i]]));
}

/**
 * Verifica se os consumo_meses têm valores reais preenchidos pelo usuário.
 */
export function hasConsumoMesesPreenchido(meses: Record<string, number> | undefined): boolean {
  if (!meses) return false;
  return Object.values(meses).some(v => v > 0);
}
