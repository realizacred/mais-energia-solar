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
      .eq("id", user.id)
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

    const { instance_name, api_url, api_key, number, groups_ignore, reject_call, always_online, consultor_ids } = await req.json();

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
    const qrBase64 = evoData?.qrcode?.base64 || evoData?.base64 || null;

    // Step 2: Save to wa_instances table
    const { data: newInstance, error: insertErr } = await supabaseAdmin
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
