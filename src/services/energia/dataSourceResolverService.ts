/**
 * dataSourceResolverService — Resolves data sources for GD dashboard.
 * SRP: Pure functions to determine which data source to use and its confidence.
 *
 * Model:
 *   Layer 1 — Official (invoices): truth of the month
 *   Layer 2 — Operational (monitoring/meter): current generation, forecasts
 *   Layer 3 — Simulation (averages): suggestions, comparisons
 */

// ─── Types ───────────────────────────────────────────────────────

export type DataConfidence = "high" | "medium" | "low";

export interface ResolvedDataSource {
  value: number;
  source: "invoice" | "monitoring" | "meter" | "average" | "estimate" | "none";
  confidence: DataConfidence;
  label: string;
  monthsUsed?: number; // for average-based sources
}

export interface UcConsumptionData {
  ucId: string;
  resolved: ResolvedDataSource;
  invoiceMonths: Array<{ year: number; month: number; kwh: number }>;
}

export interface GdGroupDataSources {
  generation: ResolvedDataSource;
  generatorConsumption: ResolvedDataSource;
  beneficiaryConsumption: UcConsumptionData[];
}

// ─── Generation Resolution ──────────────────────────────────────

/**
 * Resolve generation value from available sources.
 * Priority: monitoring > invoice > estimate
 * (Meter data is resolved via monitoring daily readings)
 */
export function resolveGeneration(sources: {
  monitoringKwh: number | null;
  invoiceInjectedKwh: number | null;
  meterExportKwh: number | null;
  monitoringDaysCount?: number;
  monthDays?: number;
}): ResolvedDataSource {
  const { monitoringKwh, invoiceInjectedKwh, meterExportKwh, monitoringDaysCount, monthDays } = sources;

  // Priority 1: Meter (highest precision)
  if (meterExportKwh != null && meterExportKwh > 0) {
    return {
      value: r2(meterExportKwh),
      source: "meter",
      confidence: "high",
      label: "Medidor IoT",
    };
  }

  // Priority 2: Monitoring (solar plant data)
  if (monitoringKwh != null && monitoringKwh > 0) {
    const days = monitoringDaysCount ?? 0;
    const total = monthDays ?? 30;
    const confidence: DataConfidence = days >= total * 0.9 ? "high" : days >= total * 0.5 ? "medium" : "low";
    return {
      value: r2(monitoringKwh),
      source: "monitoring",
      confidence,
      label: `Usina (${days}/${total} dias)`,
    };
  }

  // Priority 3: Invoice (energy_injected_kwh)
  if (invoiceInjectedKwh != null && invoiceInjectedKwh > 0) {
    return {
      value: r2(invoiceInjectedKwh),
      source: "invoice",
      confidence: "medium",
      label: "Conta de luz (injeção)",
    };
  }

  return {
    value: 0,
    source: "none",
    confidence: "low",
    label: "Sem dados de geração",
  };
}

// ─── Consumption Resolution ─────────────────────────────────────

/**
 * Resolve consumption for a single UC.
 * Priority: current invoice > last month > 3-month average > estimate
 */
export function resolveConsumption(invoices: Array<{
  year: number;
  month: number;
  kwh: number;
}>, targetYear: number, targetMonth: number): ResolvedDataSource {
  // Priority 1: Current month invoice
  const current = invoices.find((i) => i.year === targetYear && i.month === targetMonth);
  if (current && current.kwh > 0) {
    return {
      value: r2(current.kwh),
      source: "invoice",
      confidence: "high",
      label: "Conta de luz",
    };
  }

  // Priority 2: Last month
  const prev = getPreviousMonth(targetYear, targetMonth);
  const lastMonth = invoices.find((i) => i.year === prev.year && i.month === prev.month);
  if (lastMonth && lastMonth.kwh > 0) {
    return {
      value: r2(lastMonth.kwh),
      source: "invoice",
      confidence: "medium",
      label: "Último mês",
      monthsUsed: 1,
    };
  }

  // Priority 3: Average of last 3 months
  const avg = getAverageConsumption(invoices, targetYear, targetMonth, 3);
  if (avg.value > 0) {
    return avg;
  }

  // Priority 4: Any available average
  if (invoices.length > 0) {
    const allKwh = invoices.filter((i) => i.kwh > 0).map((i) => i.kwh);
    if (allKwh.length > 0) {
      const avgVal = r2(allKwh.reduce((s, v) => s + v, 0) / allKwh.length);
      return {
        value: avgVal,
        source: "average",
        confidence: "low",
        label: `Média geral (${allKwh.length} meses)`,
        monthsUsed: allKwh.length,
      };
    }
  }

  return {
    value: 0,
    source: "none",
    confidence: "low",
    label: "Sem dados de consumo",
  };
}

// ─── Simulation Baseline ────────────────────────────────────────

/**
 * Get simulation baseline (average consumption) for a UC.
 * Uses last 3 months, fallback to 2, 1, or estimate.
 */
export function getSimulationBaseline(
  invoices: Array<{ year: number; month: number; kwh: number }>,
  targetYear: number,
  targetMonth: number
): ResolvedDataSource {
  // Try 3 months
  const avg3 = getAverageConsumption(invoices, targetYear, targetMonth, 3);
  if (avg3.value > 0) return avg3;

  // Try 2 months
  const avg2 = getAverageConsumption(invoices, targetYear, targetMonth, 2);
  if (avg2.value > 0) return avg2;

  // Try 1 month
  const avg1 = getAverageConsumption(invoices, targetYear, targetMonth, 1);
  if (avg1.value > 0) return avg1;

  // Any data
  if (invoices.length > 0) {
    const allKwh = invoices.filter((i) => i.kwh > 0).map((i) => i.kwh);
    if (allKwh.length > 0) {
      return {
        value: r2(allKwh.reduce((s, v) => s + v, 0) / allKwh.length),
        source: "estimate",
        confidence: "low",
        label: `Estimativa (${allKwh.length} meses disponíveis)`,
        monthsUsed: allKwh.length,
      };
    }
  }

  return {
    value: 0,
    source: "none",
    confidence: "low",
    label: "Sem histórico para baseline",
  };
}

// ─── Helpers ────────────────────────────────────────────────────

function getAverageConsumption(
  invoices: Array<{ year: number; month: number; kwh: number }>,
  targetYear: number,
  targetMonth: number,
  monthsBack: number
): ResolvedDataSource {
  const months: Array<{ year: number; month: number }> = [];
  let y = targetYear;
  let m = targetMonth;

  for (let i = 0; i < monthsBack; i++) {
    const prev = getPreviousMonth(y, m);
    months.push(prev);
    y = prev.year;
    m = prev.month;
  }

  const matched = months
    .map((p) => invoices.find((inv) => inv.year === p.year && inv.month === p.month))
    .filter((inv): inv is { year: number; month: number; kwh: number } => inv != null && inv.kwh > 0);

  if (matched.length === 0) {
    return { value: 0, source: "none", confidence: "low", label: "Sem dados" };
  }

  const avgVal = r2(matched.reduce((s, inv) => s + inv.kwh, 0) / matched.length);
  const confidence: DataConfidence =
    matched.length >= 3 ? "high" : matched.length >= 2 ? "medium" : "low";

  return {
    value: avgVal,
    source: "average",
    confidence,
    label: `Média ${matched.length} meses`,
    monthsUsed: matched.length,
  };
}

function getPreviousMonth(y: number, m: number): { year: number; month: number } {
  if (m === 1) return { year: y - 1, month: 12 };
  return { year: y, month: m - 1 };
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
