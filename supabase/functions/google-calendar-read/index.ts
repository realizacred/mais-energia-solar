import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Reads upcoming events from the authenticated user's Google Calendar.
 * Query params:
 *  - days: number of days ahead to fetch (default 7, max 30)
 *  - max_results: max events (default 20, max 50)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
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

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user's calendar token
    const { data: calToken } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", userId)
      .eq("is_active", true)
      .maybeSingle();

    if (!calToken) {
      return new Response(
        JSON.stringify({ connected: false, events: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get OAuth creds for token refresh
    const { data: configs } = await supabaseAdmin
      .from("integration_configs")
      .select("service_key, api_key")
      .eq("tenant_id", calToken.tenant_id)
      .in("service_key", ["google_calendar_client_id", "google_calendar_client_secret"])
      .eq("is_active", true);

    const clientId = configs?.find(c => c.service_key === "google_calendar_client_id")?.api_key;
    const clientSecret = configs?.find(c => c.service_key === "google_calendar_client_secret")?.api_key;

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ connected: false, events: [], error: "OAuth not configured" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if needed
    let accessToken = calToken.access_token;
    if (new Date(calToken.token_expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(clientId, clientSecret, calToken.refresh_token);
      if (!refreshed) {
        await supabaseAdmin
          .from("google_calendar_tokens")
          .update({ is_active: false })
          .eq("id", calToken.id);
        return new Response(
          JSON.stringify({ connected: false, events: [], error: "Token expired, reconnect required" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshed.access_token;
      await supabaseAdmin
        .from("google_calendar_tokens")
        .update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
        })
        .eq("id", calToken.id);
    }

    // Parse query params
    const url = new URL(req.url);
    const days = Math.min(parseInt(url.searchParams.get("days") || "7"), 30);
    const maxResults = Math.min(parseInt(url.searchParams.get("max_results") || "20"), 50);

    const calendarId = calToken.calendar_id || "primary";
    const timeMin = new Date().toISOString();
    const timeMax = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();

    const eventsUrl = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    eventsUrl.searchParams.set("timeMin", timeMin);
    eventsUrl.searchParams.set("timeMax", timeMax);
    eventsUrl.searchParams.set("maxResults", String(maxResults));
    eventsUrl.searchParams.set("singleEvents", "true");
    eventsUrl.searchParams.set("orderBy", "startTime");

    const res = await fetch(eventsUrl.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const err = await res.text();
      console.error("Google Calendar API error:", err);
      return new Response(
        JSON.stringify({ connected: true, events: [], error: "Failed to fetch events" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await res.json();
    const events = (data.items || []).map((item: any) => ({
      id: item.id,
      summary: item.summary || "(Sem título)",
      description: item.description || "",
      location: item.location || "",
      start: item.start?.dateTime || item.start?.date || "",
      end: item.end?.dateTime || item.end?.date || "",
      htmlLink: item.htmlLink || "",
      status: item.status,
    }));

    return new Response(
      JSON.stringify({ connected: true, events, google_email: calToken.google_email }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("google-calendar-read error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

async function refreshAccessToken(clientId: string, clientSecret: string, refreshToken: string) {
  try {
    const res = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}
