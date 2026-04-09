import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * PUBLIC edge function — no auth required.
 * Called by the public lead form (/v/slug) after lead creation.
 *
 * 1. Validates lead_id exists and wa_welcome_sent = false
 * 2. Resolves vendedor settings (template, toggle)
 * 3. Calls send-whatsapp-message internally with service_role
 * 4. Sets wa_welcome_sent = true (idempotency)
 *
 * Rate limited to prevent abuse.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // ── RATE LIMITING ──
    const identifier =
      req.headers.get("x-forwarded-for") ||
      req.headers.get("cf-connecting-ip") ||
      "unknown";
    const { data: allowed } = await supabaseAdmin.rpc("check_rate_limit", {
      _function_name: "send-wa-welcome",
      _identifier: identifier,
      _window_seconds: 60,
      _max_requests: 15,
    });
    if (allowed === false) {
      console.warn(`[send-wa-welcome] Rate limited: ${identifier}`);
      return new Response(
        JSON.stringify({ success: false, error: "Rate limit exceeded" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
        }
      );
    }

    // ── PARSE BODY ──
    const body = await req.json().catch(() => null);
    if (!body?.lead_id) {
      return new Response(
        JSON.stringify({ success: false, error: "lead_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { lead_id } = body as { lead_id: string };

    // ── FETCH LEAD (validate + idempotency) ──
    const { data: lead, error: leadErr } = await supabaseAdmin
      .from("leads")
      .select("id, nome, telefone, consultor_id, tenant_id, wa_welcome_sent")
      .eq("id", lead_id)
      .maybeSingle();

    if (leadErr || !lead) {
      console.warn(`[send-wa-welcome] Lead not found: ${lead_id}`);
      return new Response(
        JSON.stringify({ success: false, error: "Lead não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Track if this is a subsequent orcamento (welcome already sent)
    const isNewOrcamento = lead.wa_welcome_sent === true;

    if (!lead.consultor_id) {
      console.warn(`[send-wa-welcome] Lead ${lead_id} has no consultor_id`);
      return new Response(
        JSON.stringify({ success: false, error: "Lead sem consultor associado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!lead.tenant_id) {
      console.error(`[send-wa-welcome] Lead ${lead_id} has no tenant_id`);
      return new Response(
        JSON.stringify({ success: false, error: "Lead sem tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── CONSULTOR SETTINGS ──
    const { data: vendedor } = await supabaseAdmin
      .from("consultores")
      .select("id, nome, settings, user_id")
      .eq("id", lead.consultor_id)
      .maybeSingle();

    if (!vendedor) {
      console.warn(`[send-wa-welcome] Consultor ${lead.consultor_id} not found`);
      return new Response(
        JSON.stringify({ success: false, error: "Consultor não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const settings = (vendedor.settings as Record<string, unknown>) || {};
    if (settings.wa_auto_message_enabled === false) {
      // console.log(`[send-wa-welcome] Auto-message disabled for consultor=${vendedor.id}`);
      await supabaseAdmin
        .from("leads")
        .update({ wa_welcome_status: "skipped" } as any)
        .eq("id", lead_id);
      return new Response(
        JSON.stringify({ success: true, skipped: true, reason: "auto_message_disabled" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── FETCH ORCAMENTO (real data lives here, not in leads) ──
    const { data: orcamento } = await supabaseAdmin
      .from("orcamentos")
      .select("cidade, estado, media_consumo, tipo_telhado, orc_code")
      .eq("lead_id", lead.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const cidade = orcamento?.cidade || "";
    const estado = orcamento?.estado || "";
    const mediaConsumo = orcamento?.media_consumo || null;
    const tipoTelhado = orcamento?.tipo_telhado || "";
    const orcCode = orcamento?.orc_code || "";

    // ── BUILD MESSAGE ──
    const defaultWelcomeTemplate = `Olá, {nome}! 👋

Aqui é {consultor} da *Mais Energia Solar*. Recebemos sua solicitação de orçamento e já estamos preparando uma proposta personalizada para você!

📋 *Dados recebidos:*
{dados}

Em breve enviaremos sua proposta com os melhores equipamentos e condições de pagamento. Qualquer dúvida, estou à disposição! ☀️`;

    const defaultNewOrcamentoTemplate = `Olá, {nome}! 👋

Aqui é {consultor} da *Mais Energia Solar*. Recebemos um *novo pedido de orçamento* ({orc_code}) para você!

📋 *Dados do novo orçamento:*
{dados}

Já estamos analisando e em breve enviaremos sua proposta atualizada. Qualquer dúvida, estou à disposição! ☀️`;

    let template: string;
    if (isNewOrcamento) {
      template = (settings.wa_new_orcamento_template as string) || defaultNewOrcamentoTemplate;
      // console.log(`[send-wa-welcome] Sending NEW ORCAMENTO message for lead=${lead_id}`);
    } else {
      template = (settings.wa_auto_message_template as string) || defaultWelcomeTemplate;
      // console.log(`[send-wa-welcome] Sending WELCOME message for lead=${lead_id}`);
    }

    const firstName = (lead.nome || "").split(" ")[0];
    const location = cidade && estado && cidade !== "N/A" && estado !== "N/A"
      ? `${cidade}/${estado}`
      : (cidade && cidade !== "N/A") ? cidade : (estado && estado !== "N/A") ? estado : "";

    const dadosParts: string[] = [];
    if (location) dadosParts.push(`📍 Localização: ${location}`);
    if (mediaConsumo && mediaConsumo > 0) dadosParts.push(`⚡ Consumo médio: ${mediaConsumo} kWh/mês`);
    if (tipoTelhado && tipoTelhado !== "N/A") dadosParts.push(`🏠 Tipo de telhado: ${tipoTelhado}`);
    const dadosStr = dadosParts.length > 0 ? dadosParts.join("\n") : "Dados em análise";

    // Use shared resolver for variable substitution
    const { resolveWaTemplate } = await import("../_shared/resolveWaTemplate.ts");
    const mensagem = resolveWaTemplate(template, {
      nome: firstName,
      consultor: vendedor.nome || "a equipe",
      dados: dadosStr,
      cidade: cidade !== "N/A" ? cidade : "",
      estado: estado !== "N/A" ? estado : "",
      consumo: mediaConsumo ? `${mediaConsumo}` : "",
      tipo_telhado: tipoTelhado !== "N/A" ? tipoTelhado : "",
      orc_code: orcCode,
    });

    // ── CALL send-whatsapp-message with service_role ──
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const sendRes = await fetch(`${supabaseUrl}/functions/v1/send-whatsapp-message`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({
        telefone: lead.telefone,
        mensagem,
        lead_id: lead.id,
        tipo: "automatico",
        tenant_id: lead.tenant_id,
      }),
    });

    const sendResult = await sendRes.json().catch(() => null);
    // console.log(`[send-wa-welcome] send-whatsapp-message response:`, JSON.stringify(sendResult));

    if (sendResult?.success) {
      // Mark as sent
      const updateData: Record<string, unknown> = { wa_welcome_status: "sent" };
      if (!isNewOrcamento) {
        updateData.wa_welcome_sent = true;
      }
      await supabaseAdmin
        .from("leads")
        .update(updateData as any)
        .eq("id", lead_id);

      const msgType = isNewOrcamento ? "new_orcamento" : "welcome";
      // console.log(`[send-wa-welcome] ✅ ${msgType} sent for lead=${lead_id}`);
      return new Response(
        JSON.stringify({
          success: true,
          conversation_id: sendResult.conversation_id || null,
          message_saved: sendResult.message_saved || false,
          tag_applied: sendResult.tag_applied || false,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── FAILED: record the error ──
    const errorMsg = sendResult?.error || "Falha no envio";
    console.warn(`[send-wa-welcome] Send failed for lead=${lead_id}:`, sendResult);
    await supabaseAdmin
      .from("leads")
      .update({ wa_welcome_status: "failed", wa_welcome_error: errorMsg } as any)
      .eq("id", lead_id);

    return new Response(
      JSON.stringify({ success: false, error: errorMsg }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-wa-welcome] Unhandled error:", error);
    // Try to record failure on the lead
    try {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      const body2 = await req.clone().json().catch(() => null);
      if (body2?.lead_id) {
        await supabaseAdmin
          .from("leads")
          .update({ wa_welcome_status: "failed", wa_welcome_error: error?.message || "Erro interno" } as any)
          .eq("id", body2.lead_id);
      }
    } catch { /* ignore */ }
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
