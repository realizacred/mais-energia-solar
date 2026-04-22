// sm-reset-all — Reset COMPLETO da migração SolarMarket para o tenant.
//
// Apaga:
//  • Staging: sm_clientes_raw, sm_projetos_raw, sm_propostas_raw,
//             sm_funis_raw, sm_projeto_funis_raw, sm_custom_fields_raw
//  • Histórico: solarmarket_import_logs/jobs, solarmarket_promotion_logs/jobs
//  • Mapeamentos: sm_consultor_mapping
//  • Vínculos externos: external_entity_links (source IN solarmarket/solar_market)
//  • Dados promovidos: clientes / projetos / propostas_nativas
//    onde external_source IN ('solarmarket','solar_market')
//
// Preserva: consultores, pipelines, pipeline_stages, usuarios, tenants.
//
// IMPORTANTE (RB-57): sem `let` em escopo de módulo. Tudo dentro do handler.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

interface ResetResult {
  table: string;
  deleted: number | null;
  error?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization header obrigatório" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Resolve user / tenant a partir do JWT.
    const userClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const {
      data: { user },
      error: userErr,
    } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(
        JSON.stringify({ error: "Usuário não autenticado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const { data: profile, error: profileErr } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .maybeSingle();
    if (profileErr || !profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Tenant não encontrado para o usuário" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
    const tenantId = profile.tenant_id as string;

    const results: ResetResult[] = [];

    // Helper genérico de delete por tenant_id.
    const wipe = async (table: string, extra?: (q: any) => any) => {
      try {
        let q: any = admin.from(table).delete({ count: "exact" }).eq("tenant_id", tenantId);
        if (extra) q = extra(q);
        const { error, count } = await q;
        if (error) {
          results.push({ table, deleted: null, error: error.message });
        } else {
          results.push({ table, deleted: count ?? 0 });
        }
      } catch (e: any) {
        results.push({ table, deleted: null, error: e?.message ?? String(e) });
      }
    };

    // 1) Staging do SolarMarket.
    await wipe("sm_propostas_raw");
    await wipe("sm_projeto_funis_raw");
    await wipe("sm_projetos_raw");
    await wipe("sm_clientes_raw");
    await wipe("sm_funis_raw");
    await wipe("sm_custom_fields_raw");

    // 2) Histórico de jobs / logs (import + promotion).
    await wipe("solarmarket_import_logs");
    await wipe("solarmarket_import_jobs");
    await wipe("solarmarket_promotion_logs");
    await wipe("solarmarket_promotion_jobs");

    // 3) Mapeamentos de consultor.
    await wipe("sm_consultor_mapping");

    // 4) Vínculos externos vindos do SolarMarket.
    await wipe("external_entity_links", (q) =>
      q.in("source", ["solarmarket", "solar_market"]),
    );

    // 5) Dados promovidos para o CRM (apenas os marcados como originados do SM).
    await wipe("propostas_nativas", (q) =>
      q.in("external_source", ["solarmarket", "solar_market"]),
    );
    await wipe("projetos", (q) =>
      q.in("external_source", ["solarmarket", "solar_market"]),
    );
    await wipe("clientes", (q) =>
      q.in("external_source", ["solarmarket", "solar_market"]),
    );

    const totalDeleted = results.reduce(
      (acc, r) => acc + (r.deleted ?? 0),
      0,
    );
    const errors = results.filter((r) => r.error);

    return new Response(
      JSON.stringify({
        success: errors.length === 0,
        tenant_id: tenantId,
        total_deleted: totalDeleted,
        results,
        errors,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e: any) {
    console.error("[sm-reset-all] Error:", e);
    return new Response(
      JSON.stringify({ error: e?.message ?? "Erro inesperado" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
