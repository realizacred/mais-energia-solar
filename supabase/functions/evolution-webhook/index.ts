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
    const url = new URL(req.url);
    // Instance key comes as query param: ?instance=INSTANCE_KEY
    const instanceKey = url.searchParams.get("instance");
    const webhookSecret = url.searchParams.get("secret");

    if (!instanceKey) {
      console.error("[evolution-webhook] Missing instance key");
      return new Response(JSON.stringify({ error: "Missing instance key" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    console.log(`[evolution-webhook] Event received for instance=${instanceKey}, type=${body.event || "unknown"}`);

    // Create admin client
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Look up the instance
    const { data: instance, error: instanceError } = await supabase
      .from("wa_instances")
      .select("id, tenant_id, webhook_secret")
      .eq("evolution_instance_key", instanceKey)
      .single();

    if (instanceError || !instance) {
      console.error(`[evolution-webhook] Instance not found: ${instanceKey}`, instanceError);
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate webhook secret if provided
    if (webhookSecret && webhookSecret !== instance.webhook_secret) {
      console.error(`[evolution-webhook] Invalid webhook secret for instance=${instanceKey}`);
      return new Response(JSON.stringify({ error: "Invalid secret" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Determine event type from Evolution API payload
    const eventType = body.event || body.type || "unknown";

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

    console.log(`[evolution-webhook] Event queued successfully: type=${eventType}, instance=${instanceKey}`);

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
