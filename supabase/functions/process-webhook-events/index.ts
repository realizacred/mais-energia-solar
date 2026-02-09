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
    
    // Determine direction
    const fromMe = key.fromMe === true;
    const direction = fromMe ? "out" : "in";
    
    // Extract message content
    const messageContent = msg.message || {};
    const { content, messageType } = extractMessageContent(messageContent, msg);
    
    // Evolution message ID for deduplication
    const evolutionMessageId = key.id || msg.id || null;
    
    // Find or create conversation
    const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    const pushName = msg.pushName || msg.verifiedBizName || null;
    
    // Upsert conversation
    const { data: existingConv } = await supabase
      .from("wa_conversations")
      .select("id, unread_count")
      .eq("instance_id", instanceId)
      .eq("remote_jid", remoteJid)
      .maybeSingle();

    let conversationId: string;

    if (existingConv) {
      conversationId = existingConv.id;
      const updates: any = {
        last_message_at: new Date().toISOString(),
        last_message_preview: content ? content.substring(0, 100) : `[${messageType}]`,
      };
      if (!fromMe) {
        updates.unread_count = (existingConv.unread_count || 0) + 1;
        if (pushName) updates.cliente_nome = pushName;
      }
      await supabase
        .from("wa_conversations")
        .update(updates)
        .eq("id", conversationId);
    } else {
      const { data: newConv, error: convError } = await supabase
        .from("wa_conversations")
        .insert({
          instance_id: instanceId,
          tenant_id: tenantId,
          remote_jid: remoteJid,
          cliente_telefone: phone,
          cliente_nome: pushName,
          status: "open",
          last_message_at: new Date().toISOString(),
          last_message_preview: content ? content.substring(0, 100) : `[${messageType}]`,
          unread_count: fromMe ? 0 : 1,
        })
        .select("id")
        .single();

      if (convError) {
        console.error("[process-webhook-events] Error creating conversation:", convError);
        throw convError;
      }
      conversationId = newConv.id;
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

    await supabase.from("wa_messages").insert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      evolution_message_id: evolutionMessageId,
      direction,
      message_type: messageType,
      content,
      media_url: msg.mediaUrl || null,
      media_mime_type: msg.mimetype || null,
      status: fromMe ? "sent" : "delivered",
      metadata: { raw_key: key },
    });
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

async function handleMessageUpdate(supabase: any, payload: any) {
  const updates = payload.data || payload.updates || (payload.key ? [payload] : []);
  
  for (const update of Array.isArray(updates) ? updates : [updates]) {
    const key = update.key || {};
    const evolutionId = key.id || update.id;
    if (!evolutionId) continue;

    const statusMap: Record<number, string> = {
      0: "pending",
      1: "sent",
      2: "delivered",
      3: "read",
      4: "read",
    };

    const newStatus = statusMap[update.status || update.update?.status] || null;
    if (!newStatus) continue;

    await supabase
      .from("wa_messages")
      .update({ status: newStatus })
      .eq("evolution_message_id", evolutionId);
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
