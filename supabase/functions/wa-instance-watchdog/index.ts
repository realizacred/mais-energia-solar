import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

/**
 * WA Instance Watchdog — CRON job that:
 * 1. Detects disconnected/error instances
 * 2. Attempts auto-reconnect via Evolution API /instance/connect
 * 3. After reconnect, syncs missed messages via /chat/findMessages
 * 4. Retries failed/pending outbox items
 */

const MAX_RECONNECT_ATTEMPTS = 3;
const RECONNECT_COOLDOWN_MS = 5 * 60 * 1000; // 5 min between reconnect attempts
const MISSED_MESSAGES_WINDOW_HOURS = 6; // sync messages from last 6 hours

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Auth: CRON secret or admin JWT
    const cronSecret = req.headers.get("x-cron-secret");
    const authHeader = req.headers.get("Authorization");
    const expectedSecret = Deno.env.get("CRON_SECRET");

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let isCron = false;

    if (cronSecret && expectedSecret && cronSecret === expectedSecret) {
      isCron = true;
    } else if (authHeader?.startsWith("Bearer ")) {
      const token = authHeader.replace("Bearer ", "");
      const { data: { user } } = await supabaseAdmin.auth.getUser(token);
      if (!user) {
        return jsonRes({ error: "Unauthorized" }, 401);
      }
      const { data: role } = await supabaseAdmin
        .from("user_roles").select("role")
        .eq("user_id", user.id).in("role", ["admin", "gerente"])
        .limit(1).maybeSingle();
      if (!role) return jsonRes({ error: "Admin required" }, 403);
    } else {
      return jsonRes({ error: "Authorization required" }, 401);
    }

    const GLOBAL_API_KEY = Deno.env.get("EVOLUTION_API_KEY") || "";

    // Step 1: Find all instances that need attention
    const { data: instances } = await supabaseAdmin
      .from("wa_instances")
      .select("id, tenant_id, nome, status, evolution_api_url, evolution_instance_key, api_key, last_seen_at, updated_at")
      .in("status", ["disconnected", "error", "connecting"]);

    if (!instances || instances.length === 0) {
      console.log("[wa-watchdog] All instances healthy, nothing to do");
      return jsonRes({ success: true, message: "all_healthy", reconnected: 0, messages_synced: 0 });
    }

    console.log(`[wa-watchdog] Found ${instances.length} unhealthy instance(s)`);

    let reconnected = 0;
    let messagesSynced = 0;
    let outboxRetried = 0;
    const errors: string[] = [];

    for (const inst of instances) {
      const apiUrl = inst.evolution_api_url?.replace(/\/$/, "");
      const instanceKey = inst.evolution_instance_key;
      const apiKey = inst.api_key || GLOBAL_API_KEY;

      if (!apiUrl || !instanceKey) {
        errors.push(`${inst.nome}: Missing API URL or key`);
        continue;
      }

      // Cooldown: don't retry too often
      const lastUpdate = inst.updated_at ? new Date(inst.updated_at).getTime() : 0;
      if (Date.now() - lastUpdate < RECONNECT_COOLDOWN_MS && isCron) {
        console.log(`[wa-watchdog] ${inst.nome}: cooldown active, skipping`);
        continue;
      }

      try {
        // Step 2: Check current state via Evolution API
        const stateRes = await fetch(
          `${apiUrl}/instance/connectionState/${encodeURIComponent(instanceKey)}`,
          { headers: { apikey: apiKey }, signal: AbortSignal.timeout(10000) }
        );

        let currentState = "unknown";
        if (stateRes.ok) {
          const stateJson = await stateRes.json();
          currentState = stateJson?.instance?.state || stateJson?.state || "unknown";
        } else {
          await stateRes.text();
        }

        console.log(`[wa-watchdog] ${inst.nome}: DB=${inst.status}, Evolution=${currentState}`);

        // If already connected in Evolution but DB says disconnected → just update DB
        if (currentState === "open") {
          await supabaseAdmin.from("wa_instances").update({
            status: "connected",
            last_seen_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          }).eq("id", inst.id);
          console.log(`[wa-watchdog] ${inst.nome}: Already connected, updated DB`);
          reconnected++;

          // Sync missed messages
          const synced = await syncMissedMessages(supabaseAdmin, inst, apiUrl, instanceKey, apiKey);
          messagesSynced += synced;

          // Retry pending outbox
          const retried = await retryPendingOutbox(supabaseAdmin, inst.id);
          outboxRetried += retried;
          continue;
        }

        // Step 3: Try to reconnect via Evolution API
        console.log(`[wa-watchdog] ${inst.nome}: Attempting reconnect...`);

        // Try /instance/connect first (reconnects existing session)
        const connectRes = await fetch(
          `${apiUrl}/instance/connect/${encodeURIComponent(instanceKey)}`,
          {
            method: "GET",
            headers: { apikey: apiKey },
            signal: AbortSignal.timeout(15000),
          }
        );

        if (connectRes.ok) {
          const connectJson = await connectRes.json();
          const newState = connectJson?.instance?.state || connectJson?.state;
          console.log(`[wa-watchdog] ${inst.nome}: Connect response state=${newState}`);

          if (newState === "open" || newState === "connecting") {
            const newStatus = newState === "open" ? "connected" : "connecting";
            await supabaseAdmin.from("wa_instances").update({
              status: newStatus,
              last_seen_at: newStatus === "connected" ? new Date().toISOString() : inst.last_seen_at,
              updated_at: new Date().toISOString(),
            }).eq("id", inst.id);
            reconnected++;

            if (newStatus === "connected") {
              // Sync missed messages
              const synced = await syncMissedMessages(supabaseAdmin, inst, apiUrl, instanceKey, apiKey);
              messagesSynced += synced;

              // Retry pending outbox
              const retried = await retryPendingOutbox(supabaseAdmin, inst.id);
              outboxRetried += retried;
            }
          } else {
            // Connect didn't work — try restart
            console.log(`[wa-watchdog] ${inst.nome}: Connect returned ${newState}, trying restart...`);
            await tryRestart(apiUrl, instanceKey, apiKey, supabaseAdmin, inst);
          }
        } else {
          const errBody = await connectRes.text();
          console.warn(`[wa-watchdog] ${inst.nome}: Connect failed ${connectRes.status}: ${errBody.slice(0, 200)}`);

          // Try restart as fallback
          await tryRestart(apiUrl, instanceKey, apiKey, supabaseAdmin, inst);
        }
      } catch (err) {
        console.error(`[wa-watchdog] ${inst.nome}: Error:`, (err as Error).message);
        errors.push(`${inst.nome}: ${(err as Error).message}`);

        // Update status to track the attempt
        await supabaseAdmin.from("wa_instances").update({
          updated_at: new Date().toISOString(),
        }).eq("id", inst.id);
      }
    }

    const summary = {
      success: true,
      instances_checked: instances.length,
      reconnected,
      messages_synced: messagesSynced,
      outbox_retried: outboxRetried,
      errors: errors.slice(0, 10),
    };

    console.log(`[wa-watchdog] Done:`, JSON.stringify(summary));
    return jsonRes(summary);
  } catch (err) {
    console.error("[wa-watchdog] Unhandled error:", err);
    return jsonRes({ error: String(err) }, 500);
  }
});

// ── Try restart (Evolution API) ──
async function tryRestart(
  apiUrl: string,
  instanceKey: string,
  apiKey: string,
  supabase: any,
  inst: any
) {
  try {
    const restartRes = await fetch(
      `${apiUrl}/instance/restart/${encodeURIComponent(instanceKey)}`,
      {
        method: "PUT",
        headers: { apikey: apiKey, "Content-Type": "application/json" },
        signal: AbortSignal.timeout(15000),
      }
    );

    if (restartRes.ok) {
      console.log(`[wa-watchdog] ${inst.nome}: Restart sent successfully`);
      await supabase.from("wa_instances").update({
        status: "connecting",
        updated_at: new Date().toISOString(),
      }).eq("id", inst.id);
    } else {
      const body = await restartRes.text();
      console.warn(`[wa-watchdog] ${inst.nome}: Restart failed ${restartRes.status}: ${body.slice(0, 200)}`);
    }
  } catch (e) {
    console.warn(`[wa-watchdog] ${inst.nome}: Restart error: ${(e as Error).message}`);
  }
}

// ── Sync missed messages (lightweight — last N hours only) ──
async function syncMissedMessages(
  supabase: any,
  inst: any,
  apiUrl: string,
  instanceKey: string,
  apiKey: string
): Promise<number> {
  try {
    const sinceMs = Date.now() - (MISSED_MESSAGES_WINDOW_HOURS * 3600 * 1000);
    const sinceTimestamp = Math.floor(sinceMs / 1000);

    // Get all conversations for this instance
    const { data: conversations } = await supabase
      .from("wa_conversations")
      .select("id, remote_jid, is_group")
      .eq("instance_id", inst.id)
      .eq("status", "open")
      .order("last_message_at", { ascending: false })
      .limit(50); // Only check recent active conversations

    if (!conversations?.length) return 0;

    let totalSynced = 0;

    for (const conv of conversations) {
      try {
        const msgsRes = await fetch(
          `${apiUrl}/chat/findMessages/${encodeURIComponent(instanceKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({
              where: { key: { remoteJid: conv.remote_jid } },
              limit: 100,
            }),
            signal: AbortSignal.timeout(10000),
          }
        );

        if (!msgsRes.ok) {
          await msgsRes.text();
          continue;
        }

        const msgsData = await msgsRes.json();
        const messages = Array.isArray(msgsData) ? msgsData : (msgsData.data || msgsData.messages || []);

        for (const msg of messages) {
          const key = msg.key || {};
          const evolutionId = key.id || msg.id;
          if (!evolutionId) continue;

          // Check timestamp — only sync recent messages
          const rawTs = msg.messageTimestamp;
          const msgSec = typeof rawTs === "number" ? (rawTs > 1e12 ? Math.floor(rawTs / 1000) : rawTs) : 0;
          if (msgSec < sinceTimestamp) continue;

          // Skip if already exists (dedup by evolution_message_id)
          const { data: existing } = await supabase
            .from("wa_messages")
            .select("id")
            .eq("evolution_message_id", evolutionId)
            .maybeSingle();

          if (existing) continue;

          const fromMe = key.fromMe === true;
          const direction = fromMe ? "out" : "in";
          const messageContent = msg.message || {};
          const { content, messageType } = extractMessageContent(messageContent, msg);

          const msgMs = msgSec * 1000;
          const msgTimestamp = new Date(msgMs).toISOString();

          await supabase.from("wa_messages").insert({
            conversation_id: conv.id,
            tenant_id: inst.tenant_id,
            evolution_message_id: evolutionId,
            direction,
            message_type: messageType,
            content,
            media_url: msg.mediaUrl || null,
            media_mime_type: msg.mimetype || null,
            status: fromMe ? "sent" : "delivered",
            participant_jid: conv.is_group ? (key.participant || msg.participant || null) : null,
            participant_name: conv.is_group ? (msg.pushName || null) : null,
            created_at: msgTimestamp,
            metadata: { synced: true, source: "watchdog" },
          });

          totalSynced++;

          // Update conversation last_message
          await supabase.from("wa_conversations").update({
            last_message_at: msgTimestamp,
            last_message_preview: content?.substring(0, 100) || `[${messageType}]`,
            last_message_direction: direction,
            status: "open",
          }).eq("id", conv.id);
        }
      } catch (convErr) {
        console.warn(`[wa-watchdog] Sync messages error for ${conv.remote_jid}: ${(convErr as Error).message}`);
      }
    }

    if (totalSynced > 0) {
      console.log(`[wa-watchdog] ${inst.nome}: Synced ${totalSynced} missed messages`);
    }

    return totalSynced;
  } catch (err) {
    console.warn(`[wa-watchdog] syncMissedMessages error: ${(err as Error).message}`);
    return 0;
  }
}

// ── Retry pending outbox items ──
async function retryPendingOutbox(supabase: any, instanceId: string): Promise<number> {
  try {
    // Reset failed items to pending so process-wa-outbox picks them up
    const { data: items } = await supabase
      .from("wa_outbox")
      .update({ status: "pending", error_message: null })
      .eq("instance_id", instanceId)
      .in("status", ["failed"])
      .lt("retry_count", 3)
      .select("id");

    const count = items?.length || 0;
    if (count > 0) {
      console.log(`[wa-watchdog] Reset ${count} failed outbox items to pending for instance ${instanceId}`);
    }
    return count;
  } catch (err) {
    console.warn(`[wa-watchdog] retryPendingOutbox error: ${(err as Error).message}`);
    return 0;
  }
}

// ── Message content extraction ──
function extractMessageContent(mc: any, msg: any): { content: string | null; messageType: string } {
  if (mc.conversation) return { content: mc.conversation, messageType: "text" };
  if (mc.extendedTextMessage?.text) return { content: mc.extendedTextMessage.text, messageType: "text" };
  if (mc.imageMessage) return { content: mc.imageMessage.caption || null, messageType: "image" };
  if (mc.videoMessage) return { content: mc.videoMessage.caption || null, messageType: mc.videoMessage.gifPlayback ? "gif" : "video" };
  if (mc.audioMessage) return { content: null, messageType: "audio" };
  if (mc.documentMessage) return { content: mc.documentMessage.fileName || null, messageType: "document" };
  if (mc.stickerMessage) return { content: null, messageType: "sticker" };
  if (mc.locationMessage) return { content: `${mc.locationMessage.degreesLatitude},${mc.locationMessage.degreesLongitude}`, messageType: "location" };
  if (mc.contactMessage || mc.contactsArrayMessage) {
    const contactDisplay = extractContactDisplay(mc);
    return { content: contactDisplay, messageType: "contact" };
  }
  if (mc.reactionMessage) return { content: mc.reactionMessage.text || null, messageType: "reaction" };
  if (msg.body || msg.text) return { content: msg.body || msg.text, messageType: "text" };
  return { content: null, messageType: "text" };
}


function extractContactDisplay(mc: any): string | null {
  try {
    if (mc.contactMessage) {
      const displayName = mc.contactMessage.displayName;
      const vcard = mc.contactMessage.vcard || "";
      const phone = extractPhoneFromVcard(vcard);
      if (displayName && phone) return `${displayName} (${phone})`;
      if (displayName) return displayName;
      if (phone) return phone;
      return null;
    }
    if (mc.contactsArrayMessage) {
      const contacts = mc.contactsArrayMessage.contacts || [];
      if (contacts.length === 0) return mc.contactsArrayMessage.displayName || null;
      const names: string[] = [];
      for (const c of contacts) {
        const name = c.displayName;
        const vcard = c.vcard || "";
        const phone = extractPhoneFromVcard(vcard);
        if (name && phone) names.push(`${name} (${phone})`);
        else if (name) names.push(name);
        else if (phone) names.push(phone);
      }
      return names.length > 0 ? names.join(", ") : null;
    }
  } catch { /* fallback */ }
  return null;
}

function extractPhoneFromVcard(vcard: string): string | null {
  if (!vcard) return null;
  const match = vcard.match(/TEL[^:]*:([+\d\s()-]+)/i);
  if (match) return match[1].trim();
  const waidMatch = vcard.match(/waid=(\d+)/i);
  if (waidMatch) return `+${waidMatch[1]}`;
  return null;
}

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
