import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { confirm } = await req.json();

    if (confirm !== "APAGAR TUDO") {
      return new Response(
        JSON.stringify({ error: "Confirmação inválida. Envie { confirm: \"APAGAR TUDO\" }." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado." }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("tenant_id, is_admin")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Tenant não encontrado para este usuário." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    if (!profile.is_admin) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem executar esta operação." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantId = profile.tenant_id;
    const results: Record<string, { ok: boolean; error?: string }> = {};

    // Helper: delete from table with tenant_id, continue on error
    const deleteTable = async (table: string) => {
      try {
        const { error } = await admin
          .from(table)
          .delete()
          .eq("tenant_id", tenantId);
        if (error) {
          console.error(`[reset-tenant-data] Error deleting ${table}: ${error.message}`);
          results[table] = { ok: false, error: error.message };
        } else {
          results[table] = { ok: true };
        }
      } catch (e) {
        console.error(`[reset-tenant-data] Exception deleting ${table}: ${String(e)}`);
        results[table] = { ok: false, error: String(e) };
      }
    };

    // 1. Delete proposta_versoes via subquery (no tenant_id column)
    try {
      const { data: proposalIds } = await admin
        .from("propostas_nativas")
        .select("id")
        .eq("tenant_id", tenantId);

      if (proposalIds && proposalIds.length > 0) {
        const ids = proposalIds.map((p: { id: string }) => p.id);
        const { error } = await admin
          .from("proposta_versoes")
          .delete()
          .in("proposta_id", ids);
        if (error) {
          console.error("[reset-tenant-data] Error deleting proposta_versoes:", error.message);
          results["proposta_versoes"] = { ok: false, error: error.message };
        } else {
          results["proposta_versoes"] = { ok: true };
        }
      } else {
        results["proposta_versoes"] = { ok: true };
      }
    } catch (e) {
      console.error("[reset-tenant-data] Exception deleting proposta_versoes:", String(e));
      results["proposta_versoes"] = { ok: false, error: String(e) };
    }

    // 2. Delete tables in correct FK order
    // (children before parents: pagamentos → parcelas → recebimentos,
    //  propostas_nativas, projetos before deals, clientes last among canonical,
    //  then SM tables)
    const orderedTables = [
      "pagamentos",
      "parcelas",
      "recebimentos",
      "propostas_nativas",
      "projetos",
      "deals",
      "clientes",
      "solar_market_custom_field_values",
      "solar_market_custom_fields",
      "solar_market_proposals",
      "solar_market_projects",
      "solar_market_clients",
      "solar_market_funnel_stages",
      "solar_market_funnels",
      "solar_market_sync_logs",
    ];

    for (const table of orderedTables) {
      await deleteTable(table);
    }

    const hasErrors = Object.values(results).some((r) => !r.ok);

    return new Response(
      JSON.stringify({ success: !hasErrors, tenantId, results }),
      {
        status: hasErrors ? 207 : 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    console.error("[reset-tenant-data] Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: e.message ?? "Erro inesperado.", step: "reset-tenant-data" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
