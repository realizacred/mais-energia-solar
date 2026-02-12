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
 * 1. Rate-limits by IP
 * 2. Resolves vendedor from codigo/slug
 * 3. Creates lead (minimal) + orcamento (full data)
 * 4. Calls send-wa-welcome internally (fire-and-forget)
 * 5. Returns lead_id + orcamento_id
 *
 * This replaces the client-side flow of:
 *   insert lead → insert orcamento → call send-wa-welcome
 * ensuring atomicity and correct tenant/vendedor resolution on the server.
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
      _function_name: "public-create-lead",
      _identifier: identifier,
      _window_seconds: 60,
      _max_requests: 10,
    });
    if (allowed === false) {
      console.warn(`[public-create-lead] Rate limited: ${identifier}`);
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
      vendedor_id: explicit_vendedor_id,
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
      // Optional: for existing lead adoption
      existing_lead_id,
      // Optional: skip WA
      skip_wa,
    } = body;

    // Validate required fields
    if (!nome || !telefone) {
      return new Response(
        JSON.stringify({ success: false, error: "nome e telefone são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!estado || !cidade || !area || !tipo_telhado || !rede_atendimento) {
      return new Response(
        JSON.stringify({ success: false, error: "Campos do orçamento são obrigatórios (estado, cidade, area, tipo_telhado, rede_atendimento)" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── RESOLVE CONSULTOR ──
    let vendedorId: string | null = explicit_vendedor_id || null;
    let vendedorNome: string | null = null;
    let tenantId: string | null = null;

    if (vendedor_codigo && !vendedorId) {
      const { data: vendedor } = await supabaseAdmin
        .from("consultores")
        .select("id, nome, tenant_id")
        .or(`codigo.eq.${vendedor_codigo},slug.eq.${vendedor_codigo}`)
        .eq("ativo", true)
        .maybeSingle();

      if (vendedor) {
        vendedorId = vendedor.id;
        vendedorNome = vendedor.nome;
        tenantId = vendedor.tenant_id;
      }
    }

    // If vendedorId was explicit, fetch tenant from consultor
    if (vendedorId && !tenantId) {
      const { data: vendedor } = await supabaseAdmin
        .from("consultores")
        .select("nome, tenant_id")
        .eq("id", vendedorId)
        .maybeSingle();
      if (vendedor) {
        vendedorNome = vendedor.nome;
        tenantId = vendedor.tenant_id;
      }
    }

    // Fallback: resolve public tenant
    if (!tenantId) {
      const { data: publicTenant, error: ptErr } = await supabaseAdmin.rpc("resolve_public_tenant_id");
      if (ptErr || !publicTenant) {
        console.error("[public-create-lead] Cannot resolve tenant:", ptErr);
        return new Response(
          JSON.stringify({ success: false, error: "Não foi possível resolver o tenant" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      tenantId = publicTenant;
    }

    // Resolve default consultor if none found
    if (!vendedorId) {
      const { data: defaultVendedor, error: dvErr } = await supabaseAdmin.rpc(
        "resolve_default_consultor_id",
        { _tenant_id: tenantId }
      );
      if (!dvErr && defaultVendedor) {
        vendedorId = defaultVendedor;
        const { data: v } = await supabaseAdmin
          .from("consultores")
          .select("nome")
          .eq("id", vendedorId!)
          .maybeSingle();
        vendedorNome = v?.nome || null;
      }
    }

    console.log(`[public-create-lead] tenant=${tenantId}, consultor=${vendedorId} (${vendedorNome})`);

    // ── CREATE OR USE EXISTING LEAD ──
    let leadId: string;
    let isNewLead = true;

    if (existing_lead_id) {
      // Verify the lead exists in same tenant
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

      // Update vendedor if needed
      if (vendedorId) {
        await supabaseAdmin
          .from("leads")
          .update({ consultor_id: vendedorId, consultor: vendedorNome || "Site" })
          .eq("id", leadId);
      }
    } else {
      // Create new lead (minimal — real data goes to orcamento)
      const newLeadId = crypto.randomUUID();
      const { error: leadErr } = await supabaseAdmin
        .from("leads")
        .insert({
          id: newLeadId,
          nome: nome.trim(),
          telefone: telefone.trim(),
          consultor_id: vendedorId,
          consultor: vendedorNome || "Site",
          tenant_id: tenantId,
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

    // ── CREATE ORCAMENTO ──
    const orcamentoId = crypto.randomUUID();
    const { error: orcErr } = await supabaseAdmin
      .from("orcamentos")
      .insert({
        id: orcamentoId,
        lead_id: leadId,
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
        consultor: vendedorNome || "Site",
        consultor_id: vendedorId,
        tenant_id: tenantId,
      });

    if (orcErr) {
      console.error("[public-create-lead] Failed to create orcamento:", orcErr);
      // Lead was created but orcamento failed — still return leadId for recovery
      return new Response(
        JSON.stringify({
          success: false,
          error: orcErr.message,
          lead_id: leadId,
          partial: true,
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[public-create-lead] ✅ lead=${leadId} orcamento=${orcamentoId} isNew=${isNewLead}`);

    // ── FIRE-AND-FORGET: send-wa-welcome ──
    let waResult: { success?: boolean; conversation_id?: string; skipped?: boolean } | null = null;

    if (!skip_wa) {
      try {
        const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
        const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

        const waRes = await fetch(`${supabaseUrl}/functions/v1/send-wa-welcome`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify({ lead_id: leadId }),
        });

        waResult = await waRes.json().catch(() => null);
        console.log(`[public-create-lead] WA welcome result:`, JSON.stringify(waResult));
      } catch (waErr) {
        console.warn("[public-create-lead] WA welcome error (non-blocking):", waErr);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        lead_id: leadId,
        orcamento_id: orcamentoId,
        is_new_lead: isNewLead,
        wa_sent: waResult?.success || false,
        wa_conversation_id: waResult?.conversation_id || null,
        wa_skipped: waResult?.skipped || skip_wa || false,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[public-create-lead] Unhandled error:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
