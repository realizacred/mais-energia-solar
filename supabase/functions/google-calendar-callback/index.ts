import { createClient } from "npm:@supabase/supabase-js@2.39.3";

/**
 * OAuth2 callback handler for Google Calendar.
 * Exchanges authorization code for tokens and stores them in google_calendar_tokens.
 * This is a browser-redirect endpoint, not an API endpoint.
 */
Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    // Determine where to redirect the user after completion
    const appUrl = Deno.env.get("APP_URL") || "https://maisenergiasolar.lovable.app";

    if (error) {
      console.error("Google OAuth error:", error);
      return redirectTo(`${appUrl}/admin/google-calendar?error=${encodeURIComponent(error)}`);
    }

    if (!code || !stateParam) {
      return redirectTo(`${appUrl}/admin/google-calendar?error=missing_params`);
    }

    // Decode state
    let state: { userId: string; tenantId: string };
    try {
      state = JSON.parse(atob(stateParam));
    } catch {
      return redirectTo(`${appUrl}/admin/google-calendar?error=invalid_state`);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get OAuth credentials for this tenant
    const { data: configs } = await supabaseAdmin
      .from("integration_configs")
      .select("service_key, api_key")
      .eq("tenant_id", state.tenantId)
      .in("service_key", ["google_calendar_client_id", "google_calendar_client_secret"])
      .eq("is_active", true);

    const clientId = configs?.find(c => c.service_key === "google_calendar_client_id")?.api_key;
    const clientSecret = configs?.find(c => c.service_key === "google_calendar_client_secret")?.api_key;

    if (!clientId || !clientSecret) {
      return redirectTo(`${appUrl}/admin/google-calendar?error=missing_credentials`);
    }

    const redirectUri = `${Deno.env.get("SUPABASE_URL")}/functions/v1/google-calendar-callback`;

    // Exchange code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();

    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return redirectTo(`${appUrl}/admin/google-calendar?error=token_exchange_failed`);
    }

    // Get user's Google email
    let googleEmail = "";
    try {
      const userInfoRes = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        googleEmail = userInfo.email || "";
      }
    } catch (e) {
      console.warn("Could not fetch Google user info:", e);
    }

    const expiresAt = new Date(Date.now() + (tokenData.expires_in || 3600) * 1000).toISOString();

    // Upsert tokens
    const { error: dbError } = await supabaseAdmin
      .from("google_calendar_tokens")
      .upsert(
        {
          user_id: state.userId,
          tenant_id: state.tenantId,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token || "",
          token_expires_at: expiresAt,
          google_email: googleEmail,
          calendar_id: "primary",
          is_active: true,
        },
        { onConflict: "user_id" }
      );

    if (dbError) {
      console.error("DB upsert error:", dbError);
      return redirectTo(`${appUrl}/admin/google-calendar?error=db_error`);
    }

    return redirectTo(`${appUrl}/admin/google-calendar?success=true`);
  } catch (error: any) {
    console.error("Error in google-calendar-callback:", error);
    const appUrl = Deno.env.get("APP_URL") || "https://maisenergiasolar.lovable.app";
    return redirectTo(`${appUrl}/admin/google-calendar?error=internal_error`);
  }
});

function redirectTo(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}
