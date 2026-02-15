import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

/**
 * Polls Google Calendar for changes for all connected users.
 * Called via pg_cron every 10 minutes.
 * Uses incremental sync tokens to fetch only deltas.
 *
 * Security: Validates Authorization header matches SUPABASE_ANON_KEY or service_role.
 * Anti-loop: Skips events already tracked locally with source='crm'.
 * Pagination: Handles nextPageToken for large result sets.
 */
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ── Auth guard: only pg_cron / service_role can call this ──
    const authHeader = req.headers.get("Authorization");
    const expectedAnon = Deno.env.get("SUPABASE_ANON_KEY");
    const expectedService = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    if (token !== expectedAnon && token !== expectedService) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all active calendar tokens
    const { data: tokens, error: tokensError } = await supabaseAdmin
      .from("google_calendar_tokens")
      .select("id, user_id, tenant_id, access_token, refresh_token, token_expires_at, calendar_id, sync_token, last_synced_at")
      .eq("is_active", true);

    if (tokensError) throw tokensError;
    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({ message: "No connected calendars", synced: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Group tokens by tenant to batch OAuth credential lookups
    const tenantIds = [...new Set(tokens.map((t) => t.tenant_id))];
    const tenantConfigs = new Map<
      string,
      { clientId: string; clientSecret: string }
    >();

    for (const tenantId of tenantIds) {
      const { data: configs } = await supabaseAdmin
        .from("integration_configs")
        .select("service_key, api_key")
        .eq("tenant_id", tenantId)
        .in("service_key", [
          "google_calendar_client_id",
          "google_calendar_client_secret",
        ])
        .eq("is_active", true);

      const clientId = configs?.find(
        (c) => c.service_key === "google_calendar_client_id"
      )?.api_key;
      const clientSecret = configs?.find(
        (c) => c.service_key === "google_calendar_client_secret"
      )?.api_key;

      if (clientId && clientSecret) {
        tenantConfigs.set(tenantId, { clientId, clientSecret });
      }
    }

    let totalSynced = 0;
    let totalErrors = 0;

    // Process each user's calendar sequentially to respect rate limits
    for (const calToken of tokens) {
      try {
        const config = tenantConfigs.get(calToken.tenant_id);
        if (!config) continue;

        // Refresh token if expired
        let accessToken = calToken.access_token;
        if (new Date(calToken.token_expires_at) <= new Date()) {
          const refreshed = await refreshAccessToken(
            config.clientId,
            config.clientSecret,
            calToken.refresh_token
          );
          if (!refreshed) {
            await supabaseAdmin
              .from("google_calendar_tokens")
              .update({ is_active: false })
              .eq("id", calToken.id);
            console.warn(
              `Token refresh failed for user ${calToken.user_id}, deactivated.`
            );
            totalErrors++;
            continue;
          }
          accessToken = refreshed.access_token;
          await supabaseAdmin
            .from("google_calendar_tokens")
            .update({
              access_token: refreshed.access_token,
              token_expires_at: new Date(
                Date.now() + (refreshed.expires_in || 3600) * 1000
              ).toISOString(),
            })
            .eq("id", calToken.id);
        }

        const calendarId = calToken.calendar_id || "primary";
        const syncToken = calToken.sync_token;

        let events: any[] = [];
        let nextSyncToken: string | null = null;

        if (syncToken) {
          const result = await fetchEventsWithPagination(
            accessToken,
            calendarId,
            syncToken,
            "incremental"
          );
          if (result.invalidSync) {
            // syncToken expired → full sync
            const fullResult = await fetchEventsWithPagination(
              accessToken,
              calendarId,
              null,
              "full"
            );
            events = fullResult.events;
            nextSyncToken = fullResult.nextSyncToken;
          } else {
            events = result.events;
            nextSyncToken = result.nextSyncToken;
          }
        } else {
          const fullResult = await fetchEventsWithPagination(
            accessToken,
            calendarId,
            null,
            "full"
          );
          events = fullResult.events;
          nextSyncToken = fullResult.nextSyncToken;
        }

        // ── Anti-loop: load existing CRM-originated event IDs ──
        let crmEventIds = new Set<string>();
        if (events.length > 0) {
          const googleIds = events.map((e) => e.id).filter(Boolean);
          if (googleIds.length > 0) {
            const { data: existing } = await supabaseAdmin
              .from("google_calendar_events")
              .select("google_event_id")
              .eq("user_id", calToken.user_id)
              .eq("source", "crm")
              .in("google_event_id", googleIds);
            crmEventIds = new Set(
              (existing || []).map((e) => e.google_event_id)
            );
          }
        }

        // Upsert non-cancelled events
        if (events.length > 0) {
          const rows = events
            .filter((e) => e.status !== "cancelled")
            .map((e) => {
              const startRaw = e.start?.dateTime || e.start?.date;
              const endRaw = e.end?.dateTime || e.end?.date;
              const isAllDay = !e.start?.dateTime && !!e.start?.date;

              return {
                user_id: calToken.user_id,
                tenant_id: calToken.tenant_id,
                google_event_id: e.id,
                summary: e.summary || "(Sem título)",
                description: (e.description || "").slice(0, 2000),
                location: e.location || "",
                start_at: startRaw || new Date().toISOString(),
                end_at: endRaw || null,
                status: e.status || "confirmed",
                html_link: e.htmlLink || "",
                is_all_day: isAllDay,
                google_updated_at: e.updated || null,
                // Anti-loop: preserve 'crm' source if already tracked
                source: crmEventIds.has(e.id) ? "crm" : "google",
                synced_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              };
            });

          if (rows.length > 0) {
            const { error: upsertError } = await supabaseAdmin
              .from("google_calendar_events")
              .upsert(rows, { onConflict: "user_id,google_event_id" });

            if (upsertError) {
              console.error(
                `Upsert error for user ${calToken.user_id}:`,
                upsertError
              );
            }
          }

          // Handle cancelled events
          const cancelledIds = events
            .filter((e) => e.status === "cancelled")
            .map((e) => e.id);

          if (cancelledIds.length > 0) {
            await supabaseAdmin
              .from("google_calendar_events")
              .delete()
              .eq("user_id", calToken.user_id)
              .eq("tenant_id", calToken.tenant_id)
              .in("google_event_id", cancelledIds);
          }
        }

        // Update sync token
        await supabaseAdmin
          .from("google_calendar_tokens")
          .update({
            sync_token: nextSyncToken || calToken.sync_token,
            last_synced_at: new Date().toISOString(),
          })
          .eq("id", calToken.id);

        totalSynced++;
      } catch (userError: any) {
        console.error(
          `Error syncing calendar for user ${calToken.user_id}:`,
          userError.message
        );
        totalErrors++;
      }
    }

    return new Response(
      JSON.stringify({
        message: "Poll complete",
        total_users: tokens.length,
        synced: totalSynced,
        errors: totalErrors,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("google-calendar-poll error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

// ─── Helpers ───

async function refreshAccessToken(
  clientId: string,
  clientSecret: string,
  refreshToken: string
) {
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

/**
 * Fetches events with full pagination support (nextPageToken).
 * mode = 'incremental' uses syncToken, 'full' uses timeMin/timeMax.
 */
async function fetchEventsWithPagination(
  accessToken: string,
  calendarId: string,
  syncToken: string | null,
  mode: "incremental" | "full"
): Promise<{
  events: any[];
  nextSyncToken: string | null;
  invalidSync: boolean;
}> {
  const allEvents: any[] = [];
  let pageToken: string | null = null;
  let nextSyncToken: string | null = null;
  const maxPages = 10; // Safety limit: 10 pages × 250 = 2500 events max
  let pageCount = 0;

  do {
    const url = new URL(
      `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(calendarId)}/events`
    );
    url.searchParams.set("maxResults", "250");

    if (mode === "incremental" && syncToken && !pageToken) {
      url.searchParams.set("syncToken", syncToken);
    } else if (mode === "full" && !pageToken) {
      const timeMin = new Date().toISOString();
      const timeMax = new Date(
        Date.now() + 90 * 24 * 60 * 60 * 1000
      ).toISOString();
      url.searchParams.set("timeMin", timeMin);
      url.searchParams.set("timeMax", timeMax);
      url.searchParams.set("singleEvents", "true");
      url.searchParams.set("orderBy", "startTime");
    }

    if (pageToken) {
      url.searchParams.set("pageToken", pageToken);
    }

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (res.status === 410) {
      return { events: [], nextSyncToken: null, invalidSync: true };
    }

    if (!res.ok) {
      throw new Error(`Calendar API error: ${res.status}`);
    }

    const data = await res.json();
    allEvents.push(...(data.items || []));
    pageToken = data.nextPageToken || null;
    nextSyncToken = data.nextSyncToken || nextSyncToken;
    pageCount++;
  } while (pageToken && pageCount < maxPages);

  if (pageCount >= maxPages) {
    console.warn(
      `Hit max pages (${maxPages}) for calendar ${calendarId}. Some events may be missing.`
    );
  }

  return { events: allEvents, nextSyncToken, invalidSync: false };
}
