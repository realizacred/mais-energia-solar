import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// NASA POWER API — free, no key needed
const NASA_POWER_BASE = "https://power.larc.nasa.gov/api/temporal/climatology/point";

// Brazil bounding box (full coverage)
const BRAZIL_BBOX = { latMin: -33.5, latMax: 5.5, lonMin: -74.0, lonMax: -35.0 };

// Max points per invocation to stay within edge function timeout (~150s)
const MAX_POINTS_PER_CHUNK = 150; // Keep small to avoid edge function timeout (~150s)
const CONCURRENT = 8;
const DELAY_MS = 250; // NASA rate limit ~30 req/s — safe margin

interface FetchParams {
  dataset_code: string;
  version_tag: string;
  source_note?: string;
  step_deg?: number;
  lat_min?: number;
  lat_max?: number;
  lon_min?: number;
  lon_max?: number;
  append_to_version?: string;
  resume_from_lat?: number;
  /** Internal: user_id for self-chaining calls */
  _chain_user_id?: string;
}

function ok(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(msg: string, status = 400) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  const authHeader = req.headers.get("Authorization");

  // Support self-chaining: use service role auth with _chain_user_id
  let userId: string;
  const body: FetchParams = await req.json();

  if (body._chain_user_id) {
    // Self-chaining call — validate it comes with service role key
    if (authHeader !== `Bearer ${serviceKey}`) {
      return err("Unauthorized chain call", 401);
    }
    userId = body._chain_user_id;
  } else {
    // Normal user call — validate JWT
    if (!authHeader?.startsWith("Bearer ")) {
      return err("Unauthorized", 401);
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return err("Unauthorized", 401);
    }
    userId = user.id;
  }

  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const { dataset_code, version_tag, source_note, append_to_version, resume_from_lat } = body;
    const step = body.step_deg ?? 0.125;

    if (!dataset_code || !version_tag) {
      return err("Missing dataset_code or version_tag");
    }

    const isResume = !!append_to_version;
    console.log(`[IRRADIANCE_FETCH] ${isResume ? "RESUME" : "START"} dataset=${dataset_code} version=${version_tag} step=${step}° by=${userId}`);

    // 1. Resolve dataset
    const { data: dataset, error: dsError } = await admin
      .from("irradiance_datasets")
      .select("id")
      .eq("code", dataset_code)
      .single();

    if (dsError || !dataset) {
      return err(`Dataset '${dataset_code}' not found`, 404);
    }

    // 2. Create or reuse version
    let versionId: string;

    if (isResume) {
      const { data: existingVersion } = await admin
        .from("irradiance_dataset_versions")
        .select("id, status")
        .eq("id", append_to_version)
        .single();

      if (!existingVersion || existingVersion.status !== "processing") {
        console.log(`[IRRADIANCE_FETCH] Version ${append_to_version} is ${existingVersion?.status ?? 'missing'} — stopping chain.`);
        return ok({ success: false, error: "ABORTED", message: "Versão não está mais em processamento (cancelada ou falhou)." });
      }
      versionId = existingVersion.id;
    } else {
      // Check if version_tag already exists for this dataset
      const { data: existing } = await admin
        .from("irradiance_dataset_versions")
        .select("id, status, row_count")
        .eq("dataset_id", dataset.id)
        .eq("version_tag", version_tag)
        .maybeSingle();

      if (existing) {
        if (existing.status === "active") {
          return ok({
            success: false,
            error: "VERSION_EXISTS",
            message: `Versão '${version_tag}' já existe com ${existing.row_count} pontos (status: active). Use outra version_tag ou delete a existente.`,
            version_id: existing.id,
          });
        }
        if (existing.status === "processing") {
          return ok({
            success: false,
            error: "VERSION_PROCESSING",
            message: `Versão '${version_tag}' já está em processamento. Aguarde a conclusão.`,
            version_id: existing.id,
          });
        }
        // If failed/deprecated, delete old and re-create
        await admin.from("irradiance_points_monthly").delete().eq("version_id", existing.id);
        await admin.from("irradiance_dataset_versions").delete().eq("id", existing.id);
        console.log(`[IRRADIANCE_FETCH] Cleaned old ${existing.status} version ${existing.id}`);
      }

      const { data: version, error: verError } = await admin
        .from("irradiance_dataset_versions")
        .insert({
          dataset_id: dataset.id,
          version_tag,
          source_note: source_note || `Auto-fetch from NASA POWER API (step=${step}°)`,
          status: "processing",
          metadata: { imported_by: userId, source: "NASA_POWER_API", step_deg: step },
        })
        .select("id")
        .single();

      if (verError) throw verError;
      versionId = version.id;
    }

    // 3. Generate grid points for THIS chunk
    const latMin = body.lat_min ?? BRAZIL_BBOX.latMin;
    const latMax = body.lat_max ?? BRAZIL_BBOX.latMax;
    const lonMin = body.lon_min ?? BRAZIL_BBOX.lonMin;
    const lonMax = body.lon_max ?? BRAZIL_BBOX.lonMax;

    const allLats: number[] = [];
    for (let lat = latMin; lat <= latMax; lat += step) {
      allLats.push(Math.round(lat * 1000) / 1000);
    }
    const lonSteps = Math.floor((lonMax - lonMin) / step) + 1;
    const totalGridPoints = allLats.length * lonSteps;

    const startFromLat = resume_from_lat != null ? resume_from_lat + step : latMin;
    const chunkLats = allLats.filter(lat => lat >= Math.round(startFromLat * 1000) / 1000);

    const maxLatRows = Math.ceil(MAX_POINTS_PER_CHUNK / lonSteps);
    const thisChunkLats = chunkLats.slice(0, maxLatRows);
    const hasMore = chunkLats.length > maxLatRows;

    const points: Array<{ lat: number; lon: number }> = [];
    for (const lat of thisChunkLats) {
      for (let lon = lonMin; lon <= lonMax; lon += step) {
        points.push({ lat, lon: Math.round(lon * 1000) / 1000 });
      }
    }

    if (points.length === 0) {
      console.log(`[IRRADIANCE_FETCH] No points to process`);
      return ok({ success: true, version_id: versionId, chunk_rows: 0, needs_continuation: false });
    }

    const lastLatInChunk = thisChunkLats[thisChunkLats.length - 1];
    console.log(`[IRRADIANCE_FETCH] Chunk: ${points.length} points, lats ${thisChunkLats[0]} to ${lastLatInChunk} (${hasMore ? "more pending" : "final"})`);

    // 4. Fetch from NASA POWER API
    const BATCH_SIZE = 500;
    let batch: any[] = [];
    let rowCount = 0;
    let errors = 0;

    for (let i = 0; i < points.length; i += CONCURRENT) {
      const chunk = points.slice(i, i + CONCURRENT);

      const results = await Promise.allSettled(
        chunk.map(async (pt) => {
          try {
            const url = `${NASA_POWER_BASE}?parameters=ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DIFF&community=RE&longitude=${pt.lon}&latitude=${pt.lat}&format=JSON`;
            const resp = await fetch(url);
            if (!resp.ok) return null;
            const data = await resp.json();
            const ghiMonthly = data?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
            const dhiMonthly = data?.properties?.parameter?.ALLSKY_SFC_SW_DIFF;
            if (!ghiMonthly) return null;

            const months: Record<string, number> = {};
            const dhiMonths: Record<string, number> = {};
            const monthKeys = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];
            for (let m = 0; m < 12; m++) {
              const mKey = `m${String(m + 1).padStart(2, "0")}`;
              const ghiVal = ghiMonthly[monthKeys[m]];
              months[mKey] = typeof ghiVal === "number" && ghiVal > 0 ? Math.round(ghiVal * 10000) / 10000 : 0;
              const dhiVal = dhiMonthly?.[monthKeys[m]];
              dhiMonths[`dhi_${mKey}`] = typeof dhiVal === "number" && dhiVal > 0 ? Math.round(dhiVal * 10000) / 10000 : 0;
            }

            return {
              version_id: versionId,
              lat: pt.lat,
              lon: pt.lon,
              ...months,
              ...dhiMonths,
              unit: "kwh_m2_day",
            };
          } catch {
            return null;
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          batch.push(r.value);
          rowCount++;
          if (batch.length >= BATCH_SIZE) {
            const { error: insertError } = await admin.from("irradiance_points_monthly").insert(batch);
            if (insertError) errors++;
            batch = [];
          }
        } else {
          errors++;
        }
      }

      await new Promise((r) => setTimeout(r, DELAY_MS));
    }

    // Final batch
    if (batch.length > 0) {
      const { error: insertError } = await admin.from("irradiance_points_monthly").insert(batch);
      if (insertError) errors++;
    }

    // 5. Update version metadata
    const { data: currentVersion } = await admin
      .from("irradiance_dataset_versions")
      .select("row_count, metadata")
      .eq("id", versionId)
      .single();

    const totalRowsSoFar = (currentVersion?.row_count ?? 0) + rowCount;
    const existingMeta = (currentVersion?.metadata as Record<string, unknown>) ?? {};

    if (!hasMore) {
      // FINAL CHUNK — finalize version
      const encoder = new TextEncoder();
      const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(`${versionId}:${totalRowsSoFar}:${new Date().toISOString()}`));
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const checksum = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

      // IMPORTANT: Do NOT auto-activate. Leave as "processing" so admin
      // activates via the canonical RPC `activate_irradiance_version`.
      // This ensures transactional activation + audit trail.
      await admin
        .from("irradiance_dataset_versions")
        .update({
          status: totalRowsSoFar > 0 ? "processing" : "failed",
          row_count: totalRowsSoFar,
          checksum_sha256: checksum,
          metadata: {
            ...existingMeta,
            imported_by: userId,
            source: "NASA_POWER_API",
            step_deg: step,
            grid_bounds: { latMin, latMax, lonMin, lonMax },
            total_points_attempted: totalGridPoints,
            total_errors: (existingMeta.total_errors as number ?? 0) + errors,
            completed_at: new Date().toISOString(),
            ready_for_activation: true,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", versionId);

      console.log(`[IRRADIANCE_FETCH] DONE — ${totalRowsSoFar} total rows`);
    } else {
      // Update progress
      await admin
        .from("irradiance_dataset_versions")
        .update({
          row_count: totalRowsSoFar,
          metadata: {
            ...existingMeta,
            imported_by: userId,
            source: "NASA_POWER_API",
            step_deg: step,
            last_lat_processed: lastLatInChunk,
            total_errors: (existingMeta.total_errors as number ?? 0) + errors,
          },
          updated_at: new Date().toISOString(),
        })
        .eq("id", versionId);

      console.log(`[IRRADIANCE_FETCH] CHUNK DONE — ${totalRowsSoFar} rows so far. Self-chaining next chunk…`);

      // ── SELF-CHAIN: fire-and-forget call to continue processing ──
      const nextBody: FetchParams = {
        dataset_code,
        version_tag,
        step_deg: step,
        lat_min: latMin,
        lat_max: latMax,
        lon_min: lonMin,
        lon_max: lonMax,
        append_to_version: versionId,
        resume_from_lat: lastLatInChunk,
        _chain_user_id: userId,
      };

      // MUST await the chain call — fire-and-forget causes the function to
      // shut down before the HTTP request is sent, breaking the chain.
      try {
        const chainResp = await fetch(`${supabaseUrl}/functions/v1/irradiance-fetch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify(nextBody),
        });
        console.log(`[IRRADIANCE_FETCH] Self-chain triggered, status=${chainResp.status}`);
      } catch (e: any) {
        console.error(`[IRRADIANCE_FETCH] Self-chain failed:`, e.message);
        // Mark version as failed so user can retry
        await admin.from("irradiance_dataset_versions")
          .update({ status: "failed", metadata: { ...existingMeta, error: `Chain failed: ${e.message}` } })
          .eq("id", versionId);
      }
    }

    return ok({
      success: true,
      version_id: versionId,
      chunk_rows: rowCount,
      total_rows: totalRowsSoFar,
      needs_continuation: hasMore,
      resume_from_lat: hasMore ? lastLatInChunk : undefined,
      grid_total_points: totalGridPoints,
    });
  } catch (error: any) {
    console.error("[IRRADIANCE_FETCH] FAILED:", error.message);
    return err(error.message, 500);
  }
});
