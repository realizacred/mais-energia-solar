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

  // ── Step 1: Collect raw channel data ──
  interface RawChannel { index: number; power: number | null; voltage: number | null; current: number | null }
  const rawChannels: RawChannel[] = [];
  for (let i = 1; i <= 32; i++) {
    const power = numberOrNull(meta[`pow${i}`] ?? meta[`ppv${i}`]);
    const voltage = numberOrNull(meta[`vpv${i}`] ?? meta[`uPv${i}`] ?? meta[`pv${i}Voltage`]);
    const current = numberOrNull(meta[`ipv${i}`] ?? meta[`iPv${i}`] ?? meta[`pv${i}Current`]);
    rawChannels.push({ index: i, power, voltage, current });
  }

  // ── Step 2: Trim to only relevant channels (align with extractMpptData) ──
  // Find last channel with any non-zero value
  let lastActiveIndex = -1;
  for (let i = rawChannels.length - 1; i >= 0; i--) {
    const ch = rawChannels[i];
    if ((ch.power !== null && ch.power > 0) || (ch.voltage !== null && ch.voltage > 0) || (ch.current !== null && ch.current > 0)) {
      lastActiveIndex = i;
      break;
    }
  }
  const keepCount = Math.max(mpptCount, lastActiveIndex + 1);
  if (keepCount === 0) {
    // No string-level data at all — skip to inverter fallback
  } else {
    const trimmed = rawChannels.slice(0, keepCount);

    // ── Step 3: Determine MPPT grouping ──
    // If mpptCount matches trimmed length, it's 1 string per MPPT
    const stringsPerMppt = mpptCount > 0 ? Math.max(Math.ceil(trimmed.length / mpptCount), 1) : 1;

    let hasStringData = false;
    for (const ch of trimmed) {
      if (ch.power === null && ch.voltage === null && ch.current === null) continue;
      hasStringData = true;
      const mpptNum = mpptCount > 0 ? Math.ceil(ch.index / stringsPerMppt) : null;

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
        string_number: ch.index,
        power_w: ch.power,
        voltage_v: ch.voltage,
        current_a: ch.current,
        granularity: "string" as StringGranularity,
      });
    }

    if (hasStringData) return readings;
  }

  // Inverter-level fallback
  {
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
