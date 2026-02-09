import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
  if (!EVOLUTION_API_KEY) {
    console.error("[process-wa-outbox] EVOLUTION_API_KEY not configured");
    return new Response(JSON.stringify({ error: "EVOLUTION_API_KEY not configured" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Fetch pending outbox items
    const { data: items, error: fetchError } = await supabase
      .from("wa_outbox")
      .select("*, wa_instances!inner(evolution_instance_key, evolution_api_url, status)")
      .eq("status", "pending")
      .lte("scheduled_at", new Date().toISOString())
      .lt("retry_count", 3)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("[process-wa-outbox] Fetch error:", fetchError);
      throw fetchError;
    }

    if (!items || items.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[process-wa-outbox] Processing ${items.length} messages`);

    let sent = 0;
    let failed = 0;

    for (const item of items) {
      try {
        // Mark as sending
        await supabase
          .from("wa_outbox")
          .update({ status: "sending" })
          .eq("id", item.id);

        const instance = item.wa_instances;
        
        if (instance.status !== "connected") {
          throw new Error(`Instance ${instance.evolution_instance_key} is not connected (${instance.status})`);
        }

        // Send via Evolution API
        const sendResult = await sendEvolutionMessage(
          instance.evolution_api_url,
          instance.evolution_instance_key,
          EVOLUTION_API_KEY,
          item
        );

        // Extract the Evolution message ID from the response
        const evolutionMessageId = sendResult?.key?.id || sendResult?.id || null;

        // Mark outbox item as sent
        await supabase
          .from("wa_outbox")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("id", item.id);

        // Update message status AND save evolution_message_id for delivery tracking
        if (item.message_id) {
          const msgUpdate: Record<string, unknown> = { status: "sent" };
          if (evolutionMessageId) {
            msgUpdate.evolution_message_id = evolutionMessageId;
          }
          await supabase
            .from("wa_messages")
            .update(msgUpdate)
            .eq("id", item.message_id);
        }

        sent++;
      } catch (err) {
        console.error(`[process-wa-outbox] Failed to send item ${item.id}:`, err);

        const retryCount = (item.retry_count || 0) + 1;
        const newStatus = retryCount >= item.max_retries ? "failed" : "pending";

        await supabase
          .from("wa_outbox")
          .update({
            status: newStatus,
            retry_count: retryCount,
            error_message: String(err),
          })
          .eq("id", item.id);

        // Update message status if failed permanently
        if (newStatus === "failed" && item.message_id) {
          await supabase
            .from("wa_messages")
            .update({ status: "failed", error_message: String(err) })
            .eq("id", item.message_id);
        }

        failed++;
      }
    }

    console.log(`[process-wa-outbox] Done: ${sent} sent, ${failed} failed`);

    return new Response(
      JSON.stringify({ sent, failed, total: items.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[process-wa-outbox] Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Evolution API Integration ─────────────────────────────

async function sendEvolutionMessage(
  apiUrl: string,
  instanceKey: string,
  apiKey: string,
  item: any
) {
  const baseUrl = apiUrl.replace(/\/$/, "");
  let endpoint: string;
  let body: any;

  switch (item.message_type) {
    case "text":
      endpoint = `/message/sendText/${instanceKey}`;
      body = {
        number: item.remote_jid.replace("@s.whatsapp.net", ""),
        text: item.content,
      };
      break;

    case "image":
      endpoint = `/message/sendMedia/${instanceKey}`;
      body = {
        number: item.remote_jid.replace("@s.whatsapp.net", ""),
        mediatype: "image",
        media: item.media_url,
        caption: item.content || "",
      };
      break;

    case "document":
      endpoint = `/message/sendMedia/${instanceKey}`;
      body = {
        number: item.remote_jid.replace("@s.whatsapp.net", ""),
        mediatype: "document",
        media: item.media_url,
        caption: item.content || "",
      };
      break;

    case "audio":
      endpoint = `/message/sendWhatsAppAudio/${instanceKey}`;
      body = {
        number: item.remote_jid.replace("@s.whatsapp.net", ""),
        audio: item.media_url,
      };
      break;

    default:
      endpoint = `/message/sendText/${instanceKey}`;
      body = {
        number: item.remote_jid.replace("@s.whatsapp.net", ""),
        text: item.content || "",
      };
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: apiKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Evolution API error [${response.status}]: ${errorBody}`);
  }

  const result = await response.json();
  console.log(`[process-wa-outbox] Message sent via Evolution API: ${JSON.stringify(result?.key || {})}`);
  return result;
}
