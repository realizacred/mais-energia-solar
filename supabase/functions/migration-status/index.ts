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
    const total = Object.values(counters).reduce((a, b) => a + b, 0);
    const done = counters.migrated + counters.skipped + counters.failed;
    const progress = total > 0 ? Math.round((done / total) * 100) : 0;

    const shouldAutoComplete =
      job.status === "running" &&
      counters.pending === 0 &&
      counters.processing === 0 &&
      job?.metadata?.progress?.has_more === false;

    if (shouldAutoComplete) {
      const { data: healedJob, error: healError } = await admin
        .from("migration_jobs")
        .update({
          status: "completed",
          completed_at: job.completed_at ?? new Date().toISOString(),
          metadata: {
            ...(job.metadata ?? {}),
            progress: {
              ...(job.metadata?.progress ?? {}),
              has_more: false,
            },
          },
        })
        .eq("id", job_id)
        .select("*")
        .single();

      if (!healError && healedJob) {
        job = healedJob;
      }
    }

    // Erros recentes
    const { data: errors } = await admin
      .from("migration_records")
      .select("entity_type, sm_entity_id, error_message, validation_errors")
      .eq("job_id", job_id)
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(20);

    return json({ job, counters, total, progress, errors: errors ?? [] }, 200);
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
