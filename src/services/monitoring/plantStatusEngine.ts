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

/** Normalize power_kw: some providers send watts instead of kW */
function normalizePowerKw(raw: number | null): number {
  if (raw == null || raw <= 0) return 0;
  return raw > 100 ? raw / 1000 : raw;
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
