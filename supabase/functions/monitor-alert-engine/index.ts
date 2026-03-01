/**
 * monitor-alert-engine v2 — Independent Edge Function
 * Runs every 5 min via cron. Detects anomalies and manages monitor_events.
 *
 * FIXES from v1:
 * - Gating PER PLANT (not per tenant)
 * - Auto-close PER PLANT processed (never closes events of unprocessed plants)
 * - Guardrail: only close events open >= 2 cycles (10 min)
 * - Timezone-aware ZERO_GENERATION (America/Sao_Paulo default)
 * - Explicit tenant_id on all inserts, service_role key verified
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

type AlertType = "offline" | "stale_data" | "freeze" | "sudden_drop" | "zero_generation" | "imbalance";
type Severity = "info" | "warning" | "critical";

interface AlertCandidate {
  tenantId: string;
  plantId: string;
  deviceId: string | null;
  channelId: string | null;
  type: AlertType;
  severity: Severity;
  title: string;
  message: string;
  fingerprint: string;
}

// ─── Thresholds ──────────────────────────────────────────
const OFFLINE_MINUTES = 15;
const STALE_MINUTES = 15;
const FREEZE_MINUTES = 10;
const SUDDEN_DROP_PCT = 0.4;
const ZERO_GEN_HOUR_START = 9;
const ZERO_GEN_HOUR_END = 16;
const IMBALANCE_TOLERANCE = 0.3;
const CLOSE_GUARDRAIL_MS = 10 * 60 * 1000; // 10 min minimum open before auto-close
const DEFAULT_TZ = "America/Sao_Paulo";

// ─── Timezone helper ─────────────────────────────────────
function getLocalHour(tz: string): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { hour: "numeric", hour12: false, timeZone: tz }).formatToParts(new Date());
    const hourPart = parts.find(p => p.type === "hour");
    return hourPart ? parseInt(hourPart.value, 10) : new Date().getUTCHours();
  } catch {
    // Fallback: UTC-3
    return (new Date().getUTCHours() - 3 + 24) % 24;
  }
}

// ─── Plan feature gating (per plant) ─────────────────────
function planAllows(features: Record<string, unknown> | null, alertType: AlertType): boolean {
  if (!features) return false;
  const alerts = (features.alerts as string[]) || [];
  return alerts.includes(alertType);
}

// Default features for plants without subscription (basic offline-only)
const DEFAULT_FEATURES: Record<string, unknown> = { alerts: ["offline", "stale_data"] };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();

  // ── Verify service role key ──
  const srkPresent = !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  console.log(`[alert-engine] service_role_key present: ${srkPresent}`);
  if (!srkPresent) {
    return json({ error: "Missing SUPABASE_SERVICE_ROLE_KEY" }, 500);
  }

  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── 1. Get all active integrations ──
    const { data: integrations } = await sb
      .from("monitoring_integrations")
      .select("tenant_id, provider, id")
      .in("status", ["connected", "connected_pending"]);

    if (!integrations?.length) {
      return json({ ok: true, msg: "No active integrations", ms: Date.now() - started });
    }

    const tenantIds = [...new Set(integrations.map((i: any) => i.tenant_id))];
    const stats = { tenants: tenantIds.length, plants_processed: 0, opened: 0, closed: 0, skipped: 0, errors: 0 };

    for (const tenantId of tenantIds) {
      try {
        await processAlertsTenant(sb, tenantId, stats);
      } catch (err) {
        console.error(`[alert-engine] tenant=${tenantId} error:`, err);
        stats.errors++;
      }
    }

    console.log(`[alert-engine] OK`, JSON.stringify({ ...stats, ms: Date.now() - started }));
    return json({ ok: true, ...stats, ms: Date.now() - started });
  } catch (err) {
    console.error("[alert-engine] Fatal:", err);
    return json({ error: (err as Error).message }, 500);
  }
});

// ═══════════════════════════════════════════════════════════
// Per-tenant processing
// ═══════════════════════════════════════════════════════════
async function processAlertsTenant(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  stats: { plants_processed: number; opened: number; closed: number; skipped: number; errors: number },
) {
  const now = new Date();

  // ── Load ALL subscriptions for this tenant (per plant_id) ──
  const { data: subs } = await sb
    .from("monitor_subscriptions")
    .select("plant_id, plant_ids, status, plan_id")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing"]);

  // ── Load ALL plans (cache for this execution) ──
  const { data: allPlans } = await sb
    .from("monitor_plans")
    .select("id, features")
    .eq("is_active", true);

  const planCache = new Map<string, Record<string, unknown>>();
  for (const p of allPlans || []) {
    planCache.set(p.id, p.features as Record<string, unknown>);
  }

  // Build map: plant_id -> features
  const plantFeaturesMap = new Map<string, Record<string, unknown>>();
  for (const sub of subs || []) {
    const s = sub as any;
    const features = s.plan_id ? planCache.get(s.plan_id) || DEFAULT_FEATURES : DEFAULT_FEATURES;

    // Direct plant_id (new per-plant model)
    if (s.plant_id) {
      plantFeaturesMap.set(s.plant_id, features);
    }
    // Legacy plant_ids array
    if (s.plant_ids && Array.isArray(s.plant_ids)) {
      for (const pid of s.plant_ids) {
        if (!plantFeaturesMap.has(pid)) {
          plantFeaturesMap.set(pid, features);
        }
      }
    }
  }

  // ── Load plants (from legacy solar_plants) ──
  const { data: plants } = await sb
    .from("solar_plants")
    .select("id, name, capacity_kw, status, updated_at, provider, external_id, metadata")
    .eq("tenant_id", tenantId);

  if (!plants?.length) return;

  // ── Determine timezone ──
  // Try to get from tenant or plant metadata; fallback to America/Sao_Paulo
  let tz = DEFAULT_TZ;
  const firstPlant = plants[0] as any;
  if (firstPlant?.metadata?.timezone) tz = String(firstPlant.metadata.timezone);
  const localHour = getLocalHour(tz);

  // ── Load recent realtime readings (last 20 min window) ──
  const windowStart = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
  const { data: readings } = await sb
    .from("monitor_readings_realtime")
    .select("plant_id, device_id, channel_id, ts, power_w, energy_kwh")
    .eq("tenant_id", tenantId)
    .gte("ts", windowStart)
    .order("ts", { ascending: false })
    .limit(1000);

  const readingsByPlant = new Map<string, any[]>();
  for (const r of readings || []) {
    const key = (r as any).plant_id;
    if (!readingsByPlant.has(key)) readingsByPlant.set(key, []);
    readingsByPlant.get(key)!.push(r);
  }

  // ── Load channels for imbalance ──
  const { data: channels } = await sb
    .from("monitor_channels")
    .select("id, plant_id, device_id, channel_type, installed_power_wp, name")
    .eq("tenant_id", tenantId)
    .eq("is_active", true);

  const channelsByPlant = new Map<string, any[]>();
  for (const ch of channels || []) {
    const key = ch.plant_id;
    if (!channelsByPlant.has(key)) channelsByPlant.set(key, []);
    channelsByPlant.get(key)!.push(ch);
  }

  // ── Process each plant individually ──
  const processedPlantIds = new Set<string>();

  for (const plant of plants) {
    const p = plant as any;
    const plantId = p.id as string;
    processedPlantIds.add(plantId);
    stats.plants_processed++;

    // Resolve features for THIS plant
    const features = plantFeaturesMap.get(plantId) || DEFAULT_FEATURES;
    const plantReadings = readingsByPlant.get(plantId) || [];
    const candidates: AlertCandidate[] = [];

    // === OFFLINE ===
    if (planAllows(features, "offline")) {
      const lastContact = p.updated_at ? new Date(p.updated_at) : null;
      if (lastContact && (now.getTime() - lastContact.getTime()) > OFFLINE_MINUTES * 60 * 1000) {
        const minAgo = Math.round((now.getTime() - lastContact.getTime()) / 60000);
        candidates.push({
          tenantId, plantId, deviceId: null, channelId: null,
          type: "offline", severity: "critical",
          title: `Usina offline há ${minAgo} min`,
          message: `${p.name || "Usina"} sem comunicação desde ${lastContact.toISOString()}`,
          fingerprint: `offline:${plantId}`,
        });
      }
    }

    // === STALE_DATA ===
    if (planAllows(features, "stale_data")) {
      if (plantReadings.length === 0) {
        const lastContact = p.updated_at ? new Date(p.updated_at) : null;
        if (lastContact && (now.getTime() - lastContact.getTime()) > STALE_MINUTES * 60 * 1000) {
          candidates.push({
            tenantId, plantId, deviceId: null, channelId: null,
            type: "stale_data", severity: "warning",
            title: "Dados desatualizados",
            message: `${p.name || "Usina"}: sem leituras recentes há mais de ${STALE_MINUTES} min`,
            fingerprint: `stale_data:${plantId}`,
          });
        }
      }
    }

    // === FREEZE ===
    if (planAllows(features, "freeze") && plantReadings.length >= 2) {
      const recent = plantReadings.slice(0, 5);
      const powers = recent.map((r: any) => Number(r.power_w || 0));
      const allSame = powers.length >= 2 && powers.every((v: number) => Math.abs(v - powers[0]) < 1);
      const oldest = recent[recent.length - 1] as any;
      const span = now.getTime() - new Date(oldest.ts).getTime();

      if (allSame && span >= FREEZE_MINUTES * 60 * 1000 && powers[0] > 0) {
        candidates.push({
          tenantId, plantId, deviceId: null, channelId: null,
          type: "freeze", severity: "warning",
          title: "Potência congelada",
          message: `${p.name || "Usina"}: potência estável em ${powers[0]}W por ${Math.round(span / 60000)} min`,
          fingerprint: `freeze:${plantId}`,
        });
      }
    }

    // === SUDDEN_DROP (adaptive to sync interval) ===
    if (planAllows(features, "sudden_drop") && plantReadings.length >= 2) {
      const latest = plantReadings[0] as any;
      // Use actual interval between readings instead of fixed 5 min
      const older = plantReadings[plantReadings.length - 1] as any;
      if (older && Number(older.power_w) > 100) {
        const drop = 1 - (Number(latest.power_w) / Number(older.power_w));
        if (drop >= SUDDEN_DROP_PCT) {
          candidates.push({
            tenantId, plantId, deviceId: null, channelId: null,
            type: "sudden_drop", severity: "critical",
            title: `Queda brusca de ${Math.round(drop * 100)}%`,
            message: `${p.name || "Usina"}: potência caiu de ${older.power_w}W para ${latest.power_w}W`,
            fingerprint: `sudden_drop:${plantId}`,
          });
        }
      }
    }

    // === ZERO_GENERATION (timezone-aware) ===
    if (planAllows(features, "zero_generation")) {
      if (localHour >= ZERO_GEN_HOUR_START && localHour < ZERO_GEN_HOUR_END) {
        if (plantReadings.length > 0) {
          const latest = plantReadings[0] as any;
          if (Number(latest.power_w || 0) < 5) {
            candidates.push({
              tenantId, plantId, deviceId: null, channelId: null,
              type: "zero_generation", severity: "warning",
              title: "Geração zero em horário solar",
              message: `${p.name || "Usina"}: potência ~0W às ${localHour}h local (esperava geração)`,
              fingerprint: `zero_gen:${plantId}`,
            });
          }
        }
      }
    }

    // === IMBALANCE ===
    if (planAllows(features, "imbalance")) {
      const plantChannels = channelsByPlant.get(plantId) || [];
      const nonTotal = plantChannels.filter((ch: any) => ch.channel_type !== "total");
      if (nonTotal.length >= 2) {
        const channelPowers: { ch: any; power: number }[] = [];
        for (const ch of nonTotal) {
          const chReading = (readings || []).find(
            (r: any) => r.channel_id === ch.id && r.plant_id === plantId,
          ) as any;
          if (chReading) {
            channelPowers.push({ ch, power: Number(chReading.power_w || 0) });
          }
        }

        if (channelPowers.length >= 2) {
          const maxPower = Math.max(...channelPowers.map((c) => c.power));
          if (maxPower > 50) {
            for (const cp of channelPowers) {
              const expectedRatio = cp.ch.installed_power_wp
                ? cp.ch.installed_power_wp / Math.max(...nonTotal.map((c: any) => c.installed_power_wp || 1))
                : 1;
              const actualRatio = cp.power / maxPower;
              if (Math.abs(actualRatio - expectedRatio) > IMBALANCE_TOLERANCE) {
                candidates.push({
                  tenantId, plantId, deviceId: cp.ch.device_id, channelId: cp.ch.id,
                  type: "imbalance", severity: "warning",
                  title: `Desequilíbrio: ${cp.ch.name}`,
                  message: `Canal ${cp.ch.name} em ${Math.round(actualRatio * 100)}% vs esperado ${Math.round(expectedRatio * 100)}%`,
                  fingerprint: `imbalance:${plantId}:${cp.ch.id}`,
                });
              }
            }
          }
        }
      }
    }

    // ── Upsert events for this plant ──
    const plantFingerprints = new Set(candidates.map(c => c.fingerprint));

    for (const c of candidates) {
      try {
        const { data: existing } = await sb
          .from("monitor_events")
          .select("id")
          .eq("tenant_id", c.tenantId)
          .eq("fingerprint", c.fingerprint)
          .eq("is_open", true)
          .limit(1);

        if (existing && existing.length > 0) {
          stats.skipped++;
          continue;
        }

        const { error } = await sb.from("monitor_events").insert({
          tenant_id: c.tenantId,
          plant_id: c.plantId,
          device_id: c.deviceId,
          channel_id: c.channelId,
          type: c.type,
          severity: c.severity,
          title: c.title,
          message: c.message,
          fingerprint: c.fingerprint,
          is_open: true,
          starts_at: now.toISOString(),
          opened_at: now.toISOString(),
          updated_at: now.toISOString(),
        });
        if (error) {
          if (error.message.includes("duplicate") || error.message.includes("23505")) {
            stats.skipped++;
          } else {
            console.warn(`[alert-engine] insert error: ${error.message}`);
            stats.errors++;
          }
        } else {
          stats.opened++;
        }
      } catch (err) {
        console.error(`[alert-engine] event insert error:`, err);
        stats.errors++;
      }
    }

    // ── Auto-close resolved events FOR THIS PLANT ONLY ──
    const { data: openEvents } = await sb
      .from("monitor_events")
      .select("id, fingerprint, opened_at")
      .eq("tenant_id", tenantId)
      .eq("plant_id", plantId)
      .eq("is_open", true)
      .not("fingerprint", "is", null);

    for (const ev of openEvents || []) {
      const fp = (ev as any).fingerprint as string;
      const openedAt = (ev as any).opened_at ? new Date((ev as any).opened_at) : null;

      // Guardrail: only close if open >= 2 cycles (10 min)
      if (openedAt && (now.getTime() - openedAt.getTime()) < CLOSE_GUARDRAIL_MS) {
        continue; // Too recent, skip closing
      }

      if (!plantFingerprints.has(fp)) {
        await sb
          .from("monitor_events")
          .update({
            is_open: false,
            resolved_at: now.toISOString(),
            ends_at: now.toISOString(),
            updated_at: now.toISOString(),
          })
          .eq("id", (ev as any).id);
        stats.closed++;
      }
    }
  }
  // Note: events from plants NOT in processedPlantIds are never touched (safe)
}
