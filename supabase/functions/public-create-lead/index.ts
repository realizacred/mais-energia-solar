import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * PUBLIC edge function — no auth required.
 * Unified server-side lead creation for public forms (/v/slug).
 *
 * SECURITY INVARIANTS:
 * - vendedor_codigo is MANDATORY (no implicit tenant resolution)
 * - vendedor_id from client payload is IGNORED (anti-IDOR)
 * - No calls to resolve_public_tenant_id without code
 * - No calls to resolve_default_consultor_id
 * - All attempts are audited in security_events
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  // Utility: hash for audit (no raw PII in logs)
  const hashForAudit = async (value: string): Promise<string> => {
    const encoder = new TextEncoder();
    const data = encoder.encode(value + "sec_salt_2024");
    const hashBuffer = await crypto.subtle.digest("SHA-256", data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
  };

  const ipRaw =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("cf-connecting-ip") ||
    "unknown";
  const userAgentRaw = req.headers.get("user-agent") || "unknown";

  // Audit helper
  const logSecurityEvent = async (
    eventType: string,
    success: boolean,
    consultorCode: string | null,
    tenantId: string | null,
    details: Record<string, unknown> = {}
  ) => {
    try {
      await supabaseAdmin.from("security_events").insert({
        event_type: eventType,
        ip_hash: await hashForAudit(ipRaw),
        user_agent_hash: await hashForAudit(userAgentRaw),
        path: "/functions/v1/public-create-lead",
        consultor_code_hash: consultorCode ? await hashForAudit(consultorCode) : null,
        success,
        tenant_id: tenantId,
        details,
      });
    } catch (e) {
      console.error("[security_events] Failed to log:", e);
    }
  };

  try {
    // ── RATE LIMITING ──
    const { data: allowed } = await supabaseAdmin.rpc("check_rate_limit", {
      _function_name: "public-create-lead",
      _identifier: await hashForAudit(ipRaw),
      _window_seconds: 60,
      _max_requests: 10,
    });
    if (allowed === false) {
      await logSecurityEvent("RATE_LIMITED", false, null, null);
      return new Response(
        JSON.stringify({ success: false, error: "Tente novamente em alguns minutos" }),
        {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
        }
      );
    }

    // ── PARSE BODY ──
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(
        JSON.stringify({ success: false, error: "Body inválido" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const {
      nome,
      telefone,
      vendedor_codigo,
      // vendedor_id is INTENTIONALLY IGNORED (anti-IDOR)
      // Orcamento fields
      cep,
      estado,
      cidade,
      rua,
      numero,
      bairro,
      complemento,
      area,
      tipo_telhado,
      rede_atendimento,
      media_consumo,
      consumo_previsto,
      observacoes,
      arquivos_urls,
      existing_lead_id,
      skip_wa,
      origem,
    } = body;

    // ── VALIDATE REQUIRED: vendedor_codigo ──
    if (!vendedor_codigo || typeof vendedor_codigo !== "string" || vendedor_codigo.trim() === "") {
      await logSecurityEvent("MISSING_CONSULTOR_CODE", false, null, null, { has_nome: !!nome });
      return new Response(
        JSON.stringify({ success: false, error: "Link inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!nome || !telefone) {
      return new Response(
        JSON.stringify({ success: false, error: "nome e telefone são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const missingFields: string[] = [];
    if (!estado) missingFields.push("Estado");
    if (!cidade) missingFields.push("Cidade");
    if (!area) missingFields.push("Área");
    if (!tipo_telhado) missingFields.push("Tipo de Telhado");
    if (!rede_atendimento) missingFields.push("Rede de Atendimento");
    if (missingFields.length > 0) {
      console.warn("[public-create-lead] Missing fields:", missingFields.join(", "));
      return new Response(
        JSON.stringify({ success: false, error: `Campos obrigatórios não preenchidos: ${missingFields.join(", ")}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RESOLVE CONSULTOR (DETERMINISTIC — no fallback) ──
    const { data: consultor } = await supabaseAdmin
      .from("consultores")
      .select("id, nome, tenant_id")
      .or(`codigo.eq.${vendedor_codigo.trim()},slug.eq.${vendedor_codigo.trim()}`)
      .eq("ativo", true)
      .maybeSingle();

    if (!consultor) {
      await logSecurityEvent("INVALID_CONSULTOR_LINK_ATTEMPT", false, vendedor_codigo, null);
      return new Response(
        JSON.stringify({ success: false, error: "Link inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const vendedorId = consultor.id;
    const vendedorNome = consultor.nome;
    const tenantId = consultor.tenant_id;

    // Verify tenant is active
    const { data: tenantActive } = await supabaseAdmin.rpc("is_tenant_active", { _tenant_id: tenantId });
    if (!tenantActive) {
      await logSecurityEvent("INACTIVE_TENANT_ATTEMPT", false, vendedor_codigo, tenantId);
      return new Response(
        JSON.stringify({ success: false, error: "Link inválido ou expirado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[public-create-lead] tenant=${tenantId}, consultor=${vendedorId} (${vendedorNome})`);

    // ── CHECK FOR DUPLICATE LEADS BY PHONE ──
    let leadId: string;
    let isNewLead = true;

    if (existing_lead_id) {
      const { data: existingLead } = await supabaseAdmin
        .from("leads")
        .select("id, tenant_id")
        .eq("id", existing_lead_id)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (!existingLead) {
        return new Response(
          JSON.stringify({ success: false, error: "Lead existente não encontrado" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      leadId = existingLead.id;
      isNewLead = false;

      await supabaseAdmin
        .from("leads")
        .update({ consultor_id: vendedorId, consultor: vendedorNome })
        .eq("id", leadId);
    } else {
      const phoneNormalized = telefone.replace(/\D/g, "");
      if (phoneNormalized.length >= 10) {
        const { data: existingLeads } = await supabaseAdmin
          .from("leads")
          .select("id, nome, telefone, created_at")
          .eq("tenant_id", tenantId)
          .or(`telefone_normalized.eq.${phoneNormalized},telefone.eq.${telefone}`)
          .order("created_at", { ascending: false })
          .limit(5);

        if (existingLeads && existingLeads.length > 0) {
          leadId = existingLeads[0].id;
          isNewLead = false;

          await supabaseAdmin
            .from("leads")
            .update({ consultor_id: vendedorId, consultor: vendedorNome })
            .eq("id", leadId);
        }
      }

      if (isNewLead) {
        const newLeadId = crypto.randomUUID();
        const { error: leadErr } = await supabaseAdmin
          .from("leads")
          .insert({
            id: newLeadId,
            nome: nome.trim(),
            telefone: telefone.trim(),
            consultor_id: vendedorId,
            consultor: vendedorNome,
            tenant_id: tenantId,
            origem: origem || null,
            estado: "N/A",
            cidade: "N/A",
            area: "N/A",
            tipo_telhado: "N/A",
            rede_atendimento: "N/A",
            media_consumo: 0,
            consumo_previsto: 0,
          });

        if (leadErr) {
          console.error("[public-create-lead] Failed to create lead:", leadErr);
          return new Response(
            JSON.stringify({ success: false, error: leadErr.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        leadId = newLeadId;
      }
    }

    // ── CREATE ORCAMENTO ──
    const orcamentoId = crypto.randomUUID();
    const { error: orcErr } = await supabaseAdmin
      .from("orcamentos")
      .insert({
        id: orcamentoId,
        lead_id: leadId!,
        cep: cep || null,
        estado,
        cidade: cidade.trim(),
        bairro: bairro || null,
        rua: rua || null,
        numero: numero || null,
        complemento: complemento || null,
        area,
        tipo_telhado,
        rede_atendimento,
        media_consumo: media_consumo || 0,
        consumo_previsto: consumo_previsto || 0,
        observacoes: observacoes || null,
        arquivos_urls: arquivos_urls || [],
        consultor: vendedorNome,
        consultor_id: vendedorId,
        tenant_id: tenantId,
      });

    if (orcErr) {
      console.error("[public-create-lead] Failed to create orcamento:", orcErr);
      return new Response(
        JSON.stringify({
          success: false,
          error: orcErr.message,
          lead_id: leadId!,
          partial: true,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── AUDIT: successful lead creation (non-blocking) ──
    logSecurityEvent("LEAD_CREATED_PUBLIC", true, vendedor_codigo, tenantId, {
      lead_id: leadId!,
      is_new: isNewLead,
    }).catch((e) => console.warn("[audit] non-critical:", e));

    console.log(`[public-create-lead] ✅ lead=${leadId} orcamento=${orcamentoId} isNew=${isNewLead}`);

    // ── FIRE-AND-FORGET: send-wa-welcome (truly non-blocking) ──
    if (!skip_wa) {
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

      fetch(`${supabaseUrl}/functions/v1/send-wa-welcome`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceRoleKey}`,
        },
        body: JSON.stringify({ lead_id: leadId! }),
      })
        .then((r) => r.json().catch(() => null))
        .then((result) => console.log(`[public-create-lead] WA welcome result:`, JSON.stringify(result)))
        .catch((waErr) => console.warn("[public-create-lead] WA welcome error (non-blocking):", waErr));
    }

    // ── RETURN IMMEDIATELY — no waiting for WA ──
    return new Response(
      JSON.stringify({
        success: true,
        lead_id: leadId!,
        orcamento_id: orcamentoId,
        is_new_lead: isNewLead,
        wa_sent: !skip_wa, // optimistic — WA is being sent in background
        wa_conversation_id: null,
        wa_skipped: skip_wa || false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error("[public-create-lead] Unhandled error:", errMsg);
    return new Response(
      JSON.stringify({ success: false, error: "Erro interno do servidor" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
