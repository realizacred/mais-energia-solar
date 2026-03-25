/**
 * Fator de Geração Service — SSOT for generation factor calculation.
 *
 * Centralizes the formula: effectiveIrrad × 30 × (desempenho / 100)
 * where effectiveIrrad = POA (transposed from GHI) or raw GHI if no latitude.
 *
 * This eliminates divergence between StepConsumptionIntelligence and
 * StepKitSelection PremissasModal that previously computed the same
 * factor independently with potentially different GHI inputs.
 */

import { transposeToTiltedPlane } from "@/services/solar-transposition";
import type { IrradianceSeries } from "@/services/irradiance-provider";

// ─── Types ──────────────────────────────────────────────────────

export interface CalcEffectiveIrradParams {
  /** Monthly GHI series (kWh/m²/day) keyed as m01..m12, or null */
  ghiSeries: Record<string, number> | null | undefined;
  /** Annual average GHI (kWh/m²/day) — used as fallback per month */
  ghiMediaAnual: number;
  /** Site latitude in degrees (negative = south) */
  latitude: number | null | undefined;
  /** Panel tilt angle in degrees */
  tilt_deg: number;
  /** Azimuth deviation from ideal in degrees */
  azimuth_deviation_deg: number;
  /** When true, skip POA transposition and return GHI average directly */
  somente_ghi?: boolean;
}

export interface CalcFatorGeracaoParams extends CalcEffectiveIrradParams {
  /** System performance ratio in % (e.g. 69.8) */
  desempenho: number;
}

// ─── Internal helpers ───────────────────────────────────────────

const MONTH_KEYS = ["m01", "m02", "m03", "m04", "m05", "m06", "m07", "m08", "m09", "m10", "m11", "m12"] as const;

/**
 * Build a normalized IrradianceSeries from a Record or flat fallback.
 * Ensures all 12 months have values, using ghiMediaAnual as fallback per month.
 */
function buildGhiSeries(
  ghiSeries: Record<string, number> | null | undefined,
  ghiMediaAnual: number,
): IrradianceSeries {
  if (ghiSeries) {
    return {
      m01: ghiSeries.m01 ?? ghiMediaAnual,
      m02: ghiSeries.m02 ?? ghiMediaAnual,
      m03: ghiSeries.m03 ?? ghiMediaAnual,
      m04: ghiSeries.m04 ?? ghiMediaAnual,
      m05: ghiSeries.m05 ?? ghiMediaAnual,
      m06: ghiSeries.m06 ?? ghiMediaAnual,
      m07: ghiSeries.m07 ?? ghiMediaAnual,
      m08: ghiSeries.m08 ?? ghiMediaAnual,
      m09: ghiSeries.m09 ?? ghiMediaAnual,
      m10: ghiSeries.m10 ?? ghiMediaAnual,
      m11: ghiSeries.m11 ?? ghiMediaAnual,
      m12: ghiSeries.m12 ?? ghiMediaAnual,
    };
  }
  return {
    m01: ghiMediaAnual, m02: ghiMediaAnual, m03: ghiMediaAnual, m04: ghiMediaAnual,
    m05: ghiMediaAnual, m06: ghiMediaAnual, m07: ghiMediaAnual, m08: ghiMediaAnual,
    m09: ghiMediaAnual, m10: ghiMediaAnual, m11: ghiMediaAnual, m12: ghiMediaAnual,
  };
}

// ─── Public API ─────────────────────────────────────────────────

/**
 * Calculate effective irradiance (POA or GHI) from params.
 * Returns kWh/m²/day annual average.
 */
export function calcEffectiveIrrad(params: CalcEffectiveIrradParams): number {
  const { ghiSeries, ghiMediaAnual, latitude, tilt_deg, azimuth_deviation_deg, somente_ghi } = params;

  if (!ghiMediaAnual || ghiMediaAnual <= 0) return 0;

  // Toggle "Só GHI": return GHI average directly, no transposition
  if (somente_ghi) {
    if (ghiSeries) {
      const vals = MONTH_KEYS.map(k => ghiSeries[k]).filter(v => v != null && v > 0);
      return vals.length > 0 ? vals.reduce((a, b) => a + b, 0) / vals.length : ghiMediaAnual;
    }
    return ghiMediaAnual;
  }

  const ghi = buildGhiSeries(ghiSeries, ghiMediaAnual);

  if (latitude != null) {
    try {
      const result = transposeToTiltedPlane({
        ghi,
        latitude,
        tilt_deg,
        azimuth_deviation_deg,
      });
      return result.poa_annual_avg;
    } catch (e) {
      console.warn("[fatorGeracaoService] POA transposition failed, using GHI:", e);
      return ghiMediaAnual;
    }
  }

  return ghiMediaAnual;
}

/**
 * Calculate fator de geração (kWh/kWp/mês) — SSOT.
 *
 * Formula: effectiveIrrad × 30 × (desempenho / 100)
 */
export function calcFatorGeracao(params: CalcFatorGeracaoParams): number {
  const effectiveIrrad = calcEffectiveIrrad(params);
  if (effectiveIrrad <= 0) return 0;
  return Math.round(effectiveIrrad * 30 * (params.desempenho / 100) * 100) / 100;
}
