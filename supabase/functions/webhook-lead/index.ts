import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface WebhookPayload {
  type: "INSERT" | "UPDATE" | "DELETE";
  table: string;
  record: Record<string, unknown>;
  old_record?: Record<string, unknown>;
}

Deno.serve(async (req: Request) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const payload: WebhookPayload = await req.json();
    console.log("Webhook received:", JSON.stringify(payload, null, 2));

    // Get webhook URLs from environment (can be set via secrets)
    const webhookUrls = Deno.env.get("WEBHOOK_URLS")?.split(",") || [];
    const n8nWebhookUrl = Deno.env.get("N8N_WEBHOOK_URL");

    if (n8nWebhookUrl) {
      webhookUrls.push(n8nWebhookUrl);
    }

    // Forward to all configured webhooks
    const results = await Promise.allSettled(
      webhookUrls
        .filter((url) => url.trim())
        .map(async (url) => {
          console.log(`Sending to webhook: ${url}`);
          const response = await fetch(url.trim(), {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              event: payload.type,
              table: payload.table,
              data: payload.record,
              old_data: payload.old_record,
              timestamp: new Date().toISOString(),
            }),
          });
          return { url, status: response.status };
        })
    );

    console.log("Webhook results:", results);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Webhook processed",
        results: results.map((r) =>
          r.status === "fulfilled" ? r.value : { error: r.reason }
        ),
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({ success: false, error: String(error) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
