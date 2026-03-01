/**
 * Confidence Score Service — SSOT for data reliability scoring.
 * Calculates a 0-100 score per plant/day indicating how trustworthy the PR is.
 * Used as a gate: alerts are only sent to clients when score >= 80.
 */

export interface ConfidenceBreakdown {
  energy_valid: boolean;       // +30
  capacity_valid: boolean;     // +25
  hsp_available: boolean;      // +25
  timezone_ok: boolean;        // +10
  unit_validated: boolean;     // +10
  total: number;
}

export type AlertLayer = "internal" | "preventive" | "urgent";

export interface LayeredAlertClassification {
  layer: AlertLayer;
  reason: string;
  blocked: boolean; // true = don't notify client
}

/**
 * Calculate confidence score for a plant reading.
 */
export function calcConfidenceScore(params: {
  energyKwh: number | null;
  capacityKwp: number | null;
  hspValue: number | null;
  hspSource: string;
  dayIsClosed: boolean;
  unitIsKwh: boolean;
}): ConfidenceBreakdown {
  const energyValid = params.energyKwh != null && params.energyKwh > 0;
  const capacityValid = params.capacityKwp != null && params.capacityKwp > 0;
  const hspAvailable = params.hspValue != null && params.hspValue > 0;
  const timezoneOk = params.dayIsClosed;
  const unitValidated = params.unitIsKwh;

  const total =
    (energyValid ? 30 : 0) +
    (capacityValid ? 25 : 0) +
    (hspAvailable ? 25 : 0) +
    (timezoneOk ? 10 : 0) +
    (unitValidated ? 10 : 0);

  return {
    energy_valid: energyValid,
    capacity_valid: capacityValid,
    hsp_available: hspAvailable,
    timezone_ok: timezoneOk,
    unit_validated: unitValidated,
    total,
  };
}

/**
 * Classify an alert into layers based on confidence score and deviation.
 */
export function classifyAlert(params: {
  confidenceScore: number;
  prStatus: string;
  deviationPercent: number; // how much below expected (positive = underperforming)
  consecutiveDays: number;
  isOffline: boolean;
  isZeroGenWithHighHsp: boolean;
}): LayeredAlertClassification {
  const { confidenceScore, prStatus, deviationPercent, consecutiveDays, isOffline, isZeroGenWithHighHsp } = params;

  // Internal layer: low confidence or incomplete data
  if (confidenceScore < 80 || ["no_data", "config_required", "irradiation_unavailable"].includes(prStatus)) {
    return {
      layer: "internal",
      reason: confidenceScore < 80
        ? `Score de confiabilidade baixo (${confidenceScore}/100)`
        : `Status: ${prStatus}`,
      blocked: true,
    };
  }

  // Urgent: high confidence + severe deviation or offline
  if (confidenceScore >= 90) {
    if (isOffline || isZeroGenWithHighHsp) {
      return {
        layer: "urgent",
        reason: isOffline ? "Usina offline confirmada" : "Geração zero com irradiação alta",
        blocked: false,
      };
    }
    if (deviationPercent > 30 && consecutiveDays >= 2) {
      return {
        layer: "urgent",
        reason: `Desvio de ${deviationPercent.toFixed(0)}% por ${consecutiveDays} dias consecutivos`,
        blocked: false,
      };
    }
  }

  // Preventive: moderate deviation sustained over time
  if (confidenceScore >= 80 && deviationPercent >= 10 && deviationPercent <= 30 && consecutiveDays >= 7) {
    return {
      layer: "preventive",
      reason: `Desvio de ${deviationPercent.toFixed(0)}% por ${consecutiveDays} dias`,
      blocked: false,
    };
  }

  // Default: internal (no alert to client)
  return {
    layer: "internal",
    reason: "Sem anomalia significativa detectada",
    blocked: true,
  };
}
