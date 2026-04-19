/**
 * migration-status — Retorna progresso, contadores e erros recentes de um job.
 *
 * Body: { job_id: string }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!SUPABASE_URL || !SERVICE_ROLE) {
      return json({ error: "Server configuration error" }, 500);
    }

    const auth = req.headers.get("Authorization") ?? "";
    if (!auth.startsWith("Bearer ")) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: userData, error: userErr } = await admin.auth.getUser(
      auth.replace("Bearer ", ""),
    );
    if (userErr || !userData?.user) return json({ error: "Invalid token" }, 401);

    const body = await req.json().catch(() => ({}));
    const job_id = String(body?.job_id ?? "");
    if (!job_id) return json({ error: "job_id required" }, 400);

    let { data: job, error } = await admin
      .from("migration_jobs")
      .select("*")
      .eq("id", job_id)
      .single();
    if (error || !job) return json({ error: "Job not found" }, 404);

    const currentStage = resolveCurrentStage(job);

    // Contadores
    const counters: Record<string, number> = {
      pending: 0,
      processing: 0,
      migrated: 0,
      skipped: 0,
      failed: 0,
    };
    const { data: rows } = await admin
      .from("migration_records")
      .select("status")
      .eq("job_id", job_id);
    for (const r of rows ?? []) {
      const s = (r as any).status as string;
      if (counters[s] !== undefined) counters[s]++;
    }
    const processed = counters.pending + counters.processing + counters.migrated + counters.skipped + counters.failed;
    const done = counters.migrated + counters.skipped + counters.failed;
    const expectedTotal = await resolveExpectedTotal(admin, job.tenant_id as string, currentStage);
    const total = expectedTotal > 0 ? expectedTotal : processed;
    const progress = total > 0 ? Math.min(100, Math.round((done / total) * 100)) : 0;

    // Erros recentes
    const { data: errors } = await admin
      .from("migration_records")
      .select("entity_type, sm_entity_id, error_message, validation_errors")
      .eq("job_id", job_id)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(20);

    // Pulados recentes (com motivo) — para a UI mostrar por que foi skipped
    const { data: skipped } = await admin
      .from("migration_records")
      .select("entity_type, sm_entity_id, error_message, native_entity_id")
      .eq("job_id", job_id)
      .eq("status", "skipped")
      .order("created_at", { ascending: false })
      .limit(200);

    // Stalled detection: running sem heartbeat há > 2 min
    const STALL_MS = 2 * 60 * 1000;
    const hb = (job as any)?.metadata?.last_heartbeat_at as string | undefined;
    const lastBeat = hb ?? (job as any)?.started_at ?? null;
    const isStalled = job.status === "running" && lastBeat
      ? Date.now() - new Date(lastBeat).getTime() > STALL_MS
      : false;

    return json(
      {
        job,
        current_stage: currentStage,
        counters,
        processed,
        total,
        progress,
        errors: errors ?? [],
        skipped: skipped ?? [],
        is_stalled: isStalled,
        last_heartbeat_at: lastBeat,
      },
      200,
    );
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function resolveCurrentStage(job: any): "classify_projects" | "migrate_clients" | "migrate_projects" | "migrate_proposals" {
  if (job?.job_type === "full_migration") {
    const stage = job?.metadata?.progress?.stage;
    if (stage === "migrate_clients" || stage === "migrate_projects" || stage === "migrate_proposals") {
      return stage;
    }
    return "classify_projects";
  }

  if (job?.job_type === "migrate_clients" || job?.job_type === "migrate_projects" || job?.job_type === "migrate_proposals") {
    return job.job_type;
  }

  return "classify_projects";
}

async function resolveExpectedTotal(admin: ReturnType<typeof createClient>, tenantId: string, stage: string) {
  if (!tenantId) return 0;

  if (stage === "migrate_clients") {
    const { count } = await admin
      .from("solar_market_clients")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    return count ?? 0;
  }

  if (stage === "migrate_proposals") {
    const { count } = await admin
      .from("solar_market_proposals")
      .select("*", { count: "exact", head: true })
      .eq("tenant_id", tenantId);
    return count ?? 0;
  }

  const { count } = await admin
    .from("solar_market_projects")
    .select("*", { count: "exact", head: true })
    .eq("tenant_id", tenantId);
  return count ?? 0;
}
