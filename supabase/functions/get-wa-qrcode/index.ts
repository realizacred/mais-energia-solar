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

    const { instance_id } = await req.json();

    if (!instance_id) {
      return new Response(JSON.stringify({ error: "instance_id é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch instance
    const { data: instance, error: instErr } = await supabase
      .from("wa_instances")
      .select("evolution_instance_key, evolution_api_url, api_key")
      .eq("id", instance_id)
      .single();

    if (instErr || !instance) {
      return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = instance.evolution_api_url.replace(/\/+$/, "");
    const instanceKey = encodeURIComponent(instance.evolution_instance_key);

    // Step 1: Check connection state
    const stateUrl = `${baseUrl}/instance/connectionState/${instanceKey}`;
    const stateRes = await fetch(stateUrl, {
      method: "GET",
      headers: { apikey: apiKey },
    });

    let connectionState = "unknown";
    if (stateRes.ok) {
      const stateData = await stateRes.json();
      connectionState = stateData?.instance?.state || stateData?.state || "unknown";
    } else {
      await stateRes.text(); // consume body
    }

    // If already connected, update DB and return
    if (connectionState === "open") {
      await supabase
        .from("wa_instances")
        .update({ status: "connected" })
        .eq("id", instance_id);

      return new Response(JSON.stringify({
        success: true,
        status: "open",
        qr_code_base64: null,
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Get QR code via connect endpoint
    const connectUrl = `${baseUrl}/instance/connect/${instanceKey}`;
    const connectRes = await fetch(connectUrl, {
      method: "GET",
      headers: { apikey: apiKey },
    });

    if (!connectRes.ok) {
      const errText = await connectRes.text();
      console.warn(`[get-wa-qrcode] Connect error: ${connectRes.status} ${errText}`);
      return new Response(JSON.stringify({
        success: true,
        status: connectionState,
        qr_code_base64: null,
        error: "Não foi possível gerar QR Code",
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const connectData = await connectRes.json();
    const qrBase64 = connectData?.base64 || connectData?.qrcode?.base64 || null;

    return new Response(JSON.stringify({
      success: true,
      status: connectionState,
      qr_code_base64: qrBase64,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[get-wa-qrcode] Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
