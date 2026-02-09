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
  tenant_id?: string; // ← callers can pass explicitly (e.g. automations)
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    // Auth
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

    // Determine if caller is a real user or service_role
    const token = authHeader.replace("Bearer ", "");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isServiceRole = token === serviceRoleKey;

    let userId: string | null = null;

    if (!isServiceRole) {
      // Regular user — validate JWT
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

    // ── TENANT RESOLUTION (multi-source) ──────────────────────
    let tenantId: string | null = body.tenant_id || null;

    // Strategy 1: From user profile (regular user)
    if (!tenantId && userId) {
      const { data: profile } = await supabaseAdmin
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userId)
        .maybeSingle();
      tenantId = profile?.tenant_id || null;
      if (tenantId) console.log(`[send-wa] tenant from user profile: ${tenantId}`);
    }

    // Strategy 2: From lead (if lead_id provided)
    if (!tenantId && lead_id) {
      const { data: lead } = await supabaseAdmin
        .from("leads")
        .select("tenant_id")
        .eq("id", lead_id)
        .maybeSingle();
      tenantId = lead?.tenant_id || null;
      if (tenantId) console.log(`[send-wa] tenant from lead: ${tenantId}`);
    }

    // Strategy 3: From whatsapp_automation_config (system-level fallback)
    if (!tenantId) {
      const { data: waConfig } = await supabaseAdmin
        .from("whatsapp_automation_config")
        .select("tenant_id")
        .maybeSingle();
      tenantId = waConfig?.tenant_id || null;
      if (tenantId) console.log(`[send-wa] tenant from wa_config: ${tenantId}`);
    }

    if (!tenantId) {
      console.error("[send-wa] CRITICAL: Could not resolve tenant_id from any source");
      return new Response(
        JSON.stringify({ success: false, error: "Tenant não resolvido. Operação bloqueada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Busca config (service role — RLS blocks vendedores)
    const { data: config, error: configError } = await supabaseAdmin
      .from("whatsapp_automation_config")
      .select("ativo, modo_envio, webhook_url, api_token, evolution_api_url, evolution_api_key, evolution_instance, tenant_id")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (configError) {
      console.error("Error fetching WhatsApp config:", configError);
      return new Response(JSON.stringify({ success: false, error: "Erro ao buscar configuração de WhatsApp" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config) {
      console.warn("WhatsApp config not found for tenant:", tenantId);
      return new Response(JSON.stringify({ success: false, error: "Configuração de WhatsApp não encontrada." }), {
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

    // Normaliza telefone
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
        console.error("Webhook error:", e);
        results.push({ method: "webhook", success: false, error: e?.message || String(e) });
      }
    }

    // Evolution API — resolve connection details from wa_instances or config
    if (config.modo_envio === "evolution" || config.modo_envio === "ambos") {
      let evoApiUrl = "";
      let evoApiKey = globalApiKey;
      let evoInstance = "";

      // Try to resolve from wa_instances first
      const instanceKey = instance_id || config.evolution_instance;
      if (instanceKey) {
        let waQuery = supabaseAdmin.from("wa_instances").select("*");
        
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instanceKey);
        if (isUuid) {
          waQuery = waQuery.eq("id", instanceKey);
        } else {
          waQuery = waQuery.eq("evolution_instance_key", instanceKey);
        }

        const { data: waInst } = await waQuery.eq("tenant_id", tenantId).maybeSingle();

        if (waInst) {
          evoApiUrl = waInst.evolution_api_url?.replace(/\/$/, "") || "";
          evoInstance = waInst.evolution_instance_key;
          console.log(`Using wa_instance: ${waInst.nome} (${evoInstance})`);
        }
      }

      // Fallback to config fields if wa_instance not found
      if (!evoApiUrl && config.evolution_api_url) {
        evoApiUrl = config.evolution_api_url.replace(/\/$/, "");
        evoInstance = config.evolution_instance || "";
        if (config.evolution_api_key) {
          evoApiKey = config.evolution_api_key;
        }
        console.log(`Fallback to config: instance=${evoInstance}`);
      }

      if (evoApiUrl && evoInstance) {
        try {
          const sendUrl = `${evoApiUrl}/message/sendText/${encodeURIComponent(evoInstance)}`;
          console.log(`Sending to: ${sendUrl}`);

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
          console.error("Evolution error:", e);
          results.push({ method: "evolution", success: false, error: e?.message || String(e) });
        }
      } else {
        console.warn("Evolution API not configured — missing URL or instance");
        results.push({ method: "evolution", success: false, error: "Instância não configurada" });
      }
    }

    const anySuccess = results.some((r) => r.success);
    const status = anySuccess ? "enviado" : "erro";

    // Log no histórico — EXPLICIT tenant_id
    const { error: logError } = await supabaseAdmin.from("whatsapp_messages").insert({
      lead_id: lead_id || null,
      tipo,
      mensagem,
      telefone: formattedPhone,
      status,
      erro_detalhes: anySuccess ? null : JSON.stringify(results),
      enviado_por: userId || null,
      tenant_id: tenantId, // ← EXPLICIT tenant_id
    });

    if (logError) console.warn("[send-wa] Log insert failed:", logError);

    if (results.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Nenhum método de envio configurado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[send-wa] Done for tenant=${tenantId}: ${results.length} methods, anySuccess=${anySuccess}`);

    return new Response(
      JSON.stringify({
        success: anySuccess,
        results,
        message: anySuccess ? "Mensagem enviada com sucesso" : "Falha ao enviar mensagem",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error sending WhatsApp message:", error);
    return new Response(JSON.stringify({ success: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
