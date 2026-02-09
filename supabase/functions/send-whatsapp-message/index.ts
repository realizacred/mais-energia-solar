import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface SendMessageRequest {
  telefone: string;
  mensagem: string;
  lead_id?: string;
  tipo?: "automatico" | "manual" | "lembrete";
  instance_id?: string;
  tenant_id?: string; // callers MUST pass for service_role context
}

/**
 * AUTH MODEL: "auth required" — NOT a public webhook.
 * - Regular users: JWT validated via getClaims()
 * - Internal callers (automations): service_role key accepted, but tenant_id MUST be in body
 * 
 * TENANT RESOLUTION (deterministic, no blind fallback):
 * 1. body.tenant_id (explicit — required for service_role)
 * 2. User profile (regular JWT)
 * 3. Lead record (if lead_id provided)
 * 4. FAIL — never uses wa_config as blind fallback
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ===== RATE LIMITING =====
    const identifier = req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    const supabaseRL = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await supabaseRL.rpc("check_rate_limit", {
      _function_name: "send-whatsapp-message",
      _identifier: identifier,
      _window_seconds: 60,
      _max_requests: 60, // internal calls can be higher
    });
    if (allowed === false) {
      console.warn(`[send-wa] Rate limited: ${identifier}`);
      return new Response(JSON.stringify({ success: false, error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    // ===== STAGING GUARD =====
    const isStaging = Deno.env.get("IS_STAGING") === "true";
    if (isStaging) {
      console.warn("[STAGING] WhatsApp send BLOCKED — ambiente de staging");
      return new Response(JSON.stringify({
        success: true,
        staging: true,
        message: "[STAGING] Mensagem NÃO enviada — ambiente de staging",
        results: [{ method: "staging-mock", success: true }],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── AUTH ──────────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = token === serviceRoleKey;

    let userId: string | null = null;

    if (!isServiceRole) {
      const supabaseUser = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: authHeader } } }
      );
      const { data: claimsData, error: claimsError } = await supabaseUser.auth.getClaims(token);
      if (claimsError || !claimsData?.claims) {
        return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      userId = claimsData.claims.sub as string;
    }

    const body = (await req.json().catch(() => null)) as SendMessageRequest | null;
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: "Body inválido" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { telefone, mensagem, lead_id, tipo = "manual", instance_id } = body;

    if (!telefone || !mensagem) {
      return new Response(
        JSON.stringify({ success: false, error: "Telefone e mensagem são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── TENANT RESOLUTION (deterministic — NO blind fallback) ──
    let tenantId: string | null = null;
    let tenantSource = "";

    // Strategy 1: Explicit tenant_id in body (REQUIRED for service_role callers)
    if (body.tenant_id) {
      // Validate that this tenant exists
      const { data: tenantRow } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("id", body.tenant_id)
        .eq("ativo", true)
        .maybeSingle();
      if (tenantRow) {
        tenantId = tenantRow.id;
        tenantSource = "body.tenant_id";
      } else {
        // HARD FAIL: explicit tenant_id was provided but is invalid — do NOT fallback
        console.error(`[send-wa] BLOCKED: body.tenant_id=${body.tenant_id} not found or inactive`);
        return new Response(
          JSON.stringify({ success: false, error: "Tenant inválido ou inativo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Strategy 2: From user profile (regular JWT user)
    if (!tenantId && userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();
      if (profile?.tenant_id) {
        tenantId = profile.tenant_id;
        tenantSource = "user_profile";
      }
    }

    // Strategy 3: From lead record (if lead_id provided)
    if (!tenantId && lead_id) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("tenant_id")
        .eq("id", lead_id)
        .maybeSingle();
      if (lead?.tenant_id) {
        tenantId = lead.tenant_id;
        tenantSource = "lead";
      }
    }

    // NO Strategy 4 — we do NOT blindly query wa_config without tenant filter
    // service_role callers MUST pass tenant_id in body

    if (!tenantId) {
      const reason = isServiceRole
        ? "service_role call sem tenant_id no body — obrigatório"
        : "Usuário sem tenant_id no profile";
      console.error(`[send-wa] BLOCKED: tenant não resolvido. Reason: ${reason}`);
      return new Response(
        JSON.stringify({ success: false, error: `Tenant não resolvido: ${reason}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[send-wa] tenant=${tenantId} via ${tenantSource}`);

    // ── FETCH CONFIG (scoped by resolved tenant) ──────────────
    const { data: config, error: configError } = await supabaseAdmin
      .from("whatsapp_automation_config")
      .select("ativo, modo_envio, webhook_url, api_token, evolution_api_url, evolution_api_key, evolution_instance")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (configError) {
      console.error("[send-wa] Config fetch error:", configError);
      return new Response(JSON.stringify({ success: false, error: "Erro ao buscar configuração de WhatsApp" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config) {
      console.warn(`[send-wa] No wa_config for tenant=${tenantId}`);
      return new Response(JSON.stringify({ success: false, error: "Configuração de WhatsApp não encontrada para este tenant." }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config.ativo) {
      return new Response(JSON.stringify({ success: false, error: "Automação de WhatsApp está desativada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── SEND MESSAGE ──────────────────────────────────────────
    let formattedPhone = telefone.replace(/\D/g, "");
    if (!formattedPhone.startsWith("55")) {
      formattedPhone = `55${formattedPhone}`;
    }

    const results: Array<{ method: "webhook" | "evolution"; success: boolean; error?: string }> = [];
    const globalApiKey = Deno.env.get("EVOLUTION_API_KEY") || "";

    // Webhook
    if ((config.modo_envio === "webhook" || config.modo_envio === "ambos") && config.webhook_url) {
      try {
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (config.api_token) headers["Authorization"] = `Bearer ${config.api_token}`;

        const webhookRes = await fetch(config.webhook_url, {
          method: "POST",
          headers,
          body: JSON.stringify({
            telefone: formattedPhone,
            mensagem,
            lead_id,
            tipo,
            timestamp: new Date().toISOString(),
          }),
        });

        await webhookRes.text().catch(() => null);

        results.push({
          method: "webhook",
          success: webhookRes.ok,
          error: webhookRes.ok ? undefined : `Status: ${webhookRes.status}`,
        });
      } catch (e: any) {
        console.error("[send-wa] Webhook error:", e);
        results.push({ method: "webhook", success: false, error: e?.message || String(e) });
      }
    }

    // Evolution API
    if (config.modo_envio === "evolution" || config.modo_envio === "ambos") {
      let evoApiUrl = "";
      let evoApiKey = globalApiKey;
      let evoInstance = "";

      const instanceKey = instance_id || config.evolution_instance;
      if (instanceKey) {
        let waQuery = supabaseAdmin.from("wa_instances").select("*");
        
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instanceKey);
        if (isUuid) {
          waQuery = waQuery.eq("id", instanceKey);
        } else {
          waQuery = waQuery.eq("evolution_instance_key", instanceKey);
        }

        // CRITICAL: scope wa_instances by tenant
        const { data: waInst } = await waQuery.eq("tenant_id", tenantId).maybeSingle();

        if (waInst) {
          evoApiUrl = waInst.evolution_api_url?.replace(/\/$/, "") || "";
          evoInstance = waInst.evolution_instance_key;
          // Use instance-specific API key with global fallback
          if (waInst.api_key) {
            evoApiKey = waInst.api_key;
          }
          console.log(`[send-wa] Using wa_instance: ${waInst.nome} (${evoInstance})`);
        }
      }

      // Fallback to config fields
      if (!evoApiUrl && config.evolution_api_url) {
        evoApiUrl = config.evolution_api_url.replace(/\/$/, "");
        evoInstance = config.evolution_instance || "";
        if (config.evolution_api_key) {
          evoApiKey = config.evolution_api_key;
        }
        console.log(`[send-wa] Fallback to config: instance=${evoInstance}`);
      }

      if (evoApiUrl && evoInstance) {
        try {
          const sendUrl = `${evoApiUrl}/message/sendText/${encodeURIComponent(evoInstance)}`;
          console.log(`[send-wa] Sending to: ${sendUrl}`);

          const evoRes = await fetch(sendUrl, {
            method: "POST",
            headers: {
              apikey: evoApiKey,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              number: formattedPhone,
              text: mensagem,
            }),
          });

          const evoText = await evoRes.text();

          results.push({
            method: "evolution",
            success: evoRes.ok,
            error: evoRes.ok ? undefined : evoText || `Status: ${evoRes.status}`,
          });
        } catch (e: any) {
          console.error("[send-wa] Evolution error:", e);
          results.push({ method: "evolution", success: false, error: e?.message || String(e) });
        }
      } else {
        console.warn("[send-wa] Evolution API not configured");
        results.push({ method: "evolution", success: false, error: "Instância não configurada" });
      }
    }

    const anySuccess = results.some((r) => r.success);
    const status = anySuccess ? "enviado" : "erro";

    // ── LOG (explicit tenant_id) ──────────────────────────────
    const { error: logError } = await supabaseAdmin.from("whatsapp_messages").insert({
      lead_id: lead_id || null,
      tipo,
      mensagem,
      telefone: formattedPhone,
      status,
      erro_detalhes: anySuccess ? null : JSON.stringify(results),
      enviado_por: userId || null,
      tenant_id: tenantId, // ← EXPLICIT, deterministic
    });

    if (logError) console.warn("[send-wa] Log insert failed:", logError);

    if (results.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Nenhum método de envio configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-wa] Done tenant=${tenantId} src=${tenantSource}: ${results.length} methods, anySuccess=${anySuccess}`);

    return new Response(
      JSON.stringify({
        success: anySuccess,
        results,
        message: anySuccess ? "Mensagem enviada com sucesso" : "Falha ao enviar mensagem",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[send-wa] Unhandled error:", error);
    return new Response(JSON.stringify({ success: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
