import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const BATCH_SIZE = 50;

// ── Status priority (monotonic — never downgrade) ──
const STATUS_PRIORITY: Record<string, number> = {
  pending: 0, queued: 1, sending: 2, sent: 3, delivered: 4, read: 5, failed: -1,
};

// ── Structured Timing Logger ──
function timingLog(step: string, t0: number, extra?: Record<string, unknown>) {
  const elapsed = Date.now() - t0;
  const payload = { step, elapsed_ms: elapsed, ts: new Date().toISOString(), ...extra };
  console.log(`[TIMING] ${JSON.stringify(payload)}`);
  return elapsed;
}

// ── Canonical JID normalizer (mirrors DB function) ──
function normalizeJid(rawJid: string): string {
  if (!rawJid) return rawJid;
  if (rawJid.includes("@g.us")) return rawJid;
  
  const [numPart] = rawJid.split("@");
  let digits = numPart.replace(/\D/g, "");
  
  // BR: ensure 13-digit format (55 + DD + 9 + 8 digits)
  if (digits.startsWith("55") && digits.length === 12) {
    digits = digits.slice(0, 4) + "9" + digits.slice(4);
  }
  
  return `${digits}@s.whatsapp.net`;
}

// ── Alt JIDs for BR phone lookup ──
function getAltJids(remoteJid: string): string[] {
  const canonical = normalizeJid(remoteJid);
  const jids = [remoteJid];
  if (canonical !== remoteJid) jids.push(canonical);
  
  // Also try without 9th digit
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

function buildConversationPreview(params: {
  messageType: string;
  content: string | null;
  isGroup: boolean;
  participantName?: string | null;
}): string {
  const base = formatPreviewByType(params.messageType, params.content);
  return params.isGroup && params.participantName ? `${params.participantName}: ${base}` : base;
}

function isTechnicalConversationName(name: string | null | undefined, remoteJid: string): boolean {
  const trimmed = name?.trim();
  if (!trimmed) return true;

  const normalizedJid = normalizeJid(remoteJid);
  const jidDigits = normalizedJid.split("@")[0];
  const nameDigits = trimmed.replace(/\D/g, "");

  if (!nameDigits) return false;

  if (trimmed === remoteJid || trimmed === normalizedJid) return true;
  if (nameDigits === jidDigits) return true;
  if (nameDigits === jidDigits.replace(/^55/, "")) return true;
  return false;
}

/**
 * Check if a pushName is actually just a phone number (should be ignored).
 * Prevents overwriting CRM names with phone-like pushNames.
 */
function isPushNameJustPhone(pushName: string | null | undefined, remoteJid: string): boolean {
  if (!pushName?.trim()) return true;
  const trimmed = pushName.trim();
  // If pushName is purely digits (with optional + or spaces), it's a phone
  const digits = trimmed.replace(/[\s+\-().]/g, "");
  if (/^\d{8,15}$/.test(digits)) return true;
  // Also check if it matches the JID phone
  const jidDigits = normalizeJid(remoteJid).split("@")[0];
  if (digits === jidDigits || digits === jidDigits.replace(/^55/, "")) return true;
  return false;
}

const INVALID_PROFILE_PICTURE_VALUES = new Set(["", "none", "null", "undefined"]);

function extractContactProfilePictureUrl(contact: any): string | null {
  const candidate =
    contact?.profilePictureUrl ??
    contact?.imgUrl ??
    contact?.profilePicUrl ??
    contact?.pictureUrl ??
    contact?.data?.profilePictureUrl ??
    contact?.data?.imgUrl ??
    contact?.data?.profilePicUrl ??
    contact?.data?.pictureUrl ??
    null;

  if (typeof candidate !== "string") return null;
  const normalized = candidate.trim();
  if (INVALID_PROFILE_PICTURE_VALUES.has(normalized.toLowerCase())) return null;
  return normalized;
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
 * CANONICAL DEDUPLICATION for outbound echo messages.
 * Priority:
 * 1. Match by correlation_id (best — set by our send flow)
 * 2. Match by evolution_message_id (provider already linked)
 * 3. Fuzzy content match as last-resort fallback (strict: same conv, ≤60s, exact content)
 */
async function reconcileOutboundEcho(
  supabase: any,
  conversationId: string,
  evolutionMessageId: string,
  content: string | null,
): Promise<{ reconciled: boolean; localMsgId?: string }> {
  // ── PRIORITY 1: Already exists with this evolution_message_id? → skip entirely
  const { data: existingByEvoId } = await supabase
    .from("wa_messages")
    .select("id")
    .eq("evolution_message_id", evolutionMessageId)
    .maybeSingle();
  
  if (existingByEvoId) {
    return { reconciled: true, localMsgId: existingByEvoId.id };
  }

  const cutoff = new Date(Date.now() - 120_000).toISOString();

  // ── PRIORITY 2: Match by correlation_id — the CANONICAL dedup mechanism.
  // When send-whatsapp-message or inbox composer inserts a local message,
  // it sets correlation_id. We look for unlinked outbound messages.
  const { data: candidates } = await supabase
    .from("wa_messages")
    .select("id, content, correlation_id")
    .eq("conversation_id", conversationId)
    .eq("direction", "out")
    .is("evolution_message_id", null)
    .eq("is_internal_note", false)
    .gte("created_at", cutoff)
    .order("created_at", { ascending: false })
    .limit(10);

  if (!candidates || candidates.length === 0) {
    return { reconciled: false };
  }

  // 2a. Any candidate with a correlation_id that matches content is a strong match.
  // Since Evolution doesn't echo our correlation_id back, we match by content
  // but ONLY among candidates that HAVE a correlation_id (i.e., originated from our system).
  const normalizedContent = (content || "").trim().substring(0, 80);
  
  // Prefer candidates WITH correlation_id (our messages) over those without
  const withCorrelation = candidates.filter((m: any) => m.correlation_id);
  const searchPool = withCorrelation.length > 0 ? withCorrelation : candidates;

  const match = normalizedContent.length > 0
    ? searchPool.find((m: any) => (m.content || "").trim().substring(0, 80) === normalizedContent)
    : null;

  if (match) {
    const now = new Date().toISOString();
    await supabase.from("wa_messages")
      .update({ 
        evolution_message_id: evolutionMessageId, 
        status: "sent",
        sent_at: now,
      })
      .eq("id", match.id);
    
    console.log(`[DEDUP] reconciled local=${match.id} ← evo=${evolutionMessageId} method=${match.correlation_id ? "correlation_id+content" : "content_fallback"}`);
    return { reconciled: true, localMsgId: match.id };
  }

  // ── FALLBACK: No content match. Log for audit trail.
  console.warn(`[DEDUP] no_match conv=${conversationId} evo=${evolutionMessageId} content_len=${normalizedContent.length} candidates=${candidates.length}`);
  return { reconciled: false };
}

/**
 * Resolve conversation using canonical JID normalization.
 * Tries all JID variants to prevent duplicate conversations.
 */
async function resolveConversation(
  supabase: any,
  instanceId: string,
  remoteJid: string,
): Promise<{ id: string; unread_count: number; status: string; is_group: boolean; cliente_nome: string | null; profile_picture_url: string | null; last_message_at: string | null } | null> {
  const altJids = getAltJids(remoteJid);
  
  const { data } = await supabase
    .from("wa_conversations")
    .select("id, unread_count, status, is_group, cliente_nome, profile_picture_url, updated_at, last_message_at")
    .eq("instance_id", instanceId)
    .in("remote_jid", altJids)
    .limit(1)
    .maybeSingle();
  
  return data;
}

// ── Main message handler ──
async function handleMessageUpsert(
  supabase: any,
  instanceId: string,
  tenantId: string,
  payload: any,
  webhookCreatedAt: string,
): Promise<number> {
  const t0_total = Date.now();
  let jobsEnqueued = 0;

  // Load instance profile_name once to filter self-named conversations
  const { data: instanceMeta } = await supabase
    .from("wa_instances")
    .select("profile_name")
    .eq("id", instanceId)
    .maybeSingle();
  const instanceProfileName = instanceMeta?.profile_name?.trim().toLowerCase() || null;
  const matchesInstanceName = (n: string | null | undefined) =>
    !!(n && instanceProfileName && n.trim().toLowerCase() === instanceProfileName);

  const messages = payload.data || payload.messages || (payload.key ? [payload] : []);
  
  for (const msg of Array.isArray(messages) ? messages : [messages]) {
    const t0_msg = Date.now();
    const key = msg.key || {};
    const remoteJid = key.remoteJid || msg.remoteJid;
    
    if (!remoteJid || remoteJid === "status@broadcast") continue;
    
    const isGroup = remoteJid.endsWith("@g.us");
    const fromMe = key.fromMe === true;
    const direction = fromMe ? "out" : "in";
    
    // Unwrap ephemeral messages — Evolution API wraps disappearing messages
    let messageContent = msg.message || {};
    if (messageContent.ephemeralMessage?.message) {
      messageContent = messageContent.ephemeralMessage.message;
    }
    const { content, messageType } = extractMessageContent(messageContent, msg);
    
    const evolutionMessageId = key.id || msg.id || null;
    const participantJid = isGroup ? (key.participant || msg.participant || null) : null;
    const participantName = isGroup ? (msg.pushName || null) : null;
    const rawContactName = isGroup ? null : (msg.pushName || msg.verifiedBizName || null);
    // Sanitize pushName: ignore phone-like names AND names matching the instance's own profile_name
    const contactName = rawContactName && !isPushNameJustPhone(rawContactName, remoteJid) && !matchesInstanceName(rawContactName) ? rawContactName : null;
    const phone = remoteJid.replace("@s.whatsapp.net", "").replace("@g.us", "");
    
    const groupSubject: string | null = isGroup
      ? (msg.groupMetadata?.subject || msg.messageContextInfo?.messageSecret?.groupSubject || payload.groupSubject || payload.subject || msg.subject || null)
      : null;

    const eventDate = parseMessageTimestamp(msg);
    const altJids = getAltJids(remoteJid);

    // ── STEP 1: Resolve/upsert conversation using canonical JID ──
    const t0_conv = Date.now();
    const existingConv = await resolveConversation(supabase, instanceId, remoteJid);

    let conversationId: string;

    if (existingConv) {
      conversationId = existingConv.id;
      const preview = buildConversationPreview({
        messageType,
        content,
        isGroup,
        participantName,
      }).substring(0, 100);
      
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
        // Name anti-regression: update only when current name is absent or technical (phone-like)
        const shouldUpdateName = !isGroup && contactName && (
          !existingConv.cliente_nome || isTechnicalConversationName(existingConv.cliente_nome, remoteJid)
        );
        if (shouldUpdateName) {
          const phonesToCheck = altJids.map(j => `+${j.split("@")[0]}`);
          const { data: savedContact } = await supabase
            .from("contacts")
            .select("name, display_name")
            .eq("tenant_id", tenantId)
            .in("phone_e164", phonesToCheck)
            .limit(1)
            .maybeSingle();
          const savedName = savedContact?.display_name || savedContact?.name;
          // CRM name > pushName > keep existing — never regress from real name to phone
          if (savedName) {
            updates.cliente_nome = savedName;
          } else if (!existingConv.cliente_nome) {
            updates.cliente_nome = contactName;
          } else if (isTechnicalConversationName(existingConv.cliente_nome, remoteJid)) {
            updates.cliente_nome = contactName;
          }
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
      // New conversation — use canonical JID
      let displayName = isGroup ? (groupSubject || null) : contactName;
      if (!isGroup && phone) {
        const phonesToCheck = altJids.map(j => `+${j.split("@")[0]}`);
        const { data: savedContact } = await supabase
          .from("contacts")
          .select("name, display_name")
          .eq("tenant_id", tenantId)
          .in("phone_e164", phonesToCheck)
          .limit(1)
          .maybeSingle();
        const savedName = savedContact?.display_name || savedContact?.name;
        if (savedName) displayName = savedName;
      }
      
      const canonicalJid = isGroup ? remoteJid : normalizeJid(remoteJid);
      
      const { data: newConv, error: convError } = await supabase
        .from("wa_conversations")
        .upsert({
          instance_id: instanceId,
          tenant_id: tenantId,
          remote_jid: canonicalJid,
          cliente_telefone: phone,
          cliente_nome: displayName,
          is_group: isGroup,
          status: "open",
          last_message_at: eventDate.toISOString(),
          last_message_preview: buildConversationPreview({
            messageType,
            content,
            isGroup,
            participantName,
          }).substring(0, 100),
          last_message_direction: direction,
          unread_count: fromMe ? 0 : 1,
         profile_picture_url: null,
        }, { onConflict: "instance_id,remote_jid", ignoreDuplicates: false })
        .select("id")
        .single();

      // Immediately enqueue profile_pic job for new conversations

      if (convError) {
        console.error("[process-webhook-events] Error upserting conversation:", convError);
        throw convError;
      }
      conversationId = newConv.id;

      if (!isGroup) {
        try {
          await supabase.from("wa_bg_jobs").insert({
            tenant_id: tenantId,
            instance_id: instanceId,
            job_type: "profile_pic",
            payload: { conversation_id: newConv.id, remote_jid: remoteJid },
            status: "pending",
          });
        } catch (_) {}

        // ── Auto-resolução em tempo real (Fase 1) ──
        // Tenta vincular conversa nova a cliente/lead via telefone (match único).
        // Nunca cria registros, nunca envia mensagem, nunca quebra webhook.
        try {
          await supabase.functions.invoke("wa-resolve-conversation", {
            body: { conversation_id: newConv.id, source: "realtime" },
          }).catch((e: any) => console.warn("[auto-resolve] invoke skipped:", e?.message));
        } catch (e: any) {
          console.warn("[auto-resolve] error suppressed:", e?.message);
        }
      }
    }
    timingLog("conversation_upsert", t0_conv, { conversationId, isNew: !existingConv });

    // ── STEP 2: DEDUP + INSERT MESSAGE ──
    const mediaMimeType: string | null = msg.mimetype || messageContent?.imageMessage?.mimetype || messageContent?.videoMessage?.mimetype || messageContent?.audioMessage?.mimetype || messageContent?.documentMessage?.mimetype || messageContent?.stickerMessage?.mimetype || null;
    const inlineMediaUrl: string | null = msg.mediaUrl || null;
    
    // Extract file metadata
    const docMsg = messageContent?.documentMessage;
    const fileName = docMsg?.fileName || null;
    const fileSize = docMsg?.fileLength ? Number(docMsg.fileLength) : null;

    // ── CANONICAL DEDUP for outbound echo ──
    if (fromMe && evolutionMessageId) {
      const { reconciled } = await reconcileOutboundEcho(
        supabase, conversationId, evolutionMessageId, content
      );
      if (reconciled) {
        timingLog("dedup_reconciled", t0_msg, { evolutionMessageId });
        continue;
      }
    }

    // Determine media_status
    const hasMedia = ["image", "video", "audio", "document", "gif", "sticker"].includes(messageType);
    const mediaStatus = hasMedia
      ? (inlineMediaUrl ? "ready" : "pending")
      : "none";

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
      media_status: mediaStatus,
      file_name: fileName,
      file_size: fileSize,
      status: fromMe ? "sent" : "delivered",
      sent_at: fromMe ? eventDate.toISOString() : null,
      delivered_at: !fromMe ? eventDate.toISOString() : null,
      participant_jid: participantJid,
      participant_name: participantName,
      metadata: { raw_key: key },
    }, { onConflict: "evolution_message_id", ignoreDuplicates: true });

    timingLog("db_insert", t0_insert, { evolutionMessageId, messageType });

    if (msgInsertError) {
      console.warn(`[process-webhook-events] Message upsert warning: ${msgInsertError.message}`);
    }

    // ── TIMING: webhook queue → DB insert latency ──
    if (webhookCreatedAt) {
      const webhookMs = new Date(webhookCreatedAt).getTime();
      timingLog("webhook_to_db_insert", webhookMs, {
        latency_ms: Date.now() - webhookMs,
        evolutionMessageId,
        messageType,
      });
    }

    // ── ENQUEUE: Media fetch job ──
    if (!inlineMediaUrl && hasMedia && evolutionMessageId) {
      jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "media_fetch", {
        evolution_message_id: evolutionMessageId,
        message_type: messageType === "gif" ? "video" : messageType,
        mime_type: mediaMimeType,
        raw_key: key,
        remote_jid: remoteJid,
        from_me: fromMe,
        file_name: fileName,
      }, `media:${evolutionMessageId}`);
    }

    // ── ENQUEUE: Group name fetch job ──
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
      const preview = buildConversationPreview({
        messageType,
        content,
        isGroup,
        participantName,
      }).substring(0, 80);

      jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "push", {
        conversation_id: conversationId,
        contact_name: isGroup ? (groupSubject || contactName) : contactName,
        message_preview: preview,
        message_id: evolutionMessageId,
        direction,
      }, `push:${evolutionMessageId}`);
    }

    // ── ENQUEUE: Auto-assign job ──
    if (!isGroup && !existingConv) {
      jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "auto_assign", {
        conversation_id: conversationId,
        remote_jid: remoteJid,
        from_me: fromMe,
        content,
        contact_name: contactName,
        phone,
      }, `assign:${conversationId}`);
    }

    // ── ENQUEUE: Auto-reply job ──
    if (!existingConv && !fromMe && !isGroup) {
      jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "auto_reply", {
        conversation_id: conversationId,
        remote_jid: remoteJid,
        contact_name: contactName,
        phone,
      }, `reply:${conversationId}`);
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
    const contactDisplay = extractContactDisplay(messageContent);
    return { content: contactDisplay, messageType: "contact" };
  }
  if (messageContent.reactionMessage) {
    return { content: messageContent.reactionMessage.text || null, messageType: "reaction" };
  }
  if (msg.body || msg.text) {
    return { content: msg.body || msg.text, messageType: "text" };
  }
  return { content: null, messageType: "text" };
}

/**
 * Extract display info from contactMessage / contactsArrayMessage.
 * Evolution API sends vCard data inside these fields.
 * Returns a human-readable string like "João Silva (+5511999990000)"
 */
function extractContactDisplay(mc: any): string | null {
  try {
    // Single contact
    if (mc.contactMessage) {
      const displayName = mc.contactMessage.displayName;
      const vcard = mc.contactMessage.vcard || "";
      const phone = extractPhoneFromVcard(vcard);
      if (displayName && phone) return `${displayName} (${phone})`;
      if (displayName) return displayName;
      if (phone) return phone;
      return null;
    }
    // Multiple contacts
    if (mc.contactsArrayMessage) {
      const contacts = mc.contactsArrayMessage.contacts || [];
      if (contacts.length === 0) {
        return mc.contactsArrayMessage.displayName || null;
      }
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
  } catch {
    // Fallback silently
  }
  return null;
}

function extractPhoneFromVcard(vcard: string): string | null {
  if (!vcard) return null;
  // Match TEL lines: TEL;type=CELL:+5511999990000 or TEL:+5511999990000
  const match = vcard.match(/TEL[^:]*:([+\d\s()-]+)/i);
  if (match) return match[1].trim();
  // Match waid (WhatsApp ID in vCard)
  const waidMatch = vcard.match(/waid=(\d+)/i);
  if (waidMatch) return `+${waidMatch[1]}`;
  return null;
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

    const { data: currentMsg, error: fetchErr } = await supabase
      .from("wa_messages")
      .select("id, status")
      .eq("evolution_message_id", evolutionId)
      .maybeSingle();

    if (fetchErr || !currentMsg) continue;

    const currentStatus = currentMsg.status || "pending";
    const currentPriority = STATUS_PRIORITY[currentStatus] ?? -1;
    const newPriority = STATUS_PRIORITY[newStatus] ?? -1;

    // Never downgrade status (monotonic progression) — failed is special (-1)
    if (newStatus !== "failed" && newPriority <= currentPriority) continue;
    // Never overwrite "failed" with lower status
    if (currentStatus === "failed") continue;

    const now = new Date().toISOString();
    const statusUpdate: Record<string, unknown> = { status: newStatus };
    
    // Set specific timestamps
    if (newStatus === "sent" && !currentMsg.sent_at) statusUpdate.sent_at = now;
    if (newStatus === "delivered") statusUpdate.delivered_at = now;
    if (newStatus === "read") statusUpdate.read_at = now;
    if (newStatus === "failed") statusUpdate.failed_at = now;

    await supabase
      .from("wa_messages")
      .update(statusUpdate)
      .eq("id", currentMsg.id);

    console.log(`[process-webhook-events] Message ${evolutionId} status: ${currentStatus} → ${newStatus}`);
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
      updated_at: new Date().toISOString(),
    })
    .eq("id", instanceId);

  console.log(`[process-webhook-events] Instance ${instanceId} connection: ${state} -> ${dbStatus}`);

  if (dbStatus === "disconnected" || dbStatus === "error") {
    try {
      const { data: inst } = await supabase
        .from("wa_instances")
        .select("evolution_api_url, evolution_instance_key, api_key, nome")
        .eq("id", instanceId)
        .single();

      if (inst?.evolution_api_url && inst?.evolution_instance_key) {
        const apiUrl = inst.evolution_api_url.replace(/\/$/, "");
        const apiKey = inst.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
        const encodedKey = encodeURIComponent(inst.evolution_instance_key);

        console.log(`[process-webhook-events] Auto-reconnect attempt for ${inst.nome}...`);

        const connectRes = await fetch(`${apiUrl}/instance/connect/${encodedKey}`, {
          method: "GET",
          headers: { apikey: apiKey },
          signal: AbortSignal.timeout(10000),
        });

        if (connectRes.ok) {
          const result = await connectRes.json();
          const newState = result?.instance?.state || result?.state;
          console.log(`[process-webhook-events] Auto-reconnect result: ${newState}`);
          
          if (newState === "open") {
            await supabase.from("wa_instances").update({
              status: "connected",
              last_seen_at: new Date().toISOString(),
            }).eq("id", instanceId);
          }
        } else {
          await connectRes.text();
          console.warn(`[process-webhook-events] Auto-reconnect failed: ${connectRes.status}`);
        }
      }
    } catch (e) {
      console.warn(`[process-webhook-events] Auto-reconnect error: ${(e as Error).message}`);
    }
  }
}

async function handleContactsUpsert(
  supabase: any,
  instanceId: string,
  tenantId: string,
  payload: any
): Promise<number> {
  const contacts = payload.data || payload.contacts || [];
  let jobsEnqueued = 0;

  // Load instance profile_name to filter out self-named contacts
  const { data: instanceMeta } = await supabase
    .from("wa_instances")
    .select("profile_name")
    .eq("id", instanceId)
    .maybeSingle();
  const instanceProfileName = instanceMeta?.profile_name?.trim().toLowerCase() || null;
  
  for (const contact of Array.isArray(contacts) ? contacts : [contacts]) {
    const jid = contact.id || contact.jid;
    if (!jid) continue;

    const name = contact.pushName || contact.name || contact.verifiedName || null;
    const profilePicUrl = extractContactProfilePictureUrl(contact);

    if (name || profilePicUrl) {
      const altJids = getAltJids(jid);
      const { data: conversations } = await supabase
        .from("wa_conversations")
        .select("id, cliente_nome, profile_picture_url, remote_jid, is_group")
        .eq("instance_id", instanceId)
        .in("remote_jid", altJids);

      for (const conversation of conversations || []) {
        const updates: any = {};

        if (profilePicUrl && profilePicUrl !== conversation.profile_picture_url) {
          updates.profile_picture_url = profilePicUrl;
        }

        // Sanitize pushName: reject phone-like names to preserve CRM data
        if (name && !isPushNameJustPhone(name, jid) && (conversation.is_group || isTechnicalConversationName(conversation.cliente_nome, conversation.remote_jid))) {
          updates.cliente_nome = name;
        }

        if (Object.keys(updates).length > 0) {
          await supabase
            .from("wa_conversations")
            .update(updates)
            .eq("id", conversation.id);
        }
      }
    }

    if (!profilePicUrl && !jid.endsWith("@g.us")) {
      jobsEnqueued += await enqueueJob(supabase, tenantId, instanceId, "profile_pic", {
        remote_jid: jid,
      }, `pic:${instanceId}:${jid}`);
    }
  }

  return jobsEnqueued;
}
