/**
 * Solar Transposition Module — Liu-Jordan Isotropic Model
 *
 * Converts GHI (Global Horizontal Irradiance) + DHI (Diffuse Horizontal Irradiance)
 * into POA (Plane of Array / Tilted Plane Irradiance) using the isotropic diffuse model.
 *
 * Formula:
 *   POA = DNI_on_tilt + DHI_sky + GHI_ground
 *
 * Where:
 *   DNI = GHI - DHI (beam/direct normal component on horizontal)
 *   DNI_on_tilt = DNI * cos(AOI) / cos(zenith)  — simplified via monthly avg zenith
 *   DHI_sky = DHI * (1 + cos(tilt)) / 2
 *   GHI_ground = GHI * albedo * (1 - cos(tilt)) / 2
 *
 * Reference: Liu & Jordan (1963), "The long-term average performance of flat-plate
 *            solar-energy collectors"
 *
 * This is deterministic, stateless, and safe for multi-tenant use.
 */

import type { IrradianceSeries } from "./irradiance-provider";

// ─── Types ──────────────────────────────────────────────────────

export interface DhiSeries {
  dhi_m01: number; dhi_m02: number; dhi_m03: number; dhi_m04: number;
  dhi_m05: number; dhi_m06: number; dhi_m07: number; dhi_m08: number;
  dhi_m09: number; dhi_m10: number; dhi_m11: number; dhi_m12: number;
}

export interface TranspositionInput {
  /** GHI monthly series (kWh/m²/day) */
  ghi: IrradianceSeries;
  /** DHI monthly series (kWh/m²/day) — optional, falls back to estimate */
  dhi?: DhiSeries | null;
  /** Site latitude in degrees (negative = south) */
  latitude: number;
  /** Panel tilt angle in degrees from horizontal (0 = flat, 90 = vertical) */
  tilt_deg: number;
  /** Azimuth deviation from ideal in degrees (0 = ideal orientation) */
  azimuth_deviation_deg?: number;
  /** Ground albedo factor (0-1, default 0.2 = typical grass/soil) */
  albedo?: number;
}

export interface TranspositionResult {
  /** POA monthly series (kWh/m²/day) */
  poa: IrradianceSeries;
  /** Annual average POA (kWh/m²/day) */
  poa_annual_avg: number;
  /** Annual average GHI for reference (kWh/m²/day) */
  ghi_annual_avg: number;
  /** Transposition gain factor (POA/GHI ratio) */
  gain_factor: number;
  /** Method used */
  method: "liu_jordan_isotropic" | "ghi_only_estimated";
  /** Whether DHI was from real data or estimated */
  dhi_source: "measured" | "estimated";
}

// ─── Constants ──────────────────────────────────────────────────

const DEG_TO_RAD = Math.PI / 180;

/** Day of year representing mid-month (approximate) */
const MID_MONTH_DOY = [17, 47, 75, 105, 135, 162, 198, 228, 258, 288, 318, 344];

// ─── Core Functions ─────────────────────────────────────────────

/**
 * Calculate solar declination for a given day of year (Spencer, 1971)
 */
function solarDeclination(dayOfYear: number): number {
  const B = (2 * Math.PI * (dayOfYear - 1)) / 365;
  return (
    0.006918 -
    0.399912 * Math.cos(B) +
    0.070257 * Math.sin(B) -
    0.006758 * Math.cos(2 * B) +
    0.000907 * Math.sin(2 * B) -
    0.002697 * Math.cos(3 * B) +
    0.00148 * Math.sin(3 * B)
  );
}

/**
 * Sunset hour angle (radians) — defines day length at given latitude/declination
 */
function sunsetHourAngle(latRad: number, declRad: number): number {
  const cosWs = -Math.tan(latRad) * Math.tan(declRad);
  // Clamp for polar day/night
  if (cosWs < -1) return Math.PI; // 24h daylight
  if (cosWs > 1) return 0; // polar night
  return Math.acos(cosWs);
}

/**
 * Monthly-average daily extraterrestrial radiation on horizontal (H0) in kWh/m²/day
 */
function extraterrestrialDaily(latRad: number, dayOfYear: number): number {
  const Gsc = 1.361; // kW/m² (solar constant)
  const B = (2 * Math.PI * (dayOfYear - 1)) / 365;
  const EoFactor = 1 + 0.033 * Math.cos(B); // eccentricity correction
  const declRad = solarDeclination(dayOfYear);
  const ws = sunsetHourAngle(latRad, declRad);

  const H0 =
    (24 / Math.PI) *
    Gsc *
    EoFactor *
    (
      Math.cos(latRad) * Math.cos(declRad) * Math.sin(ws) +
      ws * Math.sin(latRad) * Math.sin(declRad)
    );

  return Math.max(0, H0);
}

/**
 * Estimate monthly Rb (beam tilt factor) using Klein's method (1977)
 * This is the ratio of beam radiation on tilted surface to horizontal.
 */
function monthlyRb(latRad: number, declRad: number, tiltRad: number, isSouthernHemisphere: boolean): number {
  // For southern hemisphere, panels face north (azimuth=0°).
  // latRad is already negative. Klein's formula uses (lat - tilt) where tilt
  // is positive when tilting TOWARD the equator. In the southern hemisphere,
  // subtracting a positive tilt from a negative latitude moves it toward zero (equator).
  // So tiltEffective should be POSITIVE for south hemisphere (same sign as north).
  const tiltEffective = tiltRad; // Always positive — lat sign handles hemisphere
  
  const ws = sunsetHourAngle(latRad, declRad);
  const wsT = sunsetHourAngle(latRad - tiltEffective, declRad);
  const wsPrime = Math.min(ws, wsT);

  if (wsPrime <= 0) return 0;

  const num =
    Math.cos(latRad - tiltEffective) * Math.cos(declRad) * Math.sin(wsPrime) +
    wsPrime * Math.sin(latRad - tiltEffective) * Math.sin(declRad);

  const den =
    Math.cos(latRad) * Math.cos(declRad) * Math.sin(ws) +
    ws * Math.sin(latRad) * Math.sin(declRad);

  if (den <= 0) return 0;
  return Math.max(0, num / den);
}

/**
 * Estimate DHI from GHI using Erbs correlation (1982)
 * Uses clearness index (Kt = GHI/H0) to estimate diffuse fraction
 */
function estimateDhi(ghi: number, h0: number): number {
  if (h0 <= 0 || ghi <= 0) return 0;
  const Kt = Math.min(ghi / h0, 1.0);
  
  let diffuseFraction: number;
  if (Kt <= 0.22) {
    diffuseFraction = 1.0 - 0.09 * Kt;
  } else if (Kt <= 0.80) {
    diffuseFraction = 0.9511 - 0.1604 * Kt + 4.388 * Kt * Kt - 16.638 * Kt ** 3 + 12.336 * Kt ** 4;
  } else {
    diffuseFraction = 0.165;
  }
  
  return ghi * Math.max(0, Math.min(1, diffuseFraction));
}

// ─── Main Transposition Function ────────────────────────────────

/**
 * Transpose GHI+DHI to POA using Liu-Jordan isotropic model.
 * If DHI is not available, it's estimated via Erbs correlation.
 */
export function transposeToTiltedPlane(input: TranspositionInput): TranspositionResult {
  const { ghi, latitude, tilt_deg, azimuth_deviation_deg = 0, albedo = 0.2 } = input;
  
  const latRad = latitude * DEG_TO_RAD;
  const tiltRad = tilt_deg * DEG_TO_RAD;
  const isSouthern = latitude < 0;
  
  // Azimuth correction factor (cosine loss for non-ideal orientation)
  const azimuthFactor = Math.cos(azimuth_deviation_deg * DEG_TO_RAD);
  
  const ghiValues = [ghi.m01, ghi.m02, ghi.m03, ghi.m04, ghi.m05, ghi.m06,
                     ghi.m07, ghi.m08, ghi.m09, ghi.m10, ghi.m11, ghi.m12];
  
  // Resolve DHI: use measured if available, otherwise estimate
  const hasMeasuredDhi = input.dhi != null && Object.values(input.dhi).some(v => v > 0);
  let dhiValues: number[];
  
  if (hasMeasuredDhi && input.dhi) {
    dhiValues = [
      input.dhi.dhi_m01, input.dhi.dhi_m02, input.dhi.dhi_m03, input.dhi.dhi_m04,
      input.dhi.dhi_m05, input.dhi.dhi_m06, input.dhi.dhi_m07, input.dhi.dhi_m08,
      input.dhi.dhi_m09, input.dhi.dhi_m10, input.dhi.dhi_m11, input.dhi.dhi_m12,
    ];
  } else {
    // Estimate DHI using Erbs correlation
    dhiValues = ghiValues.map((ghiM, i) => {
      const h0 = extraterrestrialDaily(latRad, MID_MONTH_DOY[i]);
      return estimateDhi(ghiM, h0);
    });
  }
  
  const poaValues: number[] = [];
  
  for (let m = 0; m < 12; m++) {
    const ghiM = ghiValues[m];
    const dhiM = dhiValues[m];
    const doy = MID_MONTH_DOY[m];
    
    if (ghiM <= 0) {
      poaValues.push(0);
      continue;
    }
    
    // Beam (direct) component on horizontal = GHI - DHI
    const beamH = Math.max(0, ghiM - dhiM);
    
    // Rb: beam tilt factor for this month
    const declRad = solarDeclination(doy);
    const Rb = monthlyRb(latRad, declRad, tiltRad, isSouthern);
    
    // Liu-Jordan isotropic model components:
    // 1. Beam on tilted plane
    const beamTilt = beamH * Rb * azimuthFactor;
    
    // 2. Diffuse sky component (isotropic assumption)
    const diffuseSky = dhiM * (1 + Math.cos(tiltRad)) / 2;
    
    // 3. Ground-reflected component
    const groundReflected = ghiM * albedo * (1 - Math.cos(tiltRad)) / 2;
    
    // Total POA
    const poa = beamTilt + diffuseSky + groundReflected;
    poaValues.push(Math.round(Math.max(0, poa) * 10000) / 10000);
  }
  
  const poaSeries: IrradianceSeries = {
    m01: poaValues[0], m02: poaValues[1], m03: poaValues[2], m04: poaValues[3],
    m05: poaValues[4], m06: poaValues[5], m07: poaValues[6], m08: poaValues[7],
    m09: poaValues[8], m10: poaValues[9], m11: poaValues[10], m12: poaValues[11],
  };
  
  const poaAvg = poaValues.reduce((a, b) => a + b, 0) / 12;
  const ghiAvg = ghiValues.reduce((a, b) => a + b, 0) / 12;
  
  return {
    poa: poaSeries,
    poa_annual_avg: Math.round(poaAvg * 10000) / 10000,
    ghi_annual_avg: Math.round(ghiAvg * 10000) / 10000,
    gain_factor: ghiAvg > 0 ? Math.round((poaAvg / ghiAvg) * 10000) / 10000 : 1,
    method: hasMeasuredDhi ? "liu_jordan_isotropic" : "ghi_only_estimated",
    dhi_source: hasMeasuredDhi ? "measured" : "estimated",
  };
}

/**
 * Convenience: compute optimal tilt angle for a given latitude.
 * Rule of thumb: tilt ≈ |latitude| for annual optimization.
 * Adjusted slightly for Brazilian latitudes (CRESESB recommendation).
 */
export function optimalTilt(latitude: number): number {
  const absLat = Math.abs(latitude);
  // For Brazil (tropical), optimal tilt is slightly less than latitude
  if (absLat < 10) return Math.round(absLat + 5); // near equator: add 5°
  if (absLat < 25) return Math.round(absLat);      // tropical: ≈ latitude
  return Math.round(absLat - 5);                    // south Brazil: subtract 5°
}
