import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

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
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check admin role
    const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { instance_id, days = 365 } = body;
    const cutoffMs = Date.now() - (days * 24 * 60 * 60 * 1000);

    if (!instance_id) {
      return new Response(JSON.stringify({ error: "instance_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get instance details
    const { data: instance, error: instErr } = await supabase
      .from("wa_instances")
      .select("id, tenant_id, evolution_api_url, evolution_instance_key, api_key")
      .eq("id", instance_id)
      .single();

    if (instErr || !instance) {
      return new Response(JSON.stringify({ error: "Instance not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiUrl = instance.evolution_api_url?.replace(/\/$/, "");
    const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
    const instanceKey = instance.evolution_instance_key;

    if (!apiUrl || !instanceKey) {
      return new Response(JSON.stringify({ error: "Instance API not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[sync-wa-history] Starting sync for instance ${instanceKey} (${instance.id})`);

    // Step 1: Fetch all chats from Evolution API
    const chatsRes = await fetch(`${apiUrl}/chat/findChats/${encodeURIComponent(instanceKey)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
    });

    if (!chatsRes.ok) {
      const errText = await chatsRes.text().catch(() => "");
      console.error(`[sync-wa-history] findChats failed [${chatsRes.status}]: ${errText.substring(0, 300)}`);
      return new Response(JSON.stringify({ error: "Failed to fetch chats from Evolution API" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const chats = await chatsRes.json();
    const chatList = Array.isArray(chats) ? chats : (chats.data || chats.chats || []);

    console.log(`[sync-wa-history] Found ${chatList.length} chats`);

    let totalConversations = 0;
    let totalMessages = 0;
    let reopened = 0;
    const errors: string[] = [];
    const now = Date.now();

    for (const chat of chatList) {
      try {
        const remoteJid = chat.id || chat.remoteJid || chat.jid;
        if (!remoteJid || remoteJid === "status@broadcast") continue;

        const isGroup = remoteJid.endsWith("@g.us");
        const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
        const contactName = chat.name || chat.pushName || chat.contact?.pushName || chat.contact?.name || null;

        // Check if conversation already exists
        const { data: existingConv } = await supabase
          .from("wa_conversations")
          .select("id")
          .eq("instance_id", instance.id)
          .eq("remote_jid", remoteJid)
          .maybeSingle();

        let conversationId: string;

        if (existingConv) {
          conversationId = existingConv.id;
        } else {
          // Fetch profile picture for individual chats
          let profilePicUrl: string | null = null;
          if (!isGroup) {
            try {
              const picRes = await fetch(`${apiUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceKey)}`, {
                method: "POST",
                headers: { "Content-Type": "application/json", apikey: apiKey },
                body: JSON.stringify({ number: remoteJid }),
              });
              if (picRes.ok) {
                const picData = await picRes.json();
                profilePicUrl = picData?.profilePictureUrl || picData?.url || null;
              }
            } catch (_) { /* ignore */ }
          }

          const displayName = isGroup
            ? (chat.subject || chat.name || `Grupo ${phone.substring(0, 12)}...`)
            : contactName;

          const { data: newConv, error: convErr } = await supabase
            .from("wa_conversations")
            .insert({
              instance_id: instance.id,
              tenant_id: instance.tenant_id,
              remote_jid: remoteJid,
              cliente_telefone: phone,
              cliente_nome: displayName,
              is_group: isGroup,
              status: "resolved", // default to resolved, will reopen if recent
              unread_count: 0,
              profile_picture_url: profilePicUrl,
            })
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
            limit: 500,
          }),
        });

        if (!msgsRes.ok) continue;

        const msgsData = await msgsRes.json();
        const messages = Array.isArray(msgsData) ? msgsData : (msgsData.data || msgsData.messages || []);

        let latestMsgAt: string | null = null;
        let latestPreview: string | null = null;

        for (const msg of messages) {
          const key = msg.key || {};
          const evolutionId = key.id || msg.id;
          if (!evolutionId) continue;

          // Skip if already exists
          const { data: existingMsg } = await supabase
            .from("wa_messages")
            .select("id")
            .eq("evolution_message_id", evolutionId)
            .maybeSingle();

          if (existingMsg) continue;

          const fromMe = key.fromMe === true;
          const direction = fromMe ? "out" : "in";

          // Extract content
          const messageContent = msg.message || {};
          const { content, messageType } = extractContent(messageContent, msg);

          const rawTs = msg.messageTimestamp;
          const msgMs = rawTs
            ? (typeof rawTs === "number" ? (rawTs > 1e12 ? rawTs : rawTs * 1000) : new Date(rawTs).getTime())
            : Date.now();

          // Skip messages older than cutoff
          if (msgMs < cutoffMs) continue;

          const msgTimestamp = new Date(msgMs).toISOString();

          // Track latest message for conversation update
          if (!latestMsgAt || msgTimestamp > latestMsgAt) {
            latestMsgAt = msgTimestamp;
            latestPreview = content ? content.substring(0, 100) : `[${messageType}]`;
          }

          const participantJid = isGroup ? (key.participant || msg.participant || null) : null;
          const participantName = isGroup ? (msg.pushName || null) : null;

          await supabase.from("wa_messages").insert({
            conversation_id: conversationId,
            tenant_id: instance.tenant_id,
            evolution_message_id: evolutionId,
            direction,
            message_type: messageType,
            content,
            media_url: msg.mediaUrl || null,
            media_mime_type: msg.mimetype || null,
            status: fromMe ? "sent" : "delivered",
            participant_jid: participantJid,
            participant_name: participantName,
            created_at: msgTimestamp,
            metadata: { synced: true },
          });

          totalMessages++;
        }

        // Update conversation with latest message info
        if (latestMsgAt) {
          const updates: Record<string, unknown> = {
            last_message_at: latestMsgAt,
            last_message_preview: latestPreview,
          };

          // Reopen if latest message is within 7 days
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

    const summary = {
      success: true,
      conversations_created: totalConversations,
      messages_imported: totalMessages,
      reopened_conversations: reopened,
      errors_count: errors.length,
      errors: errors.slice(0, 10),
    };

    console.log(`[sync-wa-history] Done:`, JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[sync-wa-history] Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function extractContent(messageContent: any, msg: any): { content: string | null; messageType: string } {
  if (messageContent.conversation) return { content: messageContent.conversation, messageType: "text" };
  if (messageContent.extendedTextMessage?.text) return { content: messageContent.extendedTextMessage.text, messageType: "text" };
  if (messageContent.imageMessage) return { content: messageContent.imageMessage.caption || null, messageType: "image" };
  if (messageContent.videoMessage) return { content: messageContent.videoMessage.caption || null, messageType: "video" };
  if (messageContent.audioMessage) return { content: null, messageType: "audio" };
  if (messageContent.documentMessage) return { content: messageContent.documentMessage.fileName || null, messageType: "document" };
  if (messageContent.stickerMessage) return { content: null, messageType: "sticker" };
  if (messageContent.locationMessage) {
    const loc = messageContent.locationMessage;
    return { content: `${loc.degreesLatitude},${loc.degreesLongitude}`, messageType: "location" };
  }
  if (messageContent.contactMessage || messageContent.contactsArrayMessage) return { content: null, messageType: "contact" };
  if (messageContent.reactionMessage) return { content: messageContent.reactionMessage.text || null, messageType: "reaction" };
  if (msg.body || msg.text) return { content: msg.body || msg.text, messageType: "text" };
  return { content: null, messageType: "text" };
}
