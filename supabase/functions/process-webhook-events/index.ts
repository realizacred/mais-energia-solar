import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 50;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Fetch unprocessed events
    const { data: events, error: fetchError } = await supabase
      .from("wa_webhook_events")
      .select("*")
      .eq("processed", false)
      .lt("retry_count", 5)
      .order("created_at", { ascending: true })
      .limit(BATCH_SIZE);

    if (fetchError) {
      console.error("[process-webhook-events] Fetch error:", fetchError);
      throw fetchError;
    }

    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[process-webhook-events] Processing ${events.length} events`);

    let processed = 0;
    let errors = 0;

    for (const event of events) {
      try {
        await processEvent(supabase, event);
        
        await supabase
          .from("wa_webhook_events")
          .update({ processed: true, processed_at: new Date().toISOString() })
          .eq("id", event.id);
        
        processed++;
      } catch (err) {
        console.error(`[process-webhook-events] Error processing event ${event.id}:`, err);
        
        await supabase
          .from("wa_webhook_events")
          .update({
            retry_count: (event.retry_count || 0) + 1,
            error: String(err),
          })
          .eq("id", event.id);
        
        errors++;
      }
    }

    console.log(`[process-webhook-events] Done: ${processed} processed, ${errors} errors`);

    return new Response(
      JSON.stringify({ processed, errors, total: events.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[process-webhook-events] Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Event Processing ──────────────────────────────────────

interface WebhookEvent {
  id: string;
  instance_id: string;
  tenant_id: string;
  event_type: string;
  payload: any;
  retry_count: number;
}

async function processEvent(supabase: any, event: WebhookEvent) {
  const { event_type, payload, instance_id, tenant_id } = event;

  switch (event_type) {
    case "messages.upsert":
    case "MESSAGES_UPSERT":
      await handleMessageUpsert(supabase, instance_id, tenant_id, payload);
      break;

    case "messages.update":
    case "MESSAGES_UPDATE":
      await handleMessageUpdate(supabase, payload);
      break;

    case "connection.update":
    case "CONNECTION_UPDATE":
      await handleConnectionUpdate(supabase, instance_id, payload);
      break;

    case "contacts.upsert":
    case "CONTACTS_UPSERT":
      await handleContactsUpsert(supabase, instance_id, tenant_id, payload);
      break;

    default:
      console.log(`[process-webhook-events] Ignoring event type: ${event_type}`);
  }
}

async function handleMessageUpsert(
  supabase: any,
  instanceId: string,
  tenantId: string,
  payload: any
) {
  const messages = payload.data || payload.messages || (payload.key ? [payload] : []);
  
  for (const msg of Array.isArray(messages) ? messages : [messages]) {
    const key = msg.key || {};
    const remoteJid = key.remoteJid || msg.remoteJid;
    
    if (!remoteJid || remoteJid === "status@broadcast") continue;
    
    // Detect group
    const isGroup = remoteJid.endsWith("@g.us");
    
    // Determine direction
    const fromMe = key.fromMe === true;
    const direction = fromMe ? "out" : "in";
    
    // Extract message content
    const messageContent = msg.message || {};
    const { content, messageType } = extractMessageContent(messageContent, msg);
    
    // Evolution message ID for deduplication
    const evolutionMessageId = key.id || msg.id || null;
    
    // Group participant info
    const participantJid = isGroup ? (key.participant || msg.participant || null) : null;
    const participantName = isGroup ? (msg.pushName || null) : null;
    
    // For individual chats, use pushName as contact name
    const contactName = isGroup ? null : (msg.pushName || msg.verifiedBizName || null);
    
    // Phone / group ID
    const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    
    // Group subject (Evolution API sends it in different places)
    let groupSubject: string | null = isGroup
      ? (msg.groupMetadata?.subject || msg.messageContextInfo?.messageSecret?.groupSubject || payload.groupSubject || payload.subject || msg.subject || null)
      : null;
    
    // If group but no subject, try fetching from Evolution API
    if (isGroup && !groupSubject) {
      groupSubject = await fetchGroupName(supabase, instanceId, remoteJid);
    }

    // Upsert conversation
    const { data: existingConv } = await supabase
      .from("wa_conversations")
      .select("id, unread_count, status, is_group, cliente_nome, profile_picture_url")
      .eq("instance_id", instanceId)
      .eq("remote_jid", remoteJid)
      .maybeSingle();

    let conversationId: string;

    if (existingConv) {
      conversationId = existingConv.id;
      const preview = isGroup && participantName
        ? `${participantName}: ${content ? content.substring(0, 80) : `[${messageType}]`}`
        : content ? content.substring(0, 100) : `[${messageType}]`;
      
      const updates: any = {
        last_message_at: new Date().toISOString(),
        last_message_preview: preview,
      };
      
      // Update group name if we got it from payload (always update, even if already set with fallback)
      if (isGroup && groupSubject) {
        updates.cliente_nome = groupSubject;
      }
      
      if (!fromMe) {
        updates.unread_count = (existingConv.unread_count || 0) + 1;
        // For individual chats, update contact name
        if (!isGroup && contactName) {
          updates.cliente_nome = contactName;
        }
        // Reopen resolved conversations when client sends a new message
        if (existingConv.status === "resolved") {
          updates.status = "open";
          console.log(`[process-webhook-events] Reopening resolved conversation ${conversationId}`);
        }
      }
      
      // Ensure is_group flag is set
      if (isGroup && !existingConv.is_group) {
        updates.is_group = true;
      }
      
      await supabase
        .from("wa_conversations")
        .update(updates)
        .eq("id", conversationId);
    } else {
      const displayName = isGroup ? (groupSubject || `Grupo ${phone.substring(0, 12)}...`) : contactName;
      
      // Fetch profile picture for new conversations (individuals and groups)
      let profilePicUrl: string | null = null;
      try {
        profilePicUrl = await fetchProfilePicture(supabase, instanceId, remoteJid);
      } catch (_) { /* ignore for groups */ }

      const { data: newConv, error: convError } = await supabase
        .from("wa_conversations")
        .insert({
          instance_id: instanceId,
          tenant_id: tenantId,
          remote_jid: remoteJid,
          cliente_telefone: phone,
          cliente_nome: displayName,
          is_group: isGroup,
          status: "open",
          last_message_at: new Date().toISOString(),
          last_message_preview: content ? content.substring(0, 100) : `[${messageType}]`,
          unread_count: fromMe ? 0 : 1,
          profile_picture_url: profilePicUrl,
        })
        .select("id")
        .single();

      if (convError) {
        console.error("[process-webhook-events] Error creating conversation:", convError);
        throw convError;
      }
      conversationId = newConv.id;
    }

    // For existing conversations without profile picture, fetch it periodically
    if (existingConv && !fromMe) {
      // Check if we should refresh (no picture or stale check)
      const shouldRefresh = shouldRefreshProfilePic(existingConv);
      if (shouldRefresh) {
        const picUrl = await fetchProfilePicture(supabase, instanceId, remoteJid);
        if (picUrl) {
          await supabase
            .from("wa_conversations")
            .update({ profile_picture_url: picUrl })
            .eq("id", existingConv.id);
        }
      }
    }

    // Insert message (deduplicate by evolution_message_id)
    if (evolutionMessageId) {
      const { data: existingMsg } = await supabase
        .from("wa_messages")
        .select("id")
        .eq("evolution_message_id", evolutionMessageId)
        .maybeSingle();

      if (existingMsg) {
        console.log(`[process-webhook-events] Duplicate message skipped: ${evolutionMessageId}`);
        continue;
      }
    }

    // ── Fetch media if applicable ──
    let mediaUrl: string | null = msg.mediaUrl || null;
    const mediaMimeType: string | null = msg.mimetype || messageContent?.imageMessage?.mimetype || messageContent?.videoMessage?.mimetype || messageContent?.audioMessage?.mimetype || messageContent?.documentMessage?.mimetype || null;
    
    if (!mediaUrl && ["image", "video", "audio", "document"].includes(messageType) && evolutionMessageId) {
      mediaUrl = await fetchAndStoreMedia(supabase, instanceId, tenantId, evolutionMessageId, messageType, mediaMimeType, msg);
    }

    await supabase.from("wa_messages").insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      evolution_message_id: evolutionMessageId,
      direction,
      message_type: messageType,
      content,
      media_url: mediaUrl,
      media_mime_type: mediaMimeType,
      status: fromMe ? "sent" : "delivered",
      participant_jid: participantJid,
      participant_name: participantName,
      metadata: { raw_key: key },
    });

    // Check for satisfaction survey response (incoming messages only)
    if (!fromMe && content) {
      const trimmed = content.trim();
      const rating = parseInt(trimmed, 10);
      if (rating >= 1 && rating <= 5 && trimmed.length <= 2) {
        // Look for a pending satisfaction rating for this conversation
        const { data: pendingRating } = await supabase
          .from("wa_satisfaction_ratings")
          .select("id")
          .eq("conversation_id", conversationId)
          .is("rating", null)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        if (pendingRating) {
          await supabase
            .from("wa_satisfaction_ratings")
            .update({
              rating,
              answered_at: new Date().toISOString(),
            })
            .eq("id", pendingRating.id);

          console.log(`[process-webhook-events] Satisfaction rating ${rating} recorded for conversation ${conversationId}`);
        }
      }
    }
  }
}

// ── Fetch media from Evolution API and store in Supabase Storage ──

async function fetchAndStoreMedia(
  supabase: any,
  instanceId: string,
  tenantId: string,
  messageId: string,
  messageType: string,
  mimeType: string | null,
  rawMsg: any,
): Promise<string | null> {
  try {
    // Get instance details for API call
    const { data: instance } = await supabase
      .from("wa_instances")
      .select("evolution_api_url, evolution_instance_key, api_key")
      .eq("id", instanceId)
      .maybeSingle();

    if (!instance) {
      console.warn(`[process-webhook-events] No instance found for media fetch: ${instanceId}`);
      return null;
    }

    const apiUrl = instance.evolution_api_url?.replace(/\/$/, "");
    const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
    const instanceKey = instance.evolution_instance_key;

    if (!apiUrl || !instanceKey) return null;

    // Call Evolution API to get base64 media
    // The key must include remoteJid, fromMe, and id for Evolution to find the message
    const mediaEndpoint = `${apiUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(instanceKey)}`;
    const messageKey = rawMsg.key && rawMsg.key.remoteJid
      ? rawMsg.key
      : { remoteJid: rawMsg.key?.remoteJid || rawMsg.remoteJid || "", fromMe: rawMsg.key?.fromMe ?? false, id: messageId };
    
    const mediaRes = await fetch(mediaEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ message: { key: messageKey }, convertToMp4: messageType === "audio" }),
    });

    if (!mediaRes.ok) {
      const errText = await mediaRes.text().catch(() => "");
      console.warn(`[process-webhook-events] Media fetch failed [${mediaRes.status}]: ${errText.substring(0, 200)}`);
      return null;
    }

    const mediaData = await mediaRes.json();
    const base64 = mediaData.base64 || mediaData.data?.base64 || null;
    const mediaMime = mediaData.mimetype || mediaData.data?.mimetype || mimeType || "application/octet-stream";

    if (!base64) {
      console.warn("[process-webhook-events] No base64 in media response");
      return null;
    }

    // Determine file extension
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4", "video/3gpp": "3gp",
      "audio/ogg": "ogg", "audio/ogg; codecs=opus": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
      "application/pdf": "pdf",
    };
    const cleanMime = mediaMime.split(";")[0].trim();
    const ext = extMap[mediaMime] || extMap[cleanMime] || cleanMime.split("/")[1] || "bin";

    // Upload to Supabase Storage
    const filePath = `${tenantId}/media/${messageId}.${ext}`;
    
    // Convert base64 to Uint8Array
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }

    const { error: uploadError } = await supabase.storage
      .from("wa-attachments")
      .upload(filePath, bytes, {
        contentType: mediaMime,
        upsert: true,
      });

    if (uploadError) {
      console.error("[process-webhook-events] Storage upload error:", uploadError);
      return null;
    }

    const { data: publicUrl } = supabase.storage
      .from("wa-attachments")
      .getPublicUrl(filePath);

    console.log(`[process-webhook-events] Media stored: ${messageType} -> ${filePath}`);
    return publicUrl?.publicUrl || null;
  } catch (err) {
    console.error("[process-webhook-events] Media fetch/store error:", err);
    return null;
  }
}

// ── Fetch group name from Evolution API ──
async function fetchGroupName(
  supabase: any,
  instanceId: string,
  groupJid: string,
): Promise<string | null> {
  try {
    const { data: instance } = await supabase
      .from("wa_instances")
      .select("evolution_api_url, evolution_instance_key, api_key")
      .eq("id", instanceId)
      .maybeSingle();

    if (!instance) return null;

    const apiUrl = instance.evolution_api_url?.replace(/\/$/, "");
    const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
    const instanceKey = instance.evolution_instance_key;

    if (!apiUrl || !instanceKey) return null;

    const endpoint = `${apiUrl}/group/findGroupInfos/${encodeURIComponent(instanceKey)}?groupJid=${encodeURIComponent(groupJid)}`;

    const res = await fetch(endpoint, {
      method: "GET",
      headers: { apikey: apiKey },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const subject = data?.subject || data?.data?.subject || null;
    if (subject) {
      console.log(`[process-webhook-events] Fetched group name: "${subject}" for ${groupJid}`);
    }
    return subject;
  } catch (err) {
    console.warn("[process-webhook-events] Failed to fetch group name:", err);
    return null;
  }
}

function extractMessageContent(messageContent: any, msg: any): { content: string | null; messageType: string } {
  if (messageContent.conversation) {
    return { content: messageContent.conversation, messageType: "text" };
  }
  if (messageContent.extendedTextMessage?.text) {
    return { content: messageContent.extendedTextMessage.text, messageType: "text" };
  }
  if (messageContent.imageMessage) {
    return { content: messageContent.imageMessage.caption || null, messageType: "image" };
  }
  if (messageContent.videoMessage) {
    return { content: messageContent.videoMessage.caption || null, messageType: "video" };
  }
  if (messageContent.audioMessage) {
    return { content: null, messageType: "audio" };
  }
  if (messageContent.documentMessage) {
    return { content: messageContent.documentMessage.fileName || null, messageType: "document" };
  }
  if (messageContent.stickerMessage) {
    return { content: null, messageType: "sticker" };
  }
  if (messageContent.locationMessage) {
    const loc = messageContent.locationMessage;
    return { content: `${loc.degreesLatitude},${loc.degreesLongitude}`, messageType: "location" };
  }
  if (messageContent.contactMessage || messageContent.contactsArrayMessage) {
    return { content: null, messageType: "contact" };
  }
  if (messageContent.reactionMessage) {
    return { content: messageContent.reactionMessage.text || null, messageType: "reaction" };
  }
  // Fallback: use body or text from msg directly
  if (msg.body || msg.text) {
    return { content: msg.body || msg.text, messageType: "text" };
  }
  return { content: null, messageType: "text" };
}

// ── Fetch profile picture from Evolution API ──
async function fetchProfilePicture(
  supabase: any,
  instanceId: string,
  remoteJid: string,
): Promise<string | null> {
  try {
    const { data: instance } = await supabase
      .from("wa_instances")
      .select("evolution_api_url, evolution_instance_key, api_key")
      .eq("id", instanceId)
      .maybeSingle();

    if (!instance) return null;

    const apiUrl = instance.evolution_api_url?.replace(/\/$/, "");
    const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
    const instanceKey = instance.evolution_instance_key;

    if (!apiUrl || !instanceKey) return null;

    const endpoint = `${apiUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceKey)}`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: apiKey },
      body: JSON.stringify({ number: remoteJid }),
    });

    if (!res.ok) return null;

    const data = await res.json();
    const picUrl = data?.profilePictureUrl || data?.data?.profilePictureUrl || data?.url || data?.profilePicUrl || null;
    if (picUrl) {
      console.log(`[process-webhook-events] Profile picture fetched for ${remoteJid}`);
    }
    return picUrl;
  } catch (err) {
    console.warn("[process-webhook-events] Failed to fetch profile picture:", err);
    return null;
  }
}

// Check if we should refresh profile picture (only if missing)
function shouldRefreshProfilePic(existingConv: any): boolean {
  return !existingConv.profile_picture_url;
}

async function handleMessageUpdate(supabase: any, payload: any) {
  const data = payload.data || payload;
  const updates = Array.isArray(data) ? data : [data];
  
  for (const update of updates) {
    // Evolution API v2 uses keyId, v1 uses key.id
    const evolutionId = update.keyId || update.key?.id || update.id;
    if (!evolutionId) continue;

    // Map both numeric (v1) and string (v2) statuses
    const numericStatusMap: Record<number, string> = {
      0: "pending",
      1: "sent",
      2: "delivered",
      3: "read",
      4: "read",
    };

    const stringStatusMap: Record<string, string> = {
      "PENDING": "pending",
      "SERVER_ACK": "sent",
      "DELIVERY_ACK": "delivered",
      "READ": "read",
      "PLAYED": "read",
    };

    const rawStatus = update.status || update.update?.status;
    const newStatus = typeof rawStatus === "number"
      ? numericStatusMap[rawStatus]
      : typeof rawStatus === "string"
      ? stringStatusMap[rawStatus.toUpperCase()] || null
      : null;

    if (!newStatus) {
      console.log(`[process-webhook-events] Unknown message status: ${rawStatus} for ${evolutionId}`);
      continue;
    }

    const { data: updated, error } = await supabase
      .from("wa_messages")
      .update({ status: newStatus })
      .eq("evolution_message_id", evolutionId)
      .select("id")
      .maybeSingle();

    if (updated) {
      console.log(`[process-webhook-events] Message ${evolutionId} status -> ${newStatus}`);
    } else if (error) {
      console.warn(`[process-webhook-events] Failed to update message ${evolutionId}:`, error.message);
    }
  }
}

async function handleConnectionUpdate(supabase: any, instanceId: string, payload: any) {
  const state = payload.data?.state || payload.state || payload.status;
  
  const statusMap: Record<string, string> = {
    open: "connected",
    close: "disconnected",
    connecting: "connecting",
    refused: "error",
  };

  const dbStatus = statusMap[state] || "disconnected";

  await supabase
    .from("wa_instances")
    .update({
      status: dbStatus,
      last_seen_at: dbStatus === "connected" ? new Date().toISOString() : undefined,
    })
    .eq("id", instanceId);

  console.log(`[process-webhook-events] Instance ${instanceId} connection: ${state} -> ${dbStatus}`);
}

async function handleContactsUpsert(
  supabase: any,
  instanceId: string,
  _tenantId: string,
  payload: any
) {
  const contacts = payload.data || payload.contacts || [];
  
  for (const contact of Array.isArray(contacts) ? contacts : [contacts]) {
    const jid = contact.id || contact.jid;
    if (!jid) continue;

    const name = contact.pushName || contact.name || contact.verifiedName || null;
    const profilePicUrl = contact.profilePictureUrl || null;

    if (name || profilePicUrl) {
      const updates: any = {};
      if (name) updates.cliente_nome = name;
      if (profilePicUrl) updates.profile_picture_url = profilePicUrl;

      await supabase
        .from("wa_conversations")
        .update(updates)
        .eq("instance_id", instanceId)
        .eq("remote_jid", jid);
    }
  }
}
