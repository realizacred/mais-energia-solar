/**
 * migration-start-job — Cria um job de migração SolarMarket.
 *
 * Body: { tenant_id?: string, job_type: string, config?: object }
 * Retorna: { job_id, status }
 *
 * `tenant_id` é opcional — se omitido, resolve via JWT do usuário autenticado.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const VALID_JOB_TYPES = new Set([
  "sync_from_sm",
  "classify_projects",
  "resolve_funnels",
  "migrate_clients",
  "migrate_projects",
  "migrate_proposals",
  "full_migration",
]);

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
    const userId = userData.user.id;

    const body = await req.json().catch(() => ({}));
    const job_type = String(body?.job_type ?? "");
    const config = body?.config ?? {};
    let tenant_id = body?.tenant_id ? String(body.tenant_id) : null;

    if (!VALID_JOB_TYPES.has(job_type)) {
      return json({ error: `Invalid job_type: ${job_type}` }, 400);
    }

    // Resolve tenant do próprio usuário (sempre)
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .maybeSingle();
    const ownTenantId = (profile?.tenant_id ?? null) as string | null;

    if (!tenant_id) tenant_id = ownTenantId;
    if (!tenant_id) return json({ error: "tenant_id not resolved" }, 400);

    // Se o caller pediu tenant diferente do próprio, exige super_admin (RB-80)
    if (tenant_id !== ownTenantId) {
      const { data: roles } = await admin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
      const isSuper = (roles ?? []).some((r: any) => r.role === "super_admin");
      if (!isSuper) {
        return json({ error: "Forbidden: only super_admin can target another tenant" }, 403);
      }
    }

    // Bloqueia criação de job se o tenant não tem staging SM
    const [{ count: cClients }, { count: cProjects }, { count: cProposals }] = await Promise.all([
      admin.from("solar_market_clients").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id),
      admin.from("solar_market_projects").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id),
      admin.from("solar_market_proposals").select("id", { count: "exact", head: true }).eq("tenant_id", tenant_id),
    ]);
    const totalStaging = (cClients ?? 0) + (cProjects ?? 0) + (cProposals ?? 0);
    if (totalStaging === 0) {
      return json(
        { error: "Tenant sem dados de staging SolarMarket. Sincronize o staging antes de criar jobs." },
        409,
      );
    }

    const { data: job, error } = await admin
      .from("migration_jobs")
      .insert({
        tenant_id,
        job_type,
        status: "pending",
        metadata: { config },
        created_by: userId,
      })
      .select("id, status")
      .single();

    if (error) return json({ error: error.message }, 500);

    return json({ job_id: job.id, status: job.status }, 200);
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
