import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonRes(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonRes({ error: "Method not allowed" }, 405);
  }

  const supabaseAdmin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const body = await req.json();
    console.log("[SM Webhook] Received event:", JSON.stringify(body).slice(0, 500));

    // Optional: verify webhook secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    if (webhookSecret) {
      const { data: config } = await supabaseAdmin
        .from("solar_market_config")
        .select("webhook_secret, tenant_id")
        .limit(1)
        .maybeSingle();

      if (config?.webhook_secret && config.webhook_secret !== webhookSecret) {
        console.error("[SM Webhook] Invalid webhook secret");
        return jsonRes({ error: "Invalid webhook secret" }, 401);
      }
    }

    // Get tenant_id from config
    const { data: config } = await supabaseAdmin
      .from("solar_market_config")
      .select("tenant_id, enabled")
      .limit(1)
      .maybeSingle();

    if (!config?.enabled) {
      return jsonRes({ error: "Integration disabled" }, 400);
    }

    // Store the webhook event
    const eventType = body.event || body.type || body.eventType || "unknown";
    const { data: event, error: insertErr } = await supabaseAdmin
      .from("solar_market_webhook_events")
      .insert({
        tenant_id: config.tenant_id,
        event_type: eventType,
        payload: body,
      })
      .select("id")
      .single();

    if (insertErr) {
      console.error("[SM Webhook] Failed to store event:", insertErr.message);
      return jsonRes({ error: "Failed to store event" }, 500);
    }

    console.log(`[SM Webhook] Event stored: ${event.id}`);

    // Try to trigger delta sync based on event content
    const deltaPayload = extractDeltaPayload(body);
    if (deltaPayload) {
      console.log("[SM Webhook] Triggering delta sync:", deltaPayload);

      // Call the sync function internally
      const syncRes = await supabaseAdmin.functions.invoke("solar-market-sync", {
        body: {
          mode: "delta",
          source: "webhook",
          delta: deltaPayload,
        },
      });

      // Mark event as processed
      await supabaseAdmin
        .from("solar_market_webhook_events")
        .update({ processed: true })
        .eq("id", event.id);

      if (syncRes.error) {
        await supabaseAdmin
          .from("solar_market_webhook_events")
          .update({ error: syncRes.error.message })
          .eq("id", event.id);
      }
    }

    return jsonRes({ success: true, event_id: event.id });
  } catch (err: any) {
    console.error("[SM Webhook] Error:", err.message);
    return jsonRes({ error: err.message }, 500);
  }
});

function extractDeltaPayload(body: any): any {
  // Try to extract relevant IDs from webhook payload
  const clientId = body.clientId || body.client_id || body.data?.clientId;
  const projectId = body.projectId || body.project_id || body.data?.projectId;
  const proposalId = body.proposalId || body.proposal_id || body.data?.proposalId;

  if (clientId) {
    return { type: "client", sm_client_id: Number(clientId), sm_project_id: projectId ? Number(projectId) : undefined };
  }
  if (projectId) {
    return { type: "project", sm_project_id: Number(projectId), sm_client_id: clientId ? Number(clientId) : undefined };
  }
  if (proposalId) {
    return { type: "proposal", sm_proposal_id: Number(proposalId) };
  }

  return null;
}
