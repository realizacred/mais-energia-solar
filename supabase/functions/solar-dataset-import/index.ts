import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function err(message: string, status = 400) {
  return json({ error: message }, status);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return err("Missing authorization header", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Validate calling user
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return err("Unauthorized", 401);

    // Resolve tenant
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) return err("Tenant not found", 403);
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const action = body.action ?? "import";

    // ─── STATUS ──────────────────────────────────────────────
    if (action === "status") {
      const jobId = body.job_id;
      if (!jobId) return err("job_id is required");

      const { data: job, error: jobErr } = await adminClient
        .from("solar_import_jobs")
        .select("*")
        .eq("id", jobId)
        .eq("tenant_id", tenantId)
        .single();

      if (jobErr || !job) return err("Job not found", 404);
      return json({
        job_id: job.id,
        dataset_key: job.dataset_key,
        status: job.status,
        started_at: job.started_at,
        finished_at: job.finished_at,
        error_message: job.error_message,
        row_count: job.row_count,
        created_at: job.created_at,
      });
    }

    // ─── LOGS ────────────────────────────────────────────────
    if (action === "logs") {
      const jobId = body.job_id;
      if (!jobId) return err("job_id is required");

      // Verify job belongs to tenant
      const { data: job } = await adminClient
        .from("solar_import_jobs")
        .select("id")
        .eq("id", jobId)
        .eq("tenant_id", tenantId)
        .single();

      if (!job) return err("Job not found", 404);

      const { data: logs } = await adminClient
        .from("solar_import_job_logs")
        .select("id, job_id, level, message, created_at")
        .eq("job_id", jobId)
        .order("created_at", { ascending: true })
        .limit(200);

      return json(
        (logs ?? []).map((l: any) => ({
          id: l.id,
          job_id: l.job_id,
          level: l.level,
          message: l.message,
          timestamp: l.created_at,
        }))
      );
    }

    // ─── IMPORT (create job) ─────────────────────────────────
    const datasetKey = body.dataset_key;
    const idempotencyKey = body.idempotency_key;

    if (!datasetKey) return err("dataset_key is required");

    // Idempotency: check if a job with same key already exists
    if (idempotencyKey) {
      const { data: existing } = await adminClient
        .from("solar_import_jobs")
        .select("id, status, dataset_key, started_at, finished_at, error_message, row_count, created_at")
        .eq("idempotency_key", idempotencyKey)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (existing) {
        return json({
          job_id: existing.id,
          dataset_key: existing.dataset_key,
          status: existing.status,
          started_at: existing.started_at,
          finished_at: existing.finished_at,
          error_message: existing.error_message,
          row_count: existing.row_count,
          created_at: existing.created_at,
        });
      }
    }

    // Create the import job record (actual import logic runs async/cron)
    const { data: newJob, error: insertErr } = await adminClient
      .from("solar_import_jobs")
      .insert({
        tenant_id: tenantId,
        dataset_key: datasetKey,
        idempotency_key: idempotencyKey ?? null,
        status: "queued",
        created_by: user.id,
      })
      .select()
      .single();

    if (insertErr) {
      console.error("Failed to create import job:", insertErr);
      return err("Failed to create import job: " + insertErr.message, 500);
    }

    // Log the job creation
    await adminClient.from("solar_import_job_logs").insert({
      job_id: newJob.id,
      tenant_id: tenantId,
      level: "info",
      message: `Import job queued for dataset "${datasetKey}" by user ${user.email ?? user.id}`,
    });

    return json({
      job_id: newJob.id,
      dataset_key: newJob.dataset_key,
      status: newJob.status,
      started_at: newJob.started_at,
      finished_at: newJob.finished_at,
      error_message: newJob.error_message,
      row_count: newJob.row_count,
      created_at: newJob.created_at,
    });
  } catch (e) {
    console.error("solar-dataset-import error:", e);
    return err("Internal server error", 500);
  }
});
