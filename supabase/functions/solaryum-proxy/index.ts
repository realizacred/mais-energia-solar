import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2/cors";

const VERTYS_BASE = "https://app.vertys.com.br/api";

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Resolve tenant_id from profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(
        JSON.stringify({ error: "Tenant não encontrado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { distribuidor, endpoint, params = {} } = body as {
      distribuidor: "vertys" | "jng";
      endpoint: string;
      params: Record<string, unknown>;
    };

    // Validate endpoint whitelist
    const ALLOWED_ENDPOINTS = ["BuscarFiltros", "BuscarKits", "MontarKits"];
    if (!ALLOWED_ENDPOINTS.includes(endpoint)) {
      return new Response(
        JSON.stringify({ error: `Endpoint não permitido: ${endpoint}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Fetch token from integrations_api_configs (where the UI saves it)
    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // integration_providers.id is the provider slug ('jng' or 'vertys')
    const { data: apiConfig } = await serviceClient
      .from("integrations_api_configs")
      .select("credentials")
      .eq("tenant_id", profile.tenant_id)
      .eq("provider", distribuidor)
      .eq("is_active", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const creds = apiConfig?.credentials as Record<string, string> | null;
    const token = creds?.token ?? creds?.api_key ?? null;

    if (!token) {
      return new Response(
        JSON.stringify({ error: "Token Solaryum não configurado para este distribuidor" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build URL
    const jngBase = Deno.env.get("SOLARYUM_JNG_BASE_URL") || "https://api.jngsolar.com.br/api";
    const baseUrl = distribuidor === "vertys" ? VERTYS_BASE : jngBase;
    const url = new URL(`${baseUrl}/integracaoPlataforma/${endpoint}`);
    url.searchParams.set("token", token);

    for (const [key, value] of Object.entries(params)) {
      if (value != null) {
        url.searchParams.set(key, String(value));
      }
    }

    const apiResponse = await fetch(url.toString(), {
      method: "GET",
      headers: { "Accept": "application/json" },
    });

    if (!apiResponse.ok) {
      const errorText = await apiResponse.text();
      return new Response(
        JSON.stringify({
          error: `Solaryum API error: ${apiResponse.status}`,
          details: errorText,
        }),
        { status: apiResponse.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await apiResponse.json();
    return new Response(
      JSON.stringify(data),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[solaryum-proxy] Error:", e);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
