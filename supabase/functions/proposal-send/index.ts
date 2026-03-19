import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // ── 1. AUTH ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Não autorizado", 401);

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) {
      console.error("[proposal-send] Auth failed:", authErr?.message);
      return jsonError("Sessão expirada. Faça login novamente.", 401);
    }
    const userId = user.id;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminClient.from("profiles").select("tenant_id, ativo").eq("user_id", userId).single();
    if (!profile?.tenant_id || !profile.ativo) return jsonError("Usuário inativo", 403);
    const tenantId = profile.tenant_id;

    // ── 2. PARSE ────────────────────────────────────────────
    const body = await req.json();
    const { proposta_id, versao_id, canal, lead_id } = body;

    if (!proposta_id || !versao_id) return jsonError("proposta_id e versao_id obrigatórios", 400);

    // ── 3. VERIFICAR OWNERSHIP + DADOS (paralelo) ───────────
    const [propostaRes, tenantRes, versaoRes, renderRes] = await Promise.all([
      adminClient.from("propostas_nativas")
        .select("id, lead_id, titulo, codigo, deal_id").eq("id", proposta_id).eq("tenant_id", tenantId).single(),
      adminClient.from("tenants")
        .select("dominio_customizado, slug, nome").eq("id", tenantId).single(),
      adminClient.from("proposta_versoes")
        .select("id, versao_numero, valor_total, economia_mensal, payback_meses, potencia_kwp")
        .eq("id", versao_id).eq("tenant_id", tenantId).single(),
      adminClient.from("proposta_renders")
        .select("id").eq("versao_id", versao_id).eq("tenant_id", tenantId).eq("tipo", "html").maybeSingle(),
    ]);

    if (!propostaRes.data) return jsonError("Proposta não encontrada", 404);
    if (!versaoRes.data) return jsonError("Versão não encontrada", 404);

    const proposta = propostaRes.data;
    const tenant = tenantRes.data;
    const versao = versaoRes.data;

    // Se não tem render, gerar automaticamente
    if (!renderRes.data) {
      console.log("[proposal-send] No render found — triggering auto-render");
      await adminClient.functions.invoke("proposal-render", {
        body: { versao_id },
        headers: { Authorization: authHeader },
      });
    }

    // ── 4. IDEMPOTÊNCIA — verificar envio existente ─────────
    const { data: existingEnvio } = await adminClient
      .from("proposta_envios")
      .select("id, token_id, canal, enviado_em")
      .eq("versao_id", versao_id).eq("tenant_id", tenantId).eq("canal", canal || "link")
      .maybeSingle();

    if (existingEnvio?.token_id) {
      const { data: existingToken } = await adminClient
        .from("proposta_aceite_tokens")
        .select("token").eq("id", existingEnvio.token_id).single();

      if (existingToken) {
        const baseUrl = req.headers.get("origin") || `https://${tenant?.slug || "app"}.lovable.app`;
        return jsonOk({
          success: true, idempotent: true,
          token: existingToken.token,
          public_url: `${baseUrl}/proposta/${existingToken.token}`,
          whatsapp_sent: false,
        });
      }
    }

    // ── 5. CRIAR TOKEN ──────────────────────────────────────
    const { data: aceiteToken, error: tokenErr } = await adminClient
      .from("proposta_aceite_tokens")
      .insert({
        tenant_id: tenantId,
        proposta_id,
        versao_id,
        created_by: userId,
      })
      .select("id, token")
      .single();

    if (tokenErr || !aceiteToken) return jsonError(`Erro ao criar token: ${tokenErr?.message}`, 500);

    // Build public URL
    const baseUrl = req.headers.get("origin") || `https://${tenant?.slug || "app"}.lovable.app`;
    const publicUrl = `${baseUrl}/proposta/${aceiteToken.token}`;

    // ── 6. REGISTRAR ENVIO + ATUALIZAR PROPOSTA (paralelo) ──
    const canalFinal = canal || "link";

    await Promise.all([
      // Registrar na tabela de envios (audit trail)
      // FIX: use correct column names (destinatario + detalhes JSON)
      adminClient.from("proposta_envios").insert({
        tenant_id: tenantId,
        versao_id,
        token_id: aceiteToken.id,
        canal: canalFinal,
        enviado_por: userId,
        destinatario: null, // populated below if whatsapp
        detalhes: { token: aceiteToken.token, public_url: publicUrl },
      }),
      // Atualizar status da proposta
      adminClient.from("propostas_nativas").update({
        status: "enviada",
        enviada_at: new Date().toISOString(),
        enviada_via: canalFinal,
        enviada_por: userId,
        public_token: aceiteToken.token,
      }).eq("id", proposta_id).eq("tenant_id", tenantId),
      // Atualizar versão para "sent"
      adminClient.from("proposta_versoes").update({
        status: "sent",
      }).eq("id", versao_id).eq("tenant_id", tenantId),
    ]);

    // ── 7. TIMELINE EVENT (project_events) ──────────────────
    if (proposta.deal_id) {
      adminClient.from("project_events").insert({
        tenant_id: tenantId,
        deal_id: proposta.deal_id,
        event_type: "proposal.sent",
        actor_user_id: userId,
        from_value: null,
        to_value: canalFinal,
        metadata: {
          proposta_id,
          versao_id,
          canal: canalFinal,
          token: aceiteToken.token,
          valor_total: versao.valor_total,
          potencia_kwp: versao.potencia_kwp,
        },
      }).then(({ error }) => {
        if (error) console.warn("[proposal-send] Timeline event insert failed:", error.message);
      });
    }

    // ── 8. WHATSAPP (best-effort) ───────────────────────────
    let whatsappSent = false;
    if (canalFinal === "whatsapp") {
      const targetLeadId = lead_id || proposta.lead_id;
      if (targetLeadId) {
        try {
          const { data: lead } = await adminClient
            .from("leads").select("telefone, nome")
            .eq("id", targetLeadId).eq("tenant_id", tenantId).single();

          if (lead?.telefone) {
            const tenantNome = tenant?.nome || "Empresa";
            const mensagem = `Olá ${lead.nome || ""}! 🌞\n\n` +
              `Sua proposta solar está pronta!\n\n` +
              `📄 *${proposta.titulo || proposta.codigo || "Proposta Solar"}*\n` +
              `⚡ ${versao.potencia_kwp} kWp | 💰 Economia: R$ ${versao.economia_mensal?.toFixed(2) ?? "—"}/mês\n\n` +
              `🔗 Veja e aceite aqui:\n${publicUrl}\n\n` +
              `${tenantNome} — Energia Solar ☀️`;

            const { error: waErr } = await adminClient.functions.invoke("send-whatsapp-message", {
              body: { lead_id: targetLeadId, message: mensagem, tenant_id: tenantId },
            });

            whatsappSent = !waErr;

            // Update envio with destinatario info using correct columns
            if (whatsappSent) {
              await adminClient.from("proposta_envios").update({
                destinatario: lead.telefone,
                detalhes: {
                  token: aceiteToken.token,
                  public_url: publicUrl,
                  destinatario_nome: lead.nome,
                  destinatario_telefone: lead.telefone,
                },
              }).eq("token_id", aceiteToken.id).eq("tenant_id", tenantId);
            }
          }
        } catch (e) {
          console.warn("[proposal-send] WhatsApp send failed:", e);
        }
      }
    }

    return jsonOk({
      success: true, idempotent: false,
      token: aceiteToken.token,
      public_url: publicUrl,
      whatsapp_sent: whatsappSent,
    });
  } catch (err: any) {
    console.error("[proposal-send] Error:", err);
    return jsonError(err.message ?? "Erro interno", 500);
  }
});

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status, headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
