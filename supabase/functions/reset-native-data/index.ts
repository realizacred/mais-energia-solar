/**
 * reset-native-data — DEV ONLY
 *
 * Limpa APENAS dados canônicos NATIVOS (clientes/projetos/propostas/deals/
 * recebimentos/comissões/documentos) onde external_source IS NULL ou diferente
 * de solar_market. NÃO toca em staging SM nem em registros migrados.
 *
 * Leads são preservados.
 *
 * Body: { confirm: "LIMPAR NATIVOS" }
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

const chunk = <T,>(arr: T[], size = 500): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "LIMPAR NATIVOS") {
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

    const counts: Record<string, number> = {
      clientes: 0, projetos: 0, propostas_nativas: 0,
      proposta_versoes: 0, deals: 0, recebimentos: 0,
    };

    // Coletar IDs nativos (external_source IS NULL OR não é SM)
    const isNativeFilter = "external_source.is.null,external_source.not.in.(solarmarket,solar_market)";

    const { data: cliRows } = await admin
      .from("clientes").select("id").eq("tenant_id", tenantId).or(isNativeFilter);
    const clienteIds = (cliRows ?? []).map((r: any) => r.id as string);

    const { data: projRows } = await admin
      .from("projetos").select("id").eq("tenant_id", tenantId).or(isNativeFilter);
    const projetoIds = (projRows ?? []).map((r: any) => r.id as string);

    const { data: propRows } = await admin
      .from("propostas_nativas").select("id").eq("tenant_id", tenantId).or(isNativeFilter);
    const propostaIds = (propRows ?? []).map((r: any) => r.id as string);

    // Dependências por proposta
    if (propostaIds.length > 0) {
      for (const ids of chunk(propostaIds)) {
        const { data, error } = await admin.from("recebimentos").delete()
          .eq("tenant_id", tenantId).in("proposta_id", ids).select("id");
        if (error) return json({ error: `recebimentos: ${error.message}` }, 500);
        counts.recebimentos += data?.length ?? 0;
      }
      for (const ids of chunk(propostaIds)) {
        const { data, error } = await admin.from("proposta_versoes").delete()
          .in("proposta_id", ids).select("id");
        if (error) return json({ error: `proposta_versoes: ${error.message}` }, 500);
        counts.proposta_versoes += data?.length ?? 0;
      }
    }

    // Dependências por projeto
    if (projetoIds.length > 0) {
      for (const ids of chunk(projetoIds)) {
        const { data, error } = await admin.from("recebimentos").delete()
          .eq("tenant_id", tenantId).in("projeto_id", ids).select("id");
        if (error) return json({ error: `recebimentos(projeto): ${error.message}` }, 500);
        counts.recebimentos += data?.length ?? 0;
      }
      for (const ids of chunk(projetoIds)) {
        const { data, error } = await admin.from("deals").delete()
          .eq("tenant_id", tenantId).in("projeto_id", ids).select("id");
        if (error) return json({ error: `deals: ${error.message}` }, 500);
        counts.deals += data?.length ?? 0;
      }
    }

    // Entidades canônicas
    if (propostaIds.length > 0) {
      for (const ids of chunk(propostaIds)) {
        const { data, error } = await admin.from("propostas_nativas").delete()
          .in("id", ids).select("id");
        if (error) return json({ error: `propostas_nativas: ${error.message}` }, 500);
        counts.propostas_nativas += data?.length ?? 0;
      }
    }
    if (projetoIds.length > 0) {
      for (const ids of chunk(projetoIds)) {
        const { data, error } = await admin.from("projetos").delete()
          .in("id", ids).select("id");
        if (error) return json({ error: `projetos: ${error.message}` }, 500);
        counts.projetos += data?.length ?? 0;
      }
    }
    if (clienteIds.length > 0) {
      for (const ids of chunk(clienteIds)) {
        const { data, error } = await admin.from("clientes").delete()
          .in("id", ids).select("id");
        if (error) return json({ error: `clientes: ${error.message}` }, 500);
        counts.clientes += data?.length ?? 0;
      }
    }

    return json({ success: true, counts });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Erro inesperado.";
    console.error("[reset-native-data]", msg);
    return json({ error: msg }, 500);
  }
});
