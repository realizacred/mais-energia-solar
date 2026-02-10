import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
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

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { action } = body;

    // Admin client for service operations
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get user tenant
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "No tenant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const tenantId = profile.tenant_id;

    switch (action) {
      case "subscribe": {
        const { endpoint, p256dh, auth, userAgent } = body;
        if (!endpoint || !p256dh || !auth) {
          return new Response(JSON.stringify({ error: "Missing subscription data" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Upsert subscription (idempotent by user_id + endpoint)
        const { data, error } = await adminClient
          .from("push_subscriptions")
          .upsert(
            {
              user_id: user.id,
              tenant_id: tenantId,
              endpoint,
              p256dh,
              auth,
              user_agent: userAgent || null,
              is_active: true,
              last_seen_at: new Date().toISOString(),
            },
            { onConflict: "user_id,endpoint" }
          )
          .select("id")
          .single();

        if (error) throw error;

        // Ensure push_preferences exists
        await adminClient
          .from("push_preferences")
          .upsert(
            { user_id: user.id, tenant_id: tenantId, enabled: true },
            { onConflict: "user_id" }
          );

        return new Response(JSON.stringify({ success: true, id: data.id }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "unsubscribe": {
        const { endpoint: ep } = body;
        if (ep) {
          await adminClient
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("user_id", user.id)
            .eq("endpoint", ep);
        } else {
          // Deactivate all
          await adminClient
            .from("push_subscriptions")
            .update({ is_active: false })
            .eq("user_id", user.id);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "heartbeat": {
        const { endpoint: hbEp } = body;
        if (hbEp) {
          await adminClient
            .from("push_subscriptions")
            .update({ last_seen_at: new Date().toISOString() })
            .eq("user_id", user.id)
            .eq("endpoint", hbEp)
            .eq("is_active", true);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "update_preferences": {
        const { enabled, quiet_hours_start, quiet_hours_end } = body;
        await adminClient
          .from("push_preferences")
          .upsert(
            {
              user_id: user.id,
              tenant_id: tenantId,
              enabled: enabled ?? true,
              quiet_hours_start: quiet_hours_start || null,
              quiet_hours_end: quiet_hours_end || null,
            },
            { onConflict: "user_id" }
          );

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "mute_conversation": {
        const { conversationId, muted, mutedUntil } = body;
        if (!conversationId) {
          return new Response(JSON.stringify({ error: "Missing conversationId" }), {
            status: 400,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        if (muted) {
          await adminClient
            .from("push_muted_conversations")
            .upsert(
              {
                user_id: user.id,
                tenant_id: tenantId,
                conversation_id: conversationId,
                muted_until: mutedUntil || null,
              },
              { onConflict: "user_id,conversation_id" }
            );
        } else {
          await adminClient
            .from("push_muted_conversations")
            .delete()
            .eq("user_id", user.id)
            .eq("conversation_id", conversationId);
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "list_devices": {
        const { data: devices } = await adminClient
          .from("push_subscriptions")
          .select("id, endpoint, user_agent, is_active, created_at, last_seen_at")
          .eq("user_id", user.id)
          .order("last_seen_at", { ascending: false });

        return new Response(JSON.stringify({ devices: devices || [] }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      case "remove_device": {
        const { subscriptionId } = body;
        if (subscriptionId) {
          await adminClient
            .from("push_subscriptions")
            .delete()
            .eq("id", subscriptionId)
            .eq("user_id", user.id);
        }
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      default:
        return new Response(JSON.stringify({ error: "Invalid action" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
  } catch (err) {
    console.error("[register-push-subscription] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
