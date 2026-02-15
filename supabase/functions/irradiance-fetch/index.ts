import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// NASA POWER API — free, no key needed
const NASA_POWER_BASE = "https://power.larc.nasa.gov/api/temporal/climatology/point";

// Brazil bounding box
const BRAZIL_BBOX = { latMin: -33.5, latMax: 5.0, lonMin: -74.0, lonMax: -35.0 };

interface FetchParams {
  dataset_code: string;
  version_tag: string;
  source_note?: string;
  /** Grid step in degrees (default 0.5 ≈ ~55km) */
  step_deg?: number;
  /** Optional sub-region */
  lat_min?: number;
  lat_max?: number;
  lon_min?: number;
  lon_max?: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body: FetchParams = await req.json();
    const { dataset_code, version_tag, source_note } = body;
    const step = body.step_deg ?? 0.5;

    if (!dataset_code || !version_tag) {
      return new Response(JSON.stringify({ error: "Missing dataset_code or version_tag" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[IRRADIANCE_FETCH] START dataset=${dataset_code} version=${version_tag} step=${step}° by=${userId}`);

    // 1. Resolve dataset
    const { data: dataset, error: dsError } = await admin
      .from("irradiance_datasets")
      .select("id")
      .eq("code", dataset_code)
      .single();

    if (dsError || !dataset) {
      return new Response(JSON.stringify({ error: `Dataset '${dataset_code}' not found` }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create version (processing)
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
    const versionId = version.id;

    // 3. Generate grid points
    const latMin = body.lat_min ?? BRAZIL_BBOX.latMin;
    const latMax = body.lat_max ?? BRAZIL_BBOX.latMax;
    const lonMin = body.lon_min ?? BRAZIL_BBOX.lonMin;
    const lonMax = body.lon_max ?? BRAZIL_BBOX.lonMax;

    const points: Array<{ lat: number; lon: number }> = [];
    for (let lat = latMin; lat <= latMax; lat += step) {
      for (let lon = lonMin; lon <= lonMax; lon += step) {
        points.push({
          lat: Math.round(lat * 1000) / 1000,
          lon: Math.round(lon * 1000) / 1000,
        });
      }
    }

    console.log(`[IRRADIANCE_FETCH] Grid: ${points.length} points (${latMin},${lonMin} to ${latMax},${lonMax} step=${step})`);

    // 4. Fetch from NASA POWER API in batches
    const BATCH_SIZE = 500;
    let batch: any[] = [];
    let rowCount = 0;
    let errors = 0;
    const hashParts: string[] = [];

    // Process points with concurrency control
    const CONCURRENT = 10;
    for (let i = 0; i < points.length; i += CONCURRENT) {
      const chunk = points.slice(i, i + CONCURRENT);

      const results = await Promise.allSettled(
        chunk.map(async (pt) => {
          try {
            // Fetch GHI + DHI from NASA POWER in a single call
            const url = `${NASA_POWER_BASE}?parameters=ALLSKY_SFC_SW_DWN,ALLSKY_SFC_SW_DIFF&community=RE&longitude=${pt.lon}&latitude=${pt.lat}&format=JSON`;
            const resp = await fetch(url);
            if (!resp.ok) {
              console.warn(`[IRRADIANCE_FETCH] NASA API error for (${pt.lat},${pt.lon}): ${resp.status}`);
              return null;
            }
            const data = await resp.json();
            const ghiMonthly = data?.properties?.parameter?.ALLSKY_SFC_SW_DWN;
            const dhiMonthly = data?.properties?.parameter?.ALLSKY_SFC_SW_DIFF;
            if (!ghiMonthly) return null;

            // NASA POWER returns kWh/m²/day already
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
          } catch (e) {
            return null;
          }
        })
      );

      for (const r of results) {
        if (r.status === "fulfilled" && r.value) {
          const row = r.value;
          batch.push(row);
          const vals = Object.entries(row)
            .filter(([k]) => k.startsWith("m"))
            .map(([, v]) => v)
            .join(":");
          hashParts.push(`${row.lat}:${row.lon}:${vals}`);
          rowCount++;

          if (batch.length >= BATCH_SIZE) {
            const { error: insertError } = await admin
              .from("irradiance_points_monthly")
              .insert(batch);
            if (insertError) {
              console.error(`[IRRADIANCE_FETCH] Batch insert error at ${rowCount}:`, insertError);
              errors++;
            }
            batch = [];
          }
        } else {
          errors++;
        }
      }

      // Log progress every 100 points
      if ((i + CONCURRENT) % 100 === 0 || i + CONCURRENT >= points.length) {
        console.log(`[IRRADIANCE_FETCH] Progress: ${Math.min(i + CONCURRENT, points.length)}/${points.length} (${rowCount} ok, ${errors} err)`);
      }

      // Rate limit: NASA allows ~30 req/sec, we do 10 concurrent with small delay
      await new Promise((r) => setTimeout(r, 400));
    }

    // Final batch
    if (batch.length > 0) {
      await admin.from("irradiance_points_monthly").insert(batch);
    }

    // 5. Checksum
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashParts.join("|")));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // 6. Finalize version
    await admin
      .from("irradiance_dataset_versions")
      .update({
        status: rowCount > 0 ? "active" : "failed",
        row_count: rowCount,
        checksum_sha256: checksum,
        metadata: {
          imported_by: userId,
          source: "NASA_POWER_API",
          step_deg: step,
          grid_bounds: { latMin, latMax, lonMin, lonMax },
          total_points_attempted: points.length,
          errors,
        },
        updated_at: new Date().toISOString(),
      })
      .eq("id", versionId);

    // 7. Deprecate old active versions
    if (rowCount > 0) {
      await admin
        .from("irradiance_dataset_versions")
        .update({ status: "deprecated", updated_at: new Date().toISOString() })
        .eq("dataset_id", dataset.id)
        .eq("status", "active")
        .neq("id", versionId);

      // Clear old cache
      const { data: oldVersions } = await admin
        .from("irradiance_dataset_versions")
        .select("id")
        .eq("dataset_id", dataset.id)
        .neq("id", versionId);

      if (oldVersions?.length) {
        for (const ov of oldVersions) {
          await admin.from("irradiance_lookup_cache").delete().eq("version_id", ov.id);
        }
      }
    }

    // 8. Audit log
    await admin.from("audit_logs").insert({
      acao: "IRRADIANCE_FETCH_FINISHED",
      tabela: "irradiance_dataset_versions",
      registro_id: versionId,
      dados_novos: { dataset_code, version_tag, row_count: rowCount, errors, checksum, source: "NASA_POWER_API" },
      user_id: userId,
    });

    console.log(`[IRRADIANCE_FETCH] DONE — ${rowCount} rows, ${errors} errors, checksum=${checksum.substring(0, 16)}`);

    return new Response(
      JSON.stringify({
        success: true,
        version_id: versionId,
        row_count: rowCount,
        errors,
        checksum,
        grid_points_total: points.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[IRRADIANCE_FETCH] FAILED:", error.message);

    await admin
      .from("audit_logs")
      .insert({
        acao: "IRRADIANCE_FETCH_FAILED",
        tabela: "irradiance_dataset_versions",
        dados_novos: { error: error.message },
        user_id: userId,
      })
      .catch(() => {});

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
