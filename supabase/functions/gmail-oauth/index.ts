import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const GOOGLE_CLIENT_ID = Deno.env.get("GOOGLE_CLIENT_ID")!;
const GOOGLE_CLIENT_SECRET = Deno.env.get("GOOGLE_CLIENT_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const APP_URL = Deno.env.get("APP_URL") || "https://maisenergiasolar.lovable.app";

function getRedirectUri(): string {
  return `${SUPABASE_URL}/functions/v1/gmail-oauth?action=callback`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "auth_url") {
      // Validate user JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claimsData, error: claimsError } = await supabase.auth.getUser();
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get tenant_id from profiles
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", claimsData.user.id)
        .single();

      if (!profile?.tenant_id) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const state = btoa(
        JSON.stringify({
          tenant_id: profile.tenant_id,
          user_id: claimsData.user.id,
        })
      );

      const scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/userinfo.email",
      ];

      const params = new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        redirect_uri: getRedirectUri(),
        response_type: "code",
        scope: scopes.join(" "),
        state,
        access_type: "offline",
        prompt: "consent",
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback") {
      const code = url.searchParams.get("code");
      const stateParam = url.searchParams.get("state");
      const error = url.searchParams.get("error");

      if (error) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${APP_URL}/admin/faturas-energia?gmail=erro&reason=${error}` },
        });
      }

      if (!code || !stateParam) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${APP_URL}/admin/faturas-energia?gmail=erro&reason=missing_params` },
        });
      }

      let stateData: { tenant_id: string; user_id: string };
      try {
        stateData = JSON.parse(atob(stateParam));
      } catch {
        return new Response(null, {
          status: 302,
          headers: { Location: `${APP_URL}/admin/faturas-energia?gmail=erro&reason=invalid_state` },
        });
      }

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: GOOGLE_CLIENT_ID,
          client_secret: GOOGLE_CLIENT_SECRET,
          redirect_uri: getRedirectUri(),
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error("Token exchange failed:", tokenData);
        return new Response(null, {
          status: 302,
          headers: {
            Location: `${APP_URL}/admin/faturas-energia?gmail=erro&reason=token_exchange_failed`,
          },
        });
      }

      const { access_token, refresh_token, expires_in } = tokenData;

      // Get user email from Google
      let userEmail = "desconhecido";
      try {
        const userInfoResp = await fetch(
          `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${access_token}`
        );
        if (userInfoResp.ok) {
          const userInfo = await userInfoResp.json();
          userEmail = userInfo.email || "desconhecido";
        }
      } catch (e) {
        console.error("Failed to get user email:", e);
      }

      // Save to integrations_api_configs using service role
      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Check if there's already a gmail config for this tenant
      const { data: existing } = await adminClient
        .from("integrations_api_configs")
        .select("id")
        .eq("tenant_id", stateData.tenant_id)
        .eq("provider", "gmail")
        .maybeSingle();

      const configPayload = {
        name: `Gmail - ${userEmail}`,
        provider: "gmail",
        tenant_id: stateData.tenant_id,
        credentials: { access_token, refresh_token },
        settings: {
          token_expiry: Date.now() + expires_in * 1000,
          email: userEmail,
        },
        is_active: true,
        status: "active",
        updated_at: new Date().toISOString(),
        updated_by: stateData.user_id,
      };

      if (existing?.id) {
        await adminClient
          .from("integrations_api_configs")
          .update(configPayload)
          .eq("id", existing.id);
      } else {
        await adminClient
          .from("integrations_api_configs")
          .insert({ ...configPayload, created_by: stateData.user_id });
      }

      return new Response(null, {
        status: 302,
        headers: { Location: `${APP_URL}/admin/faturas-energia?gmail=conectado` },
      });
    }

    if (action === "disconnect") {
      // Validate user JWT
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claimsData, error: claimsError } = await supabase.auth.getUser();
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", claimsData.user.id)
        .single();

      if (!profile?.tenant_id) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      await adminClient
        .from("integrations_api_configs")
        .update({ is_active: false, status: "disconnected", updated_at: new Date().toISOString() })
        .eq("tenant_id", profile.tenant_id)
        .eq("provider", "gmail");

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gmail-oauth error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
