import { createClient } from "npm:@supabase/supabase-js@2.39.3";

/**
 * OAuth2 callback handler for Google Calendar.
 * Exchanges authorization code for tokens and stores them in google_calendar_tokens.
 *
 * SECURITY: Uses APP_URL_LOCKED secret for ALL redirects.
 * The editable public_app_url (DB) is NEVER used here to prevent redirect attacks.
 *
 * HARDENING: Preserves existing refresh_token if Google doesn't return a new one.
 */

function getLockedAppUrl(): string | null {
  // SECURITY: Only use locked secret, never DB-editable URL
  const locked = Deno.env.get("APP_URL_LOCKED");
  if (locked) return locked.replace(/\/+$/, "");
  // Fallback to APP_URL for backwards compatibility
  const appUrl = Deno.env.get("APP_URL");
  if (appUrl) return appUrl.replace(/\/+$/, "");
  return null;
}

Deno.serve(async (req) => {
  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    const stateParam = url.searchParams.get("state");
    const error = url.searchParams.get("error");

    const appUrl = getLockedAppUrl();
    if (!appUrl) {
      console.error("[SECURITY] APP_URL_LOCKED not configured. OAuth callback cannot redirect safely.");
      return new Response("APP_URL_LOCKED not configured", { status: 500 });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    if (error) {
      console.error("Google OAuth error:", error);
      return redirectTo(
        `${appUrl}/admin/google-calendar?error=${encodeURIComponent(error)}`
      );
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

    // Get OAuth credentials for this tenant
    const { data: configs } = await supabaseAdmin
      .from("integration_configs")
      .select("service_key, api_key")
      .eq("tenant_id", state.tenantId)
      .in("service_key", [
        "google_calendar_client_id",
        "google_calendar_client_secret",
      ])
      .eq("is_active", true);

    const clientId = configs?.find(
      (c: any) => c.service_key === "google_calendar_client_id"
    )?.api_key;
    const clientSecret = configs?.find(
      (c: any) => c.service_key === "google_calendar_client_secret"
    )?.api_key;

    if (!clientId || !clientSecret) {
      return redirectTo(
        `${appUrl}/admin/google-calendar?error=missing_credentials`
      );
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
      return redirectTo(
        `${appUrl}/admin/google-calendar?error=token_exchange_failed`
      );
    }

    // Get user's Google email
    let googleEmail = "";
    try {
      const userInfoRes = await fetch(
        "https://www.googleapis.com/oauth2/v2/userinfo",
        {
          headers: { Authorization: `Bearer ${tokenData.access_token}` },
        }
      );
      if (userInfoRes.ok) {
        const userInfo = await userInfoRes.json();
        googleEmail = userInfo.email || "";
      }
    } catch (e) {
      console.warn("Could not fetch Google user info:", e);
    }

    const expiresAt = new Date(
      Date.now() + (tokenData.expires_in || 3600) * 1000
    ).toISOString();

    // ── HARDENING: Preserve existing refresh_token ──
    let refreshToken = tokenData.refresh_token || "";

    // Check if user already has a token (for reconnect/switch user scenarios)
    const { data: existing } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("id, refresh_token, google_email")
      .eq("user_id", state.userId)
      .maybeSingle();

    if (!refreshToken && existing?.refresh_token) {
      refreshToken = existing.refresh_token;
    }

    if (!refreshToken) {
      console.error(
        "No refresh_token available for user:",
        state.userId,
        "Token will expire and cannot be renewed."
      );
      return redirectTo(
        `${appUrl}/admin/google-calendar?error=no_refresh_token`
      );
    }

    // If existing record, update it; otherwise insert
    // This handles switching Google accounts properly
    if (existing?.id) {
      const { error: updateError } = await supabaseAdmin
        .from("google_calendar_tokens")
        .update({
          access_token: tokenData.access_token,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          google_email: googleEmail,
          calendar_id: "primary",
          is_active: true,
        })
        .eq("id", existing.id);

      if (updateError) {
        console.error("DB update error:", updateError);
        return redirectTo(`${appUrl}/admin/google-calendar?error=db_error`);
      }
    } else {
      const { error: insertError } = await supabaseAdmin
        .from("google_calendar_tokens")
        .insert({
          user_id: state.userId,
          tenant_id: state.tenantId,
          access_token: tokenData.access_token,
          refresh_token: refreshToken,
          token_expires_at: expiresAt,
          google_email: googleEmail,
          calendar_id: "primary",
          is_active: true,
        });

      if (insertError) {
        console.error("DB insert error:", insertError);
        return redirectTo(`${appUrl}/admin/google-calendar?error=db_error`);
      }
    }

    if (dbError) {
      console.error("DB upsert error:", dbError);
      return redirectTo(`${appUrl}/admin/google-calendar?error=db_error`);
    }

    return redirectTo(`${appUrl}/admin/google-calendar?success=true`);
  } catch (error: any) {
    console.error("Error in google-calendar-callback:", error);
    const fallbackUrl = getLockedAppUrl();
    if (!fallbackUrl) return new Response("Internal error and APP_URL_LOCKED not configured", { status: 500 });
    return redirectTo(`${fallbackUrl}/admin/google-calendar?error=internal_error`);
  }
});

function redirectTo(url: string): Response {
  return new Response(null, {
    status: 302,
    headers: { Location: url },
  });
}
