/**
 * MPPT / String Engine — Edge Function
 *
 * Actions:
 * - process_sync: Post-sync hook — normalize, upsert registry, insert metrics, detect alerts
 * - recalculate_baseline: Manual baseline recalculation for a plant
 *
 * Called by monitoring-sync (post-hook) and frontend (baseline recalculation).
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ═══ Normalizer (server-side) ═══

interface NormalizedReading {
  tenant_id: string;
  plant_id: string;
  device_id: string;
  inverter_serial: string | null;
  provider_id: string | null;
  ts: string;
  inverter_online: boolean;
  plant_generating: boolean;
  mppt_number: number | null;
  string_number: number | null;
  power_w: number | null;
  voltage_v: number | null;
  current_a: number | null;
  granularity: "string" | "mppt" | "inverter";
}

function numberOrNull(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

function normalizeDevice(
  device: any,
  plantId: string,
  tenantId: string,
  plantGenerating: boolean,
): NormalizedReading[] {
  if (device.type !== "inverter") return [];

  const meta = device.metadata || {};
  const ts = device.last_seen_at || new Date().toISOString();
  const inverterOnline = device.status === "online";
  const mpptCount = Number(meta.dcInputTypeMppt ?? meta.dcInputType ?? meta.mpptCount ?? 0);
  const readings: NormalizedReading[] = [];

  // Phase 1: Discover which string indices have real data (power > 0 or V/I > 0)
  const realStrings: number[] = [];
  for (let i = 1; i <= 32; i++) {
    const power = numberOrNull(meta[`pow${i}`] ?? meta[`ppv${i}`]);
    const voltage = numberOrNull(meta[`vpv${i}`] ?? meta[`uPv${i}`] ?? meta[`pv${i}Voltage`]);
    const current = numberOrNull(meta[`ipv${i}`] ?? meta[`iPv${i}`] ?? meta[`pv${i}Current`]);
    // Only include strings with actual non-zero data, OR strings within declared mpptCount
    const hasData = (power !== null && power > 0) || (voltage !== null && voltage > 0) || (current !== null && current > 0);
    if (hasData || i <= mpptCount) {
      realStrings.push(i);
    }
  }

  // Phase 2: Build readings only for real strings
  let hasStringData = false;
  for (const i of realStrings) {
    const power = numberOrNull(meta[`pow${i}`] ?? meta[`ppv${i}`]);
    const voltage = numberOrNull(meta[`vpv${i}`] ?? meta[`uPv${i}`] ?? meta[`pv${i}Voltage`]);
    const current = numberOrNull(meta[`ipv${i}`] ?? meta[`iPv${i}`] ?? meta[`pv${i}Current`]);

    hasStringData = true;

    // Determine MPPT number
    let mpptNum: number | null = null;
    if (mpptCount > 0) {
      const stringsPerMppt = Math.max(Math.ceil(realStrings.length / mpptCount), 1);
      const posInList = realStrings.indexOf(i);
      mpptNum = Math.floor(posInList / stringsPerMppt) + 1;
    }

    readings.push({
      tenant_id: tenantId,
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
      granularity: "string",
    });
  }

  // Inverter-level fallback
  if (!hasStringData) {
    const acPower = numberOrNull(meta.pac ?? meta.TotalActiveACOutputPower);
    if (acPower !== null) {
      readings.push({
        tenant_id: tenantId,
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
        granularity: "inverter",
      });
    }
  }

  return readings;
}

// ═══ Feature flag check ═══

async function isFeatureEnabled(admin: any, tenantId: string): Promise<boolean> {
  const { data } = await admin
    .from("tenants")
    .select("tenant_config")
    .eq("id", tenantId)
    .maybeSingle();
  return data?.tenant_config?.feature_mppt_string_monitoring === true;
}

// ═══ Process Sync (post-hook) ═══

async function processSyncHook(admin: any, tenantId: string, plantIds: string[]) {
  const enabled = await isFeatureEnabled(admin, tenantId);
  if (!enabled) {
    console.log(`[mppt-string-engine] Feature disabled for tenant ${tenantId}, skipping`);
    return { processed: 0, alerts_created: 0 };
  }

  let totalProcessed = 0;
  let alertsCreated = 0;

  for (const plantId of plantIds) {
    // Get all inverter devices for this plant
    const { data: devices } = await admin
      .from("monitor_devices")
      .select("*")
      .eq("plant_id", plantId)
      .eq("type", "inverter");

    if (!devices || devices.length === 0) continue;

    // Determine if plant is generating (any inverter online with power > 0)
    const plantGenerating = devices.some((d: any) => {
      const pac = numberOrNull(d.metadata?.pac ?? d.metadata?.TotalActiveACOutputPower);
      return d.status === "online" && pac !== null && pac > 0;
    });

    for (const device of devices) {
      const readings = normalizeDevice(device, plantId, tenantId, plantGenerating);

      for (const reading of readings) {
        // 1. Upsert registry
        const { data: reg, error: regErr } = await admin
          .from("monitor_string_registry")
          .upsert(
            {
              tenant_id: tenantId,
              plant_id: plantId,
              device_id: device.id,
              inverter_serial: reading.inverter_serial,
              provider_id: reading.provider_id,
              mppt_number: reading.mppt_number,
              string_number: reading.string_number,
              granularity: reading.granularity,
              last_seen_at: reading.ts,
              is_active: true,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "tenant_id,plant_id,device_id,mppt_number,string_number,granularity" }
          )
          .select("id, baseline_power_p50_w")
          .single();

        if (regErr || !reg) {
          console.warn(`[mppt-string-engine] Registry upsert failed: ${regErr?.message}`);
          continue;
        }

        // 2. Insert metric
        await admin.from("monitor_string_metrics").insert({
          tenant_id: tenantId,
          registry_id: reg.id,
          plant_id: plantId,
          device_id: device.id,
          ts: reading.ts,
          power_w: reading.power_w,
          voltage_v: reading.voltage_v,
          current_a: reading.current_a,
          online: reading.inverter_online,
          generating: reading.plant_generating,
        });

        totalProcessed++;

        // 3. Alert detection
        const alertResult = await detectAlerts(admin, tenantId, plantId, device, reading, reg);
        alertsCreated += alertResult;
      }
    }
  }

  return { processed: totalProcessed, alerts_created: alertsCreated };
}

// ═══ Alert Detector ═══

async function detectAlerts(
  admin: any,
  tenantId: string,
  plantId: string,
  device: any,
  reading: NormalizedReading,
  registry: any,
): Promise<number> {
  let created = 0;

  // Skip alert detection if inverter is offline or plant not generating
  if (!reading.inverter_online || !reading.plant_generating) {
    return 0;
  }

  const power = reading.power_w ?? 0;
  const baseline = registry.baseline_power_p50_w;

  // ── String/MPPT Stopped ──
  if (power === 0) {
    // Check if there's already an open alert for this registry
    const { data: existingAlert } = await admin
      .from("monitor_string_alerts")
      .select("id")
      .eq("registry_id", registry.id)
      .eq("status", "open")
      .in("alert_type", ["string_stopped", "mppt_stopped"])
      .maybeSingle();

    if (!existingAlert) {
      const alertType = reading.granularity === "mppt" ? "mppt_stopped" : "string_stopped";
      const label = reading.string_number
        ? `MPPT ${reading.mppt_number || "?"} · S${reading.string_number}`
        : `Inversor ${device.serial || device.id}`;

      await admin.from("monitor_string_alerts").insert({
        tenant_id: tenantId,
        plant_id: plantId,
        device_id: device.id,
        registry_id: registry.id,
        alert_type: alertType,
        severity: "critical",
        status: "open",
        detected_at: reading.ts,
        message: `${label} parado (0W) com inversor online e planta gerando`,
        context: {
          inverter_serial: reading.inverter_serial,
          mppt_number: reading.mppt_number,
          string_number: reading.string_number,
          granularity: reading.granularity,
        },
      });
      created++;
    }
  }

  // ── String/MPPT Low Generation vs Baseline ──
  if (baseline && baseline > 0 && power > 0 && power < baseline * 0.3) {
    const { data: existingAlert } = await admin
      .from("monitor_string_alerts")
      .select("id")
      .eq("registry_id", registry.id)
      .eq("status", "open")
      .in("alert_type", ["string_low", "mppt_low"])
      .maybeSingle();

    if (!existingAlert) {
      const alertType = reading.granularity === "mppt" ? "mppt_low" : "string_low";
      const label = reading.string_number
        ? `MPPT ${reading.mppt_number || "?"} · S${reading.string_number}`
        : `Inversor ${device.serial || device.id}`;
      const pct = ((power / baseline) * 100).toFixed(0);

      await admin.from("monitor_string_alerts").insert({
        tenant_id: tenantId,
        plant_id: plantId,
        device_id: device.id,
        registry_id: registry.id,
        alert_type: alertType,
        severity: "warn",
        status: "open",
        detected_at: reading.ts,
        message: `${label} com geração baixa (${pct}% do baseline p50)`,
        context: {
          inverter_serial: reading.inverter_serial,
          mppt_number: reading.mppt_number,
          string_number: reading.string_number,
          current_power_w: power,
          baseline_p50_w: baseline,
          pct: Number(pct),
        },
      });
      created++;
    }
  }

  // ── Auto-resolve: power recovered above 40% baseline ──
  if (baseline && baseline > 0 && power > baseline * 0.4) {
    await admin
      .from("monitor_string_alerts")
      .update({
        status: "resolved",
        resolved_at: reading.ts,
        updated_at: new Date().toISOString(),
      })
      .eq("registry_id", registry.id)
      .eq("status", "open");
  }

  // Also resolve stopped alerts when power > 0
  if (power > 0) {
    await admin
      .from("monitor_string_alerts")
      .update({
        status: "resolved",
        resolved_at: reading.ts,
        updated_at: new Date().toISOString(),
      })
      .eq("registry_id", registry.id)
      .eq("status", "open")
      .in("alert_type", ["string_stopped", "mppt_stopped"]);
  }

  return created;
}

// ═══ Baseline Calculation ═══

async function recalculateBaseline(admin: any, tenantId: string, plantId: string) {
  // Get all registry entries for this plant
  const { data: registries } = await admin
    .from("monitor_string_registry")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("plant_id", plantId)
    .eq("is_active", true);

  if (!registries || registries.length === 0) return { updated: 0 };

  let updated = 0;

  for (const reg of registries) {
    // Get all metrics where plant was generating (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const { data: metrics } = await admin
      .from("monitor_string_metrics")
      .select("power_w")
      .eq("registry_id", reg.id)
      .eq("generating", true)
      .eq("online", true)
      .gt("power_w", 0)
      .gte("ts", sevenDaysAgo)
      .order("power_w", { ascending: true });

    if (!metrics || metrics.length < 5) continue; // Not enough data

    const powers = metrics.map((m: any) => Number(m.power_w)).sort((a: number, b: number) => a - b);
    const p50 = powers[Math.floor(powers.length * 0.5)];
    const avg = powers.reduce((s: number, v: number) => s + v, 0) / powers.length;
    const p90 = powers[Math.floor(powers.length * 0.9)];

    await admin
      .from("monitor_string_registry")
      .update({
        baseline_day: new Date().toISOString().slice(0, 10),
        baseline_power_p50_w: p50,
        baseline_power_avg_w: avg,
        baseline_power_p90_w: p90,
        updated_at: new Date().toISOString(),
      })
      .eq("id", reg.id);

    updated++;
  }

  return { updated };
}

// ═══ Auto-baseline: first valid window ═══

async function autoBaseline(admin: any, tenantId: string, plantId: string) {
  // Only baseline registries that don't have one yet
  const { data: registries } = await admin
    .from("monitor_string_registry")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("plant_id", plantId)
    .eq("is_active", true)
    .is("baseline_day", null);

  if (!registries || registries.length === 0) return;

  // Check if plant has enough generation to establish baseline
  // Plant must have at least 5 generating readings
  for (const reg of registries) {
    const { data: metrics } = await admin
      .from("monitor_string_metrics")
      .select("power_w")
      .eq("registry_id", reg.id)
      .eq("generating", true)
      .eq("online", true)
      .gt("power_w", 50) // Minimum 50W threshold
      .order("power_w", { ascending: true })
      .limit(50);

    if (!metrics || metrics.length < 5) continue;

    const powers = metrics.map((m: any) => Number(m.power_w)).sort((a: number, b: number) => a - b);
    const p50 = powers[Math.floor(powers.length * 0.5)];
    const avg = powers.reduce((s: number, v: number) => s + v, 0) / powers.length;
    const p90 = powers[Math.floor(powers.length * 0.9)];

    // Only set baseline if p50 is meaningful (> 50W)
    if (p50 > 50) {
      await admin
        .from("monitor_string_registry")
        .update({
          baseline_day: new Date().toISOString().slice(0, 10),
          baseline_power_p50_w: p50,
          baseline_power_avg_w: avg,
          baseline_power_p90_w: p90,
          updated_at: new Date().toISOString(),
        })
        .eq("id", reg.id);

      console.log(`[mppt-string-engine] Auto-baseline set for registry ${reg.id}: p50=${p50}W avg=${avg.toFixed(0)}W p90=${p90}W`);
    }
  }
}

// ═══ Main Handler ═══

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { action, tenant_id, plant_ids, plant_id } = body;

    if (!tenant_id && !plant_id) {
      return jsonResponse({ error: "tenant_id or plant_id required" }, 400);
    }

    // Resolve tenant_id from plant_id if needed
    let tenantId = tenant_id;
    if (!tenantId && plant_id) {
      const { data: plant } = await supabaseAdmin
        .from("monitor_plants")
        .select("tenant_id")
        .eq("id", plant_id)
        .maybeSingle();
      tenantId = plant?.tenant_id;
      if (!tenantId) return jsonResponse({ error: "Plant not found" }, 404);
    }

    switch (action) {
      case "process_sync": {
        const result = await processSyncHook(supabaseAdmin, tenantId, plant_ids || []);
        // After processing, try auto-baseline for entries without one
        for (const pid of (plant_ids || [])) {
          await autoBaseline(supabaseAdmin, tenantId, pid);
        }
        return jsonResponse({ success: true, ...result });
      }

      case "recalculate_baseline": {
        if (!plant_id) return jsonResponse({ error: "plant_id required" }, 400);
        const result = await recalculateBaseline(supabaseAdmin, tenantId, plant_id);
        return jsonResponse({ success: true, ...result });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("[mppt-string-engine] Error:", err);
    return jsonResponse({ error: (err as Error).message }, 500);
  }
});
