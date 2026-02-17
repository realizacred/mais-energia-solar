import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
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

  // Auth check
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
    global: { headers: { Authorization: authHeader } },
  });

  const { data: { user }, error: userError } = await userClient.auth.getUser();
  if (userError || !user) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  const userId = user.id;
  const admin = createClient(supabaseUrl, serviceKey);

  try {
    const body = await req.json();
    const action = body.action || "full"; // backwards compat

    // ────────────────────────────────────────────
    // ACTION: init — create version record, return version_id
    // ────────────────────────────────────────────
    if (action === "init") {
      const { dataset_code, version_tag, source_note, file_names } = body;
      if (!dataset_code || !version_tag) {
        return jsonResponse({ error: "Missing dataset_code or version_tag" }, 400);
      }

      console.log(`[IRRADIANCE_IMPORT] INIT — dataset=${dataset_code} version=${version_tag} by=${userId}`);

      const { data: dataset, error: dsError } = await admin
        .from("irradiance_datasets")
        .select("id")
        .eq("code", dataset_code)
        .single();

      if (dsError || !dataset) {
        return jsonResponse({ error: `Dataset '${dataset_code}' not found` }, 404);
      }

      // Clean up any previous failed/deprecated versions for idempotency
      const { data: existing } = await admin
        .from("irradiance_dataset_versions")
        .select("id, status")
        .eq("dataset_id", dataset.id)
        .eq("version_tag", version_tag);

      if (existing && existing.length > 0) {
        const active = existing.find((v) => v.status === "active");
        if (active) {
          return jsonResponse({ error: "VERSION_EXISTS", message: `Versão ${version_tag} já existe e está ativa.` });
        }
        const processing = existing.find((v) => v.status === "processing");
        if (processing) {
          return jsonResponse({ error: "VERSION_PROCESSING", message: `Versão ${version_tag} está sendo processada.` });
        }
        // Remove failed ones
        for (const v of existing.filter((v) => v.status === "failed")) {
          await admin.from("irradiance_points_monthly").delete().eq("version_id", v.id);
          await admin.from("irradiance_dataset_versions").delete().eq("id", v.id);
        }
      }

      const { data: version, error: verError } = await admin
        .from("irradiance_dataset_versions")
        .insert({
          dataset_id: dataset.id,
          version_tag,
          source_note: source_note || null,
          status: "processing",
          metadata: { imported_by: userId, file_names: file_names || [] },
        })
        .select("id")
        .single();

      if (verError) throw verError;

      return jsonResponse({ success: true, version_id: version.id, dataset_id: dataset.id });
    }

    // ────────────────────────────────────────────
    // ACTION: batch — insert a batch of rows
    // ────────────────────────────────────────────
    if (action === "batch") {
      const { version_id, rows } = body;
      if (!version_id || !Array.isArray(rows) || rows.length === 0) {
        return jsonResponse({ error: "Missing version_id or rows" }, 400);
      }

      // Validate version exists and is processing
      const { data: ver } = await admin
        .from("irradiance_dataset_versions")
        .select("id, status")
        .eq("id", version_id)
        .single();

      if (!ver || ver.status !== "processing") {
        return jsonResponse({ error: "Version not found or not in processing state" }, 400);
      }

      // Insert batch
      const { error: insertError } = await admin
        .from("irradiance_points_monthly")
        .insert(rows);

      if (insertError) {
        console.error(`[IRRADIANCE_IMPORT] Batch insert error:`, insertError.message);
        return jsonResponse({ error: insertError.message }, 500);
      }

      return jsonResponse({ success: true, inserted: rows.length });
    }

    // ────────────────────────────────────────────
    // ACTION: finalize — compute checksum, activate version
    // ────────────────────────────────────────────
    if (action === "finalize") {
      const { version_id, dataset_id, row_count, checksum, has_dhi, has_dni } = body;
      if (!version_id || !dataset_id) {
        return jsonResponse({ error: "Missing version_id or dataset_id" }, 400);
      }

      console.log(`[IRRADIANCE_IMPORT] FINALIZE — version=${version_id} rows=${row_count}`);

      // Update version to active
      await admin.from("irradiance_dataset_versions")
        .update({
          status: "active",
          row_count: row_count || 0,
          checksum_sha256: checksum || null,
          metadata: { imported_by: userId, row_count, has_dhi, has_dni, finalized_at: new Date().toISOString() },
          updated_at: new Date().toISOString(),
        })
        .eq("id", version_id);

      // Deprecate previous active versions
      await admin.from("irradiance_dataset_versions")
        .update({ status: "deprecated", updated_at: new Date().toISOString() })
        .eq("dataset_id", dataset_id)
        .eq("status", "active")
        .neq("id", version_id);

      // Clear old cache
      const { data: oldVersions } = await admin
        .from("irradiance_dataset_versions")
        .select("id")
        .eq("dataset_id", dataset_id)
        .neq("id", version_id);

      if (oldVersions && oldVersions.length > 0) {
        for (const ov of oldVersions) {
          await admin.from("irradiance_lookup_cache").delete().eq("version_id", ov.id);
        }
      }

      console.log(`[IRRADIANCE_IMPORT] DONE — ${row_count} rows activated`);

      return jsonResponse({ success: true, version_id, row_count });
    }

    // ────────────────────────────────────────────
    // ACTION: abort — mark version as failed
    // ────────────────────────────────────────────
    if (action === "abort") {
      const { version_id, error: errorMsg } = body;
      if (!version_id) return jsonResponse({ error: "Missing version_id" }, 400);

      await admin.from("irradiance_dataset_versions")
        .update({ status: "failed", metadata: { error: errorMsg || "Aborted by user" } })
        .eq("id", version_id);

      // Clean up any partial data
      await admin.from("irradiance_points_monthly").delete().eq("version_id", version_id);

      return jsonResponse({ success: true });
    }

    // ────────────────────────────────────────────
    // ACTION: delete_version — remove a specific version by tag (for replace flow)
    // ────────────────────────────────────────────
    if (action === "delete_version") {
      const { dataset_code, version_tag } = body;
      if (!dataset_code || !version_tag) {
        return jsonResponse({ error: "Missing dataset_code or version_tag" }, 400);
      }

      console.log(`[IRRADIANCE_IMPORT] DELETE_VERSION — dataset=${dataset_code} tag=${version_tag}`);

      const { data: dataset } = await admin
        .from("irradiance_datasets")
        .select("id")
        .eq("code", dataset_code)
        .single();

      if (!dataset) return jsonResponse({ error: "Dataset not found" }, 404);

      const { data: versions } = await admin
        .from("irradiance_dataset_versions")
        .select("id")
        .eq("dataset_id", dataset.id)
        .eq("version_tag", version_tag);

      if (versions && versions.length > 0) {
        for (const v of versions) {
          await admin.from("irradiance_lookup_cache").delete().eq("version_id", v.id);
          await admin.from("irradiance_points_monthly").delete().eq("version_id", v.id);
          await admin.from("irradiance_dataset_versions").delete().eq("id", v.id);
        }
        console.log(`[IRRADIANCE_IMPORT] Deleted ${versions.length} version(s) for tag=${version_tag}`);
      }

      return jsonResponse({ success: true, deleted: versions?.length || 0 });
    }

    return jsonResponse({ error: `Unknown action: ${action}` }, 400);

  } catch (error: any) {
    console.error("[IRRADIANCE_IMPORT] FAILED:", error.message);
    return jsonResponse({ error: error.message }, 500);
  }
});
