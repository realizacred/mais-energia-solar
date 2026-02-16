import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * Retry Failed Calendar Sync — called periodically via pg_cron.
 * Also handles:
 * 1. Auto-marking missed appointments
 * 2. Sending push reminders for upcoming appointments
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

    const results: Record<string, any> = {};

    // ── 1) Auto-mark missed appointments ──
    const { error: missedError } = await supabaseAdmin.rpc("auto_mark_missed_appointments");
    results.missed = missedError ? { error: missedError.message } : { ok: true };

    // ── 2) Send push reminders for upcoming appointments ──
    const { data: pendingReminders, error: reminderError } = await supabaseAdmin
      .rpc("get_pending_appointment_reminders");

    if (reminderError) {
      results.reminders = { error: reminderError.message };
    } else if (pendingReminders && pendingReminders.length > 0) {
      let sent = 0;
      let failed = 0;

      for (const appt of pendingReminders) {
        if (!appt.assigned_to) continue;

        try {
          // Send push notification
          const { error: pushError } = await supabaseAdmin.functions.invoke("send-push-notification", {
            body: {
              user_id: appt.assigned_to,
              tenant_id: appt.tenant_id,
              title: `⏰ Lembrete: ${appt.title}`,
              body: `Compromisso em ${appt.reminder_minutes} minutos`,
              event_key: `appointment_reminder:${appt.id}`,
              url: "/consultor/agenda",
            },
          });

          if (pushError) {
            console.error(`Push failed for appointment ${appt.id}:`, pushError);
            failed++;
          } else {
            sent++;
          }

          // Mark reminder as sent regardless (avoid spam)
          await supabaseAdmin
            .from("appointments")
            .update({ reminder_sent: true })
            .eq("id", appt.id);
        } catch (e) {
          console.error(`Reminder error for ${appt.id}:`, e);
          failed++;
          // Still mark as sent to prevent infinite retries
          await supabaseAdmin
            .from("appointments")
            .update({ reminder_sent: true })
            .eq("id", appt.id);
        }
      }

      results.reminders = { total: pendingReminders.length, sent, failed };
    } else {
      results.reminders = { total: 0 };
    }

    // Google Calendar sync removed — no retry needed
    results.retry_sync = { skipped: true };

    return new Response(JSON.stringify({ success: true, ...results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("retry-failed-calendar-sync error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
