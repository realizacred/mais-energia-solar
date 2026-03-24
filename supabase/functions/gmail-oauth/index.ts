import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const APP_URL = Deno.env.get("APP_URL") || "https://maisenergiasolar.lovable.app";

function getRedirectUri(): string {
  return `${SUPABASE_URL}/functions/v1/gmail-oauth`;
}

/**
 * Resolve Google OAuth credentials:
 * 1. site_settings (per-tenant, stored by user in UI)
 * 2. Fallback to env secrets GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET
 */
async function resolveGoogleCredentials(
  adminClient: any,
  tenantId?: string
): Promise<{ clientId: string; clientSecret: string }> {
  // Try site_settings first
  if (tenantId) {
    const { data } = await adminClient
      .from("site_settings")
      .select("google_client_id, google_client_secret")
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (data?.google_client_id && data?.google_client_secret) {
      return { clientId: data.google_client_id, clientSecret: data.google_client_secret };
    }
  }
  // Fallback to env
  const clientId = Deno.env.get("GOOGLE_CLIENT_ID") || "";
  const clientSecret = Deno.env.get("GOOGLE_CLIENT_SECRET") || "";
  return { clientId, clientSecret };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "auth_url") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claimsData, error: claimsError } = await supabase.auth.getUser();
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", claimsData.user.id)
        .single();

      if (!profile?.tenant_id) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { clientId, clientSecret } = await resolveGoogleCredentials(adminClient, profile.tenant_id);

      if (!clientId || !clientSecret) {
        return new Response(JSON.stringify({ error: "Google OAuth não configurado. Configure Client ID e Secret nas configurações." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Extra params from query string
      const accountName = url.searchParams.get("account_name") || "Gmail";
      const concessionaria = url.searchParams.get("concessionaria") || "";
      const gmailLabel = url.searchParams.get("gmail_label") || "";

      const state = btoa(
        JSON.stringify({
          tenant_id: profile.tenant_id,
          user_id: claimsData.user.id,
          account_name: accountName,
          concessionaria,
          gmail_label: gmailLabel,
        })
      );

      const scopes = [
        "https://www.googleapis.com/auth/gmail.readonly",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/userinfo.email",
      ];

      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: getRedirectUri(),
        response_type: "code",
        scope: scopes.join(" "),
        state,
        access_type: "offline",
        prompt: "select_account consent",
      });

      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

      return new Response(JSON.stringify({ auth_url: authUrl }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "callback" || (!action && url.searchParams.has("code"))) {
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

      let stateData: { tenant_id: string; user_id: string; account_name?: string; concessionaria?: string; gmail_label?: string };
      try {
        stateData = JSON.parse(atob(stateParam));
      } catch {
        return new Response(null, {
          status: 302,
          headers: { Location: `${APP_URL}/admin/faturas-energia?gmail=erro&reason=invalid_state` },
        });
      }

      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { clientId, clientSecret } = await resolveGoogleCredentials(adminClient, stateData.tenant_id);

      if (!clientId || !clientSecret) {
        return new Response(null, {
          status: 302,
          headers: { Location: `${APP_URL}/admin/faturas-energia?gmail=erro&reason=no_oauth_config` },
        });
      }

      // Exchange code for tokens
      const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code,
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: getRedirectUri(),
          grant_type: "authorization_code",
        }),
      });

      const tokenData = await tokenResponse.json();

      if (!tokenResponse.ok) {
        console.error("Token exchange failed:", tokenData);
        return new Response(null, {
          status: 302,
          headers: { Location: `${APP_URL}/admin/faturas-energia?gmail=erro&reason=token_exchange_failed` },
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

      // Save to gmail_accounts
      await adminClient
        .from("gmail_accounts")
        .insert({
          tenant_id: stateData.tenant_id,
          nome: stateData.account_name || `Gmail - ${userEmail}`,
          email: userEmail,
          concessionaria_nome: stateData.concessionaria || null,
          gmail_label: stateData.gmail_label || null,
          credentials: { access_token, refresh_token },
          settings: {
            token_expiry: Date.now() + expires_in * 1000,
            email: userEmail,
          },
          is_active: true,
        });

      // Also update integrations_api_configs for backward compat
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
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claimsData, error: claimsError } = await supabase.auth.getUser();
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", claimsData.user.id)
        .single();

      if (!profile?.tenant_id) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
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

    // ── list_labels: fetch Gmail labels for a specific account ──
    if (action === "list_labels") {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        global: { headers: { Authorization: authHeader } },
      });

      const { data: claimsData, error: claimsError } = await supabase.auth.getUser();
      if (claimsError || !claimsData?.user) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", claimsData.user.id)
        .single();

      if (!profile?.tenant_id) {
        return new Response(JSON.stringify({ error: "Tenant not found" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

      // Get all active gmail accounts for the tenant
      const { data: accounts, error: accError } = await adminClient
        .from("gmail_accounts")
        .select("id, email, nome, credentials, settings")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true);

      if (accError || !accounts?.length) {
        return new Response(JSON.stringify({ labels: [], error: "Nenhuma conta Gmail ativa encontrada" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Use the first account (or a specific one if account_id is provided)
      const accountId = url.searchParams.get("account_id");
      const account = accountId
        ? accounts.find((a: any) => a.id === accountId)
        : accounts[0];

      if (!account) {
        return new Response(JSON.stringify({ labels: [], error: "Conta não encontrada" }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Get access token, refresh if needed
      let accessToken = account.credentials?.access_token;
      const tokenExpiry = account.settings?.token_expiry || 0;

      if (Date.now() > tokenExpiry - 60000 && account.credentials?.refresh_token) {
        const { clientId, clientSecret } = await resolveGoogleCredentials(adminClient, profile.tenant_id);
        const refreshResp = await fetch("https://oauth2.googleapis.com/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: clientId,
            client_secret: clientSecret,
            refresh_token: account.credentials.refresh_token,
            grant_type: "refresh_token",
          }),
        });
        const refreshData = await refreshResp.json();
        if (refreshData.access_token) {
          accessToken = refreshData.access_token;
          // Update stored token
          await adminClient
            .from("gmail_accounts")
            .update({
              credentials: { ...account.credentials, access_token: accessToken },
              settings: { ...account.settings, token_expiry: Date.now() + (refreshData.expires_in || 3600) * 1000 },
            })
            .eq("id", account.id);
        }
      }

      if (!accessToken) {
        return new Response(JSON.stringify({ labels: [], error: "Token de acesso indisponível. Reconecte a conta Gmail." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Fetch labels from Gmail API
      const labelsResp = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/labels", {
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!labelsResp.ok) {
        return new Response(JSON.stringify({ labels: [], error: `Erro ao buscar marcadores: ${labelsResp.status}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const labelsData = await labelsResp.json();
      const labels = (labelsData.labels || [])
        .filter((l: any) => l.type === "user") // Only user-created labels
        .map((l: any) => ({ id: l.id, name: l.name }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name));

      return new Response(JSON.stringify({ labels }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Invalid action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("gmail-oauth error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
