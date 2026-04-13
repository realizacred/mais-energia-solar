import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_EXECUTION_MS = 25_000; // Stop before 30s timeout
const BATCH_SIZE = 50; // Process N chats per invocation

function normalizeJid(rawJid: string): string {
  if (!rawJid) return rawJid;
  if (rawJid.includes("@g.us")) return rawJid;

  const [numPart] = rawJid.split("@");
  let digits = numPart.replace(/\D/g, "");

  if (digits.startsWith("55") && digits.length === 12) {
    digits = digits.slice(0, 4) + "9" + digits.slice(4);
  }

  return `${digits}@s.whatsapp.net`;
}

function getAltJids(remoteJid: string): string[] {
  const canonical = normalizeJid(remoteJid);
  const jids = [remoteJid];
  if (canonical !== remoteJid) jids.push(canonical);

  const digits = canonical.split("@")[0];
  if (digits.startsWith("55") && digits.length === 13) {
    const without9 = `55${digits.slice(2, 4)}${digits.slice(5)}`;
    jids.push(`${without9}@s.whatsapp.net`);
  }

  return [...new Set(jids)];
}

function formatPreviewByType(messageType: string, content: string | null): string {
  const trimmed = content?.trim() || "";

  switch (messageType) {
    case "image":
      return trimmed ? `📷 ${trimmed}` : "📷 Imagem";
    case "video":
    case "gif":
      return trimmed ? `🎥 ${trimmed}` : "🎥 Vídeo";
    case "audio":
    case "ptt":
      return "🎵 Áudio";
    case "document":
      return trimmed ? `📄 ${trimmed}` : "📄 Documento";
    case "sticker":
      return "🎭 Figurinha";
    case "location":
      return "📍 Localização";
    case "contact":
      return trimmed ? `👤 ${trimmed}` : "👤 Contato";
    case "reaction":
      return trimmed ? `👍 ${trimmed}` : "👍 Reação";
    default:
      return trimmed || "Mensagem";
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Authenticate caller
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonRes({ error: "Unauthorized" }, 401);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return jsonRes({ error: "Invalid token" }, 401);
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return jsonRes({ error: "Forbidden" }, 403);
    }

    const body = await req.json();
    const { instance_id, days = 365, offset = 0 } = body;
    const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);

    if (!instance_id) {
      return jsonRes({ error: "instance_id required" }, 400);
    }

    // Get instance details
    const { data: instance, error: instErr } = await supabase
      .from("wa_instances")
      .select("id, tenant_id, evolution_api_url, evolution_instance_key, api_key")
      .eq("id", instance_id)
      .single();

    if (instErr || !instance) {
      return jsonRes({ error: "Instance not found" }, 404);
    }

    const apiUrl = instance.evolution_api_url?.replace(/\/$/, "");
    const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
    const instanceKey = instance.evolution_instance_key;

    if (!apiUrl || !instanceKey) {
      return jsonRes({ error: "Instance API not configured" }, 400);
    }

    const startTime = Date.now();
    console.log(`[sync-wa-history] Starting sync for instance ${instanceKey} (${instance.id}), offset=${offset}`);

    // Step 1: Fetch all chats from Evolution API
    const chatsRes = await fetch(`${apiUrl}/chat/findChats/${encodeURIComponent(instanceKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      signal: AbortSignal.timeout(10000),
    });

    if (!chatsRes.ok) {
      const errText = await chatsRes.text().catch(() => "");
      console.error(`[sync-wa-history] findChats failed [${chatsRes.status}]: ${errText.substring(0, 300)}`);
      return jsonRes({ error: "Failed to fetch chats from Evolution API" }, 502);
    }

    const chats = await chatsRes.json();
    const chatList = Array.isArray(chats) ? chats : (chats.data || chats.chats || []);
    const totalChats = chatList.length;

    // Process only a batch starting from offset
    const batch = chatList.slice(offset, offset + BATCH_SIZE);
    console.log(`[sync-wa-history] Processing batch ${offset}-${offset + batch.length} of ${totalChats} chats`);

    let totalConversations = 0;
    let totalMessages = 0;
    let reopened = 0;
    const errors: string[] = [];
    const now = Date.now();
    let stoppedEarly = false;

    for (const chat of batch) {
      // Check time budget
      if (Date.now() - startTime > MAX_EXECUTION_MS) {
        console.log(`[sync-wa-history] Time budget exceeded, stopping early`);
        stoppedEarly = true;
        break;
      }

      try {
        const sourceJid = chat.id || chat.remoteJid || chat.jid;
        const remoteJid = sourceJid?.endsWith("@g.us") ? sourceJid : normalizeJid(sourceJid);
        if (!remoteJid || remoteJid === "status@broadcast") continue;

        const isGroup = remoteJid.endsWith("@g.us");
        const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
        const contactName = chat.name || chat.pushName || chat.contact?.pushName || chat.contact?.name || null;
        const altJids = getAltJids(remoteJid);

        // Check if conversation already exists
        const { data: existingConv } = await supabase
          .from("wa_conversations")
          .select("id")
          .eq("instance_id", instance.id)
          .in("remote_jid", altJids)
          .maybeSingle();

        let conversationId: string;

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          const displayName = isGroup
            ? (chat.subject || chat.name || `Grupo ${phone.substring(0, 12)}...`)
            : contactName;

          // Skip profile pic fetch to save time — it will be fetched later on demand
          const { data: newConv, error: convErr } = await supabase
            .from("wa_conversations")
            .upsert({
              instance_id: instance.id,
              tenant_id: instance.tenant_id,
              remote_jid: remoteJid,
              cliente_telefone: phone,
              cliente_nome: displayName,
              is_group: isGroup,
              status: "resolved",
              unread_count: 0,
            }, { onConflict: "instance_id,remote_jid", ignoreDuplicates: true })
            .select("id")
            .single();

          if (convErr) {
            errors.push(`Conv ${phone}: ${convErr.message}`);
            continue;
          }
          conversationId = newConv.id;
          totalConversations++;
        }

        // Step 2: Fetch messages for this chat
        const msgsRes = await fetch(`${apiUrl}/chat/findMessages/${encodeURIComponent(instanceKey)}`, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({
            where: { key: { remoteJid } },
            limit: 200,
          }),
          signal: AbortSignal.timeout(8000),
        });

        if (!msgsRes.ok) {
          await msgsRes.text().catch(() => {});
          continue;
        }

        const msgsData = await msgsRes.json();
        const messages = Array.isArray(msgsData) ? msgsData : (msgsData.data || msgsData.messages || []);

        // Batch-check existing messages to avoid N+1 queries
        const evolutionIds = messages
          .map((m: any) => m.key?.id || m.id)
          .filter(Boolean);

        const existingIds = new Set<string>();
        if (evolutionIds.length > 0) {
          // Check in chunks of 100
          for (let i = 0; i < evolutionIds.length; i += 100) {
            const chunk = evolutionIds.slice(i, i + 100);
            const { data: existing } = await supabase
              .from("wa_messages")
              .select("evolution_message_id")
              .in("evolution_message_id", chunk);
            existing?.forEach((e: any) => existingIds.add(e.evolution_message_id));
          }
        }

        let latestMsgAt: string | null = null;
        let latestPreview: string | null = null;
        let latestDirection: string | null = null;
        const newMessages: any[] = [];

        for (const msg of messages) {
          const key = msg.key || {};
          const evolutionId = key.id || msg.id;
          if (!evolutionId || existingIds.has(evolutionId)) continue;

          const fromMe = key.fromMe === true;
          const direction = fromMe ? "out" : "in";
          const messageContent = msg.message || {};
          const { content, messageType } = extractContent(messageContent, msg);

          const rawTs = msg.messageTimestamp;
          const msgMs = rawTs
            ? (typeof rawTs === "number" ? (rawTs > 1e12 ? rawTs : rawTs * 1000) : new Date(rawTs).getTime())
            : Date.now();

          if (msgMs < cutoffMs) continue;

          const msgTimestamp = new Date(msgMs).toISOString();

          if (!latestMsgAt || msgTimestamp > latestMsgAt) {
            latestMsgAt = msgTimestamp;
            latestPreview = formatPreviewByType(messageType, content).substring(0, 100);
            latestDirection = direction;
          }

          newMessages.push({
            conversation_id: conversationId,
            tenant_id: instance.tenant_id,
            evolution_message_id: evolutionId,
            direction,
            message_type: messageType,
            content,
            media_url: msg.mediaUrl || null,
            media_mime_type: msg.mimetype || null,
            status: fromMe ? "sent" : "delivered",
            participant_jid: isGroup ? (key.participant || msg.participant || null) : null,
            participant_name: isGroup ? (msg.pushName || null) : null,
            created_at: msgTimestamp,
            metadata: { synced: true },
          });
        }

        // Batch insert messages (chunks of 50)
        for (let i = 0; i < newMessages.length; i += 50) {
          const chunk = newMessages.slice(i, i + 50);
          const { error: insertErr } = await supabase.from("wa_messages").insert(chunk);
          if (insertErr) {
            errors.push(`Msgs ${phone}: ${insertErr.message}`);
          } else {
            totalMessages += chunk.length;
          }
        }

        // Update conversation with latest message info
        if (latestMsgAt) {
          const updates: Record<string, unknown> = {
            last_message_at: latestMsgAt,
            last_message_preview: latestPreview,
            last_message_direction: latestDirection,
          };

          const msgAge = now - new Date(latestMsgAt).getTime();
          if (msgAge <= SEVEN_DAYS_MS) {
            updates.status = "open";
            reopened++;
          }

          await supabase
            .from("wa_conversations")
            .update(updates)
            .eq("id", conversationId);
        }
      } catch (chatErr) {
        errors.push(`Chat error: ${String(chatErr).substring(0, 100)}`);
      }
    }

    // Save sync metadata on the instance
    await supabase
      .from("wa_instances")
      .update({
        last_sync_at: new Date().toISOString(),
        last_sync_messages: totalMessages,
        last_sync_conversations: totalConversations,
      })
      .eq("id", instance.id);

    const nextOffset = offset + BATCH_SIZE;
    const hasMore = nextOffset < totalChats && !stoppedEarly;

    const summary = {
      success: true,
      conversations_created: totalConversations,
      messages_imported: totalMessages,
      reopened_conversations: reopened,
      total_chats: totalChats,
      processed_offset: offset,
      processed_count: batch.length,
      has_more: hasMore,
      next_offset: hasMore ? nextOffset : null,
      errors_count: errors.length,
      errors: errors.slice(0, 5),
    };

    console.log(`[sync-wa-history] Batch done:`, JSON.stringify(summary));
    return jsonRes(summary);
  } catch (err) {
    console.error("[sync-wa-history] Unhandled error:", err);
    return jsonRes({ error: String(err) }, 500);
  }
});

function extractContent(messageContent: any, msg: any): { content: string | null; messageType: string } {
  if (messageContent.conversation) return { content: messageContent.conversation, messageType: "text" };
  if (messageContent.extendedTextMessage?.text) return { content: messageContent.extendedTextMessage.text, messageType: "text" };
  if (messageContent.imageMessage) return { content: messageContent.imageMessage.caption || null, messageType: "image" };
  if (messageContent.videoMessage) {
    const isGif = messageContent.videoMessage.gifPlayback === true;
    return { content: messageContent.videoMessage.caption || null, messageType: isGif ? "gif" : "video" };
  }
  if (messageContent.audioMessage) return { content: null, messageType: "audio" };
  if (messageContent.documentMessage) return { content: messageContent.documentMessage.fileName || null, messageType: "document" };
  if (messageContent.stickerMessage) return { content: null, messageType: "sticker" };
  if (messageContent.locationMessage) {
    const loc = messageContent.locationMessage;
    return { content: `${loc.degreesLatitude},${loc.degreesLongitude}`, messageType: "location" };
  }
  if (messageContent.contactMessage || messageContent.contactsArrayMessage) {
    const contactDisplay = extractContactDisplay(messageContent);
    return { content: contactDisplay, messageType: "contact" };
  }
  if (messageContent.reactionMessage) return { content: messageContent.reactionMessage.text || null, messageType: "reaction" };
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
