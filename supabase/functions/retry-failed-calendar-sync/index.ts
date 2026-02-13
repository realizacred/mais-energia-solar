import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Retry failed Google Calendar syncs.
 * Runs periodically via pg_cron to pick up appointments
 * that were saved internally but failed to sync to Google.
 *
 * Only retries appointments where:
 * - google_sync_status = 'failed'
 * - status != 'cancelled'
 * - created in the last 7 days (avoid retrying very old ones)
 * - max 3 retry attempts (tracked via sync logs count)
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find failed appointments from last 7 days
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: failedAppointments, error: fetchErr } = await supabaseAdmin
      .from("appointments")
      .select("id, tenant_id, assigned_to, title, description, starts_at, ends_at, appointment_type, google_event_id")
      .eq("google_sync_status", "failed")
      .neq("status", "cancelled")
      .gte("created_at", sevenDaysAgo)
      .limit(50);

    if (fetchErr) {
      console.error("Error fetching failed appointments:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!failedAppointments || failedAppointments.length === 0) {
      return new Response(JSON.stringify({ message: "No failed syncs to retry", retried: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let retried = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const appt of failedAppointments) {
      try {
        // Check retry count (max 3 attempts)
        const { count } = await supabaseAdmin
          .from("agenda_sync_logs")
          .select("id", { count: "exact", head: true })
          .eq("appointment_id", appt.id)
          .eq("action", "retry");

        if ((count || 0) >= 3) {
          // Mark as permanently failed
          await supabaseAdmin
            .from("appointments")
            .update({ google_sync_status: "permanently_failed" })
            .eq("id", appt.id);
          skipped++;
          continue;
        }

        // Check if tenant has Google sync enabled
        const { data: config } = await supabaseAdmin
          .from("agenda_config")
          .select("google_sync_enabled")
          .eq("tenant_id", appt.tenant_id)
          .maybeSingle();

        if (!config?.google_sync_enabled) {
          // Tenant disabled sync, clear the failed status
          await supabaseAdmin
            .from("appointments")
            .update({ google_sync_status: "not_synced" })
            .eq("id", appt.id);
          skipped++;
          continue;
        }

        // Get calendar token for assigned user
        const userId = appt.assigned_to;
        if (!userId) {
          skipped++;
          continue;
        }

        const { data: calToken } = await supabaseAdmin
          .from("google_calendar_tokens")
          .select("*")
          .eq("user_id", userId)
          .eq("is_active", true)
          .maybeSingle();

        if (!calToken) {
          skipped++;
          continue;
        }

        // Get OAuth credentials
        const { data: configs } = await supabaseAdmin
          .from("integration_configs")
          .select("service_key, api_key")
          .eq("tenant_id", appt.tenant_id)
          .in("service_key", ["google_calendar_client_id", "google_calendar_client_secret"])
          .eq("is_active", true);

        const clientId = configs?.find(c => c.service_key === "google_calendar_client_id")?.api_key;
        const clientSecret = configs?.find(c => c.service_key === "google_calendar_client_secret")?.api_key;

        if (!clientId || !clientSecret) {
          skipped++;
          continue;
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
            skipped++;
            continue;
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

        const calendarId = calToken.calendar_id || "primary";

        // Build Google Calendar event
        const gcalEvent = {
          summary: appt.title,
          description: appt.description || "",
          start: { dateTime: appt.starts_at, timeZone: "America/Sao_Paulo" },
          end: {
            dateTime: appt.ends_at || new Date(new Date(appt.starts_at).getTime() + 60 * 60 * 1000).toISOString(),
            timeZone: "America/Sao_Paulo",
          },
          reminders: { useDefault: false, overrides: [{ method: "popup", minutes: 30 }] },
        };

        let googleResponse: any;

        if (appt.google_event_id) {
          // Try update
          googleResponse = await updateCalendarEvent(accessToken, calendarId, appt.google_event_id, gcalEvent);
        } else {
          // Create new
          googleResponse = await createCalendarEvent(accessToken, calendarId, gcalEvent);
        }

        const eventId = googleResponse?.id;

        if (eventId) {
          await supabaseAdmin
            .from("appointments")
            .update({
              google_event_id: eventId,
              google_sync_status: "synced",
              google_sync_error: null,
              google_synced_at: new Date().toISOString(),
            })
            .eq("id", appt.id);

          await supabaseAdmin.from("agenda_sync_logs").insert({
            appointment_id: appt.id,
            action: "retry",
            status: "success",
            google_event_id: eventId,
            tenant_id: appt.tenant_id,
          });

          retried++;
        }
      } catch (err: any) {
        console.error(`Retry failed for appointment ${appt.id}:`, err);
        errors.push(`${appt.id}: ${err.message}`);

        await supabaseAdmin.from("agenda_sync_logs").insert({
          appointment_id: appt.id,
          action: "retry",
          status: "error",
          error_message: err.message || String(err),
          tenant_id: appt.tenant_id,
        });
      }
    }

    return new Response(
      JSON.stringify({
        message: "Retry complete",
        total: failedAppointments.length,
        retried,
        skipped,
        errors: errors.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("retry-failed-calendar-sync error:", error);
    return new Response(JSON.stringify({ error: error?.message || String(error) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ─── Helpers ───

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

async function createCalendarEvent(accessToken: string, calendarId: string, event: any) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) throw new Error(`Create event failed: ${res.status}`);
  return await res.json();
}

async function updateCalendarEvent(accessToken: string, calendarId: string, eventId: string, event: any) {
  const res = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events/${encodeURIComponent(eventId)}`,
    {
      method: "PATCH",
      headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
      body: JSON.stringify(event),
    }
  );
  if (!res.ok) {
    if (res.status === 404) return await createCalendarEvent(accessToken, calendarId, event);
    throw new Error(`Update event failed: ${res.status}`);
  }
  return await res.json();
}
