import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

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
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const userId = user.id;

  // Use service role for writes to global tables (no tenant RLS)
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const { dataset_code, version_tag, source_note, file_path } = body;

    if (!dataset_code || !version_tag || !file_path) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[IRRADIANCE_IMPORT] START — dataset=${dataset_code} version=${version_tag} by=${userId}`);

    // 1. Resolve dataset
    const { data: dataset, error: dsError } = await admin
      .from("irradiance_datasets")
      .select("id")
      .eq("code", dataset_code)
      .single();

    if (dsError || !dataset) {
      return new Response(JSON.stringify({ error: `Dataset '${dataset_code}' not found` }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Create version record (processing)
    const { data: version, error: verError } = await admin
      .from("irradiance_dataset_versions")
      .insert({
        dataset_id: dataset.id,
        version_tag,
        source_note: source_note || null,
        status: "processing",
        metadata: { imported_by: userId, file_path },
      })
      .select("id")
      .single();

    if (verError) throw verError;
    const versionId = version.id;

    // 3. Download CSV from storage
    const { data: fileData, error: dlError } = await admin.storage
      .from("irradiance-source")
      .download(file_path);

    if (dlError || !fileData) {
      await admin.from("irradiance_dataset_versions")
        .update({ status: "failed", metadata: { error: "File download failed" } })
        .eq("id", versionId);
      throw new Error("Failed to download file from storage");
    }

    const csvText = await fileData.text();
    const lines = csvText.split("\n").filter((l) => l.trim());

    // 4. Parse CSV (auto-detect separator)
    const separator = lines[0].includes(";") ? ";" : ",";
    const header = lines[0].split(separator).map((h) => h.trim().toLowerCase());

    // Detect column indexes
    const latIdx = header.findIndex((h) => h === "lat" || h === "latitude");
    const lonIdx = header.findIndex((h) => h === "lon" || h === "lng" || h === "longitude");
    const monthCols: number[] = [];
    for (let m = 1; m <= 12; m++) {
      const mKey = `m${String(m).padStart(2, "0")}`;
      const altKeys = [mKey, `jan,fev,mar,abr,mai,jun,jul,ago,set,out,nov,dez`.split(",")[m - 1]];
      const idx = header.findIndex((h) => altKeys.includes(h));
      monthCols.push(idx >= 0 ? idx : -1);
    }

    if (latIdx < 0 || lonIdx < 0) {
      await admin.from("irradiance_dataset_versions")
        .update({ status: "failed", metadata: { error: "Missing lat/lon columns", header } })
        .eq("id", versionId);
      throw new Error("CSV must have lat and lon columns");
    }

    // 5. Parse rows and batch insert
    const BATCH_SIZE = 500;
    let rowCount = 0;
    let batch: any[] = [];
    const hashParts: string[] = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(separator).map((c) => c.trim());
      if (cols.length < 2) continue;

      const lat = parseFloat(cols[latIdx].replace(",", "."));
      const lon = parseFloat(cols[lonIdx].replace(",", "."));
      if (isNaN(lat) || isNaN(lon)) continue;

      const months: Record<string, number> = {};
      for (let m = 0; m < 12; m++) {
        const mKey = `m${String(m + 1).padStart(2, "0")}`;
        const val = monthCols[m] >= 0 ? parseFloat(cols[monthCols[m]].replace(",", ".")) : 0;
        months[mKey] = isNaN(val) ? 0 : val;
      }

      batch.push({
        version_id: versionId,
        lat, lon,
        ...months,
        unit: "kwh_m2_day",
      });

      hashParts.push(`${lat}:${lon}:${Object.values(months).join(":")}`);
      rowCount++;

      if (batch.length >= BATCH_SIZE) {
        const { error: insertError } = await admin
          .from("irradiance_points_monthly")
          .insert(batch);
        if (insertError) {
          console.error(`[IRRADIANCE_IMPORT] Batch insert error at row ${rowCount}:`, insertError);
        }
        batch = [];
      }
    }

    // Final batch
    if (batch.length > 0) {
      await admin.from("irradiance_points_monthly").insert(batch);
    }

    // 6. Compute checksum (simple hash of concatenated data)
    const encoder = new TextEncoder();
    const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(hashParts.join("|")));
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const checksum = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

    // 7. Update version
    await admin.from("irradiance_dataset_versions")
      .update({
        status: "active",
        row_count: rowCount,
        checksum_sha256: checksum,
        metadata: { imported_by: userId, file_path, header, separator, parsed_rows: lines.length - 1 },
        updated_at: new Date().toISOString(),
      })
      .eq("id", versionId);

    // 8. Deprecate previous active versions
    await admin.from("irradiance_dataset_versions")
      .update({ status: "deprecated", updated_at: new Date().toISOString() })
      .eq("dataset_id", dataset.id)
      .eq("status", "active")
      .neq("id", versionId);

    // 9. Clear cache for this dataset (new data invalidates old lookups)
    const { data: oldVersions } = await admin
      .from("irradiance_dataset_versions")
      .select("id")
      .eq("dataset_id", dataset.id)
      .neq("id", versionId);

    if (oldVersions && oldVersions.length > 0) {
      for (const ov of oldVersions) {
        await admin.from("irradiance_lookup_cache").delete().eq("version_id", ov.id);
      }
    }

    // 10. Audit log
    await admin.from("audit_logs").insert({
      acao: "IRRADIANCE_IMPORT_FINISHED",
      tabela: "irradiance_dataset_versions",
      registro_id: versionId,
      dados_novos: { dataset_code, version_tag, row_count: rowCount, checksum },
      user_id: userId,
    });

    console.log(`[IRRADIANCE_IMPORT] DONE — ${rowCount} rows, checksum=${checksum.substring(0, 16)}`);

    return new Response(JSON.stringify({
      success: true,
      version_id: versionId,
      row_count: rowCount,
      checksum,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: any) {
    console.error("[IRRADIANCE_IMPORT] FAILED:", error.message);

    // Audit failure
    await admin.from("audit_logs").insert({
      acao: "IRRADIANCE_IMPORT_FAILED",
      tabela: "irradiance_dataset_versions",
      dados_novos: { error: error.message },
      user_id: userId,
    }).catch(() => {});

    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
