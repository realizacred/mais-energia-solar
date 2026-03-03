import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

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
  /** Provider-reported status (e.g. "normal", "offline", "alarm") */
  provider_status?: string | null;
}

/** SSOT: Threshold único de offline — 30 min (~2 ciclos de sync de 15 min). Padrão para TODAS as APIs/usinas. */
const OFFLINE_THRESHOLD_MS = 30 * 60 * 1000;

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

  // Rule 1: OFFLINE — no recent sync (threshold único: 30 min para TODAS as APIs)
  if (!input.updated_at || elapsed > OFFLINE_THRESHOLD_MS) {
    return {
      uiStatus: "offline",
      reason: input.updated_at
        ? `Última sincronização há ${Math.round(elapsed / 60000)} min (limite: 30 min)`
        : "Sem data de sincronização",
    };
  }

  // Recent sync confirmed — check provider-reported status first
  const ps = input.provider_status || "unknown";
  const providerOffline = ps === "offline" || ps === "no_communication";
  const providerAlarm = ps === "alarm";
  const providerConfirmedOnline = ps === "normal" || ps === "online";

  const powerKw = normalizePowerKw(input.power_kw);
  const isNight = isBrasiliaNight();

  // Rule 2: NIGHTTIME — if synced recently (rule 1 passed), always STANDBY at night
  // Rationale: after sunset there's no solar generation. Providers may report
  // "offline" or "disconnected" simply because inverters shut down at night.
  // Since the device passed the 2h sync gate, it is communicating and healthy.
  if (isNight) {
    // Only exception: explicit alarm (real fault, not just "no power")
    if (providerAlarm) {
      return {
        uiStatus: "offline",
        reason: "Alarme reportado pelo provedor (noturno)",
      };
    }
    return {
      uiStatus: "standby",
      reason: providerConfirmedOnline
        ? "Noturno — sem geração solar esperada"
        : input.energy_today_kwh > 0
          ? "Noturno — gerou energia hoje"
          : "Noturno — aguardando próxima sincronização",
    };
  }

  // Rule 3 (daytime): Provider says "offline"/"no_communication"
  // If there's active generation → trust generation over label (provider false positive).
  // If NO generation → trust the provider: plant is genuinely offline.
  if (providerOffline) {
    if (powerKw > POWER_THRESHOLD_KW) {
      return {
        uiStatus: "online",
        reason: `Gerando ${powerKw.toFixed(2)} kW (provedor reporta offline)`,
      };
    }
    if (input.energy_today_kwh > 0) {
      return {
        uiStatus: "online",
        reason: `Gerou ${input.energy_today_kwh.toFixed(1)} kWh hoje (provedor reporta offline)`,
      };
    }
    // No generation + provider confirms offline → trust provider
    return {
      uiStatus: "offline",
      reason: "Sem geração — provedor confirma offline",
    };
  }

  // Rule 3b: If provider reports ALARM, always offline
  if (providerAlarm) {
    return {
      uiStatus: "offline",
      reason: "Alarme reportado pelo provedor",
    };
  }

  // Rule 4 (daytime): ONLINE — provider confirms or actively generating
  const isActivelyGenerating = powerKw > POWER_THRESHOLD_KW;
  const hasGeneration = isActivelyGenerating || input.energy_today_kwh > 0;

  // If provider explicitly says "normal"/"online", trust it — plant is communicating
  if (providerConfirmedOnline) {
    return {
      uiStatus: "online",
      reason: isActivelyGenerating
        ? `Gerando ${powerKw.toFixed(2)} kW`
        : hasGeneration
          ? `Gerou ${input.energy_today_kwh.toFixed(1)} kWh hoje`
          : "Online — comunicação confirmada pelo provedor",
    };
  }

  // Unknown provider status but has generation → online
  if (hasGeneration) {
    return {
      uiStatus: "online",
      reason: isActivelyGenerating
        ? `Gerando ${powerKw.toFixed(2)} kW`
        : `Gerou ${input.energy_today_kwh.toFixed(1)} kWh hoje`,
    };
  }

  // Unknown provider status, no generation, daytime — still online if synced recently
  // (plant may be under clouds, in maintenance, or metrics not yet fetched today)
  return {
    uiStatus: "online",
    reason: "Sincronizado — aguardando dados de geração",
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
 * SSOT: Extract the canonical "last seen" timestamp for a device.
 *
 * IMPORTANT: For loggers, `updated_at` is touched by non-sync flows
 * (metadata merges, etc.) and does NOT represent real sync time.
 * Therefore we ONLY use `last_seen_at` for loggers.
 * For inverters, we allow fallback to `updated_at` only when `last_seen_at` is null
 * (extremely rare — means the device was never synced via the new flow).
 */
export function getDeviceSsotTimestamp(device: {
  type?: string;
  last_seen_at?: string | null;
  updated_at?: string;
}): string | null {
  // Prefer last_seen_at always — it tracks real sync
  if (device.last_seen_at) return device.last_seen_at;
  // For loggers: NEVER fall back to updated_at (it's polluted)
  if (device.type === "logger") return null;
  // For inverters/other: fall back only if last_seen_at is null
  return device.updated_at || null;
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

  // Rule 2: NIGHTTIME — recently synced (passed rule 1) → standby
  // Inverters shut down at night; providers may report "offline"/"disconnected"
  // which doesn't mean a real fault — just no solar generation.
  if (isBrasiliaNight()) {
    return { status: "standby", provider_status: providerStatus, reason: "Noturno — dispositivo em standby" };
  }

  // Rule 3 (daytime): ONLINE if raw status indicates healthy
  const isOnline = providerStatus === "online" || providerStatus === "normal" || providerStatus === "connected";
  if (isOnline) {
    return { status: "online", provider_status: providerStatus, reason: "Dispositivo sincronizado e operacional" };
  }

  // Unknown/other status during daytime but recently synced — still online
  // (device is communicating even if status label is unusual)
  if (providerStatus === "unknown" || providerStatus === "") {
    return { status: "online", provider_status: providerStatus, reason: "Sincronizado — status desconhecido" };
  }

  // Explicit fault/offline during daytime
  return { status: "offline", provider_status: providerStatus, reason: `Status do provedor: ${providerStatus}` };
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

/* ─── RELATIVE TIME FORMATTER (SSOT) ─── */

/**
 * Format a "seen at" timestamp as relative text (e.g., "há 13 min", "há 3 horas").
 * SSOT — the ONLY helper for "Visto há …" / "Sync há …" across all monitoring screens.
 * Returns "—" if no date is provided.
 */
export function formatRelativeSeenAt(dateStr: string | null | undefined, options?: { addSuffix?: boolean }): string {
  if (!dateStr) return "—";
  try {
    return formatDistanceToNow(new Date(dateStr), {
      addSuffix: options?.addSuffix ?? false,
      locale: ptBR,
    });
  } catch {
    return "—";
  }
}
