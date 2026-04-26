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

    const { instance_id } = await req.json();

    if (!instance_id) {
      return new Response(JSON.stringify({ error: "instance_id é obrigatório" }), {
        status: 400,
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

    // Role check: admin, gerente, or user linked to this instance via wa_instance_consultores
    const { data: roleData } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "gerente"])
      .limit(1)
      .maybeSingle();

    if (!roleData) {
      // Check if user is a consultor linked to this instance
      const { data: consultorLink } = await supabaseAdmin
        .from("consultores")
        .select("id")
        .eq("user_id", user.id)
        .eq("ativo", true)
        .limit(1)
        .maybeSingle();

      if (consultorLink) {
        const { data: instanceLink } = await supabaseAdmin
          .from("wa_instance_consultores")
          .select("id")
          .eq("instance_id", instance_id)
          .eq("consultor_id", consultorLink.id)
          .limit(1)
          .maybeSingle();

        if (!instanceLink) {
          return new Response(JSON.stringify({ error: "Sem permissão para esta instância" }), {
            status: 403,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } else {
        return new Response(JSON.stringify({ error: "Sem permissão para gerar QR Code" }), {
          status: 403,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Fetch instance with tenant isolation (includes api_flavor)
    const { data: instance, error: instErr } = await supabaseAdmin
      .from("wa_instances")
      .select("evolution_instance_key, evolution_api_url, api_key, api_flavor")
      .eq("id", instance_id)
      .eq("tenant_id", profile.tenant_id)
      .single();

    if (instErr || !instance) {
      return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = instance.api_key;
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key não configurada para esta instância" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use shared adapter for both Classic & GO flavors
    const { buildContext, fetchConnectionState, fetchQrCode } = await import("../_shared/wa-provider.ts");
    const ctx = buildContext({
      api_flavor: (instance as any).api_flavor,
      evolution_api_url: instance.evolution_api_url,
      evolution_instance_key: instance.evolution_instance_key,
      api_key: apiKey,
    });

    // Step 1: Check connection state via adapter
    const stateResult = await fetchConnectionState(ctx).catch((e) => {
      console.warn("[get-wa-qrcode] State check failed:", e);
      return { state: "unknown" as const, raw: null };
    });
    const connectionState = stateResult.state;

    // If already connected, update DB and return
    if (connectionState === "open") {
      await supabaseAdmin
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

    // Step 2: Get QR code via adapter
    const qrBase64 = await fetchQrCode(ctx).catch((e) => {
      console.warn("[get-wa-qrcode] QR fetch failed:", e);
      return null;
    });

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
