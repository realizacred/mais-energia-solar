/**
 * proposta-kit-token
 * 
 * POST: criar grupo de kits (authenticated)
 * GET:  buscar dados do grupo via token (public)
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

  try {
    if (req.method === "POST") {
      // ─── Authenticated: create grupo ───
      const authHeader = req.headers.get("authorization") || "";
      const supaUser = createClient(supabaseUrl, anonKey, {
        global: { headers: { authorization: authHeader } },
      });
      const { data: { user }, error: authErr } = await supaUser.auth.getUser();
      if (authErr || !user) return json({ error: "Não autorizado" }, 401);

      const admin = createClient(supabaseUrl, serviceKey);

      const { data: profile } = await admin
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();
      if (!profile?.tenant_id) return json({ error: "Perfil não encontrado" }, 400);

      const body = await req.json();
      const { projeto_id, proposta_ids, titulo, expires_days } = body;

      if (!projeto_id || !Array.isArray(proposta_ids) || proposta_ids.length < 2) {
        return json({ error: "Selecione pelo menos 2 propostas" }, 400);
      }

      const expiresAt = expires_days
        ? new Date(Date.now() + expires_days * 86400000).toISOString()
        : null;

      const { data: grupo, error: insertErr } = await admin
        .from("proposta_grupo_tokens")
        .insert({
          tenant_id: profile.tenant_id,
          projeto_id,
          proposta_ids,
          titulo: titulo || "Escolha seu Kit Solar",
          expires_at: expiresAt,
          created_by: user.id,
        })
        .select("id, token")
        .single();

      if (insertErr) {
        console.error("[proposta-kit-token] Insert error:", insertErr);
        return json({ error: "Erro ao criar grupo" }, 500);
      }

      const appUrl = Deno.env.get("APP_URL") || "https://maisenergiasolar.lovable.app";
      return json({
        token: grupo.token,
        url: `${appUrl}/kits/${grupo.token}`,
        id: grupo.id,
      });
    }

    if (req.method === "GET") {
      // ─── Public: fetch grupo data ───
      const url = new URL(req.url);
      const token = url.searchParams.get("token");
      if (!token) return json({ error: "Token obrigatório" }, 400);

      const admin = createClient(supabaseUrl, serviceKey);

      // 1. Find grupo
      const { data: grupo, error: grupoErr } = await admin
        .from("proposta_grupo_tokens")
        .select("*")
        .eq("token", token)
        .single();

      if (grupoErr || !grupo) return json({ error: "Link inválido ou expirado" }, 404);
      if (grupo.expires_at && new Date(grupo.expires_at) < new Date()) {
        return json({ error: "Link expirado" }, 410);
      }

      // Increment view count
      await admin
        .from("proposta_grupo_tokens")
        .update({ view_count: (grupo.view_count || 0) + 1 })
        .eq("id", grupo.id);

      // 2. Fetch propostas with latest versão snapshot
      const propostaIds = grupo.proposta_ids as string[];
      const { data: propostas } = await admin
        .from("propostas_nativas")
        .select("id, titulo, nome_kit, status, is_principal")
        .in("id", propostaIds);

      // 3. Fetch latest versão for each proposta
      const kits = [];
      for (const p of (propostas || [])) {
        const { data: versao } = await admin
          .from("proposta_versoes")
          .select("id, versao_numero, valor_total, economia_mensal, payback_meses, potencia_kwp, snapshot")
          .eq("proposta_id", p.id)
          .order("versao_numero", { ascending: false })
          .limit(1)
          .single();

        // Fetch cenários
        const { data: cenarios } = await admin
          .from("proposta_cenarios")
          .select("*")
          .eq("versao_id", versao?.id || "")
          .order("ordem", { ascending: true });

        kits.push({
          proposta_id: p.id,
          nome_kit: p.nome_kit || p.titulo || `Kit ${kits.length + 1}`,
          status: p.status,
          versao: versao ? {
            id: versao.id,
            versao_numero: versao.versao_numero,
            valor_total: versao.valor_total,
            economia_mensal: versao.economia_mensal,
            payback_meses: versao.payback_meses,
            potencia_kwp: versao.potencia_kwp,
            snapshot: versao.snapshot,
          } : null,
          cenarios: cenarios || [],
        });
      }

      // 4. Fetch brand settings
      const { data: brand } = await admin
        .from("brand_settings")
        .select("logo_url, logo_white_url, color_primary, color_secondary, font_heading, representante_legal, representante_email")
        .eq("tenant_id", grupo.tenant_id)
        .limit(1)
        .single();

      // 5. Fetch tenant
      const { data: tenant } = await admin
        .from("tenants")
        .select("nome, telefone, email")
        .eq("id", grupo.tenant_id)
        .single();

      // 6. Fetch projeto → cliente
      const { data: projeto } = await admin
        .from("projetos")
        .select("id, cliente_id")
        .eq("id", grupo.projeto_id)
        .single();

      let cliente = null;
      if (projeto?.cliente_id) {
        const { data: c } = await admin
          .from("clientes")
          .select("nome, cidade, estado, email, telefone")
          .eq("id", projeto.cliente_id)
          .single();
        cliente = c;
      }

      // 7. Fetch consultor (created_by)
      let consultor = null;
      if (grupo.created_by) {
        const { data: prof } = await admin
          .from("profiles")
          .select("full_name, phone")
          .eq("user_id", grupo.created_by)
          .single();
        consultor = prof;
      }

      return json({
        grupo: {
          id: grupo.id,
          titulo: grupo.titulo,
          projeto_id: grupo.projeto_id,
          kit_aceito_id: grupo.kit_aceito_id,
          expires_at: grupo.expires_at,
          view_count: grupo.view_count,
        },
        kits,
        brand,
        tenant,
        cliente,
        consultor,
      });
    }

    return json({ error: "Method not allowed" }, 405);
  } catch (e) {
    console.error("[proposta-kit-token] Error:", e);
    return json({ error: "Erro interno" }, 500);
  }
});
