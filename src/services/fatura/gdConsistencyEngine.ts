/**
 * gdConsistencyEngine — Motor de Consistência GD (nível distribuidora).
 * Valida coerência dos dados de geração distribuída extraídos de faturas.
 * SSOT para regras de integridade pós-extração.
 */

export type GdConsistencyLevel = "ok" | "warning" | "error";

export interface GdConsistencyCheck {
  rule: string;
  level: GdConsistencyLevel;
  message: string;
  expected?: number | string | null;
  actual?: number | string | null;
}

export interface GdConsistencyResult {
  checks: GdConsistencyCheck[];
  overallLevel: GdConsistencyLevel;
  score: number; // 0-100, 100 = fully consistent
}

interface InvoiceGdData {
  consumo_kwh?: number | null;
  energia_injetada_kwh?: number | null;
  energia_compensada_kwh?: number | null;
  saldo_gd_acumulado?: number | null;
  saldo_gd_anterior?: number | null;
  valor_total?: number | null;
  tarifa_energia_kwh?: number | null;
  tarifa_fio_b_kwh?: number | null;
}

/**
 * Run all GD consistency checks on extracted invoice data.
 */
export function runGdConsistencyChecks(
  current: InvoiceGdData,
  previous?: InvoiceGdData | null,
): GdConsistencyResult {
  const checks: GdConsistencyCheck[] = [];

  // 1. Injeção vs Compensado
  checkInjectionVsCompensation(current, checks);

  // 2. Saldo acumulado coerente
  checkBalanceCoherence(current, checks);

  // 3. Histórico de saldo (se disponível)
  if (previous) {
    checkHistoricalBalance(current, previous, checks);
  }

  // 4. Compensado não pode ser negativo
  checkNonNegativeFields(current, checks);

  // 5. Saldo não pode diminuir mais que o compensado
  if (previous) {
    checkBalanceReduction(current, previous, checks);
  }

  const overallLevel = deriveOverallLevel(checks);
  const score = calculateScore(checks);

  return { checks, overallLevel, score };
}

function checkInjectionVsCompensation(data: InvoiceGdData, checks: GdConsistencyCheck[]) {
  const injected = data.energia_injetada_kwh;
  const compensated = data.energia_compensada_kwh;

  if (injected == null || compensated == null) return;

  if (compensated > injected) {
    checks.push({
      rule: "injection_vs_compensation",
      level: "warning",
      message: `Compensado (${compensated} kWh) maior que injetado (${injected} kWh) no mesmo ciclo. Possível uso de saldo acumulado anterior.`,
      expected: injected,
      actual: compensated,
    });
  } else {
    checks.push({
      rule: "injection_vs_compensation",
      level: "ok",
      message: "Compensado dentro do limite da injeção.",
    });
  }
}

function checkBalanceCoherence(data: InvoiceGdData, checks: GdConsistencyCheck[]) {
  const saldoAtual = data.saldo_gd_acumulado;
  const saldoAnterior = data.saldo_gd_anterior;
  const injected = data.energia_injetada_kwh;
  const compensated = data.energia_compensada_kwh;

  if (saldoAtual == null || saldoAnterior == null || injected == null || compensated == null) return;

  // Expected: saldo_atual ≈ saldo_anterior + injetada - compensada
  const expected = saldoAnterior + injected - compensated;
  const diff = Math.abs(saldoAtual - expected);
  const tolerance = Math.max(expected * 0.05, 5); // 5% or 5 kWh min

  if (diff > tolerance) {
    checks.push({
      rule: "balance_coherence",
      level: "error",
      message: `Saldo acumulado (${saldoAtual}) diverge do esperado (${Math.round(expected)}). Diferença: ${Math.round(diff)} kWh.`,
      expected: Math.round(expected),
      actual: saldoAtual,
    });
  } else {
    checks.push({
      rule: "balance_coherence",
      level: "ok",
      message: "Saldo acumulado coerente com injeção e compensação.",
    });
  }
}

function checkHistoricalBalance(
  current: InvoiceGdData,
  previous: InvoiceGdData,
  checks: GdConsistencyCheck[],
) {
  const prevSaldo = previous.saldo_gd_acumulado;
  const currSaldoAnterior = current.saldo_gd_anterior;

  if (prevSaldo == null || currSaldoAnterior == null) return;

  if (Math.abs(prevSaldo - currSaldoAnterior) > 5) {
    checks.push({
      rule: "historical_balance_match",
      level: "warning",
      message: `Saldo anterior desta fatura (${currSaldoAnterior}) difere do saldo acumulado da fatura anterior (${prevSaldo}).`,
      expected: prevSaldo,
      actual: currSaldoAnterior,
    });
  } else {
    checks.push({
      rule: "historical_balance_match",
      level: "ok",
      message: "Saldo anterior confere com histórico.",
    });
  }
}

function checkNonNegativeFields(data: InvoiceGdData, checks: GdConsistencyCheck[]) {
  const fields: { key: keyof InvoiceGdData; label: string }[] = [
    { key: "energia_injetada_kwh", label: "Energia injetada" },
    { key: "energia_compensada_kwh", label: "Energia compensada" },
    { key: "saldo_gd_acumulado", label: "Saldo acumulado" },
    { key: "consumo_kwh", label: "Consumo" },
  ];

  for (const { key, label } of fields) {
    const val = data[key];
    if (val != null && (val as number) < 0) {
      checks.push({
        rule: `non_negative_${key}`,
        level: "error",
        message: `${label} é negativo (${val}). Possível erro de extração.`,
        actual: val,
      });
    }
  }
}

function checkBalanceReduction(
  current: InvoiceGdData,
  previous: InvoiceGdData,
  checks: GdConsistencyCheck[],
) {
  const prevSaldo = previous.saldo_gd_acumulado;
  const currSaldo = current.saldo_gd_acumulado;
  const compensated = current.energia_compensada_kwh;

  if (prevSaldo == null || currSaldo == null || compensated == null) return;

  const reduction = prevSaldo - currSaldo;
  if (reduction > 0 && reduction > compensated * 1.1 + 10) {
    checks.push({
      rule: "balance_reduction_exceeds_compensation",
      level: "warning",
      message: `Saldo reduziu ${Math.round(reduction)} kWh mas compensado foi apenas ${compensated} kWh. Possível expiração de créditos ou erro.`,
      expected: compensated,
      actual: Math.round(reduction),
    });
  }
}

function deriveOverallLevel(checks: GdConsistencyCheck[]): GdConsistencyLevel {
  if (checks.some(c => c.level === "error")) return "error";
  if (checks.some(c => c.level === "warning")) return "warning";
  return "ok";
}

function calculateScore(checks: GdConsistencyCheck[]): number {
  if (checks.length === 0) return 100;
  const weights: Record<GdConsistencyLevel, number> = { ok: 1, warning: 0.5, error: 0 };
  const total = checks.reduce((sum, c) => sum + weights[c.level], 0);
  return Math.round((total / checks.length) * 100);
}
