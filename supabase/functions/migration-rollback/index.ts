/**
 * migration-rollback — Reverte um job de migração deletando os registros nativos
 * criados pelo job (ordem reversa: proposals → projects → clients).
 *
 * Body: { job_id: string, confirm: true }
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
    if (body?.confirm !== true) {
      return json({ error: "Confirmation required: { confirm: true }" }, 400);
    }

    const { data: job } = await admin
      .from("migration_jobs")
      .select("id, tenant_id, status")
      .eq("id", job_id)
      .single();
    if (!job) return json({ error: "Job not found" }, 404);

    const counts = { proposals: 0, projects: 0, clients: 0 };

    // 1) Proposals
    const { data: propRows } = await admin
      .from("migration_records")
      .select("native_entity_id")
      .eq("job_id", job_id)
      .eq("entity_type", "proposal")
      .not("native_entity_id", "is", null);
    const propIds = (propRows ?? []).map((r: any) => r.native_entity_id);
    if (propIds.length) {
      const { count } = await admin
        .from("propostas_nativas")
        .delete({ count: "exact" })
        .in("id", propIds);
      counts.proposals = count ?? 0;
    }

    // 2) Projects
    const { data: projRows } = await admin
      .from("migration_records")
      .select("native_entity_id")
      .eq("job_id", job_id)
      .eq("entity_type", "project")
      .not("native_entity_id", "is", null);
    const projIds = (projRows ?? []).map((r: any) => r.native_entity_id);
    if (projIds.length) {
      const { count } = await admin
        .from("projetos")
        .delete({ count: "exact" })
        .in("id", projIds);
      counts.projects = count ?? 0;
    }

    // 3) Clients
    const { data: cliRows } = await admin
      .from("migration_records")
      .select("native_entity_id")
      .eq("job_id", job_id)
      .eq("entity_type", "client")
      .not("native_entity_id", "is", null);
    const cliIds = (cliRows ?? []).map((r: any) => r.native_entity_id);
    if (cliIds.length) {
      const { count } = await admin
        .from("clientes")
        .delete({ count: "exact" })
        .in("id", cliIds);
      counts.clients = count ?? 0;
    }

    // CR#2: limpa migration_records do job (evita ledger órfão após rollback)
    let deleted_records = 0;
    {
      const { count } = await admin
        .from("migration_records")
        .delete({ count: "exact" })
        .eq("job_id", job_id);
      deleted_records = count ?? 0;
    }

    await admin
      .from("migration_jobs")
      .update({ status: "rolled_back", completed_at: new Date().toISOString() })
      .eq("id", job_id);

    return json({ success: true, counts, deleted_records }, 200);
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
