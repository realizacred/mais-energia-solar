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

// ── P0-5: Defensive epoch parsing ──
function parseMessageTimestamp(msg: any): Date {
  const raw = msg.messageTimestamp ?? msg.message_timestamp ?? msg.timestamp;
  if (raw == null) return new Date();

  let epochMs: number;
  if (typeof raw === "number") {
    // Evolution sends seconds; if < 1e12 it's seconds, otherwise ms
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

    // P0-5: Parse event timestamp defensively
    const eventDate = parseMessageTimestamp(msg);

    // Upsert conversation — include last_message_at for P0-5 timestamp comparison
    const { data: existingConv } = await supabase
      .from("wa_conversations")
      .select("id, unread_count, status, is_group, cliente_nome, profile_picture_url, updated_at, last_message_at")
      .eq("instance_id", instanceId)
      .eq("remote_jid", remoteJid)
      .maybeSingle();

    let conversationId: string;

    if (existingConv) {
      conversationId = existingConv.id;
      const preview = isGroup && participantName
        ? `${participantName}: ${content ? content.substring(0, 80) : `[${messageType}]`}`
        : content ? content.substring(0, 100) : `[${messageType}]`;
      
      // P0-5: Only update preview/direction/last_message_at if event is newer
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
      
      // Update group name if we got it from payload (always update, even if already set with fallback)
      if (isGroup && groupSubject) {
        updates.cliente_nome = groupSubject;
      }
      
      if (!fromMe) {
        // P0-5: unread_count ALWAYS increments for inbound, regardless of timestamp order
        updates.unread_count = (existingConv.unread_count || 0) + 1;
        // For individual chats, update contact name
        if (!isGroup && contactName) {
          updates.cliente_nome = contactName;
        }
        // Reopen resolved conversations when client sends a new message
        // BUT not if the message is a satisfaction survey response
        if (existingConv.status === "resolved") {
          const trimmedContent = content?.trim() || "";
          const possibleRating = parseInt(trimmedContent, 10);
          const isSurveyResponse = possibleRating >= 1 && possibleRating <= 5 && trimmedContent.length <= 2;
          
          if (isSurveyResponse) {
            // Check if there's a pending satisfaction rating
            const { data: pendingSurvey } = await supabase
              .from("wa_satisfaction_ratings")
              .select("id")
              .eq("conversation_id", existingConv.id)
              .is("rating", null)
              .limit(1)
              .maybeSingle();
            
            if (!pendingSurvey) {
              // No pending survey — reopen normally
              updates.status = "open";
              console.log(`[process-webhook-events] Reopening resolved conversation ${conversationId} (not a survey response)`);
            } else {
              console.log(`[process-webhook-events] Keeping conversation ${conversationId} resolved (satisfaction survey response)`);
            }
          } else {
            updates.status = "open";
            console.log(`[process-webhook-events] Reopening resolved conversation ${conversationId}`);
          }
        }
      }
      
      // Ensure is_group flag is set
      if (isGroup && !existingConv.is_group) {
        updates.is_group = true;
      }
      
      // Only update if there are actual changes
      if (Object.keys(updates).length > 0) {
        await supabase
          .from("wa_conversations")
          .update(updates)
          .eq("id", conversationId);
      }
    } else {
      const displayName = isGroup ? (groupSubject || `Grupo ${phone.substring(0, 12)}...`) : contactName;
      
      // Fetch profile picture for new conversations (individuals and groups)
      let profilePicUrl: string | null = null;
      try {
        profilePicUrl = await fetchProfilePicture(supabase, instanceId, remoteJid);
      } catch (_) { /* ignore for groups */ }

      // ⚠️ HARDENING: Use upsert with onConflict to avoid duplicate key errors
      // from concurrent webhook events for the same conversation
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
          profile_picture_url: profilePicUrl,
        }, { onConflict: "instance_id,remote_jid", ignoreDuplicates: false })
        .select("id")
        .single();

      if (convError) {
        console.error("[process-webhook-events] Error upserting conversation:", convError);
        throw convError;
      }
      conversationId = newConv.id;
    }

    // ── HARDENING: Smart auto-assign conversations ──
    // HMV4: Auto-assign ONLY on conversation creation (INSERT), never on subsequent messages.
    // This prevents flip-flop when conversations are returned to team queue.
    // Priority:
    //   A) #CANAL:slug marker → ALWAYS auto-assign to that consultor
    //   B) No marker:
    //      - 1 active consultor on instance → auto-assign
    //      - 2+ active consultores → leave null (team queue, "Equipe")
    //      - 0 consultores → fallback to instance owner, else null
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

        // A. Check #CANAL:slug marker in first inbound message
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
                console.log(`[process-webhook-events] #CANAL marker detected: ${canalSlug} → user ${ownerId}`);
              }
            }
          }
        }

        // B. No canal marker → count-based logic (single query, no N+1)
        if (!ownerId) {
          const { data: linkedConsultores } = await supabase
            .from("wa_instance_consultores")
            .select("consultor_id, consultores:consultor_id(user_id, ativo)")
            .eq("instance_id", instanceId);

          // Filter to active consultores with user_id
          const activeConsultores = (linkedConsultores || []).filter(
            (lc: any) => lc.consultores?.ativo === true && lc.consultores?.user_id
          );

          const activeCount = activeConsultores.length;

          if (activeCount === 1) {
            ownerId = (activeConsultores[0].consultores as any).user_id;
            assignSource = "single_consultor";
            console.log(`[process-webhook-events] Single active consultor on instance → auto-assign to ${ownerId}`);
          } else if (activeCount > 1) {
            assignSource = "team_queue";
            console.log(`[process-webhook-events] ${activeCount} active consultores on instance → team queue (assigned_to=null)`);
          } else {
            const { data: instData } = await supabase
              .from("wa_instances")
              .select("owner_user_id")
              .eq("id", instanceId)
              .maybeSingle();

            if (instData?.owner_user_id) {
              ownerId = instData.owner_user_id;
              assignSource = "instance_owner_fallback";
              console.log(`[process-webhook-events] No linked consultores → fallback to instance owner ${ownerId}`);
            } else {
              console.warn(`[process-webhook-events] Conversation ${conversationId} has no consultores and no owner → stays unassigned`);
            }
          }
        }

        // Idempotent: only assign if still null
        if (ownerId) {
          const { error: assignErr } = await supabase
            .from("wa_conversations")
            .update({ assigned_to: ownerId, status: "open" })
            .eq("id", conversationId)
            .is("assigned_to", null);

          if (!assignErr) {
            console.log(`[process-webhook-events] Auto-assigned conversation ${conversationId} to ${ownerId} (source=${assignSource})`);
          }
        }
      }
    }

    if (existingConv && !fromMe && !isGroup) {
      const shouldRefresh = shouldRefreshProfilePic(existingConv);
      if (shouldRefresh) {
        try {
          const picUrl = await fetchProfilePicture(supabase, instanceId, remoteJid);
          if (picUrl && picUrl !== existingConv.profile_picture_url) {
            await supabase
              .from("wa_conversations")
              .update({ profile_picture_url: picUrl })
              .eq("id", existingConv.id);
            console.log(`[process-webhook-events] Profile picture updated for conversation ${conversationId}`);
          }
        } catch (e) {
          console.warn(`[process-webhook-events] Profile picture refresh failed for ${remoteJid}:`, e);
        }
      }
    }

    // ── Fetch media if applicable ──
    let mediaUrl: string | null = msg.mediaUrl || null;
    const mediaMimeType: string | null = msg.mimetype || messageContent?.imageMessage?.mimetype || messageContent?.videoMessage?.mimetype || messageContent?.audioMessage?.mimetype || messageContent?.documentMessage?.mimetype || null;
    
    if (!mediaUrl && ["image", "video", "audio", "document"].includes(messageType) && evolutionMessageId) {
      mediaUrl = await fetchAndStoreMedia(supabase, instanceId, tenantId, evolutionMessageId, messageType, mediaMimeType, msg);
    }

    // ⚠️ HARDENING: Use upsert with ignoreDuplicates to prevent duplicate key errors
    // from concurrent webhook processing of the same message
    const { error: msgInsertError } = await supabase.from("wa_messages").upsert({
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
    }, { onConflict: "evolution_message_id", ignoreDuplicates: true });

    if (msgInsertError) {
      console.warn(`[process-webhook-events] Message upsert warning: ${msgInsertError.message}`);
    }

    // ── Send Web Push for inbound messages (fire-and-forget) ──
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

// Check if we should refresh profile picture
// - Always refresh if missing
// - Retry every ~24h if still missing after last update
function shouldRefreshProfilePic(existingConv: any): boolean {
  if (!existingConv.profile_picture_url) {
    if (existingConv.updated_at) {
      const lastUpdate = new Date(existingConv.updated_at).getTime();
      const sixHoursAgo = Date.now() - 6 * 60 * 60 * 1000;
      if (lastUpdate > sixHoursAgo) {
        return false;
      }
    }
    return true;
  }
  return false;
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

    // If contact has no profile picture, try to fetch it
    if (!profilePicUrl && !jid.endsWith("@g.us")) {
      try {
        const picUrl = await fetchProfilePicture(supabase, instanceId, jid);
        if (picUrl) {
          await supabase
            .from("wa_conversations")
            .update({ profile_picture_url: picUrl })
            .eq("instance_id", instanceId)
            .eq("remote_jid", jid);
          console.log(`[process-webhook-events] Profile picture fetched via contacts.upsert for ${jid}`);
        }
      } catch (_) { /* ignore */ }
    }
  }
}
