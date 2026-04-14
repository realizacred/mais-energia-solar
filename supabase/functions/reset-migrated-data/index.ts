import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const body = await req.json();
    if (body?.confirm !== "LIMPAR MIGRADOS") {
      return new Response(
        JSON.stringify({ error: "Confirmação inválida." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !supabaseAnonKey || !serviceRoleKey) {
      console.error("[reset-migrated-data] Missing env vars");
      return new Response(
        JSON.stringify({ error: "Server configuration error." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const anonClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Tenant não encontrado." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = profile.tenant_id;
    const nowIso = new Date().toISOString();

    const { error: disableAutoMigrationError } = await admin
      .from("sm_migration_settings")
      .update({ enabled: false, updated_at: nowIso })
      .eq("tenant_id", tenantId);

    if (disableAutoMigrationError) {
      console.error("[reset-migrated-data] Failed to disable background migration:", disableAutoMigrationError.message);
      return new Response(
        JSON.stringify({ error: "Não foi possível pausar a migração automática." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: cancelledRuns, error: cancelRunsError } = await admin
      .from("sm_operation_runs")
      .update({
        status: "cancelled",
        finished_at: nowIso,
        error_summary: "Cancelado ao limpar dados migrados",
      })
      .eq("tenant_id", tenantId)
      .eq("operation_type", "migrate_to_native")
      .in("status", ["queued", "running"])
      .select("id");

    if (cancelRunsError) {
      console.error("[reset-migrated-data] Failed to cancel active migration runs:", cancelRunsError.message);
      return new Response(
        JSON.stringify({ error: "Não foi possível parar a migração ativa." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The RPC itself now checks for active migration/sync and blocks if needed
    const { data: counts, error: resetErr } = await admin.rpc(
      "reset_migrated_data",
      { p_tenant_id: tenantId }
    );

    if (resetErr) {
      console.error("[reset-migrated-data] RPC error:", resetErr.message);
      return new Response(
        JSON.stringify({ error: resetErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // RPC returns success:false when migration is active
    if (counts && counts.success === false) {
      return new Response(
        JSON.stringify({ error: counts.error, blocked: true }),
        { status: 409, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        counts,
        cancelled_runs: cancelledRuns?.length ?? 0,
        background_migration_paused: true,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e: any) {
    console.error("[reset-migrated-data] Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "Erro inesperado." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
