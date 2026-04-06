import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/** Simple template renderer — replaces {{key}} with values */
function renderTemplate(corpo: string, vars: Record<string, string>): string {
  return corpo.replace(/\{\{(\w+)\}\}/g, (_match, key) => vars[key] ?? `{{${key}}}`);
}

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
    const { proposta_id, versao_id, canal, lead_id, template_id, mensagem_custom } = body;

    if (!proposta_id || !versao_id) return jsonError("proposta_id e versao_id obrigatórios", 400);

    // ── 3. VERIFICAR OWNERSHIP + DADOS (paralelo) ───────────
    const [propostaRes, tenantRes, versaoRes, renderRes] = await Promise.all([
      adminClient.from("propostas_nativas")
        .select("id, lead_id, titulo, codigo, deal_id").eq("id", proposta_id).eq("tenant_id", tenantId).single(),
      adminClient.from("tenants")
        .select("dominio_customizado, slug, nome").eq("id", tenantId).single(),
      adminClient.from("proposta_versoes")
        .select("id, versao_numero, valor_total, economia_mensal, payback_meses, potencia_kwp, geracao_mensal, snapshot")
        .eq("id", versao_id).eq("tenant_id", tenantId).single(),
      adminClient.from("proposta_renders")
        .select("id").eq("versao_id", versao_id).eq("tenant_id", tenantId).eq("tipo", "html").maybeSingle(),
    ]);

    if (!propostaRes.data) return jsonError("Proposta não encontrada", 404);
    if (!versaoRes.data) return jsonError("Versão não encontrada", 404);

    const proposta = propostaRes.data;
    const tenant = tenantRes.data;
    const versao = versaoRes.data as any;

    // Se não tem render, gerar automaticamente
    if (!renderRes.data) {
      // No render found — triggering auto-render
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
        const baseUrl = Deno.env.get("APP_URL") || Deno.env.get("APP_URL_LOCKED") || `https://${tenant?.slug || "app"}.lovable.app`;
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
    const baseUrl = Deno.env.get("APP_URL") || Deno.env.get("APP_URL_LOCKED") || `https://${tenant?.slug || "app"}.lovable.app`;
    const publicUrl = `${baseUrl}/proposta/${aceiteToken.token}`;

    // ── 5b. RESOLVER MENSAGEM (template ou custom) ──────────
    const canalFinal = canal || "link";
    let mensagemFinal: string | null = null;

    if (mensagem_custom) {
      // Usuário editou a mensagem antes de enviar
      mensagemFinal = mensagem_custom;
    } else if (canalFinal === "whatsapp" || canalFinal === "email") {
      // Buscar template
      let templateData: any = null;
      if (template_id) {
        const { data: t } = await adminClient
          .from("proposta_email_templates")
          .select("corpo_texto, corpo_html, canal")
          .eq("id", template_id).eq("tenant_id", tenantId).eq("ativo", true)
          .single();
        templateData = t;
      }
      if (!templateData) {
        // Fallback: template padrão
        const { data: t } = await adminClient
          .from("proposta_email_templates")
          .select("corpo_texto, corpo_html, canal")
          .eq("tenant_id", tenantId).eq("is_default", true).eq("ativo", true)
          .in("canal", [canalFinal, "ambos"])
          .limit(1)
          .maybeSingle();
        templateData = t;
      }

      if (templateData) {
        const corpoRaw = canalFinal === "whatsapp" ? (templateData.corpo_texto || "") : (templateData.corpo_html || "");
        if (corpoRaw) {
          // Build template vars from real data
          const leadId = lead_id || proposta.lead_id;
          let leadNome = "";
          if (leadId) {
            const { data: lead } = await adminClient
              .from("leads").select("nome").eq("id", leadId).eq("tenant_id", tenantId).single();
            leadNome = lead?.nome || "";
          }

          const snapshot = versao.snapshot || {};
          const itens = (snapshot as any).itens || [];
          const modulos = itens.filter((i: any) => i.categoria === "modulo" || i.categoria === "modulos");
          const inversores = itens.filter((i: any) => i.categoria === "inversor" || i.categoria === "inversores");
          const numModulos = modulos.reduce((s: number, m: any) => s + (m.quantidade || 1), 0);
          const modeloInversor = inversores.length > 0 ? `${inversores[0].fabricante || ""} ${inversores[0].modelo || ""}`.trim() : "";
          const ucs = (snapshot as any).ucs || [];
          const consumoMensal = ucs.reduce((s: number, uc: any) => s + (uc.consumo_mensal || 0), 0);

          const templateVars: Record<string, string> = {
            cliente_nome: leadNome,
            tipo_instalacao: (snapshot as any).tipo_telhado || "",
            potencia_kwp: String(versao.potencia_kwp || 0),
            numero_modulos: String(numModulos),
            modelo_inversor: modeloInversor,
            consumo_mensal: String(consumoMensal),
            geracao_mensal: String(versao.geracao_mensal || 0),
            valor_total: (versao.valor_total || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            economia_mensal: (versao.economia_mensal || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
            payback_meses: String(versao.payback_meses || 0),
            proposta_link: publicUrl,
            empresa_nome: tenant?.nome || "Empresa",
          };

          mensagemFinal = renderTemplate(corpoRaw, templateVars);
        }
      }
    }

    // ── 6. REGISTRAR ENVIO + ATUALIZAR PROPOSTA (paralelo) ──
    await Promise.all([
      adminClient.from("proposta_envios").insert({
        tenant_id: tenantId,
        versao_id,
        token_id: aceiteToken.id,
        canal: canalFinal,
        enviado_por: userId,
        destinatario: null,
        detalhes: { token: aceiteToken.token, public_url: publicUrl },
        mensagem_resumo: mensagemFinal,
      }),
      adminClient.from("propostas_nativas").update({
        status: "enviada",
        enviada_at: new Date().toISOString(),
        enviada_via: canalFinal,
        enviada_por: userId,
        public_token: aceiteToken.token,
        status_visualizacao: "enviado",
      }).eq("id", proposta_id).eq("tenant_id", tenantId),
      adminClient.from("proposta_versoes").update({
        status: "sent",
        enviado_em: new Date().toISOString(),
        public_slug: aceiteToken.token,
      }).eq("id", versao_id).eq("tenant_id", tenantId),
    ]);

    // ── 6b. PROPOSAL EVENT: proposta_enviada ────────────────
    adminClient.from("proposal_events").insert({
      proposta_id,
      tipo: "proposta_enviada",
      payload: {
        versao_id,
        canal: canalFinal,
        token: aceiteToken.token,
        public_url: publicUrl,
        valor_total: versao.valor_total,
        potencia_kwp: versao.potencia_kwp,
      },
      user_id: userId,
      tenant_id: tenantId,
    }).then(({ error: evtErr }) => {
      if (evtErr) console.warn("[proposal-send] Event insert failed:", evtErr.message);
    });

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

    // ── 8. WHATSAPP (best-effort, RB-26: enqueue_wa_outbox_item) ──
    let whatsappSent = false;
    if (canalFinal === "whatsapp") {
      const targetLeadId = lead_id || proposta.lead_id;
      if (targetLeadId) {
        try {
          const { data: lead } = await adminClient
            .from("leads").select("telefone, nome")
            .eq("id", targetLeadId).eq("tenant_id", tenantId).single();

          if (lead?.telefone) {
            // Resolve WA instance for tenant
            const { data: waInstance } = await adminClient
              .from("wa_instances")
              .select("id")
              .eq("tenant_id", tenantId)
              .eq("status", "connected")
              .limit(1)
              .maybeSingle();

            if (waInstance) {
              const mensagem = mensagemFinal || (
                `Olá ${lead.nome || ""}! 🌞\n\n` +
                `Sua proposta solar está pronta!\n\n` +
                `📄 *${proposta.titulo || proposta.codigo || "Proposta Solar"}*\n` +
                `⚡ ${versao.potencia_kwp} kWp | 💰 Economia: R$ ${versao.economia_mensal?.toFixed(2) ?? "—"}/mês\n\n` +
                `🔗 Veja e aceite aqui:\n${publicUrl}\n\n` +
                `${tenant?.nome || "Empresa"} — Energia Solar ☀️`
              );

              const cleanPhone = lead.telefone.replace(/\D/g, "");
              const remoteJid = `${cleanPhone}@s.whatsapp.net`;
              const idempKey = `proposal_send:${tenantId}:${proposta_id}:${aceiteToken.id}`;

              const { error: enqueueErr } = await adminClient.rpc("enqueue_wa_outbox_item", {
                p_tenant_id: tenantId,
                p_instance_id: waInstance.id,
                p_remote_jid: remoteJid,
                p_message_type: "text",
                p_content: mensagem,
                p_idempotency_key: idempKey,
              });

              whatsappSent = !enqueueErr;
              if (enqueueErr) {
                console.error("[proposal-send] WA enqueue failed:", enqueueErr.message);
              }

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
