import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  buildContext,
  createInstanceRequest,
  fetchConnectionState,
  fetchQrCode,
  setWebhookRequest,
  type WaApiFlavor,
} from "../_shared/wa-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Validate user session
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get profile with tenant_id
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Role check: only admin or gerente can create instances
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "gerente"])
      .limit(1)
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Apenas administradores e gerentes podem criar instâncias" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instance_name, api_url, api_key, number, groups_ignore, reject_call, always_online, consultor_ids, register_only, evolution_instance_key, api_flavor } = await req.json();
    const flavor: WaApiFlavor = api_flavor === "go" ? "go" : "classic";

    if (!instance_name || !api_url) {
      return new Response(JSON.stringify({ error: "instance_name e api_url são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve API key: per-instance > global env secret
    const resolvedApiKey = api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
    if (!resolvedApiKey) {
      return new Response(JSON.stringify({ error: "API Key não fornecida e EVOLUTION_API_KEY não configurada no servidor" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // For register_only mode, evolution_instance_key is required (existing instance name on Evolution)
    if (register_only && !evolution_instance_key) {
      return new Response(JSON.stringify({ error: "evolution_instance_key é obrigatório ao registrar instância existente" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = api_url.replace(/\/+$/, "");
    let qrBase64: string | null = null;
    const effectiveInstanceKey = register_only ? evolution_instance_key : instance_name;

    // Build provider context (used for both classic & GO via shared adapter)
    const provCtx = buildContext({
      api_flavor: flavor,
      evolution_api_url: baseUrl,
      evolution_instance_key: effectiveInstanceKey,
      api_key: resolvedApiKey,
    });

    if (register_only) {
      // ── REGISTER ONLY: skip create, validate the instance exists via state probe ──
      console.log(`[create-wa-instance] Register-only (${flavor}) for: ${effectiveInstanceKey}`);
      const stateInfo = await fetchConnectionState(provCtx);
      if (stateInfo.state === "unknown" && !stateInfo.raw) {
        return new Response(JSON.stringify({ error: `Instância "${effectiveInstanceKey}" não encontrada na ${flavor === "go" ? "Evolution GO" : "Evolution"}. Verifique o nome.` }), {
          status: 404,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (stateInfo.state !== "open") {
        qrBase64 = await fetchQrCode(provCtx);
      }
    } else {
      // ── CREATE NEW: call provider via adapter ──
      const { url: createUrl, init: createInit } = createInstanceRequest(provCtx, {
        number: number ? String(number) : undefined,
        groupsIgnore: groups_ignore !== undefined ? Boolean(groups_ignore) : undefined,
        rejectCall: reject_call !== undefined ? Boolean(reject_call) : undefined,
        alwaysOnline: always_online !== undefined ? Boolean(always_online) : undefined,
      });
      console.log(`[create-wa-instance] Creating instance (${flavor}): ${instance_name} at ${createUrl}`);

      const evoRes = await fetch(createUrl, createInit);

      if (!evoRes.ok) {
        const errText = await evoRes.text();
        console.error(`[create-wa-instance] Provider error: ${evoRes.status} ${errText}`);

        let friendlyMsg = "Erro ao criar instância no provedor WhatsApp";
        try {
          const parsed = JSON.parse(errText);
          if (parsed?.message) friendlyMsg = parsed.message;
          else if (parsed?.error) friendlyMsg = parsed.error;
        } catch { /* ignore */ }

        return new Response(JSON.stringify({ error: friendlyMsg }), {
          status: 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const evoData = await evoRes.json().catch(() => ({}));
      // Try to extract QR from create response (classic returns it inline; GO requires separate call)
      qrBase64 = evoData?.qrcode?.base64 || evoData?.base64 || evoData?.qrcode || null;
      if (!qrBase64) {
        // Fallback: fetch QR explicitly (Evolution GO path)
        qrBase64 = await fetchQrCode(provCtx);
      }
    }

    // Step 2: Save to wa_instances table
    const initialStatus = register_only ? "disconnected" : "connecting";
    const { data: newInstance, error: insertErr } = await supabaseAdmin
      .from("wa_instances")
      .insert({
        tenant_id: profile.tenant_id,
        nome: instance_name,
        evolution_instance_key: effectiveInstanceKey,
        evolution_api_url: baseUrl,
        api_key: api_key || null,  // Store only per-instance key; null = uses global
        owner_user_id: user.id,
        status: initialStatus,
      })
      .select("id, webhook_secret")
      .single();

    if (insertErr) {
      console.error(`[create-wa-instance] DB insert error:`, insertErr);
      return new Response(JSON.stringify({ error: "Erro ao salvar instância no banco" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 3: Create consultor linkages if provided
    if (newInstance?.id && Array.isArray(consultor_ids) && consultor_ids.length > 0) {
      const linkRows = consultor_ids.map((cid: string) => ({
        instance_id: newInstance.id,
        consultor_id: cid,
        tenant_id: profile.tenant_id,
      }));
      const { error: linkErr } = await supabaseAdmin
        .from("wa_instance_consultores")
        .insert(linkRows);
      if (linkErr) {
        console.warn(`[create-wa-instance] Consultor linkage warning:`, linkErr);
      }

      // Legacy single consultor_id field for backward compat
      if (consultor_ids.length === 1) {
        await supabaseAdmin
          .from("wa_instances")
          .update({ consultor_id: consultor_ids[0] } as any)
          .eq("id", newInstance.id);
      }
    }

    console.log(`[create-wa-instance] Instance created: ${newInstance.id} for tenant ${profile.tenant_id}`);

    // Step 4: Auto-configure webhook on Evolution API (non-blocking)
    let webhookConfigured = false;
    let webhookWarning: string | null = null;

    try {
      const supabaseUrl = Deno.env.get("SUPABASE_URL");
      if (!supabaseUrl) throw new Error("SUPABASE_URL not available");

      // Validate URL before using it
      new URL(supabaseUrl);

      const webhookUrl = `${supabaseUrl}/functions/v1/evolution-webhook?instance=${encodeURIComponent(effectiveInstanceKey)}&secret=${encodeURIComponent(newInstance.webhook_secret || "")}`;
      const webhookEvents = [
        "MESSAGES_UPSERT",
        "MESSAGES_UPDATE",
        "CONNECTION_UPDATE",
        "CONTACTS_UPSERT",
        "QRCODE_UPDATED",
      ];

      const encodedKey = encodeURIComponent(effectiveInstanceKey);
      const webhookSetUrl = `${baseUrl}/webhook/set/${encodedKey}`;

      console.log(`[create-wa-instance] Setting webhook: ${webhookSetUrl}`);

      const webhookRes = await fetch(webhookSetUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: resolvedApiKey,
        },
        body: JSON.stringify({
          url: webhookUrl,
          webhook_by_events: false,
          webhook_base64: false,
          events: webhookEvents,
        }),
      });

      if (webhookRes.ok) {
        webhookConfigured = true;
        console.log(`[create-wa-instance] Webhook configured successfully for ${effectiveInstanceKey}`);
      } else {
        const errText = await webhookRes.text();
        webhookWarning = `Webhook setup failed (${webhookRes.status}): ${errText.substring(0, 200)}`;
        console.warn(`[create-wa-instance] ${webhookWarning}`);
      }
    } catch (whErr: any) {
      webhookWarning = `Webhook auto-config error: ${whErr.message}`;
      console.warn(`[create-wa-instance] ${webhookWarning}`);
    }

    return new Response(JSON.stringify({
      success: true,
      instance_id: newInstance.id,
      qr_code_base64: qrBase64,
      webhook_configured: webhookConfigured,
      webhook_warning: webhookWarning,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[create-wa-instance] Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno ao criar instância" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
