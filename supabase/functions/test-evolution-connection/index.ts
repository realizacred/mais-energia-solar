import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth (functions.invoke envia Authorization automaticamente quando o usuário está logado)
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ success: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Restringe a admins (mesmo padrão do instagram-sync)
    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ success: false, error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Busca configuração (com RLS do usuário)
    const { data: config, error: configError } = await supabase
      .from("whatsapp_automation_config")
      .select("evolution_api_url, evolution_api_key, evolution_instance")
      .single();

    if (configError) {
      console.error("Error fetching WhatsApp config:", configError);
      return new Response(JSON.stringify({ success: false, error: "Erro ao buscar configuração" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!config?.evolution_api_url || !config?.evolution_api_key || !config?.evolution_instance) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Configuração incompleta. Preencha URL, API Key e Instância.",
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const evolutionUrl = config.evolution_api_url.replace(/\/$/, "");

    // 1) fetchInstances
    const instancesUrl = `${evolutionUrl}/instance/fetchInstances`;
    console.log("Testing Evolution API (fetchInstances):", instancesUrl);

    const instancesRes = await fetch(instancesUrl, {
      method: "GET",
      headers: {
        apikey: config.evolution_api_key,
        "Content-Type": "application/json",
      },
    });

    const instancesText = await instancesRes.text();

    if (!instancesRes.ok) {
      console.error("Evolution API fetchInstances error:", instancesRes.status, instancesText);
      return new Response(
        JSON.stringify({
          success: false,
          error: `Erro na API (fetchInstances): ${instancesRes.status} - ${instancesText}`,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    let instances: any = null;
    try {
      instances = JSON.parse(instancesText);
    } catch {
      // algumas instalações retornam string/obj diferente
      instances = instancesText;
    }

    const instanceExists =
      Array.isArray(instances) &&
      instances.some(
        (inst: any) =>
          inst?.instance?.instanceName === config.evolution_instance ||
          inst?.instanceName === config.evolution_instance ||
          inst?.name === config.evolution_instance
      );

    // 2) connectionState (best-effort)
    let connectionState: string = "unknown";
    let instanceStatus = instanceExists ? "encontrada" : "não encontrada";

    if (instanceExists) {
      try {
        const stateUrl = `${evolutionUrl}/instance/connectionState/${config.evolution_instance}`;
        console.log("Testing Evolution API (connectionState):", stateUrl);

        const stateRes = await fetch(stateUrl, {
          method: "GET",
          headers: {
            apikey: config.evolution_api_key,
            "Content-Type": "application/json",
          },
        });

        const stateText = await stateRes.text();
        if (stateRes.ok) {
          const stateJson = JSON.parse(stateText);
          connectionState = stateJson?.instance?.state || stateJson?.state || "unknown";
          instanceStatus = connectionState === "open" ? "conectada" : connectionState;
        } else {
          console.warn("connectionState non-OK:", stateRes.status, stateText);
        }
      } catch (e) {
        console.warn("Error checking connectionState:", e);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        instanceExists,
        instanceStatus,
        connectionState,
        message: instanceExists
          ? `Conexão OK! Instância \"${config.evolution_instance}\" ${instanceStatus}`
          : `API conectada, mas instância \"${config.evolution_instance}\" não encontrada`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("Error testing Evolution connection:", error);
    return new Response(JSON.stringify({ success: false, error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
