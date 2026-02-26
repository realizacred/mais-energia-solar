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

  // ── P0-2: Advisory lock to prevent concurrent processing ──
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

    // ── P1-2: Backlog alert (stuck events > 5min old) ──
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
    // Collect fire-and-forget media promises to settle before function exits
    const backgroundTasks: Promise<void>[] = [];

    for (const event of events) {
      try {
        const bgTasks = await processEvent(supabase, event);
        if (bgTasks.length > 0) backgroundTasks.push(...bgTasks);
        
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

    // Wait for background tasks with a safety timeout so the function doesn't hang
    if (backgroundTasks.length > 0) {
      const BG_TIMEOUT_MS = 25_000; // 25s safety cap
      await Promise.race([
        Promise.allSettled(backgroundTasks),
        new Promise(resolve => setTimeout(resolve, BG_TIMEOUT_MS)),
      ]);
    }

    console.log(`[process-webhook-events] Done: ${processed} processed, ${errors} errors, ${backgroundTasks.length} bg_tasks`);

    return new Response(
      JSON.stringify({ processed, errors, total: events.length, bg_tasks: backgroundTasks.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[process-webhook-events] Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } finally {
    // P0-2: Always release lock in finally (even though session-scoped)
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
 * Process a single event. Returns an array of background (fire-and-forget) promises
 * that the caller should settle before the function exits.
 */
async function processEvent(supabase: any, event: WebhookEvent): Promise<Promise<void>[]> {
  const { event_type, payload, instance_id, tenant_id } = event;

  switch (event_type) {
    case "messages.upsert":
    case "MESSAGES_UPSERT":
      return await handleMessageUpsert(supabase, instance_id, tenant_id, payload, event.created_at);

    case "messages.update":
    case "MESSAGES_UPDATE":
      await handleMessageUpdate(supabase, payload);
      return [];

    case "connection.update":
    case "CONNECTION_UPDATE":
      await handleConnectionUpdate(supabase, instance_id, payload);
      return [];

    case "contacts.upsert":
    case "CONTACTS_UPSERT":
      return await handleContactsUpsert(supabase, instance_id, tenant_id, payload);

    default:
      console.log(`[process-webhook-events] Ignoring event type: ${event_type}`);
      return [];
  }
}

// ── P0-5: Defensive epoch parsing ──
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
 * Handle messages.upsert — CRITICAL PATH.
 * Rule: DB INSERT must ALWAYS happen FIRST. No external calls before insert.
 * Returns background promises for deferred work (media, group name).
 */
async function handleMessageUpsert(
  supabase: any,
  instanceId: string,
  tenantId: string,
  payload: any,
  webhookCreatedAt: string,
): Promise<Promise<void>[]> {
  const t0_total = Date.now();
  const backgroundTasks: Promise<void>[] = [];

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
    
    // ⚡ PERF: Only use data already in payload — NEVER block on external API call
    const groupSubject: string | null = isGroup
      ? (msg.groupMetadata?.subject || msg.messageContextInfo?.messageSecret?.groupSubject || payload.groupSubject || payload.subject || msg.subject || null)
      : null;

    const eventDate = parseMessageTimestamp(msg);

    // ── P0-NORM: Build alternate JID formats for BR phone normalization ──
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

    // ── STEP 1: Upsert conversation ──
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
              console.log(`[process-webhook-events] Reopening resolved conversation ${conversationId} (not a survey response)`);
            }
          } else {
            updates.status = "open";
            console.log(`[process-webhook-events] Reopening resolved conversation ${conversationId}`);
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
      const displayName = isGroup ? (groupSubject || `Grupo ${phone.substring(0, 12)}...`) : contactName;
      
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
      media_url: inlineMediaUrl, // Only use if already present in payload
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
    // EVERYTHING BELOW IS NON-BLOCKING — message is already in DB
    // and visible via Realtime. Background tasks are collected and
    // settled with a safety timeout before the function exits.
    // ══════════════════════════════════════════════════════════════

    // ── BACKGROUND: Fetch media AFTER insert (fire-and-forget) ──
    if (!inlineMediaUrl && ["image", "video", "audio", "document", "gif", "sticker"].includes(messageType) && evolutionMessageId) {
      const bgMedia = (async () => {
        const t0_media = Date.now();
        try {
          const mediaUrl = await fetchAndStoreMedia(supabase, instanceId, tenantId, evolutionMessageId, messageType === "gif" ? "video" : messageType, mediaMimeType, msg);
          timingLog("media_fetch_done", t0_media, { evolutionMessageId, mediaUrl: !!mediaUrl });
          if (mediaUrl) {
            await supabase.from("wa_messages")
              .update({ media_url: mediaUrl })
              .eq("evolution_message_id", evolutionMessageId);
          }
        } catch (e) {
          timingLog("media_fetch_error", t0_media, { evolutionMessageId, error: String(e) });
        }
      })();
      backgroundTasks.push(bgMedia);
    }

    // ── BACKGROUND: Fetch group name if missing ──
    if (isGroup && !groupSubject && existingConv && !existingConv.cliente_nome?.startsWith("Grupo ") === false) {
      const bgGroup = (async () => {
        const t0_group = Date.now();
        try {
          const name = await fetchGroupName(supabase, instanceId, remoteJid);
          timingLog("group_fetch_done", t0_group, { conversationId, name });
          if (name) {
            await supabase.from("wa_conversations").update({ cliente_nome: name }).eq("id", conversationId);
          }
        } catch (e) {
          timingLog("group_fetch_error", t0_group, { error: String(e) });
        }
      })();
      backgroundTasks.push(bgGroup);
    }

    // ── Auto-assign (only new conversations, non-group) ──
    const isNewConversation = !existingConv;
    if (!isGroup && isNewConversation) {
      const { data: convCheck } = await supabase
        .from("wa_conversations")
        .select("assigned_to")
        .eq("id", conversationId)
        .maybeSingle();

      if (convCheck && !convCheck.assigned_to) {
        let ownerId: string | null = null;
        let assignSource = "unknown";

        if (!fromMe && content) {
          const canalMatch = content.match(/#CANAL:([a-zA-Z0-9_-]+)/);
          if (canalMatch) {
            const canalSlug = canalMatch[1];
            const { data: canalConsultor } = await supabase
              .rpc("resolve_consultor_public", { _codigo: canalSlug })
              .maybeSingle();

            if (canalConsultor && canalConsultor.tenant_id === tenantId && canalConsultor.id) {
              const { data: consultorData } = await supabase
                .from("consultores")
                .select("user_id")
                .eq("id", canalConsultor.id)
                .maybeSingle();

              if (consultorData?.user_id) {
                ownerId = consultorData.user_id;
                assignSource = `canal:${canalSlug}`;
              }
            }
          }
        }

        if (!ownerId) {
          const { data: linkedConsultores } = await supabase
            .from("wa_instance_consultores")
            .select("consultor_id, consultores:consultor_id(user_id, ativo)")
            .eq("instance_id", instanceId);

          const activeConsultores = (linkedConsultores || []).filter(
            (lc: any) => lc.consultores?.ativo === true && lc.consultores?.user_id
          );

          const activeCount = activeConsultores.length;

          if (activeCount === 1) {
            ownerId = (activeConsultores[0].consultores as any).user_id;
            assignSource = "single_consultor";
          } else if (activeCount > 1) {
            assignSource = "team_queue";
          } else {
            const { data: instData } = await supabase
              .from("wa_instances")
              .select("owner_user_id")
              .eq("id", instanceId)
              .maybeSingle();

            if (instData?.owner_user_id) {
              ownerId = instData.owner_user_id;
              assignSource = "instance_owner_fallback";
            }
          }
        }

        if (ownerId) {
          await supabase
            .from("wa_conversations")
            .update({ assigned_to: ownerId, status: "open" })
            .eq("id", conversationId)
            .is("assigned_to", null);

          console.log(`[process-webhook-events] Auto-assigned ${conversationId} to ${ownerId} (source=${assignSource})`);
        }
      }
    }

    // ── Auto-reply (new conversations, inbound, non-group) ──
    if (isNewConversation && !fromMe && !isGroup) {
      try {
        const { data: autoReplyConfig } = await supabase
          .from("whatsapp_automation_config")
          .select("auto_reply_enabled, auto_reply_message, auto_reply_cooldown_minutes")
          .eq("tenant_id", tenantId)
          .eq("ativo", true)
          .maybeSingle();

        if (autoReplyConfig?.auto_reply_enabled && autoReplyConfig?.auto_reply_message) {
          const replyMsg = autoReplyConfig.auto_reply_message
            .replace(/\{nome\}/g, contactName || "")
            .replace(/\{telefone\}/g, phone || "");

          const { data: outMsg } = await supabase.from("wa_messages").insert({
            conversation_id: conversationId,
            direction: "out",
            message_type: "text",
            content: replyMsg,
            is_internal_note: false,
            status: "pending",
            tenant_id: tenantId,
            source: "auto_reply",
          }).select("id").single();

          if (outMsg) {
            const idempKey = `auto_reply:${tenantId}:${conversationId}:${outMsg.id}`;
            await supabase.rpc("enqueue_wa_outbox_item", {
              p_tenant_id: tenantId,
              p_instance_id: instanceId,
              p_remote_jid: remoteJid,
              p_message_type: "text",
              p_content: replyMsg,
              p_conversation_id: conversationId,
              p_message_id: outMsg.id,
              p_idempotency_key: idempKey,
            });

            // Fire-and-forget outbox processing
            try {
              const outboxUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/process-wa-outbox`;
              fetch(outboxUrl, {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
                  "Content-Type": "application/json",
                },
              }).catch(() => {});
            } catch {}
          }
        }
      } catch (e) {
        console.warn(`[process-webhook-events] Auto-reply error:`, e);
      }
    }

    // ── Push notification (fire-and-forget) ──
    if (!fromMe && evolutionMessageId) {
      const preview = isGroup && participantName
        ? `${participantName}: ${content ? content.substring(0, 60) : `[${messageType}]`}`
        : content ? content.substring(0, 80) : `[${messageType}]`;

      try {
        const pushUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`;
        fetch(pushUrl, {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            conversationId,
            tenantId,
            instanceId,
            contactName: isGroup ? (groupSubject || contactName) : contactName,
            messagePreview: preview,
            messageId: evolutionMessageId,
            direction,
          }),
        }).catch(e => console.warn("[process-webhook-events] Push trigger failed:", e));
      } catch (e) {
        console.warn("[process-webhook-events] Push trigger error:", e);
      }
    }

    // ── Satisfaction rating check ──
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

          console.log(`[process-webhook-events] Satisfaction rating ${rating} recorded for conversation ${conversationId}`);
        }
      }
    }

    timingLog("message_total", t0_msg, { evolutionMessageId, messageType, bg_tasks: backgroundTasks.length });
  }

  timingLog("upsert_batch_total", t0_total, { msg_count: (Array.isArray(messages) ? messages : [messages]).length });
  return backgroundTasks;
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

    const extMap: Record<string, string> = {
      "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
      "video/mp4": "mp4", "video/3gpp": "3gp",
      "audio/ogg": "ogg", "audio/ogg; codecs=opus": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
      "application/pdf": "pdf",
    };
    const cleanMime = mediaMime.split(";")[0].trim();
    const ext = extMap[mediaMime] || extMap[cleanMime] || cleanMime.split("/")[1] || "bin";

    const filePath = `${tenantId}/media/${messageId}.${ext}`;
    
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
    return data?.profilePictureUrl || data?.data?.profilePictureUrl || data?.url || data?.profilePicUrl || null;
  } catch (err) {
    console.warn("[process-webhook-events] Failed to fetch profile picture:", err);
    return null;
  }
}

async function handleMessageUpdate(supabase: any, payload: any) {
  const data = payload.data || payload;
  const updates = Array.isArray(data) ? data : [data];
  
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
  _tenantId: string,
  payload: any
): Promise<Promise<void>[]> {
  const contacts = payload.data || payload.contacts || [];
  const bgTasks: Promise<void>[] = [];
  
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

    // Profile picture fetch is BACKGROUND — never block the event loop
    if (!profilePicUrl && !jid.endsWith("@g.us")) {
      const bgPic = (async () => {
        try {
          const picUrl = await fetchProfilePicture(supabase, instanceId, jid);
          if (picUrl) {
            await supabase
              .from("wa_conversations")
              .update({ profile_picture_url: picUrl })
              .eq("instance_id", instanceId)
              .eq("remote_jid", jid);
          }
        } catch (_) { /* ignore */ }
      })();
      bgTasks.push(bgPic);
    }
  }
  return bgTasks;
}
