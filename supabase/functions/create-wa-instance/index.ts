import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate user session
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) {
      return new Response(JSON.stringify({ error: "Sessão inválida" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get tenant_id from user's profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instance_name, api_url, api_key, number, groups_ignore, reject_call, always_online } = await req.json();

    if (!instance_name || !api_url || !api_key) {
      return new Response(JSON.stringify({ error: "instance_name, api_url e api_key são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = api_url.replace(/\/+$/, "");

    // Step 1: Create instance on Evolution API
    const createUrl = `${baseUrl}/instance/create`;
    console.log(`[create-wa-instance] Creating instance: ${instance_name} at ${createUrl}`);

    const createPayload: Record<string, unknown> = {
      instanceName: instance_name,
      qrcode: true,
      integration: "WHATSAPP-BAILEYS",
    };
    // Optional enhanced settings
    if (number) createPayload.number = String(number);
    if (groups_ignore !== undefined) createPayload.groupsIgnore = Boolean(groups_ignore);
    if (reject_call !== undefined) createPayload.rejectCall = Boolean(reject_call);
    if (always_online !== undefined) createPayload.alwaysOnline = Boolean(always_online);

    const evoRes = await fetch(createUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: api_key,
      },
      body: JSON.stringify(createPayload),
    });

    if (!evoRes.ok) {
      const errText = await evoRes.text();
      console.error(`[create-wa-instance] Evolution error: ${evoRes.status} ${errText}`);

      let friendlyMsg = "Erro ao criar instância na Evolution API";
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

    const evoData = await evoRes.json();
    console.log(`[create-wa-instance] Evolution response keys:`, Object.keys(evoData));

    // Extract QR code from response
    // Evolution API v2 returns { instance: {...}, hash: "...", qrcode: { base64: "..." } }
    const qrBase64 = evoData?.qrcode?.base64 || evoData?.base64 || null;

    // Step 2: Save to wa_instances table
    const { data: newInstance, error: insertErr } = await supabase
      .from("wa_instances")
      .insert({
        tenant_id: profile.tenant_id,
        nome: instance_name,
        evolution_instance_key: instance_name,
        evolution_api_url: baseUrl,
        api_key: api_key,
        owner_user_id: user.id,
        status: "connecting",
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error(`[create-wa-instance] DB insert error:`, insertErr);
      return new Response(JSON.stringify({ error: "Erro ao salvar instância no banco" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      success: true,
      instance_id: newInstance.id,
      qr_code_base64: qrBase64,
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
