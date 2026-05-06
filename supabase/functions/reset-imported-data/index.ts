/**
 * reset-imported-data — DEV ONLY
 *
 * Limpa APENAS staging SolarMarket (sm_*_raw + jobs/logs + mapeamentos +
 * external_entity_links). NÃO toca em clientes/projetos/propostas canônicos.
 *
 * Body: { confirm: "LIMPAR IMPORTADOS" }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (b: unknown, s = 200) =>
  new Response(JSON.stringify(b), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "LIMPAR IMPORTADOS") {
      return json({ error: "Confirmação inválida." }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Não autenticado." }, 401);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SVC = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anon = createClient(SUPABASE_URL, ANON, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: aerr } = await anon.auth.getUser();
    if (aerr || !user) return json({ error: "Usuário não autenticado." }, 401);

    const admin = createClient(SUPABASE_URL, SVC);
    const { data: profile } = await admin
      .from("profiles").select("tenant_id").eq("user_id", user.id).maybeSingle();
    const tenantId = profile?.tenant_id;
    if (!tenantId) return json({ error: "Tenant não encontrado." }, 400);

    const counts: Record<string, number> = {};
    const wipe = async (table: string, extra?: (q: any) => any) => {
      try {
        let q: any = admin.from(table as never).delete({ count: "exact" }).eq("tenant_id", tenantId);
        if (extra) q = extra(q);
        const { error, count } = await q;
        if (error) {
          const code = (error as { code?: string }).code;
          if (code === "42P01") return; // tabela não existe — ignora
          counts[`${table}_error`] = -1;
          console.error(`[reset-imported] ${table}:`, error.message);
        } else {
          counts[table] = count ?? 0;
        }
      } catch (e) {
        console.error(`[reset-imported] ${table} exception:`, e);
      }
    };

    // Staging SM (ordem: filhos -> pais)
    await wipe("sm_propostas_raw");
    await wipe("sm_projeto_funis_raw");
    await wipe("sm_projetos_raw");
    await wipe("sm_clientes_raw");
    await wipe("sm_funis_raw");
    await wipe("sm_custom_fields_raw");

    // Histórico
    await wipe("solarmarket_import_logs");
    await wipe("solarmarket_import_jobs");
    await wipe("solarmarket_promotion_logs");
    await wipe("solarmarket_promotion_jobs");

    // Mapeamentos / vínculos
    await wipe("sm_consultor_mapping");
    await wipe("external_entity_links", (q) =>
      q.in("source", ["solarmarket", "solar_market"])
    );

    return json({ success: true, counts });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    console.error("[reset-imported-data]", msg);
    return json({ error: msg }, 500);
  }
});
