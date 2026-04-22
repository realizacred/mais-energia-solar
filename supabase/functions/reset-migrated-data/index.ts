/**
 * reset-migrated-data — DEV ONLY
 *
 * Limpa todos os registros canônicos criados pela promoção SolarMarket → CRM
 * (clientes, projetos, propostas_nativas, proposta_versoes, deals, recebimentos)
 * com origem `solar_market`. NÃO toca em staging (`sm_*_raw`).
 *
 * Body: { confirm: "LIMPAR MIGRADOS" }
 *
 * Resposta:
 *   {
 *     success: true,
 *     counts: { clientes, projetos, propostas_nativas, proposta_versoes, deals, recebimentos },
 *     cancelled_runs: number,
 *     background_migration_paused: boolean
 *   }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    if (body?.confirm !== "LIMPAR MIGRADOS") {
      return jsonResponse({ error: "Confirmação inválida." }, 400);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonResponse({ error: "Não autenticado." }, 401);
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await anonClient.auth.getUser();
    if (authErr || !user) {
      return jsonResponse({ error: "Usuário não autenticado." }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_KEY);

    const { data: profile } = await admin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return jsonResponse({ error: "Tenant não encontrado." }, 400);
    }

    // ============================================================
    // 0) Pausar/cancelar execuções de background da migração SM
    // ============================================================
    let cancelled_runs = 0;
    let background_migration_paused = false;
    try {
      const { data: runs, error: runsErr } = await admin
        .from("sm_operation_runs")
        .update({ status: "cancelled", finished_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .in("status", ["running", "pending"])
        .select("id");
      if (!runsErr && runs) {
        cancelled_runs = runs.length;
        background_migration_paused = true;
      }
    } catch (_) {
      // tabela pode não existir em todos os ambientes — ignorar
    }

    // ============================================================
    // 1) Coletar IDs canônicos com origem solar_market
    // ============================================================
    const { data: clientesRows } = await admin
      .from("clientes")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_source", "solar_market");
    const clienteIds = (clientesRows ?? []).map((r: any) => r.id as string);

    const { data: projetosRows } = await admin
      .from("projetos")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_source", "solar_market");
    const projetoIds = (projetosRows ?? []).map((r: any) => r.id as string);

    const { data: propostasRows } = await admin
      .from("propostas_nativas")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("external_source", "solar_market");
    const propostaIds = (propostasRows ?? []).map((r: any) => r.id as string);

    const counts: Record<string, number> = {
      clientes: 0,
      projetos: 0,
      propostas_nativas: 0,
      proposta_versoes: 0,
      deals: 0,
      recebimentos: 0,
    };

    // Helper para .in() em chunks (Postgres tem limite prático)
    const chunk = <T,>(arr: T[], size = 500): T[][] => {
      const out: T[][] = [];
      for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
      return out;
    };

    // ============================================================
    // 2) Deletar dependências antes (recebimentos, deals, versões)
    // ============================================================
    if (propostaIds.length > 0) {
      // recebimentos por proposta_id
      for (const ids of chunk(propostaIds)) {
        const { data, error } = await admin
          .from("recebimentos")
          .delete()
          .eq("tenant_id", tenantId)
          .in("proposta_id", ids)
          .select("id");
        if (error) return jsonResponse({ error: `recebimentos: ${error.message}` }, 500);
        counts.recebimentos += data?.length ?? 0;
      }
      // proposta_versoes
      for (const ids of chunk(propostaIds)) {
        const { data, error } = await admin
          .from("proposta_versoes")
          .delete()
          .in("proposta_id", ids)
          .select("id");
        if (error) return jsonResponse({ error: `proposta_versoes: ${error.message}` }, 500);
        counts.proposta_versoes += data?.length ?? 0;
      }
    }

    // recebimentos vinculados por projeto (sem proposta) — fallback
    if (projetoIds.length > 0) {
      for (const ids of chunk(projetoIds)) {
        const { data, error } = await admin
          .from("recebimentos")
          .delete()
          .eq("tenant_id", tenantId)
          .in("projeto_id", ids)
          .select("id");
        if (error) return jsonResponse({ error: `recebimentos(projeto): ${error.message}` }, 500);
        counts.recebimentos += data?.length ?? 0;
      }
    }

    // deals por cliente/projeto
    if (projetoIds.length > 0) {
      for (const ids of chunk(projetoIds)) {
        const { data, error } = await admin
          .from("deals")
          .delete()
          .eq("tenant_id", tenantId)
          .in("projeto_id", ids)
          .select("id");
        if (error) return jsonResponse({ error: `deals(projeto): ${error.message}` }, 500);
        counts.deals += data?.length ?? 0;
      }
    }
    if (clienteIds.length > 0) {
      for (const ids of chunk(clienteIds)) {
        const { data, error } = await admin
          .from("deals")
          .delete()
          .eq("tenant_id", tenantId)
          .in("cliente_id", ids)
          .select("id");
        if (error) return jsonResponse({ error: `deals(cliente): ${error.message}` }, 500);
        counts.deals += data?.length ?? 0;
      }
    }

    // ============================================================
    // 3) Deletar entidades canônicas
    // ============================================================
    if (propostaIds.length > 0) {
      for (const ids of chunk(propostaIds)) {
        const { data, error } = await admin
          .from("propostas_nativas")
          .delete()
          .in("id", ids)
          .select("id");
        if (error) return jsonResponse({ error: `propostas_nativas: ${error.message}` }, 500);
        counts.propostas_nativas += data?.length ?? 0;
      }
    }
    if (projetoIds.length > 0) {
      for (const ids of chunk(projetoIds)) {
        const { data, error } = await admin
          .from("projetos")
          .delete()
          .in("id", ids)
          .select("id");
        if (error) return jsonResponse({ error: `projetos: ${error.message}` }, 500);
        counts.projetos += data?.length ?? 0;
      }
    }
    if (clienteIds.length > 0) {
      for (const ids of chunk(clienteIds)) {
        const { data, error } = await admin
          .from("clientes")
          .delete()
          .in("id", ids)
          .select("id");
        if (error) return jsonResponse({ error: `clientes: ${error.message}` }, 500);
        counts.clientes += data?.length ?? 0;
      }
    }

    return jsonResponse({
      success: true,
      counts,
      cancelled_runs,
      background_migration_paused,
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Erro inesperado.";
    console.error("[reset-migrated-data] Error:", message);
    return jsonResponse({ error: message }, 500);
  }
});
