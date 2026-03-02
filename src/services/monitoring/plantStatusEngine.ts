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
  const currentHour = new Date().getHours();
  const isNight = currentHour >= 18 || currentHour < 6;
  const isActivelyGenerating = powerKw > POWER_THRESHOLD_KW;

  // Rule 2: STANDBY — nighttime, no active generation, but synced
  // At night, even if energy_today > 0, power_kw = 0 means not generating NOW
  if (isNight && !isActivelyGenerating) {
    return {
      uiStatus: "standby",
      reason: "Noturno — sem geração solar esperada",
    };
  }

  // Rule 3: ONLINE — actively generating OR daytime with energy today
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
