/**
 * Canonical MPPT/String Normalizer
 *
 * Extracts NormalizedStringReadings from device metadata
 * without touching any provider adapter code.
 * Supports Growatt, Solis, Deye, SolarEdge and any provider
 * that stores pow1..pow32, vpv1..vpv32, ipv1..ipv32 in metadata.
 */
import type { MonitorDevice } from "./monitorTypes";
import type { NormalizedStringReading, StringGranularity } from "./mpptStringTypes";
import { deriveDeviceStatus, getDeviceSsotTimestamp } from "./plantStatusEngine";

/**
 * Normalize a device's metadata into canonical string readings.
 * Never throws — returns empty array for unsupported/missing data.
 */
export function normalizeDeviceToStringReadings(
  device: MonitorDevice,
  plantId: string,
  plantGenerating: boolean,
): NormalizedStringReading[] {
  if (device.type !== "inverter") return [];

  const meta = device.metadata || {};
  const deviceSeenAt = getDeviceSsotTimestamp(device);
  const ts = deviceSeenAt || new Date().toISOString();
  // SSOT: derive status via engine — NEVER use device.status directly
  const derived = deriveDeviceStatus({ rawStatus: device.status, lastSeenAt: deviceSeenAt });
  const inverterOnline = derived.status === "online";

  const mpptCount = Number(meta.dcInputTypeMppt ?? meta.dcInputType ?? meta.mpptCount ?? 0);
  const readings: NormalizedStringReading[] = [];

  // Scan for pow1..pow32 (string-level power in W)
  let hasStringData = false;
  for (let i = 1; i <= 32; i++) {
    const power = numberOrNull(meta[`pow${i}`] ?? meta[`ppv${i}`]);
    const voltage = numberOrNull(meta[`vpv${i}`] ?? meta[`uPv${i}`] ?? meta[`pv${i}Voltage`]);
    const current = numberOrNull(meta[`ipv${i}`] ?? meta[`iPv${i}`] ?? meta[`pv${i}Current`]);

    // Only emit if we have any data for this string index, or it's within mpptCount
    if (power === null && voltage === null && current === null && i > mpptCount) continue;

    hasStringData = true;
    const stringsPerMppt = mpptCount > 0 ? Math.max(Math.ceil(32 / mpptCount), 1) : 1;
    const mpptNum = mpptCount > 0 ? Math.ceil(i / stringsPerMppt) : null;

    readings.push({
      tenant_id: device.tenant_id,
      plant_id: plantId,
      device_id: device.id,
      inverter_serial: device.serial || null,
      provider_id: null,
      ts,
      inverter_online: inverterOnline,
      plant_generating: plantGenerating,
      mppt_number: mpptNum,
      string_number: i,
      power_w: power,
      voltage_v: voltage,
      current_a: current,
      granularity: "string" as StringGranularity,
    });
  }

  // If no string-level data, fall back to inverter-level
  if (!hasStringData) {
    const acPower = numberOrNull(meta.pac ?? meta.TotalActiveACOutputPower);
    if (acPower !== null) {
      readings.push({
        tenant_id: device.tenant_id,
        plant_id: plantId,
        device_id: device.id,
        inverter_serial: device.serial || null,
        provider_id: null,
        ts,
        inverter_online: inverterOnline,
        plant_generating: plantGenerating,
        mppt_number: null,
        string_number: null,
        power_w: acPower,
        voltage_v: null,
        current_a: null,
        granularity: "inverter" as StringGranularity,
      });
    }
  }

  return readings;
}

function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}
