/**
 * gdSimulationService — Pure simulation engine for GD distribution.
 * SRP: Deterministic calculation WITHOUT database persistence.
 * Reuses the same math as gdEnergyEngine but returns results in-memory.
 *
 * Parts:
 *  1. simulateDistribution — real GD calculation (no DB)
 *  2. compareDistributions — diff two results
 *  3. suggestOptimizations — actionable suggestions
 */

import type { GdCategory, GdCalculationInput } from "@/services/gdTypeRules";
import { gdTypeRules } from "@/services/gdTypeRules";

// ─── Types ───────────────────────────────────────────────────────

export interface SimulatedAllocation {
  ucId: string;
  allocationPercent: number;
  allocatedKwh: number;
  consumedKwh: number;
  compensatedKwh: number;
  surplusKwh: number;
  deficitKwh: number;
  priorBalanceKwh: number;
  usedFromBalanceKwh: number;
  newBalanceKwh: number;
  coveragePercent: number;
  estimatedSavingsBrl: number | null;
}

export interface SimulationResult {
  categoriaGd: GdCategory;
  generationKwh: number;
  generatorConsumptionKwh: number;
  totalAllocatedKwh: number;
  totalCompensatedKwh: number;
  totalSurplusKwh: number;
  totalDeficitKwh: number;
  efficiencyPercent: number; // compensated / generation * 100
  allocations: SimulatedAllocation[];
  overflowTransfers: OverflowTransfer[];
}

export interface OverflowTransfer {
  fromUcId: string;
  toUcId: string;
  overflowKwh: number;
}

export interface ComparisonResult {
  current: SimulationResult;
  proposed: SimulationResult;
  deltaEfficiency: number; // proposed - current (pp)
  deltaSurplus: number;    // proposed - current (kWh)
  deltaDeficit: number;    // proposed - current (kWh)
  deltaSavings: number;    // proposed - current (BRL)
  improved: boolean;
}

export interface OptimizationSuggestion {
  type: "reduce_excess" | "cover_deficit" | "redistribute" | "balance_allocation";
  ucId: string | null;
  description: string;
  currentValue: number;
  suggestedValue: number;
  estimatedImpactKwh: number;
}

// ─── Part 1: Simulate Distribution ──────────────────────────────

/**
 * Deterministic GD distribution calculation.
 * Does NOT touch the database.
 * Tariff (R$/kWh) is optional — used for savings estimation.
 */
export function simulateDistribution(
  input: GdCalculationInput,
  tariffBrlPerKwh?: number
): SimulationResult {
  const { categoriaGd, generationKwh, generatorConsumptionKwh, beneficiaries } = input;
  const distType = gdTypeRules.getDistributionType(categoriaGd);

  // Sort by priorityOrder for overflow later
  const sorted = [...beneficiaries].sort((a, b) => {
    const pa = a.priorityOrder ?? 999;
    const pb = b.priorityOrder ?? 999;
    return pa - pb;
  });

  // Net generation available for beneficiaries
  const netGeneration = Math.max(generationKwh - generatorConsumptionKwh, 0);

  // Phase 1: Base allocation
  const baseAllocations: SimulatedAllocation[] = sorted.map((ben) => {
    const percent = distType === "self" ? 100 : ben.allocationPercent;
    const allocatedKwh = r2(netGeneration * (percent / 100));
    const totalAvailable = allocatedKwh + ben.priorBalanceKwh;
    const compensatedKwh = r2(Math.min(totalAvailable, ben.consumedKwh));
    const usedFromBalanceKwh = r2(Math.min(ben.priorBalanceKwh, Math.max(ben.consumedKwh - allocatedKwh, 0)));
    const newBalanceKwh = r2(Math.max(totalAvailable - ben.consumedKwh, 0));
    const surplusKwh = r2(Math.max(allocatedKwh - ben.consumedKwh, 0));
    const deficitKwh = r2(Math.max(ben.consumedKwh - totalAvailable, 0));
    const coveragePercent = ben.consumedKwh > 0 ? r2((compensatedKwh / ben.consumedKwh) * 100) : 100;
    const estimatedSavingsBrl = tariffBrlPerKwh ? r2(compensatedKwh * tariffBrlPerKwh) : null;

    return {
      ucId: ben.ucId,
      allocationPercent: percent,
      allocatedKwh,
      consumedKwh: ben.consumedKwh,
      compensatedKwh,
      surplusKwh,
      deficitKwh,
      priorBalanceKwh: ben.priorBalanceKwh,
      usedFromBalanceKwh,
      newBalanceKwh,
      coveragePercent,
      estimatedSavingsBrl,
    };
  });

  // Phase 2: Overflow redistribution
  const overflowTransfers: OverflowTransfer[] = [];
  const working = baseAllocations.map((a) => ({ ...a }));

  const donors = working.filter((a) => {
    const ben = sorted.find((b) => b.ucId === a.ucId);
    return a.surplusKwh > 0 && (ben?.allowOverflowOut !== false);
  });

  const receivers = working.filter((a) => {
    const ben = sorted.find((b) => b.ucId === a.ucId);
    return a.deficitKwh > 0 && (ben?.allowOverflowIn !== false);
  });

  for (const receiver of receivers) {
    let remaining = receiver.deficitKwh;
    if (remaining <= 0) continue;

    for (const donor of donors) {
      if (remaining <= 0 || donor.surplusKwh <= 0) continue;
      const transfer = r2(Math.min(donor.surplusKwh, remaining));
      if (transfer <= 0) continue;

      donor.surplusKwh = r2(donor.surplusKwh - transfer);
      receiver.deficitKwh = r2(receiver.deficitKwh - transfer);
      receiver.compensatedKwh = r2(Math.min(receiver.compensatedKwh + transfer, receiver.consumedKwh));
      receiver.coveragePercent = receiver.consumedKwh > 0 ? r2((receiver.compensatedKwh / receiver.consumedKwh) * 100) : 100;
      remaining = receiver.deficitKwh;

      overflowTransfers.push({
        fromUcId: donor.ucId,
        toUcId: receiver.ucId,
        overflowKwh: transfer,
      });
    }
  }

  // Recalculate savings after overflow
  if (tariffBrlPerKwh) {
    for (const a of working) {
      a.estimatedSavingsBrl = r2(a.compensatedKwh * tariffBrlPerKwh);
    }
  }

  // Totals
  const totalAllocatedKwh = r2(working.reduce((s, a) => s + a.allocatedKwh, 0));
  const totalCompensatedKwh = r2(working.reduce((s, a) => s + a.compensatedKwh, 0));
  const totalSurplusKwh = r2(working.reduce((s, a) => s + a.surplusKwh, 0));
  const totalDeficitKwh = r2(working.reduce((s, a) => s + a.deficitKwh, 0));
  const efficiencyPercent = netGeneration > 0 ? r2((totalCompensatedKwh / netGeneration) * 100) : 0;

  return {
    categoriaGd: categoriaGd,
    generationKwh,
    generatorConsumptionKwh,
    totalAllocatedKwh,
    totalCompensatedKwh,
    totalSurplusKwh,
    totalDeficitKwh,
    efficiencyPercent,
    allocations: working,
    overflowTransfers,
  };
}

// ─── Part 2: Compare Distributions ──────────────────────────────

export function compareDistributions(
  current: SimulationResult,
  proposed: SimulationResult
): ComparisonResult {
  const currentSavings = current.allocations.reduce((s, a) => s + (a.estimatedSavingsBrl ?? 0), 0);
  const proposedSavings = proposed.allocations.reduce((s, a) => s + (a.estimatedSavingsBrl ?? 0), 0);

  const deltaEfficiency = r2(proposed.efficiencyPercent - current.efficiencyPercent);
  const deltaSurplus = r2(proposed.totalSurplusKwh - current.totalSurplusKwh);
  const deltaDeficit = r2(proposed.totalDeficitKwh - current.totalDeficitKwh);
  const deltaSavings = r2(proposedSavings - currentSavings);

  return {
    current,
    proposed,
    deltaEfficiency,
    deltaSurplus,
    deltaDeficit,
    deltaSavings,
    improved: deltaEfficiency > 0 || (deltaEfficiency === 0 && deltaDeficit < 0),
  };
}

// ─── Part 3: Optimization Suggestions ───────────────────────────

export function suggestOptimizations(
  result: SimulationResult
): OptimizationSuggestion[] {
  const suggestions: OptimizationSuggestion[] = [];
  const { allocations, totalSurplusKwh, totalDeficitKwh, generationKwh } = result;

  if (allocations.length <= 1) return suggestions;

  // 1. Identify UCs with excess (surplus > 10% of allocation)
  for (const a of allocations) {
    if (a.surplusKwh > 0 && a.allocatedKwh > 0 && (a.surplusKwh / a.allocatedKwh) > 0.10) {
      const idealPercent = a.consumedKwh > 0 && generationKwh > 0
        ? r2((a.consumedKwh / generationKwh) * 100)
        : 0;
      suggestions.push({
        type: "reduce_excess",
        ucId: a.ucId,
        description: `UC tem ${r2(a.surplusKwh)} kWh de excedente (${r2((a.surplusKwh / a.allocatedKwh) * 100)}% da alocação). Reduzir percentual de ${a.allocationPercent}% para ~${Math.max(idealPercent, 1)}%.`,
        currentValue: a.allocationPercent,
        suggestedValue: Math.max(idealPercent, 1),
        estimatedImpactKwh: a.surplusKwh,
      });
    }
  }

  // 2. Identify UCs with deficit
  for (const a of allocations) {
    if (a.deficitKwh > 0 && a.consumedKwh > 0) {
      const idealPercent = generationKwh > 0
        ? r2((a.consumedKwh / generationKwh) * 100)
        : a.allocationPercent;
      suggestions.push({
        type: "cover_deficit",
        ucId: a.ucId,
        description: `UC tem déficit de ${r2(a.deficitKwh)} kWh (cobertura ${a.coveragePercent}%). Aumentar percentual de ${a.allocationPercent}% para ~${Math.min(idealPercent, 100)}%.`,
        currentValue: a.allocationPercent,
        suggestedValue: Math.min(idealPercent, 100),
        estimatedImpactKwh: a.deficitKwh,
      });
    }
  }

  // 3. Global redistribution suggestion
  if (totalSurplusKwh > 0 && totalDeficitKwh > 0) {
    const redistributable = Math.min(totalSurplusKwh, totalDeficitKwh);
    suggestions.push({
      type: "redistribute",
      ucId: null,
      description: `Existem ${r2(totalSurplusKwh)} kWh de sobra e ${r2(totalDeficitKwh)} kWh de falta no grupo. Redistribuir até ${r2(redistributable)} kWh para melhorar eficiência.`,
      currentValue: result.efficiencyPercent,
      suggestedValue: generationKwh > 0
        ? r2(((result.totalCompensatedKwh + redistributable) / generationKwh) * 100)
        : result.efficiencyPercent,
      estimatedImpactKwh: redistributable,
    });
  }

  // 4. Balance allocation suggestion (proportional to consumption)
  const totalConsumption = allocations.reduce((s, a) => s + a.consumedKwh, 0);
  if (totalConsumption > 0 && allocations.length >= 2) {
    const maxDeviation = allocations.reduce((max, a) => {
      const idealPercent = (a.consumedKwh / totalConsumption) * 100;
      const deviation = Math.abs(a.allocationPercent - idealPercent);
      return Math.max(max, deviation);
    }, 0);

    if (maxDeviation > 5) { // > 5pp deviation
      suggestions.push({
        type: "balance_allocation",
        ucId: null,
        description: `Os percentuais de rateio estão desbalanceados em relação ao consumo real (desvio máx. ${r2(maxDeviation)}pp). Considere redistribuir proporcionalmente ao consumo.`,
        currentValue: maxDeviation,
        suggestedValue: 0,
        estimatedImpactKwh: Math.min(totalSurplusKwh, totalDeficitKwh),
      });
    }
  }

  return suggestions;
}

// ─── Utility: Generate optimized allocation percentages ─────────

/**
 * Generate optimized allocation percentages based on actual consumption.
 * Returns a new beneficiaries array with adjusted allocationPercent values.
 */
export function generateOptimizedAllocations(
  input: GdCalculationInput
): GdCalculationInput {
  const totalConsumption = input.beneficiaries.reduce((s, b) => s + b.consumedKwh, 0);
  if (totalConsumption <= 0 || input.beneficiaries.length === 0) return input;

  const optimized = input.beneficiaries.map((b) => ({
    ...b,
    allocationPercent: r2((b.consumedKwh / totalConsumption) * 100),
  }));

  // Ensure sum = 100% (adjust last beneficiary for rounding)
  const sum = optimized.reduce((s, b) => s + b.allocationPercent, 0);
  if (optimized.length > 0 && Math.abs(sum - 100) > 0.01) {
    optimized[optimized.length - 1].allocationPercent = r2(
      optimized[optimized.length - 1].allocationPercent + (100 - sum)
    );
  }

  return { ...input, beneficiaries: optimized };
}

// ─── Helper ─────────────────────────────────────────────────────

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
