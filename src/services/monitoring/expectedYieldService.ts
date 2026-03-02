/**
 * Expected Yield Service — SSOT for client-facing generation estimates.
 * Separates engineering PR from client-friendly "expected yield" metric.
 *
 * Expected Yield = capacity_kwp × HSP × expected_factor
 * expected_factor = (1 - shading) × (1 - soiling) × (1 - other_losses)
 */

export interface PlantLosses {
  shading_loss_percent: number;
  soiling_loss_percent: number;
  other_losses_percent: number;
}

export interface ExpectedYieldResult {
  expected_kwh: number;
  expected_factor: number;
  losses: PlantLosses;
  deviation_percent: number; // positive = underperforming
}

/**
 * Default losses calibrated to ~23% total:
 * (1 - 0.08) × (1 - 0.05) × (1 - 0.12) ≈ 0.769 → 23.1% loss
 * This reflects real-world conditions in Brazil (overload, clipping, etc.)
 */
const DEFAULT_LOSSES: PlantLosses = {
  shading_loss_percent: 8,
  soiling_loss_percent: 5,
  other_losses_percent: 12,
};

/**
 * Calculate the expected energy factor after losses.
 */
export function calcExpectedFactor(losses: Partial<PlantLosses>): number {
  const shading = (losses.shading_loss_percent ?? DEFAULT_LOSSES.shading_loss_percent) / 100;
  const soiling = (losses.soiling_loss_percent ?? DEFAULT_LOSSES.soiling_loss_percent) / 100;
  const other = (losses.other_losses_percent ?? DEFAULT_LOSSES.other_losses_percent) / 100;

  return (1 - shading) * (1 - soiling) * (1 - other);
}

/**
 * Calculate expected yield for a plant over a period.
 */
export function calcExpectedYield(params: {
  capacityKwp: number;
  hspKwhM2: number;
  days: number;
  losses?: Partial<PlantLosses>;
  actualKwh?: number;
}): ExpectedYieldResult {
  const { capacityKwp, hspKwhM2, days, losses = {}, actualKwh } = params;

  const resolvedLosses: PlantLosses = {
    shading_loss_percent: losses.shading_loss_percent ?? DEFAULT_LOSSES.shading_loss_percent,
    soiling_loss_percent: losses.soiling_loss_percent ?? DEFAULT_LOSSES.soiling_loss_percent,
    other_losses_percent: losses.other_losses_percent ?? DEFAULT_LOSSES.other_losses_percent,
  };

  const factor = calcExpectedFactor(resolvedLosses);
  const expectedKwh = capacityKwp * hspKwhM2 * days * factor;

  let deviationPercent = 0;
  if (actualKwh != null && expectedKwh > 0) {
    deviationPercent = Math.max(0, ((expectedKwh - actualKwh) / expectedKwh) * 100);
  }

  return {
    expected_kwh: Math.round(expectedKwh * 10) / 10,
    expected_factor: Math.round(factor * 1000) / 1000,
    losses: resolvedLosses,
    deviation_percent: Math.round(deviationPercent * 10) / 10,
  };
}
