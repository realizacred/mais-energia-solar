/**
 * monitor-alert-engine — Independent Edge Function
 * Runs every 5 min via cron. Detects anomalies and manages monitor_events.
 *
 * Rules: OFFLINE, STALE_DATA, FREEZE, SUDDEN_DROP, ZERO_GENERATION, IMBALANCE
 * Idempotent: uses fingerprint-based dedup (unique partial index).
 * Plan-gated: checks monitor_subscriptions for feature flags.
 *
 * Does NOT alter monitoring-connect or monitoring-sync.
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

// ─── Alert types / severity ──────────────────────────────────
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

// ─── Thresholds (configurable via env in future) ─────────────
const OFFLINE_MINUTES = 15;
const STALE_MINUTES = 15;
const FREEZE_MINUTES = 10;
const SUDDEN_DROP_PCT = 0.4;
const SUDDEN_DROP_WINDOW_MIN = 5;
const ZERO_GEN_HOUR_START = 9;
const ZERO_GEN_HOUR_END = 16;
const IMBALANCE_TOLERANCE = 0.3;
const IMBALANCE_MINUTES = 15;

// ─── Plan feature gating ─────────────────────────────────────
function planAllows(features: Record<string, unknown> | null, alertType: AlertType): boolean {
  if (!features) return false;
  const alerts = (features.alerts as string[]) || [];
  return alerts.includes(alertType);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const started = Date.now();
  const sb = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // ── 1. Get all active integrations (per tenant) ──────────
    const { data: integrations } = await sb
      .from("monitoring_integrations")
      .select("tenant_id, provider, id")
      .in("status", ["connected", "connected_pending"]);

    if (!integrations?.length) {
      return json({ ok: true, msg: "No active integrations", ms: Date.now() - started });
    }

    const tenantIds = [...new Set(integrations.map((i: any) => i.tenant_id))];
    const stats = { tenants: tenantIds.length, opened: 0, closed: 0, skipped: 0, errors: 0 };

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

// ═══════════════════════════════════════════════════════════════
// Per-tenant processing
// ═══════════════════════════════════════════════════════════════
async function processAlertsTenant(
  sb: ReturnType<typeof createClient>,
  tenantId: string,
  stats: { opened: number; closed: number; skipped: number; errors: number },
) {
  const now = new Date();

  // ── Load subscription + plan features for this tenant ──────
  const { data: subs } = await sb
    .from("monitor_subscriptions")
    .select("plant_ids, status, plan_id")
    .eq("tenant_id", tenantId)
    .in("status", ["active", "trialing"]);

  // Build set of plant_ids with active subscriptions
  const activePlantIds = new Set<string>();
  let planFeatures: Record<string, unknown> | null = null;

  if (subs?.length) {
    for (const sub of subs) {
      const ids = (sub as any).plant_ids as string[] | null;
      if (ids) ids.forEach((id: string) => activePlantIds.add(id));

      // Load plan features (use first found)
      if (!planFeatures && (sub as any).plan_id) {
        const { data: plan } = await sb
          .from("monitor_plans")
          .select("features")
          .eq("id", (sub as any).plan_id)
          .single();
        if (plan) planFeatures = plan.features as Record<string, unknown>;
      }
    }
  }

  // If no subscriptions, default to basic offline-only alerts
  if (!planFeatures) {
    planFeatures = { alerts: ["offline"] };
  }

  // ── Load plants (from legacy solar_plants) ─────────────────
  const { data: plants } = await sb
    .from("solar_plants")
    .select("id, name, capacity_kw, status, updated_at, provider, external_id")
    .eq("tenant_id", tenantId);

  if (!plants?.length) return;

  // ── Load recent realtime readings (last 20 min window) ─────
  const windowStart = new Date(now.getTime() - 20 * 60 * 1000).toISOString();
  const { data: readings } = await sb
    .from("monitor_readings_realtime")
    .select("plant_id, device_id, channel_id, ts, power_w, energy_kwh")
    .eq("tenant_id", tenantId)
    .gte("ts", windowStart)
    .order("ts", { ascending: false })
    .limit(1000);

  // Group readings by plant
  const readingsByPlant = new Map<string, typeof readings>();
  for (const r of readings || []) {
    const key = (r as any).plant_id;
    if (!readingsByPlant.has(key)) readingsByPlant.set(key, []);
    readingsByPlant.get(key)!.push(r);
  }

  // ── Load channels for imbalance detection ──────────────────
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

  // ── Generate alert candidates ──────────────────────────────
  const candidates: AlertCandidate[] = [];
  const currentHour = now.getUTCHours() - 3; // BRT approximation

  for (const plant of plants) {
    const p = plant as any;
    const plantReadings = readingsByPlant.get(p.id) || [];

    // === OFFLINE ===
    if (planAllows(planFeatures, "offline")) {
      const lastContact = p.updated_at ? new Date(p.updated_at) : null;
      if (lastContact && (now.getTime() - lastContact.getTime()) > OFFLINE_MINUTES * 60 * 1000) {
        const minAgo = Math.round((now.getTime() - lastContact.getTime()) / 60000);
        candidates.push({
          tenantId, plantId: p.id, deviceId: null, channelId: null,
          type: "offline", severity: "critical",
          title: `Usina offline há ${minAgo} min`,
          message: `${p.name || "Usina"} sem comunicação desde ${lastContact.toISOString()}`,
          fingerprint: `offline:${p.id}`,
        });
      }
    }

    // === STALE_DATA ===
    if (planAllows(planFeatures, "stale_data")) {
      if (plantReadings.length === 0) {
        // No realtime readings at all — check if we should expect them
        const lastContact = p.updated_at ? new Date(p.updated_at) : null;
        if (lastContact && (now.getTime() - lastContact.getTime()) > STALE_MINUTES * 60 * 1000) {
          candidates.push({
            tenantId, plantId: p.id, deviceId: null, channelId: null,
            type: "stale_data", severity: "warning",
            title: "Dados desatualizados",
            message: `${p.name || "Usina"}: sem leituras recentes há mais de ${STALE_MINUTES} min`,
            fingerprint: `stale_data:${p.id}`,
          });
        }
      }
    }

    // === FREEZE ===
    if (planAllows(planFeatures, "freeze") && plantReadings.length >= 2) {
      const recent = plantReadings.slice(0, 5); // latest readings
      const powers = recent.map((r: any) => Number(r.power_w || 0));
      const allSame = powers.length >= 2 && powers.every((v: number) => Math.abs(v - powers[0]) < 1);
      const oldest = recent[recent.length - 1] as any;
      const span = now.getTime() - new Date(oldest.ts).getTime();

      if (allSame && span >= FREEZE_MINUTES * 60 * 1000 && powers[0] > 0) {
        candidates.push({
          tenantId, plantId: p.id, deviceId: null, channelId: null,
          type: "freeze", severity: "warning",
          title: "Potência congelada",
          message: `${p.name || "Usina"}: potência estável em ${powers[0]}W por ${Math.round(span / 60000)} min`,
          fingerprint: `freeze:${p.id}`,
        });
      }
    }

    // === SUDDEN_DROP ===
    if (planAllows(planFeatures, "sudden_drop") && plantReadings.length >= 2) {
      const latest = plantReadings[0] as any;
      const windowBack = new Date(now.getTime() - SUDDEN_DROP_WINDOW_MIN * 60 * 1000);
      const older = plantReadings.find((r: any) => new Date(r.ts) <= windowBack) as any;

      if (older && Number(older.power_w) > 100) {
        const drop = 1 - (Number(latest.power_w) / Number(older.power_w));
        if (drop >= SUDDEN_DROP_PCT) {
          candidates.push({
            tenantId, plantId: p.id, deviceId: null, channelId: null,
            type: "sudden_drop", severity: "critical",
            title: `Queda brusca de ${Math.round(drop * 100)}%`,
            message: `${p.name || "Usina"}: potência caiu de ${older.power_w}W para ${latest.power_w}W`,
            fingerprint: `sudden_drop:${p.id}`,
          });
        }
      }
    }

    // === ZERO_GENERATION ===
    if (planAllows(planFeatures, "zero_generation")) {
      if (currentHour >= ZERO_GEN_HOUR_START && currentHour < ZERO_GEN_HOUR_END) {
        if (plantReadings.length > 0) {
          const latest = plantReadings[0] as any;
          if (Number(latest.power_w || 0) < 5) {
            candidates.push({
              tenantId, plantId: p.id, deviceId: null, channelId: null,
              type: "zero_generation", severity: "warning",
              title: "Geração zero em horário solar",
              message: `${p.name || "Usina"}: potência ~0W às ${currentHour}h (esperava geração)`,
              fingerprint: `zero_gen:${p.id}`,
            });
          }
        }
      }
    }

    // === IMBALANCE ===
    if (planAllows(planFeatures, "imbalance")) {
      const plantChannels = channelsByPlant.get(p.id) || [];
      const nonTotal = plantChannels.filter((ch: any) => ch.channel_type !== "total");
      if (nonTotal.length >= 2) {
        // Get latest reading per channel
        const channelPowers: { ch: any; power: number }[] = [];
        for (const ch of nonTotal) {
          const chReading = (readings || []).find(
            (r: any) => r.channel_id === ch.id && r.plant_id === p.id,
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
                  tenantId, plantId: p.id, deviceId: cp.ch.device_id, channelId: cp.ch.id,
                  type: "imbalance", severity: "warning",
                  title: `Desequilíbrio: ${cp.ch.name}`,
                  message: `Canal ${cp.ch.name} em ${Math.round(actualRatio * 100)}% vs esperado ${Math.round(expectedRatio * 100)}%`,
                  fingerprint: `imbalance:${p.id}:${cp.ch.id}`,
                });
              }
            }
          }
        }
      }
    }
  }

  // ── Upsert events (open new, skip existing) ────────────────
  const openFingerprints = new Set(candidates.map((c) => c.fingerprint));

  for (const c of candidates) {
    try {
      // Check if already open with same fingerprint
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

  // ── Auto-close resolved events ─────────────────────────────
  const { data: openEvents } = await sb
    .from("monitor_events")
    .select("id, fingerprint")
    .eq("tenant_id", tenantId)
    .eq("is_open", true)
    .not("fingerprint", "is", null);

  for (const ev of openEvents || []) {
    const fp = (ev as any).fingerprint as string;
    if (!openFingerprints.has(fp)) {
      // Condition resolved — close event
      await sb
        .from("monitor_events")
        .update({ is_open: false, resolved_at: now.toISOString(), ends_at: now.toISOString(), updated_at: now.toISOString() })
        .eq("id", (ev as any).id);
      stats.closed++;
    }
  }
}
