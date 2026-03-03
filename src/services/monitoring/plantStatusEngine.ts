/**
 * Plant Status Engine — SSOT for deriving plant UI status.
 *
 * Three visual states:
 *   🟢 online   — generating or has generated today, recently synced
 *   🌙 standby  — nighttime, no generation, but recently synced
 *   🔴 offline  — no recent sync (>2h) or daytime with no generation
 *
 * Rules:
 *   1. OFFLINE if updated_at > 120 min ago (absolute, no exceptions)
 *   2. STANDBY if synced <2h AND power_kw <= 0.05 AND hour 18–06
 *   3. ONLINE  if synced <2h AND (power_kw > 0.05 OR energy_today > 0)
 *
 * Never uses monthly energy. Never uses OR-permissive fallbacks.
 */

export type PlantUiStatus = "online" | "standby" | "offline";

export interface DerivedPlantStatus {
  uiStatus: PlantUiStatus;
  reason: string;
}

interface PlantStatusInput {
  /** ISO timestamp of last sync/update */
  updated_at: string | null;
  /** Current instantaneous power in kW (may be watts for some providers) */
  power_kw: number | null;
  /** Energy generated today in kWh */
  energy_today_kwh: number;
}

const OFFLINE_THRESHOLD_MS = 2 * 60 * 60 * 1000; // 2 hours

/**
 * Get current hour in America/Sao_Paulo timezone (BRT/BRST).
 * SSOT for daylight/night checks across the monitoring system.
 */
export function getBrasiliaHour(): number {
  return parseInt(new Date().toLocaleString("en-US", { timeZone: "America/Sao_Paulo", hour: "numeric", hour12: false }), 10);
}

export function isBrasiliaNight(): boolean {
  const hour = getBrasiliaHour();
  return hour >= 18 || hour < 6;
}

/**
 * Get today's date string (YYYY-MM-DD) in America/Sao_Paulo timezone.
 * SSOT — prevents UTC shift after 21h BRT (which is 00h+ UTC next day).
 */
export function getTodayBrasilia(): string {
  const now = new Date();
  return now.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" }); // en-CA = YYYY-MM-DD
}

/**
 * Get first day of current month (YYYY-MM-DD) in Brasilia timezone.
 */
export function getMonthStartBrasilia(): string {
  const parts = getTodayBrasilia().split("-");
  return `${parts[0]}-${parts[1]}-01`;
}

/**
 * Get a date string N days ago in Brasilia timezone (YYYY-MM-DD).
 */
export function getDaysAgoBrasilia(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

/**
 * Format a Date to YYYY-MM-DD in Brasilia timezone.
 */
export function formatDateBrasilia(date: Date): string {
  return date.toLocaleDateString("en-CA", { timeZone: "America/Sao_Paulo" });
}

const POWER_THRESHOLD_KW = 0.05;

/**
 * Derive the UI status of a plant. This is the ONLY function
 * that should be used across the entire frontend.
 */
export function derivePlantStatus(input: PlantStatusInput): DerivedPlantStatus {
  const now = Date.now();
  const updatedAt = input.updated_at ? new Date(input.updated_at).getTime() : 0;
  const elapsed = now - updatedAt;

  // Rule 1: OFFLINE — no recent sync
  if (!input.updated_at || elapsed > OFFLINE_THRESHOLD_MS) {
    return {
      uiStatus: "offline",
      reason: input.updated_at
        ? `Última sincronização há ${Math.round(elapsed / 60000)} min (limite: 120 min)`
        : "Sem data de sincronização",
    };
  }

  // Recent sync confirmed — check generation
  const powerKw = normalizePowerKw(input.power_kw);
  const isNight = isBrasiliaNight();

  // Rule 2: STANDBY — nighttime always standby (synced)
  // Many providers return stale power_kw from the last daytime reading,
  // so we NEVER trust power_kw at night. Synced + night = standby.
  if (isNight) {
    return {
      uiStatus: "standby",
      reason: "Noturno — sem geração solar esperada",
    };
  }

  // Rule 3 (daytime only): ONLINE — actively generating or generated today
  const isActivelyGenerating = powerKw > POWER_THRESHOLD_KW;
  const hasGeneration = isActivelyGenerating || input.energy_today_kwh > 0;
  if (hasGeneration) {
    return {
      uiStatus: "online",
      reason: isActivelyGenerating
        ? `Gerando ${powerKw.toFixed(2)} kW`
        : `Gerou ${input.energy_today_kwh.toFixed(1)} kWh hoje`,
    };
  }

  // Daytime, synced, but no generation — still offline
  return {
    uiStatus: "offline",
    reason: "Sincronizado mas sem geração durante o dia",
  };
}

// normalizePowerKw is now exported in the SSOT section below

/* ─── DEVICE STATUS ENGINE (SSOT) ─── */

export type DeviceUiStatus = "online" | "standby" | "offline";

export interface DerivedDeviceStatus {
  status: DeviceUiStatus;
  reason: string;
  /** Original provider-reported status, preserved for diagnostics */
  provider_status: string;
}

interface DeviceStatusInput {
  /** Raw status from monitor_devices table */
  rawStatus: string;
  /** ISO timestamp of last device sync/update */
  lastSeenAt: string | null;
}

/**
 * Derive device UI status. SSOT — the ONLY function for device status.
 * Same philosophy as derivePlantStatus:
 *   1. OFFLINE if last_seen > 2h ago
 *   2. STANDBY if night + was online
 *   3. ONLINE otherwise
 */
export function deriveDeviceStatus(input: DeviceStatusInput): DerivedDeviceStatus {
  const now = Date.now();
  const lastSeen = input.lastSeenAt ? new Date(input.lastSeenAt).getTime() : 0;
  const elapsed = now - lastSeen;
  const providerStatus = input.rawStatus || "unknown";

  // Rule 1: OFFLINE — no recent sync (same 2h threshold as plants)
  if (!input.lastSeenAt || elapsed > OFFLINE_THRESHOLD_MS) {
    return {
      status: "offline",
      provider_status: providerStatus,
      reason: input.lastSeenAt
        ? `Offline por timeout — sem sincronização há ${Math.round(elapsed / 60000)} min`
        : "Sem data de sincronização",
    };
  }

  // Rule 2: STANDBY — nighttime + was online
  if (input.rawStatus === "online" && isBrasiliaNight()) {
    return { status: "standby", provider_status: providerStatus, reason: "Noturno — dispositivo em standby" };
  }

  // Rule 3: ONLINE — recently synced and raw status is online
  if (input.rawStatus === "online") {
    return { status: "online", provider_status: providerStatus, reason: "Dispositivo sincronizado e operacional" };
  }

  // Raw status is not online (e.g. "offline", "fault", unknown)
  return { status: "offline", provider_status: providerStatus, reason: `Status do provedor: ${input.rawStatus}` };
}

/* ─── SHARED UI STATUS RESOLVER (SSOT) ─── */

/**
 * Map a MonitorHealthCache.status string to PlantUiStatus.
 * SSOT — eliminates duplicate resolveUiStatus() in every screen.
 */
export function resolveHealthToUiStatus(healthStatus: string | undefined): PlantUiStatus {
  if (healthStatus === "online") return "online";
  if (healthStatus === "standby") return "standby";
  return "offline";
}

/* ─── ENERGY/POWER HELPERS (SSOT) ─── */

/**
 * Estimate energy from power when energy_kwh is unavailable.
 * SSOT — single constant for the conservative multiplier.
 * NOT the same as HSP for PR calculation.
 */
export const POWER_KW_TO_ENERGY_ESTIMATE_HOURS = 4.5;

/**
 * Normalize power: some providers send watts instead of kW.
 * SSOT — replaces all inline W→kW conversions.
 */
export function normalizePowerKw(raw: number | null): number {
  if (raw == null || raw <= 0) return 0;
  return raw > 100 ? raw / 1000 : raw;
}

/**
 * Compute energy from a daily metric row, with power_kw fallback.
 * SSOT — replaces duplicated energy extraction in listPlantsWithHealth,
 * getPlantDetail, and getDashboardStats.
 */
export function extractDailyEnergy(energyKwh: number | null, powerKw: number | null): number {
  if (energyKwh != null && Number(energyKwh) > 0) return Number(energyKwh);
  if (powerKw != null && Number(powerKw) > 0) {
    return normalizePowerKw(Number(powerKw)) * POWER_KW_TO_ENERGY_ESTIMATE_HOURS;
  }
  return 0;
}

/**
 * Sum monthly energy from an array of daily metric rows.
 * SSOT — single aggregation function.
 */
export function sumMonthlyEnergy(rows: Array<{ energy_kwh: number | null; power_kw?: number | null }>): number {
  return rows.reduce((total, r) => total + extractDailyEnergy(r.energy_kwh, r.power_kw ?? null), 0);
}

/* ─── UI Constants (SSOT for badges, dots, filters) ─── */

export const UI_STATUS_LABELS: Record<PlantUiStatus, string> = {
  online: "Online",
  standby: "Standby",
  offline: "Offline",
};

export const UI_STATUS_DOT: Record<PlantUiStatus, string> = {
  online: "bg-success",
  standby: "bg-warning",
  offline: "bg-destructive",
};

export const UI_STATUS_ICON: Record<PlantUiStatus, string> = {
  online: "🟢",
  standby: "🌙",
  offline: "🔴",
};

export const PLANT_FILTER_CHIPS: { key: PlantUiStatus | "all"; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "online", label: "🟢 Online" },
  { key: "standby", label: "🌙 Standby" },
  { key: "offline", label: "🔴 Offline" },
];

/* ─── Device UI Constants (SSOT) ─── */

export const DEVICE_STATUS_LABELS: Record<DeviceUiStatus, string> = {
  online: "Online",
  standby: "Standby",
  offline: "Sem conexão",
};

export const DEVICE_STATUS_DOT: Record<DeviceUiStatus, string> = {
  online: "bg-success",
  standby: "bg-warning",
  offline: "bg-destructive",
};

export const DEVICE_STATUS_TEXT: Record<DeviceUiStatus, string> = {
  online: "text-success",
  standby: "text-warning",
  offline: "text-destructive",
};

/* ─── STALENESS GATE (SSOT) ─── */

export interface DeviceStaleness {
  stale: boolean;
  minutesAgo: number | null;
  label: string;
}

/**
 * Compute whether a device snapshot is stale.
 * SSOT — single staleness check for all device/MPPT data across the UI.
 */
export function computeDeviceStaleness(snapshotAt: string | null): DeviceStaleness {
  if (!snapshotAt) {
    return { stale: true, minutesAgo: null, label: "Sem data de sincronização" };
  }
  const elapsed = Date.now() - new Date(snapshotAt).getTime();
  const minutesAgo = Math.round(elapsed / 60000);
  const stale = elapsed > OFFLINE_THRESHOLD_MS;
  return {
    stale,
    minutesAgo,
    label: stale ? `Última leitura há ${minutesAgo} min` : `Sincronizado há ${minutesAgo} min`,
  };
}
