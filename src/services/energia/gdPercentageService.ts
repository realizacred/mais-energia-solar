/**
 * gdPercentageService — Percentage-based GD distribution engine.
 * SRP: Deterministic calculation based on the correct GD model.
 *
 * Correct model:
 *   100% of generation is distributed by percentage.
 *   Generator retains whatever is NOT allocated to beneficiaries.
 *   NO energy transfer between UCs.
 *   NO overflow redistribution.
 *   Calculation is purely diagnostic.
 */

// ─── Types ───────────────────────────────────────────────────────

export interface GdUcInput {
  ucId: string;
  ucLabel: string;
  type: "geradora" | "beneficiaria";
  allocationPercent: number;
  consumedKwh: number;
}

export interface GdPercentageInput {
  generationKwh: number;
  participants: GdUcInput[];
}

export type UcSituation = "acima_do_ideal" | "abaixo_do_ideal" | "equilibrado";

export interface GdUcResult {
  ucId: string;
  ucLabel: string;
  type: "geradora" | "beneficiaria";
  allocationPercent: number;
  allocatedKwh: number;
  consumedKwh: number;
  differenceKwh: number; // positive = surplus, negative = deficit
  coveragePercent: number;
  situation: UcSituation;
}

export interface GdPercentageResult {
  generationKwh: number;
  totalAllocatedPercent: number;
  generatorRetainedPercent: number;
  generatorRetainedKwh: number;
  efficiencyPercent: number; // min(allocated, consumed) / generation
  totalSurplusKwh: number;
  totalDeficitKwh: number;
  avgCoveragePercent: number;
  results: GdUcResult[];
}

export interface PercentageAdjustment {
  ucId: string;
  ucLabel: string;
  type: "geradora" | "beneficiaria";
  currentPercent: number;
  suggestedPercent: number;
  deltaPercent: number;
  reason: string;
}

export interface OptimizationSuggestion {
  description: string;
  adjustments: PercentageAdjustment[];
  projectedEfficiency: number;
  projectedAvgCoverage: number;
}

export interface PercentageComparison {
  metricLabel: string;
  currentValue: string;
  suggestedValue: string;
  improved: boolean;
}

// ─── Part 1: Calculate Distribution by Percentage ────────────────

/**
 * Calculates distribution based purely on allocation percentages.
 * Generator retains what is NOT allocated to beneficiaries.
 */
export function calculateDistributionByPercentage(
  input: GdPercentageInput
): GdPercentageResult {
  const { generationKwh, participants } = input;

  // Sum of beneficiary percentages
  const beneficiaryPercent = participants
    .filter((p) => p.type === "beneficiaria")
    .reduce((s, p) => s + p.allocationPercent, 0);

  // Generator retains the remainder
  const generatorRetainedPercent = r2(100 - beneficiaryPercent);
  const generatorRetainedKwh = r2(generationKwh * (generatorRetainedPercent / 100));

  const results: GdUcResult[] = participants.map((p) => {
    const effectivePercent =
      p.type === "geradora" ? generatorRetainedPercent : p.allocationPercent;
    const allocatedKwh = r2(generationKwh * (effectivePercent / 100));
    const differenceKwh = r2(allocatedKwh - p.consumedKwh);
    const coveragePercent =
      p.consumedKwh > 0 ? r2((allocatedKwh / p.consumedKwh) * 100) : allocatedKwh > 0 ? 999 : 0;

    let situation: UcSituation = "equilibrado";
    if (differenceKwh > p.consumedKwh * 0.05 && p.consumedKwh > 0) {
      situation = "acima_do_ideal";
    } else if (differenceKwh < -(p.consumedKwh * 0.05) && p.consumedKwh > 0) {
      situation = "abaixo_do_ideal";
    }

    return {
      ucId: p.ucId,
      ucLabel: p.ucLabel,
      type: p.type,
      allocationPercent: effectivePercent,
      allocatedKwh,
      consumedKwh: p.consumedKwh,
      differenceKwh,
      coveragePercent: Math.min(coveragePercent, 999),
      situation,
    };
  });

  const totalUseful = results.reduce(
    (s, r) => s + Math.min(r.allocatedKwh, r.consumedKwh),
    0
  );
  const efficiencyPercent =
    generationKwh > 0 ? r2((totalUseful / generationKwh) * 100) : 0;
  const totalSurplusKwh = r2(
    results.reduce((s, r) => s + Math.max(r.differenceKwh, 0), 0)
  );
  const totalDeficitKwh = r2(
    results.reduce((s, r) => s + Math.abs(Math.min(r.differenceKwh, 0)), 0)
  );
  const avgCoveragePercent =
    results.length > 0
      ? r2(
          results.reduce((s, r) => s + Math.min(r.coveragePercent, 100), 0) /
            results.length
        )
      : 0;

  return {
    generationKwh,
    totalAllocatedPercent: r2(beneficiaryPercent),
    generatorRetainedPercent,
    generatorRetainedKwh,
    efficiencyPercent,
    totalSurplusKwh,
    totalDeficitKwh,
    avgCoveragePercent,
    results,
  };
}

// ─── Part 2: Suggest Percentage Adjustments ─────────────────────

/**
 * Analyzes current distribution and suggests percentage adjustments.
 * Based on proportion of consumption — NOT energy transfer.
 */
export function suggestPercentageAdjustments(
  result: GdPercentageResult
): OptimizationSuggestion | null {
  const { results, generationKwh } = result;
  if (results.length < 2 || generationKwh <= 0) return null;

  const totalConsumption = results.reduce((s, r) => s + r.consumedKwh, 0);
  if (totalConsumption <= 0) return null;

  const adjustments: PercentageAdjustment[] = results.map((r) => {
    const idealPercent = r2((r.consumedKwh / totalConsumption) * 100);
    const delta = r2(idealPercent - r.allocationPercent);
    let reason = "";

    if (r.situation === "acima_do_ideal") {
      reason = `Recebe mais do que consome. Reduzir de ${r.allocationPercent}% para ${idealPercent}%`;
    } else if (r.situation === "abaixo_do_ideal") {
      reason = `Recebe menos do que consome. Aumentar de ${r.allocationPercent}% para ${idealPercent}%`;
    } else {
      reason = "Percentual adequado ao consumo";
    }

    return {
      ucId: r.ucId,
      ucLabel: r.ucLabel,
      type: r.type,
      currentPercent: r.allocationPercent,
      suggestedPercent: idealPercent,
      deltaPercent: delta,
      reason,
    };
  });

  // Check if any meaningful deviation exists (>5pp)
  const hasDeviation = adjustments.some(
    (a) => Math.abs(a.deltaPercent) > 5
  );
  if (!hasDeviation) return null;

  // Project optimized result
  const optimizedInput: GdPercentageInput = {
    generationKwh,
    participants: results.map((r) => ({
      ucId: r.ucId,
      ucLabel: r.ucLabel,
      type: r.type,
      allocationPercent: r2((r.consumedKwh / totalConsumption) * 100),
      consumedKwh: r.consumedKwh,
    })),
  };
  const projected = calculateDistributionByPercentage(optimizedInput);

  return {
    description: `Redistribuir percentuais proporcionalmente ao consumo real de cada UC.`,
    adjustments,
    projectedEfficiency: projected.efficiencyPercent,
    projectedAvgCoverage: projected.avgCoveragePercent,
  };
}

// ─── Part 3: Generate Optimized Percentages ─────────────────────

/**
 * Generates optimized allocation percentages based on consumption.
 * Ensures sum = 100%. Does NOT persist anything.
 */
export function generateOptimizedPercentages(
  participants: GdUcInput[]
): GdUcInput[] {
  const totalConsumption = participants.reduce((s, p) => s + p.consumedKwh, 0);
  if (totalConsumption <= 0 || participants.length === 0) return participants;

  const optimized = participants.map((p) => ({
    ...p,
    allocationPercent: r2((p.consumedKwh / totalConsumption) * 100),
  }));

  // Fix rounding to exactly 100%
  const sum = optimized.reduce((s, p) => s + p.allocationPercent, 0);
  if (optimized.length > 0 && Math.abs(sum - 100) > 0.01) {
    optimized[optimized.length - 1].allocationPercent = r2(
      optimized[optimized.length - 1].allocationPercent + (100 - sum)
    );
  }

  return optimized;
}

// ─── Part 4: Compare Current vs Suggested ───────────────────────

export function comparePercentageDistributions(
  current: GdPercentageResult,
  suggested: GdPercentageResult
): PercentageComparison[] {
  return [
    {
      metricLabel: "Eficiência",
      currentValue: `${current.efficiencyPercent}%`,
      suggestedValue: `${suggested.efficiencyPercent}%`,
      improved: suggested.efficiencyPercent > current.efficiencyPercent,
    },
    {
      metricLabel: "Cobertura Média",
      currentValue: `${current.avgCoveragePercent}%`,
      suggestedValue: `${suggested.avgCoveragePercent}%`,
      improved: suggested.avgCoveragePercent > current.avgCoveragePercent,
    },
    {
      metricLabel: "Sobra Total",
      currentValue: `${current.totalSurplusKwh} kWh`,
      suggestedValue: `${suggested.totalSurplusKwh} kWh`,
      improved: suggested.totalSurplusKwh < current.totalSurplusKwh,
    },
    {
      metricLabel: "Déficit Total",
      currentValue: `${current.totalDeficitKwh} kWh`,
      suggestedValue: `${suggested.totalDeficitKwh} kWh`,
      improved: suggested.totalDeficitKwh < current.totalDeficitKwh,
    },
    {
      metricLabel: "% Retido pela Geradora",
      currentValue: `${current.generatorRetainedPercent}%`,
      suggestedValue: `${suggested.generatorRetainedPercent}%`,
      improved: true,
    },
  ];
}

// ─── Helper ─────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
