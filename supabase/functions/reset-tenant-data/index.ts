import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();

    if (body?.confirm !== "APAGAR TUDO") {
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

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } =
      await anonClient.auth.getUser();

    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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

    // Marcar syncs travados como failed
    await admin
      .from("solar_market_sync_logs")
      .update({
        status: "failed",
        finished_at: new Date().toISOString(),
      })
      .eq("tenant_id", tenantId)
      .eq("status", "running");

    // Deletar tabelas SM grandes em lotes para evitar timeout
    for (const bigTable of ["solar_market_proposals", "solar_market_projects"]) {
      let hasMore = true;
      while (hasMore) {
        const { data, error } = await admin
          .from(bigTable)
          .delete()
          .eq("tenant_id", tenantId)
          .limit(200)
          .select("id");
        if (error || !data || data.length === 0) {
          hasMore = false;
        }
      }
    }

    // Resto das tabelas SM (pequenas, uma chamada basta)
    const smallSmTables = [
      "solar_market_clients",
      "solar_market_custom_field_values",
      "solar_market_custom_fields",
      "solar_market_funnel_stages",
      "solar_market_funnels",
      "solar_market_sync_logs",
    ];
    for (const table of smallSmTables) {
      await admin.from(table).delete().eq("tenant_id", tenantId);
    }

    // RPC só para dados canônicos (rápido)
    const { data: counts, error: resetErr } = await admin
      .rpc("reset_migrated_data", { p_tenant_id: tenantId });

    if (resetErr) {
      return new Response(
        JSON.stringify({ error: resetErr.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, counts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (e: any) {
    return new Response(
      JSON.stringify({ error: e?.message ?? "Erro inesperado." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
