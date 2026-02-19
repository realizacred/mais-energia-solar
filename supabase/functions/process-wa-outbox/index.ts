import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const ITEMS_PER_INSTANCE = 50;
const MAX_INSTANCES_PER_RUN = 20;

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
    // ── Step 1: Find all connected instances with pending outbox items ──
    const { data: instances, error: instErr } = await supabase
      .from("wa_instances")
      .select("id, tenant_id, evolution_instance_key, evolution_api_url, status, api_key")
      .eq("status", "connected");

    if (instErr) {
      console.error("[process-wa-outbox] Failed to fetch instances:", instErr);
      throw instErr;
    }

    if (!instances || instances.length === 0) {
      return new Response(JSON.stringify({ sent: 0, message: "no_connected_instances" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Shuffle for fairness and limit to MAX_INSTANCES_PER_RUN
    const shuffled = instances
      .sort(() => Math.random() - 0.5)
      .slice(0, MAX_INSTANCES_PER_RUN);

    let totalSent = 0;
    let totalFailed = 0;
    let totalSkipped = 0;

    // Helper: log ops event (fire-and-forget)
    const logOps = (tenantId: string, instanceId: string | null, eventType: string, payload: Record<string, unknown> = {}) => {
      supabase.from("wa_ops_events").insert({
        tenant_id: tenantId,
        instance_id: instanceId,
        event_type: eventType,
        payload,
      }).then(({ error }) => {
        if (error) console.warn(`[ops] Failed to log ${eventType}:`, error.message);
      });
    };

    // ── Step 2: Process each instance with scoped lock ──
    for (const inst of shuffled) {
      let lockAcquired = false;
      try {
        // Acquire per-instance advisory lock
        const { data: lockResult } = await supabase.rpc("try_outbox_lock", {
          p_tenant_id: inst.tenant_id,
          p_instance_id: inst.id,
        });
        lockAcquired = lockResult === true;

        if (!lockAcquired) {
          console.log(`[process-wa-outbox] Lock busy for instance=${inst.evolution_instance_key}, skipping`);
          logOps(inst.tenant_id, inst.id, "lock_busy", { instance_key: inst.evolution_instance_key });
          totalSkipped++;
          continue;
        }

        // Fetch pending items for THIS instance only
        const { data: items, error: fetchError } = await supabase
          .from("wa_outbox")
          .select("*")
          .eq("instance_id", inst.id)
          .eq("status", "pending")
          .lte("scheduled_at", new Date().toISOString())
          .lt("retry_count", 3)
          .order("created_at", { ascending: true })
          .limit(ITEMS_PER_INSTANCE);

        if (fetchError) {
          console.error(`[process-wa-outbox] Fetch error for instance=${inst.id}:`, fetchError);
          continue;
        }

        if (!items || items.length === 0) continue;

        console.log(`[process-wa-outbox] Processing ${items.length} items for instance=${inst.evolution_instance_key}`);

        for (const item of items) {
          try {
            // Atomic claim
            const { data: claimed, error: claimErr } = await supabase
              .from("wa_outbox")
              .update({ status: "sending" })
              .eq("id", item.id)
              .eq("status", "pending")
              .select("id")
              .maybeSingle();

            if (!claimed || claimErr) {
              console.log(`[process-wa-outbox] Item ${item.id} already claimed, skipping`);
              continue;
            }

            // Use remote_jid_canonical for sending, fallback to remote_jid
            const canonicalJid = item.remote_jid_canonical || item.remote_jid;

            const effectiveApiKey = inst.api_key || EVOLUTION_API_KEY;
            const sendResult = await sendEvolutionMessage(
              inst.evolution_api_url,
              inst.evolution_instance_key,
              effectiveApiKey,
              { ...item, remote_jid: canonicalJid }
            );

            const evolutionMessageId = sendResult?.key?.id || sendResult?.id || null;

            await supabase
              .from("wa_outbox")
              .update({ status: "sent", sent_at: new Date().toISOString() })
              .eq("id", item.id);

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

            logOps(inst.tenant_id, inst.id, "outbox_sent_ack", { outbox_id: item.id, evolution_msg_id: evolutionMessageId });
            totalSent++;
          } catch (err) {
            console.error(`[process-wa-outbox] Failed item ${item.id}:`, err);
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

            if (newStatus === "failed" && item.message_id) {
              await supabase
                .from("wa_messages")
                .update({ status: "failed", error_message: String(err) })
                .eq("id", item.message_id);
            }

            logOps(inst.tenant_id, inst.id, "outbox_failed", { outbox_id: item.id, error: String(err), retry_count: retryCount, final: newStatus === "failed" });
            totalFailed++;
          }
        }
      } finally {
        // Always release per-instance lock
        if (lockAcquired) {
          try {
            await supabase.rpc("release_outbox_lock", {
              p_tenant_id: inst.tenant_id,
              p_instance_id: inst.id,
            });
          } catch (e) {
            console.warn(`[process-wa-outbox] Failed to release lock for instance=${inst.id}:`, e);
          }
        }
      }
    }

    console.log(`[process-wa-outbox] Done: ${totalSent} sent, ${totalFailed} failed, ${totalSkipped} instances skipped (locked)`);

    return new Response(
      JSON.stringify({ sent: totalSent, failed: totalFailed, skipped: totalSkipped, instances: shuffled.length }),
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

  // Extract number from canonical JID
  const number = item.remote_jid.replace("@s.whatsapp.net", "").replace("@c.us", "");

  switch (item.message_type) {
    case "text":
      endpoint = `/message/sendText/${instanceKey}`;
      body = { number, text: item.content };
      break;
    case "image":
      endpoint = `/message/sendMedia/${instanceKey}`;
      body = { number, mediatype: "image", media: item.media_url, caption: item.content || "" };
      break;
    case "document":
      endpoint = `/message/sendMedia/${instanceKey}`;
      body = { number, mediatype: "document", media: item.media_url, caption: item.content || "" };
      break;
    case "audio":
      endpoint = `/message/sendWhatsAppAudio/${instanceKey}`;
      body = { number, audio: item.media_url };
      break;
    case "video":
      endpoint = `/message/sendMedia/${instanceKey}`;
      body = { number, mediatype: "video", media: item.media_url, caption: item.content || "" };
      break;
    default:
      endpoint = `/message/sendText/${instanceKey}`;
      body = { number, text: item.content || "" };
  }

  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: apiKey },
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
