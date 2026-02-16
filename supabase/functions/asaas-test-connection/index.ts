import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claimsData.claims.sub;

    // Resolve tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant found" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;

    // Get request body
    const { api_key, environment } = await req.json();

    if (!api_key || !environment) {
      return new Response(
        JSON.stringify({ error: "api_key and environment are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Determine Asaas base URL
    const baseUrl =
      environment === "production"
        ? "https://api.asaas.com/v3"
        : "https://sandbox.asaas.com/api/v3";

    // Test connection by fetching account info
    const asaasResponse = await fetch(`${baseUrl}/finance/getCurrentBalance`, {
      method: "GET",
      headers: {
        accept: "application/json",
        access_token: api_key,
      },
    });

    if (!asaasResponse.ok) {
      const errorBody = await asaasResponse.text();
      console.error(`[asaas-test-connection] Asaas API error: ${asaasResponse.status}`, errorBody);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Falha na conexão com o Asaas. Verifique a chave e o ambiente.",
          status: asaasResponse.status,
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const balanceData = await asaasResponse.json();

    return new Response(
      JSON.stringify({
        success: true,
        environment,
        balance: balanceData.balance ?? null,
        tenant_id: tenantId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[asaas-test-connection] Error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
