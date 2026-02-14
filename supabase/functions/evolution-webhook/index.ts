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
    // ===== RATE LIMITING =====
    const url = new URL(req.url);
    const instanceKey = url.searchParams.get("instance");
    const identifier = instanceKey || req.headers.get("x-forwarded-for") || req.headers.get("cf-connecting-ip") || "unknown";
    
    const supabaseRL = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: allowed } = await supabaseRL.rpc("check_rate_limit", {
      _function_name: "evolution-webhook",
      _identifier: identifier,
      _window_seconds: 60,
      _max_requests: 120, // webhooks can be bursty
    });
    if (allowed === false) {
      console.warn(`[evolution-webhook] Rate limited: ${identifier}`);
      return new Response(JSON.stringify({ error: "Rate limit exceeded" }), {
        status: 429,
        headers: { ...corsHeaders, "Content-Type": "application/json", "Retry-After": "60" },
      });
    }

    const webhookSecret = url.searchParams.get("secret");

    if (!instanceKey) {
      console.error("[evolution-webhook] Missing instance key");
      return new Response(JSON.stringify({ error: "Missing instance key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const eventType = body.event || body.type || "unknown";
    console.log(`[evolution-webhook] Event received for instance=${instanceKey}, type=${eventType}`);

    // Create admin client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up the instance — try multiple strategies
    let instance: { id: string; tenant_id: string; webhook_secret: string } | null = null;

    // Strategy 1: Try by evolution_instance_key (exact match)
    const { data: byKey } = await supabase
      .from("wa_instances")
      .select("id, tenant_id, webhook_secret")
      .eq("evolution_instance_key", instanceKey)
      .maybeSingle();

    if (byKey) {
      instance = byKey;
      console.log(`[evolution-webhook] Found instance by evolution_instance_key: ${instance.id}`);
    }

    // Strategy 2: Try by ID (if instanceKey looks like UUID)
    if (!instance) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(instanceKey);
      if (isUuid) {
        const { data: byId } = await supabase
          .from("wa_instances")
          .select("id, tenant_id, webhook_secret")
          .eq("id", instanceKey)
          .maybeSingle();
        if (byId) {
          instance = byId;
          console.log(`[evolution-webhook] Found instance by ID: ${instance.id}`);
        }
      }
    }

    // Strategy 3: Try by webhook_secret match (if secret was provided)
    if (!instance && webhookSecret) {
      const { data: bySecret } = await supabase
        .from("wa_instances")
        .select("id, tenant_id, webhook_secret")
        .eq("webhook_secret", webhookSecret)
        .maybeSingle();
      if (bySecret) {
        instance = bySecret;
        console.log(`[evolution-webhook] Found instance by webhook_secret: ${instance.id}`);
      }
    }

    // No fallback — if no strategy matched, reject
    if (!instance) {
      console.error(`[evolution-webhook] Instance not found by any strategy: ${instanceKey}`);
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // G3: Tenant status enforcement — reject webhooks for inactive tenants
    const { data: tenantCheck } = await supabase
      .from("tenants")
      .select("status, deleted_at")
      .eq("id", instance.tenant_id)
      .single();

    if (!tenantCheck || tenantCheck.status !== "active" || tenantCheck.deleted_at) {
      console.warn(`[evolution-webhook] Tenant ${instance.tenant_id} inactive (${tenantCheck?.status}), rejecting webhook`);
      return new Response(JSON.stringify({ error: "tenant_inactive" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate webhook secret if both are provided
    if (webhookSecret && instance.webhook_secret && webhookSecret !== instance.webhook_secret) {
      console.error(`[evolution-webhook] Invalid webhook secret for instance=${instanceKey}`);
      return new Response(JSON.stringify({ error: "Invalid secret" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Queue the event for processing
    const { error: insertError } = await supabase
      .from("wa_webhook_events")
      .insert({
        instance_id: instance.id,
        tenant_id: instance.tenant_id,
        event_type: eventType,
        payload: body,
        processed: false,
      });

    if (insertError) {
      console.error("[evolution-webhook] Failed to queue event:", insertError);
      return new Response(JSON.stringify({ error: "Failed to queue event" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[evolution-webhook] Event queued: type=${eventType}, instance=${instance.id}`);

    // Auto-trigger processing for message and status events
    const autoTriggerEvents = [
      "messages.upsert", "MESSAGES_UPSERT",
      "messages.update", "MESSAGES_UPDATE",
      "connection.update", "CONNECTION_UPDATE",
      "contacts.upsert", "CONTACTS_UPSERT",
    ];
    if (autoTriggerEvents.includes(eventType)) {
      try {
        const processUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-webhook-events`;
        fetch(processUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
        }).catch(e => console.warn("[evolution-webhook] Auto-process trigger failed:", e));
      } catch (e) {
        console.warn("[evolution-webhook] Auto-process trigger error:", e);
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[evolution-webhook] Unhandled error:", err);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
