import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Google Calendar Sync — creates, updates or deletes calendar events.
 * 
 * Body:
 *  - action: "create" | "update" | "delete"
 *  - event_type: "servico" | "followup"
 *  - record_id: UUID of servicos_agendados or wa_followup_queue
 *  - event_data: { summary, description, start, end, location? }
 *  - user_id?: optional, defaults to assigned user
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

    const callerUserId = claimsData.claims.sub;

    const body = await req.json();
    const { action, event_type, record_id, event_data, user_id } = body;

    if (!action || !event_type || !record_id) {
      return new Response(JSON.stringify({ error: "action, event_type, record_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Determine which user's calendar to use
    const targetUserId = user_id || callerUserId;

    // Get calendar token for the target user
    const { data: calToken } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("*")
      .eq("user_id", targetUserId)
      .eq("is_active", true)
      .maybeSingle();

    if (!calToken) {
      return new Response(
        JSON.stringify({ error: "User has no connected Google Calendar", skipped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tenant's OAuth credentials for token refresh
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
        JSON.stringify({ error: "Google Calendar OAuth not configured for tenant" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Refresh token if expired
    let accessToken = calToken.access_token;
    if (new Date(calToken.token_expires_at) <= new Date()) {
      const refreshed = await refreshAccessToken(clientId, clientSecret, calToken.refresh_token);
      if (!refreshed) {
        // Mark token as inactive
        await supabaseAdmin
          .from("google_calendar_tokens")
          .update({ is_active: false })
          .eq("id", calToken.id);
        return new Response(
          JSON.stringify({ error: "Failed to refresh Google token. User must reconnect." }),
          { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      accessToken = refreshed.access_token;
      // Update stored token
      await supabaseAdmin
        .from("google_calendar_tokens")
        .update({
          access_token: refreshed.access_token,
          token_expires_at: new Date(Date.now() + (refreshed.expires_in || 3600) * 1000).toISOString(),
        })
        .eq("id", calToken.id);
    }

    const calendarId = calToken.calendar_id || "primary";
    const table = event_type === "servico" ? "servicos_agendados" : "wa_followup_queue";

    // Get existing event ID
    const { data: record } = await supabaseAdmin
      .from(table)
      .select("google_calendar_event_id")
      .eq("id", record_id)
      .maybeSingle();

    let result: any;

    if (action === "delete") {
      if (record?.google_calendar_event_id) {
        await deleteCalendarEvent(accessToken, calendarId, record.google_calendar_event_id);
        await supabaseAdmin
          .from(table)
          .update({ google_calendar_event_id: null })
          .eq("id", record_id);
      }
      result = { deleted: true };
    } else if (action === "create" || action === "update") {
      if (!event_data?.summary || !event_data?.start) {
        return new Response(JSON.stringify({ error: "event_data.summary and event_data.start required" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const gcalEvent = {
        summary: event_data.summary,
        description: event_data.description || "",
        location: event_data.location || "",
        start: {
          dateTime: event_data.start,
          timeZone: "America/Sao_Paulo",
        },
        end: {
          dateTime: event_data.end || new Date(new Date(event_data.start).getTime() + 60 * 60 * 1000).toISOString(),
          timeZone: "America/Sao_Paulo",
        },
        reminders: {
          useDefault: false,
          overrides: [
            { method: "popup", minutes: 30 },
          ],
        },
      };

      let eventId: string;

      if (record?.google_calendar_event_id && action === "update") {
        // Update existing event
        const updated = await updateCalendarEvent(accessToken, calendarId, record.google_calendar_event_id, gcalEvent);
        eventId = updated?.id || record.google_calendar_event_id;
      } else {
        // Create new event
        const created = await createCalendarEvent(accessToken, calendarId, gcalEvent);
        eventId = created?.id;
      }

      if (eventId) {
        await supabaseAdmin
          .from(table)
          .update({ google_calendar_event_id: eventId })
          .eq("id", record_id);
      }

      result = { event_id: eventId, action };
    }

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("google-calendar-sync error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─── Google Calendar API helpers ───

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
    if (!res.ok) {
      console.error("Token refresh failed:", await res.text());
      return null;
    }
    return await res.json();
  } catch (e) {
    console.error("Token refresh error:", e);
    return null;
  }
}

async function createCalendarEvent(accessToken: string, calendarId: string, event: any) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error("Create event error:", err);
    throw new Error(`Failed to create calendar event: ${res.status}`);
  }
  return await res.json();
}

async function updateCalendarEvent(accessToken: string, calendarId: string, eventId: string, event: any) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) {
    const err = await res.text();
    console.error("Update event error:", err);
    // If event not found, create a new one
    if (res.status === 404) {
      return await createCalendarEvent(accessToken, calendarId, event);
    }
    throw new Error(`Failed to update calendar event: ${res.status}`);
  }
  return await res.json();
}

async function deleteCalendarEvent(accessToken: string, calendarId: string, eventId: string) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  if (!res.ok && res.status !== 404) {
    console.error("Delete event error:", await res.text());
  }
}
