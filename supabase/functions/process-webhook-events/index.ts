import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 50;

// ── Structured Timing Logger ──
function timingLog(step: string, t0: number, extra?: Record<string, unknown>) {
  const elapsed = Date.now() - t0;
  const payload = { step, elapsed_ms: elapsed, ts: new Date().toISOString(), ...extra };
  console.log(`[TIMING] ${JSON.stringify(payload)}`);
  return elapsed;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  let lockAcquired = false;
  try {
    const { data: lockResult } = await supabase.rpc("try_webhook_lock");
    lockAcquired = lockResult === true;

    if (!lockAcquired) {
      console.log("[METRIC] webhook_lock_skipped");
      return new Response(
        JSON.stringify({ processed: 0, skipped: "locked" }),
        { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Backlog alert
    {
      const { count: stuckCount } = await supabase
        .from("wa_webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("processed", false)
        .lt("created_at", new Date(Date.now() - 5 * 60 * 1000).toISOString());
      if (stuckCount && stuckCount > 10) {
        console.error("[ALERT] webhook_backlog_stuck", { count: stuckCount });
      }
    }

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
    let jobsEnqueued = 0;

    for (const event of events) {
      try {
        const enqueued = await processEvent(supabase, event);
        jobsEnqueued += enqueued;
        
        // Mark processed IMMEDIATELY after DB insert — no extra awaits
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

    // ══════════════════════════════════════════════════════════════
    // NO Promise.allSettled — NO waiting for background tasks.
    // All deferred work is in wa_bg_jobs, processed by wa-bg-worker.
    // ══════════════════════════════════════════════════════════════

    // Fire-and-forget: trigger the background worker
    if (jobsEnqueued > 0) {
      try {
        const workerUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/wa-bg-worker`;
        fetch(workerUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
        }).catch(() => {});
      } catch {}
    }

    console.log(`[process-webhook-events] Done: ${processed} processed, ${errors} errors, ${jobsEnqueued} jobs_enqueued`);

    return new Response(
      JSON.stringify({ processed, errors, total: events.length, jobs_enqueued: jobsEnqueued }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[process-webhook-events] Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    if (lockAcquired) {
      try {
        await supabase.rpc("release_webhook_lock");
      } catch (e) {
        console.warn("[process-webhook-events] Failed to release lock:", e);
      }
    }
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
  created_at: string;
}

/**
 * Process a single event. Returns the number of background jobs enqueued.
 * CRITICAL PATH ONLY: conversation upsert + message insert.
 * Everything else → wa_bg_jobs.
 */
async function processEvent(supabase: any, event: WebhookEvent): Promise<number> {
  const { event_type, payload, instance_id, tenant_id } = event;

  switch (event_type) {
    case "messages.upsert":
    case "MESSAGES_UPSERT":
      return await handleMessageUpsert(supabase, instance_id, tenant_id, payload, event.created_at);

    case "messages.update":
    case "MESSAGES_UPDATE":
      await handleMessageUpdate(supabase, payload);
      return 0;

    case "connection.update":
    case "CONNECTION_UPDATE":
      await handleConnectionUpdate(supabase, instance_id, payload);
      return 0;

    case "contacts.upsert":
    case "CONTACTS_UPSERT":
      return await handleContactsUpsert(supabase, instance_id, tenant_id, payload);

    default:
      console.log(`[process-webhook-events] Ignoring event type: ${event_type}`);
      return 0;
  }
}

// ── Defensive epoch parsing ──
function parseMessageTimestamp(msg: any): Date {
  const raw = msg.messageTimestamp ?? msg.message_timestamp ?? msg.timestamp;
  if (raw == null) return new Date();

  let epochMs: number;
  if (typeof raw === "number") {
    epochMs = raw < 1e12 ? raw * 1000 : raw;
  } else if (typeof raw === "string") {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || parsed <= 0) return new Date();
    epochMs = parsed < 1e12 ? parsed * 1000 : parsed;
  } else {
    return new Date();
  }

  if (!Number.isFinite(epochMs) || epochMs <= 0) return new Date();
  return new Date(epochMs);
}

/**
 * Enqueue a background job with idempotency.
 * Returns 1 if enqueued, 0 if duplicate (already exists).
 */
async function enqueueJob(
  supabase: any,
  tenantId: string,
  instanceId: string,
  jobType: string,
  payload: Record<string, unknown>,
  idempotencyKey: string,
): Promise<number> {
  const { error } = await supabase.from("wa_bg_jobs").upsert({
    tenant_id: tenantId,
    instance_id: instanceId,
    job_type: jobType,
    payload,
    status: "pending",
    idempotency_key: idempotencyKey,
  }, { onConflict: "idempotency_key", ignoreDuplicates: true });

  if (error) {
    console.warn(`[process-webhook-events] Failed to enqueue ${jobType} job:`, error.message);
    return 0;
  }
  return 1;
}

/**
 * Handle messages.upsert — CRITICAL PATH.
 * Rule: DB INSERT must ALWAYS happen FIRST. No external calls before insert.
 * All background work → wa_bg_jobs table.
 */
async function handleMessageUpsert(
  supabase: any,
  instanceId: string,
  tenantId: string,
  payload: any,
  webhookCreatedAt: string,
): Promise<number> {
  const t0_total = Date.now();
  let jobsEnqueued = 0;

  const messages = payload.data || payload.messages || (payload.key ? [payload] : []);
  
  for (const msg of Array.isArray(messages) ? messages : [messages]) {
    const t0_msg = Date.now();
    const key = msg.key || {};
    const remoteJid = key.remoteJid || msg.remoteJid;
    
    if (!remoteJid || remoteJid === "status@broadcast") continue;
    
    const isGroup = remoteJid.endsWith("@g.us");
    const fromMe = key.fromMe === true;
    const direction = fromMe ? "out" : "in";
    
    const messageContent = msg.message || {};
    const { content, messageType } = extractMessageContent(messageContent, msg);
    
    const evolutionMessageId = key.id || msg.id || null;
    const participantJid = isGroup ? (key.participant || msg.participant || null) : null;
    const participantName = isGroup ? (msg.pushName || null) : null;
    const contactName = isGroup ? null : (msg.pushName || msg.verifiedBizName || null);
    const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    
    // Only use data already in payload — NEVER block on external API call
    const groupSubject: string | null = isGroup
      ? (msg.groupMetadata?.subject || msg.messageContextInfo?.messageSecret?.groupSubject || payload.groupSubject || payload.subject || msg.subject || null)
      : null;

    const eventDate = parseMessageTimestamp(msg);

    // BR phone normalization
    const altJids: string[] = [remoteJid];
    if (!isGroup) {
      const digits = phone;
      if (digits.startsWith("55") && digits.length === 13) {
        const without9 = `55${digits.slice(2, 4)}${digits.slice(5)}`;
        altJids.push(`${without9}@s.whatsapp.net`);
      } else if (digits.startsWith("55") && digits.length === 12) {
        const with9 = `55${digits.slice(2, 4)}9${digits.slice(4)}`;
        altJids.push(`${with9}@s.whatsapp.net`);
      }
    }

    // ── STEP 1: Upsert conversation (CRITICAL PATH) ──
    const t0_conv = Date.now();
    const { data: existingConv } = await supabase
      .from("wa_conversations")
      .select("id, unread_count, status, is_group, cliente_nome, profile_picture_url, updated_at, last_message_at")
      .eq("instance_id", instanceId)
      .in("remote_jid", altJids)
      .limit(1)
      .maybeSingle();

    let conversationId: string;

    if (existingConv) {
      conversationId = existingConv.id;
      const preview = isGroup && participantName
        ? `${participantName}: ${content ? content.substring(0, 80) : `[${messageType}]`}`
        : content ? content.substring(0, 100) : `[${messageType}]`;
      
      const existingEpoch = existingConv.last_message_at
        ? new Date(existingConv.last_message_at).getTime()
        : 0;
      const eventEpoch = eventDate.getTime();
      const isNewer = eventEpoch > existingEpoch;

      const updates: any = {};

      if (isNewer) {
        updates.last_message_at = eventDate.toISOString();
        updates.last_message_preview = preview;
        updates.last_message_direction = direction;
      }
      
      if (isGroup && groupSubject) {
        updates.cliente_nome = groupSubject;
      }
      
      if (!fromMe) {
        updates.unread_count = (existingConv.unread_count || 0) + 1;
        if (!isGroup && contactName) {
          updates.cliente_nome = contactName;
        }
        if (existingConv.status === "resolved") {
          const trimmedContent = content?.trim() || "";
          const possibleRating = parseInt(trimmedContent, 10);
          const isSurveyResponse = possibleRating >= 1 && possibleRating <= 5 && trimmedContent.length <= 2;
          
          if (isSurveyResponse) {
            const { data: pendingSurvey } = await supabase
              .from("wa_satisfaction_ratings")
              .select("id")
              .eq("conversation_id", existingConv.id)
              .is("rating", null)
              .limit(1)
              .maybeSingle();
            
            if (!pendingSurvey) {
              updates.status = "open";
            }
          } else {
            updates.status = "open";
          }
        }
      }
      
      if (isGroup && !existingConv.is_group) {
        updates.is_group = true;
      }
      
      if (Object.keys(updates).length > 0) {
        await supabase
          .from("wa_conversations")
          .update(updates)
          .eq("id", conversationId);
      }
    } else {
      // P0-5: Fix group name placeholder — use null when no subject available
      const displayName = isGroup ? (groupSubject || null) : contactName;
      
      const { data: newConv, error: convError } = await supabase
        .from("wa_conversations")
        .upsert({
          instance_id: instanceId,
          tenant_id: tenantId,
          remote_jid: remoteJid,
          cliente_telefone: phone,
          cliente_nome: displayName,
          is_group: isGroup,
          status: "open",
          last_message_at: eventDate.toISOString(),
          last_message_preview: content ? content.substring(0, 100) : `[${messageType}]`,
          last_message_direction: direction,
          unread_count: fromMe ? 0 : 1,
          profile_picture_url: null,
        }, { onConflict: "instance_id,remote_jid", ignoreDuplicates: false })
        .select("id")
        .single();

      if (convError) {
        console.error("[process-webhook-events] Error upserting conversation:", convError);
        throw convError;
      }
      conversationId = newConv.id;
    }
    timingLog("conversation_upsert", t0_conv, { conversationId, isNew: !existingConv });

    // ── STEP 2: INSERT MESSAGE (CRITICAL PATH — always first, no external calls) ──
    const mediaMimeType: string | null = msg.mimetype || messageContent?.imageMessage?.mimetype || messageContent?.videoMessage?.mimetype || messageContent?.audioMessage?.mimetype || messageContent?.documentMessage?.mimetype || messageContent?.stickerMessage?.mimetype || null;
    const inlineMediaUrl: string | null = msg.mediaUrl || null;

    const t0_insert = Date.now();
    const { error: msgInsertError } = await supabase.from("wa_messages").upsert({
      conversation_id: conversationId,
      tenant_id: tenantId,
      evolution_message_id: evolutionMessageId,
      direction,
      message_type: messageType,
      content,
      media_url: inlineMediaUrl,
      media_mime_type: mediaMimeType,
      status: fromMe ? "sent" : "delivered",
      participant_jid: participantJid,
      participant_name: participantName,
      metadata: { raw_key: key },
    }, { onConflict: "evolution_message_id", ignoreDuplicates: true });

    const insertMs = timingLog("db_insert", t0_insert, { evolutionMessageId, messageType });

    if (msgInsertError) {
      console.warn(`[process-webhook-events] Message upsert warning: ${msgInsertError.message}`);
    }

    // ── TIMING: webhook queue → DB insert latency ──
    if (webhookCreatedAt) {
      const webhookMs = new Date(webhookCreatedAt).getTime();
      const totalLatency = Date.now() - webhookMs;
      timingLog("webhook_to_db_insert", webhookMs, {
        latency_ms: totalLatency,
        evolutionMessageId,
        messageType,
      });
    }

    // ══════════════════════════════════════════════════════════════
    // CRITICAL PATH ENDS HERE.
    // Everything below enqueues jobs into wa_bg_jobs.
    // NO awaits on external APIs. NO Promise.allSettled.
    // ══════════════════════════════════════════════════════════════

    // ── ENQUEUE: Media fetch job ──
    if (!inlineMediaUrl && ["image", "video", "audio", "document", "gif", "sticker"].includes(messageType) && evolutionMessageId) {
      jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "media_fetch", {
        evolution_message_id: evolutionMessageId,
        message_type: messageType === "gif" ? "video" : messageType,
        mime_type: mediaMimeType,
        raw_key: key,
        remote_jid: remoteJid,
        from_me: fromMe,
      }, `media:${evolutionMessageId}`);
    }

    // ── ENQUEUE: Group name fetch job ──
    // P0-5 FIX: Check if name is null OR starts with "Grupo "
    if (isGroup && !groupSubject) {
      const needsGroupName = !existingConv 
        || existingConv.cliente_nome == null 
        || (typeof existingConv.cliente_nome === "string" && existingConv.cliente_nome.startsWith("Grupo "));
      
      if (needsGroupName) {
        jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "group_name", {
          conversation_id: conversationId,
          remote_jid: remoteJid,
        }, `group:${conversationId}`);
      }
    }

    // ── ENQUEUE: Push notification job ──
    if (!fromMe && evolutionMessageId) {
      const preview = isGroup && participantName
        ? `${participantName}: ${content ? content.substring(0, 60) : `[${messageType}]`}`
        : content ? content.substring(0, 80) : `[${messageType}]`;

      jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "push", {
        conversation_id: conversationId,
        contact_name: isGroup ? (groupSubject || contactName) : contactName,
        message_preview: preview,
        message_id: evolutionMessageId,
        direction,
      }, `push:${evolutionMessageId}`);
    }

    // ── ENQUEUE: Auto-assign job (only new conversations, non-group) ──
    const isNewConversation = !existingConv;
    if (!isGroup && isNewConversation) {
      jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "auto_assign", {
        conversation_id: conversationId,
        remote_jid: remoteJid,
        from_me: fromMe,
        content,
        contact_name: contactName,
        phone,
      }, `assign:${conversationId}`);
    }

    // ── ENQUEUE: Auto-reply job (new conversations, inbound, non-group) ──
    if (isNewConversation && !fromMe && !isGroup) {
      jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "auto_reply", {
        conversation_id: conversationId,
        remote_jid: remoteJid,
        contact_name: contactName,
        phone,
      }, `reply:${conversationId}`);
    }

    // ── Satisfaction rating check (lightweight, stays inline) ──
    if (!fromMe && content) {
      const trimmed = content.trim();
      const rating = parseInt(trimmed, 10);
      if (rating >= 1 && rating <= 5 && trimmed.length <= 2) {
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
            .update({ rating, answered_at: new Date().toISOString() })
            .eq("id", pendingRating.id);
        }
      }
    }

    timingLog("message_total", t0_msg, { evolutionMessageId, messageType, jobs_enqueued: jobsEnqueued });
  }

  timingLog("upsert_batch_total", t0_total, { msg_count: (Array.isArray(messages) ? messages : [messages]).length });
  return jobsEnqueued;
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
    const isGif = messageContent.videoMessage.gifPlayback === true;
    return { content: messageContent.videoMessage.caption || null, messageType: isGif ? "gif" : "video" };
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
  if (msg.body || msg.text) {
    return { content: msg.body || msg.text, messageType: "text" };
  }
  return { content: null, messageType: "text" };
}

async function handleMessageUpdate(supabase: any, payload: any) {
  const data = payload.data || payload;
  const updates = Array.isArray(data) ? data : [data];

  const statusPriority: Record<string, number> = {
    pending: 0,
    sent: 1,
    delivered: 2,
    read: 3,
  };
  
  for (const update of updates) {
    const evolutionId = update.keyId || update.key?.id || update.id;
    if (!evolutionId) continue;

    const numericStatusMap: Record<number, string> = {
      0: "pending", 1: "sent", 2: "delivered", 3: "read", 4: "read",
    };

    const stringStatusMap: Record<string, string> = {
      "PENDING": "pending", "SERVER_ACK": "sent", "DELIVERY_ACK": "delivered",
      "READ": "read", "PLAYED": "read",
    };

    const rawStatus = update.status || update.update?.status;
    const newStatus = typeof rawStatus === "number"
      ? numericStatusMap[rawStatus]
      : typeof rawStatus === "string"
      ? stringStatusMap[rawStatus.toUpperCase()] || null
      : null;

    if (!newStatus) continue;

    const { data: currentMsg, error: fetchErr } = await supabase
      .from("wa_messages")
      .select("id, status")
      .eq("evolution_message_id", evolutionId)
      .maybeSingle();

    if (fetchErr) {
      console.warn(`[process-webhook-events] Failed to fetch message ${evolutionId}:`, fetchErr.message);
      continue;
    }

    if (!currentMsg) continue;

    const currentStatus = currentMsg.status || "pending";
    const currentPriority = statusPriority[currentStatus] ?? -1;
    const newPriority = statusPriority[newStatus] ?? -1;

    // Ignore stale/out-of-order status events (never downgrade status)
    if (newPriority < currentPriority) {
      console.log(`[process-webhook-events] Ignored stale status for ${evolutionId}: ${newStatus} < ${currentStatus}`);
      continue;
    }

    if (newPriority === currentPriority) continue;

    const { data: updated, error } = await supabase
      .from("wa_messages")
      .update({ status: newStatus })
      .eq("id", currentMsg.id)
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
    open: "connected", close: "disconnected", connecting: "connecting", refused: "error",
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
  tenantId: string,
  payload: any
): Promise<number> {
  const contacts = payload.data || payload.contacts || [];
  let jobsEnqueued = 0;
  
  for (const contact of Array.isArray(contacts) ? contacts : [contacts]) {
    const jid = contact.id || contact.jid;
    if (!jid) continue;

    const name = contact.pushName || contact.name || contact.verifiedName || null;
    const profilePicUrl = contact.profilePictureUrl || contact.imgUrl || null;

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

    // Profile picture → enqueue as background job
    if (!profilePicUrl && !jid.endsWith("@g.us")) {
      jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "profile_pic", {
        remote_jid: jid,
      }, `pic:${instanceId}:${jid}`);
    }
  }

  return jobsEnqueued;
}
