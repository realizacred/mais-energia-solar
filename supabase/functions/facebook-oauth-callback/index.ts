import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const tenantId = url.searchParams.get("state");
  const error = url.searchParams.get("error");

  const APP_ID = Deno.env.get("FACEBOOK_APP_ID");
  const APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const REDIRECT_URI = `${SUPABASE_URL}/functions/v1/facebook-oauth-callback`;

  // Use the host to determine where to redirect back to
  // If APP_URL is not set, we try to infer it from the referrer or host if possible, 
  // but APP_URL is safer.
  const appUrl = Deno.env.get("APP_URL") || "https://bguhckqkpnziykpbwbeu.lovable.app";
  const redirectUrl = new URL(`${appUrl}/admin/meta-facebook-config`);

  console.log(`OAuth callback started for tenant: ${tenantId}`);

  if (error) {
    console.error("FB OAuth Error param:", error);
    redirectUrl.searchParams.set("fb_status", "error");
    redirectUrl.searchParams.set("fb_error", error);
    return Response.redirect(redirectUrl.toString(), 302);
  }

  if (!code || !tenantId) {
    console.error("Missing code or state (tenantId)");
    redirectUrl.searchParams.set("fb_status", "error");
    redirectUrl.searchParams.set("fb_error", "missing_params");
    return Response.redirect(redirectUrl.toString(), 302);
  }

  if (!APP_ID || !APP_SECRET) {
    console.error("FACEBOOK_APP_ID or FACEBOOK_APP_SECRET not configured in Edge Function");
    redirectUrl.searchParams.set("fb_status", "error");
    redirectUrl.searchParams.set("fb_error", "env_not_configured");
    return Response.redirect(redirectUrl.toString(), 302);
  }

  try {
    // 1. Exchange code for short-lived token
    const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${APP_ID}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&client_secret=${APP_SECRET}&code=${code}`;
    const tokenResponse = await fetch(tokenUrl);
    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      console.error("FB Token Exchange Error:", tokenData.error);
      redirectUrl.searchParams.set("fb_status", "error");
      redirectUrl.searchParams.set("fb_error", tokenData.error.message || "token_exchange_failed");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    const shortToken = tokenData.access_token;

    // 2. Exchange short-lived token for long-lived token (60 days)
    const longTokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?grant_type=fb_exchange_token&client_id=${APP_ID}&client_secret=${APP_SECRET}&fb_exchange_token=${shortToken}`;
    const longTokenResponse = await fetch(longTokenUrl);
    const longTokenData = await longTokenResponse.json();

    if (longTokenData.error) {
       console.error("FB Long Token Exchange Error:", longTokenData.error);
       redirectUrl.searchParams.set("fb_status", "error");
       redirectUrl.searchParams.set("fb_error", longTokenData.error.message || "long_token_exchange_failed");
       return Response.redirect(redirectUrl.toString(), 302);
    }

    const longToken = longTokenData.access_token;
    const expiresIn = longTokenData.expires_in; // in seconds
    const expiresAt = expiresIn 
      ? new Date(Date.now() + expiresIn * 1000).toISOString()
      : new Date(Date.now() + 59 * 24 * 60 * 60 * 1000).toISOString();

    // 2.5 Fetch user name
    const userResponse = await fetch(`https://graph.facebook.com/v18.0/me?access_token=${longToken}&fields=name`);
    const userData = await userResponse.json();
    const userName = userData.name || "Conta Facebook";

    // 3. Save to database

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: dbError } = await supabase
      .from("facebook_integrations")
      .upsert({
        tenant_id: tenantId,
        access_token: longToken,
        token_type: 'long_lived',
        expires_at: expiresAt,
        status: 'connected',
        connected_account_name: userName,
        connected_at: new Date().toISOString(),
      }, { onConflict: 'tenant_id' });


    if (dbError) {
      console.error("Database Save Error:", dbError);
      redirectUrl.searchParams.set("fb_status", "error");
      redirectUrl.searchParams.set("fb_error", "db_save_failed");
      return Response.redirect(redirectUrl.toString(), 302);
    }

    console.log(`OAuth successful for tenant: ${tenantId}`);
    redirectUrl.searchParams.set("fb_status", "success");
    return Response.redirect(redirectUrl.toString(), 302);

  } catch (err) {
    console.error("OAuth Callback Error:", err);
    redirectUrl.searchParams.set("fb_status", "error");
    redirectUrl.searchParams.set("fb_error", "internal_server_error");
    return Response.redirect(redirectUrl.toString(), 302);
  }
});
