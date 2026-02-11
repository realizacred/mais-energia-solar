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
 * INSTANCE ROUTING (priority order):
 * 1. body.instance_id (explicit — caller knows which instance)
 * 2. Vendor's linked instance via wa_instance_vendedores junction table
 * 3. config.evolution_instance (legacy fallback from whatsapp_automation_config)
 * 4. First active instance of the tenant
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
      _max_requests: 60,
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

    console.log(`[send-wa] tenant=${tenantId} via ${tenantSource}, userId=${userId || "service_role"}`);

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

    // ── INSTANCE ROUTING (smart selection) ────────────────────
    // Priority:
    // 1. Explicit instance_id from request body
    // 2. Vendor's linked instance (via wa_instance_vendedores junction)
    // 3. config.evolution_instance (legacy)
    // 4. First active instance of tenant
    let resolvedInstance: { id: string; evolution_api_url: string; evolution_instance_key: string; api_key: string | null } | null = null;
    let instanceSource = "";

    // Priority 1: Explicit instance_id
    if (instance_id) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instance_id);
      let q = supabaseAdmin.from("wa_instances").select("id, evolution_api_url, evolution_instance_key, api_key").eq("tenant_id", tenantId);
      if (isUuid) {
        q = q.eq("id", instance_id);
      } else {
        q = q.eq("evolution_instance_key", instance_id);
      }
      const { data: inst } = await q.maybeSingle();
      if (inst) {
        resolvedInstance = inst;
        instanceSource = "body.instance_id";
      }
    }

    // Priority 2: Vendor's linked instance via junction table
    if (!resolvedInstance && userId) {
      // Find vendedor linked to this user
      const { data: vendedor } = await supabaseAdmin
        .from("vendedores")
        .select("id")
        .eq("user_id", userId)
        .eq("ativo", true)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (vendedor) {
        // Check junction table for linked instances
        const { data: links } = await supabaseAdmin
          .from("wa_instance_vendedores")
          .select("instance_id, wa_instances:instance_id(id, evolution_api_url, evolution_instance_key, api_key, status)")
          .eq("vendedor_id", vendedor.id)
          .eq("tenant_id", tenantId);

        if (links && links.length > 0) {
          // Prefer connected instance, fallback to first
          const connected = links.find((l: any) => (l.wa_instances as any)?.status === "connected");
          const chosen = connected || links[0];
          const inst = (chosen as any).wa_instances;
          if (inst) {
            resolvedInstance = {
              id: inst.id,
              evolution_api_url: inst.evolution_api_url,
              evolution_instance_key: inst.evolution_instance_key,
              api_key: inst.api_key,
            };
            instanceSource = "vendor_junction";
            console.log(`[send-wa] Routed to vendor's instance: ${inst.evolution_instance_key} (${connected ? "connected" : "first-link"})`);
          }
        }
      }
    }

    // Priority 3: Legacy config.evolution_instance
    if (!resolvedInstance && config.evolution_instance) {
      const { data: inst } = await supabaseAdmin
        .from("wa_instances")
        .select("id, evolution_api_url, evolution_instance_key, api_key")
        .eq("evolution_instance_key", config.evolution_instance)
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (inst) {
        resolvedInstance = inst;
        instanceSource = "config.evolution_instance";
      }
    }

    // Priority 4: First active instance of tenant
    if (!resolvedInstance) {
      const { data: inst } = await supabaseAdmin
        .from("wa_instances")
        .select("id, evolution_api_url, evolution_instance_key, api_key")
        .eq("tenant_id", tenantId)
        .eq("status", "connected")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (inst) {
        resolvedInstance = inst;
        instanceSource = "first_active_tenant_instance";
      }
    }

    console.log(`[send-wa] Instance resolved: ${resolvedInstance?.evolution_instance_key || "NONE"} via ${instanceSource}`);

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
      if (resolvedInstance) {
        const evoApiUrl = resolvedInstance.evolution_api_url?.replace(/\/$/, "") || "";
        const evoInstance = resolvedInstance.evolution_instance_key;
        const evoApiKey = resolvedInstance.api_key || globalApiKey;

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
          console.warn("[send-wa] Instance resolved but missing API URL or key");
          results.push({ method: "evolution", success: false, error: "Instância sem URL ou chave configurada" });
        }
      } else {
        // Legacy fallback to config fields (no wa_instances match)
        let evoApiUrl = "";
        let evoApiKey = globalApiKey;
        let evoInstance = "";

        if (config.evolution_api_url) {
          evoApiUrl = config.evolution_api_url.replace(/\/$/, "");
          evoInstance = config.evolution_instance || "";
          if (config.evolution_api_key) evoApiKey = config.evolution_api_key;
          console.log(`[send-wa] Legacy config fallback: instance=${evoInstance}`);
        }

        if (evoApiUrl && evoInstance) {
          try {
            const sendUrl = `${evoApiUrl}/message/sendText/${encodeURIComponent(evoInstance)}`;
            const evoRes = await fetch(sendUrl, {
              method: "POST",
              headers: { apikey: evoApiKey, "Content-Type": "application/json" },
              body: JSON.stringify({ number: formattedPhone, text: mensagem }),
            });
            const evoText = await evoRes.text();
            results.push({
              method: "evolution",
              success: evoRes.ok,
              error: evoRes.ok ? undefined : evoText || `Status: ${evoRes.status}`,
            });
          } catch (e: any) {
            results.push({ method: "evolution", success: false, error: e?.message || String(e) });
          }
        } else {
          console.warn("[send-wa] Evolution API not configured");
          results.push({ method: "evolution", success: false, error: "Instância não configurada" });
        }
      }
    }

    const anySuccess = results.some((r) => r.success);
    const status = anySuccess ? "enviado" : "erro";

    // ── LOG (explicit tenant_id + instance_id) ────────────────
    const { error: logError } = await supabaseAdmin.from("whatsapp_automation_logs").insert({
      lead_id: lead_id || null,
      telefone: formattedPhone,
      mensagem_enviada: mensagem,
      status,
      erro_detalhes: anySuccess ? null : JSON.stringify(results),
      tenant_id: tenantId,
      instance_id: resolvedInstance?.id || null,
    });

    if (logError) console.warn("[send-wa] Log insert failed (non-blocking):", logError);

    if (results.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Nenhum método de envio configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-wa] Done tenant=${tenantId} src=${tenantSource} instance=${resolvedInstance?.evolution_instance_key || "NONE"} via=${instanceSource}: ${results.length} methods, anySuccess=${anySuccess}`);

    return new Response(
      JSON.stringify({
        success: anySuccess,
        results,
        instance_used: resolvedInstance?.evolution_instance_key || null,
        instance_source: instanceSource,
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
