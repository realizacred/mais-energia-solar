/**
 * migration-clear-history — Apaga jobs do histórico do tenant atual.
 * Modos:
 *  - scope: "finished" (default) — apaga completed/failed/rolled_back
 *  - scope: "all" — apaga TODOS (inclui pending/running). Use com cuidado.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";

    const userClient = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();

    const tenant_id = profile?.tenant_id;
    if (!tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const scope: "finished" | "all" = body?.scope === "all" ? "all" : "finished";

    // Buscar IDs dos jobs alvo
    let q = admin.from("migration_jobs").select("id").eq("tenant_id", tenant_id);
    if (scope === "finished") {
      q = q.in("status", ["completed", "failed", "rolled_back"]);
    }
    const { data: jobs, error: selErr } = await q;
    if (selErr) throw selErr;

    const jobIds = (jobs ?? []).map((j: any) => j.id);
    if (jobIds.length === 0) {
      return new Response(JSON.stringify({ success: true, deleted_jobs: 0, deleted_steps: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deletar steps primeiro (FK)
    const { count: stepsCount } = await admin
      .from("migration_job_steps")
      .delete({ count: "exact" })
      .in("job_id", jobIds);

    const { count: jobsCount } = await admin
      .from("migration_jobs")
      .delete({ count: "exact" })
      .in("id", jobIds);

    return new Response(
      JSON.stringify({ success: true, deleted_jobs: jobsCount ?? 0, deleted_steps: stepsCount ?? 0, scope }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e?.message ?? String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
