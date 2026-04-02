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

    // Resolve tenant from caller JWT
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

    // Service role client for deletions (bypasses RLS)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Resolve tenant_id from profile
    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (profileErr || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Tenant não encontrado para este usuário." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantId = profile.tenant_id;

    // Check admin role
    const { data: roleData } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(
        JSON.stringify({ error: "Apenas administradores podem executar esta operação." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Delete in FK order
    const counts: Record<string, number> = {};

    const tables = [
      "pagamentos",
      "parcelas",
      "recebimentos",
    ];

    // Direct tenant_id tables first
    for (const table of tables) {
      const { data, error } = await admin
        .from(table)
        .delete()
        .eq("tenant_id", tenantId)
        .select("id");
      if (error) {
        console.error(`[reset-tenant-data] Error deleting ${table}:`, error.message);
        return new Response(
          JSON.stringify({ error: `Erro ao apagar ${table}: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      counts[table] = data?.length ?? 0;
    }

    // proposta_versoes via subquery
    {
      const { data: proposalIds } = await admin
        .from("propostas_nativas")
        .select("id")
        .eq("tenant_id", tenantId);

      if (proposalIds && proposalIds.length > 0) {
        const ids = proposalIds.map((p: { id: string }) => p.id);
        const { data, error } = await admin
          .from("proposta_versoes")
          .delete()
          .in("proposta_id", ids)
          .select("id");
        if (error) {
          console.error("[reset-tenant-data] Error deleting proposta_versoes:", error.message);
          return new Response(
            JSON.stringify({ error: `Erro ao apagar proposta_versoes: ${error.message}` }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
          );
        }
        counts["proposta_versoes"] = data?.length ?? 0;
      } else {
        counts["proposta_versoes"] = 0;
      }
    }

    // Remaining tables with tenant_id
    const remainingTables = [
      "propostas_nativas",
      "deals",
      "projetos",
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

    for (const table of remainingTables) {
      const { data, error } = await admin
        .from(table)
        .delete()
        .eq("tenant_id", tenantId)
        .select("id");
      if (error) {
        console.error(`[reset-tenant-data] Error deleting ${table}:`, error.message);
        return new Response(
          JSON.stringify({ error: `Erro ao apagar ${table}: ${error.message}` }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      counts[table] = data?.length ?? 0;
    }

    return new Response(
      JSON.stringify({ success: true, counts }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[reset-tenant-data] Unexpected error:", e);
    return new Response(
      JSON.stringify({ error: e.message ?? "Erro inesperado." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
