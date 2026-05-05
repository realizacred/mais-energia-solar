import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const MAX_JOBS_PER_RUN = 20;
const MAX_ATTEMPTS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  const t0 = Date.now();

  try {
    const { data: jobs, error } = await supabase.rpc("claim_wa_bg_jobs", {
      max_jobs: MAX_JOBS_PER_RUN,
    });

    if (error) {
      console.error("[wa-bg-worker] Claim error:", error);
      throw error;
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[wa-bg-worker] Claimed ${jobs.length} jobs`);

    let done = 0;
    let failed = 0;

    for (const job of jobs) {
      const t0_job = Date.now();
      try {
        await processJob(supabase, job);

        await supabase
          .from("wa_bg_jobs")
          .update({ status: "done", updated_at: new Date().toISOString() })
          .eq("id", job.id);

        done++;
        const elapsed = Date.now() - t0_job;
        console.log(`[wa-bg-worker] [METRIC] ${job.job_type} done in ${elapsed}ms (${job.idempotency_key})`);
      } catch (err) {
        const nextAttempt = (job.attempts || 0) + 1;
        const isFinal = nextAttempt >= MAX_ATTEMPTS;
        const backoffMs = Math.min(60_000, 1000 * Math.pow(2, nextAttempt));

        await supabase
          .from("wa_bg_jobs")
          .update({
            status: isFinal ? "failed" : "pending",
            attempts: nextAttempt,
            last_error: String(err).substring(0, 500),
            next_run_at: new Date(Date.now() + backoffMs).toISOString(),
          })
          .eq("id", job.id);

        // When media_fetch permanently fails, update formal media_status
        if (isFinal && job.job_type === "media_fetch" && job.payload?.evolution_message_id) {
          const now = new Date().toISOString();
          await supabase
            .from("wa_messages")
            .update({ 
              media_status: "failed",
              media_error_message: `Falha permanente após ${MAX_ATTEMPTS} tentativas: ${String(err).substring(0, 200)}`,
              media_failed_at: now,
              media_retry_count: nextAttempt,
              error_message: "Mídia não disponível — falha ao baixar do provedor",
            })
            .eq("evolution_message_id", job.payload.evolution_message_id)
            .is("media_url", null);
          console.warn(`[wa-bg-worker] media_fetch PERMANENTLY FAILED for ${job.payload.evolution_message_id}`);
        }

        failed++;
        console.warn(`[wa-bg-worker] ${job.job_type} failed (attempt ${nextAttempt}):`, String(err).substring(0, 200));
      }
    }

    const elapsed = Date.now() - t0;
    console.log(`[wa-bg-worker] [METRIC] batch_summary: ${done} ok, ${failed} failed, ${elapsed}ms total, ${jobs.length} claimed`);

    return new Response(
      JSON.stringify({ done, failed, total: jobs.length, elapsed_ms: elapsed }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[wa-bg-worker] Unhandled error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ── Job Dispatcher ──
async function processJob(supabase: any, job: any) {
  const p = job.payload;

  switch (job.job_type) {
    case "media_fetch":
      return await jobMediaFetch(supabase, job.instance_id, job.tenant_id, p);
    case "group_name":
      return await jobGroupName(supabase, job.instance_id, p);
    case "profile_pic":
      return await jobProfilePic(supabase, job.instance_id, p);
    case "push":
      return await jobPushNotification(supabase, job.tenant_id, job.instance_id, p);
    case "auto_assign":
      return await jobAutoAssign(supabase, job.instance_id, job.tenant_id, p);
    case "auto_reply":
      return await jobAutoReply(supabase, job.instance_id, job.tenant_id, p);
    default:
      console.warn(`[wa-bg-worker] Unknown job type: ${job.job_type}`);
  }
}

async function getInstanceDetails(supabase: any, instanceId: string) {
  const { data } = await supabase
    .from("wa_instances")
    .select("evolution_api_url, evolution_instance_key, api_key, owner_user_id")
    .eq("id", instanceId)
    .maybeSingle();

  if (!data) return null;

  return {
    apiUrl: data.evolution_api_url?.replace(/\/$/, ""),
    apiKey: data.api_key || Deno.env.get("EVOLUTION_API_KEY") || "",
    instanceKey: data.evolution_instance_key,
    ownerUserId: data.owner_user_id,
  };
}

// ── JOB: Media Fetch (with formal media_status transitions) ──
async function jobMediaFetch(supabase: any, instanceId: string, tenantId: string, p: any) {
  const messageId = p.evolution_message_id;

  // IDEMPOTENCY: skip if media already uploaded
  const { data: existing } = await supabase
    .from("wa_messages")
    .select("media_url, media_status")
    .eq("evolution_message_id", messageId)
    .maybeSingle();

  if (existing?.media_url || existing?.media_status === "ready") {
    console.log(`[wa-bg-worker] media_fetch SKIP (already ready): ${messageId}`);
    return;
  }

  // Transition: pending → fetching
  await supabase.from("wa_messages")
    .update({ media_status: "fetching", media_retry_count: (existing?.media_retry_count || 0) + 1 })
    .eq("evolution_message_id", messageId);

  const inst = await getInstanceDetails(supabase, instanceId);
  if (!inst || !inst.apiUrl || !inst.instanceKey) return;

  const messageType = p.message_type;
  const mimeType = p.mime_type;

  const mediaEndpoint = `${inst.apiUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(inst.instanceKey)}`;
  const messageKey = p.raw_key?.remoteJid
    ? p.raw_key
    : { remoteJid: p.remote_jid || "", fromMe: p.from_me ?? false, id: messageId };

  // For audio, request convertToMp4 so Evolution API converts ogg/opus to mp4 (browser-compatible)
  const requestConvert = messageType === "audio";
  const mediaRes = await fetch(mediaEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: inst.apiKey },
    body: JSON.stringify({ message: { key: messageKey }, convertToMp4: requestConvert }),
  });

  if (!mediaRes.ok) {
    const errText = await mediaRes.text().catch(() => "");
    throw new Error(`Media API ${mediaRes.status}: ${errText.substring(0, 200)}`);
  }

  const mediaData = await mediaRes.json();
  const base64 = mediaData.base64 || mediaData.data?.base64 || null;
  let mediaMime = mediaData.mimetype || mediaData.data?.mimetype || mimeType || "application/octet-stream";

  if (!base64) throw new Error("No base64 in media response");

  // FIX: When we requested convertToMp4 for audio, Evolution API often returns
  // the original MIME (audio/ogg) even though the actual data is now mp4.
  // Detect the real format from the first bytes of the decoded data.
  if (requestConvert && messageType === "audio") {
    // Decode just enough bytes to detect format (first 12 bytes)
    const probe = atob(base64.substring(0, 24)); // 24 base64 chars = 18 bytes
    const sig = [];
    for (let i = 0; i < Math.min(probe.length, 12); i++) sig.push(probe.charCodeAt(i));

    // ftyp signature at offset 4 = MP4 container
    const isMp4 = sig.length >= 8 && sig[4] === 0x66 && sig[5] === 0x74 && sig[6] === 0x79 && sig[7] === 0x70;
    // OggS magic = OGG container
    const isOgg = sig.length >= 4 && sig[0] === 0x4F && sig[1] === 0x67 && sig[2] === 0x67 && sig[3] === 0x53;

    if (isMp4 && mediaMime.includes("ogg")) {
      console.log(`[wa-bg-worker] Audio format correction: reported=${mediaMime}, actual=audio/mp4`);
      mediaMime = "audio/mp4";
    } else if (isOgg && mediaMime.includes("mp4")) {
      console.log(`[wa-bg-worker] Audio format correction: reported=${mediaMime}, actual=audio/ogg; codecs=opus`);
      mediaMime = "audio/ogg; codecs=opus";
    }
  }

  const extMap: Record<string, string> = {
    "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp",
    "video/mp4": "mp4", "video/3gpp": "3gp",
    "audio/ogg": "ogg", "audio/ogg; codecs=opus": "ogg", "audio/mpeg": "mp3", "audio/mp4": "m4a",
    "application/pdf": "pdf",
  };
  const cleanMime = mediaMime.split(";")[0].trim();
  const ext = extMap[mediaMime] || extMap[cleanMime] || cleanMime.split("/")[1] || "bin";
  const storagePath = `${tenantId}/media/${messageId}.${ext}`;

  // Decode base64 in chunks to handle large audio files safely
  const binaryStr = atob(base64);
  const bytes = new Uint8Array(binaryStr.length);
  const CHUNK = 8192;
  for (let i = 0; i < binaryStr.length; i += CHUNK) {
    const end = Math.min(i + CHUNK, binaryStr.length);
    for (let j = i; j < end; j++) {
      bytes[j] = binaryStr.charCodeAt(j);
    }
  }

  const { error: uploadError } = await supabase.storage
    .from("wa-attachments")
    .upload(storagePath, bytes, { contentType: mediaMime, upsert: true });

  if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

  // Onda 1 hardening: bucket wa-attachments é PRIVADO. NUNCA salvar URL pública.
  // Frontend resolve via getSignedMediaUrl(storage_path) on demand.
  await supabase.from("wa_messages")
    .update({
      media_url: null,
      media_status: "ready",
      storage_path: storagePath,
      media_mime_type: mediaMime,
      file_name: p.file_name || `${messageId}.${ext}`,
      file_size: bytes.length,
    })
    .eq("evolution_message_id", messageId);
  console.log(`[wa-bg-worker] Media stored (private): ${messageType} -> ${storagePath} (${bytes.length} bytes)`);
}

// ── JOB: Group Name ──
async function jobGroupName(supabase: any, instanceId: string, p: any) {
  const inst = await getInstanceDetails(supabase, instanceId);
  if (!inst || !inst.apiUrl || !inst.instanceKey) return;

  const endpoint = `${inst.apiUrl}/group/findGroupInfos/${encodeURIComponent(inst.instanceKey)}?groupJid=${encodeURIComponent(p.remote_jid)}`;
  const res = await fetch(endpoint, {
    method: "GET",
    headers: { apikey: inst.apiKey },
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Group API ${res.status}: ${errText.substring(0, 200)}`);
  }

  const data = await res.json();
  const subject = data?.subject || data?.data?.subject || null;
  if (subject) {
    await supabase.from("wa_conversations").update({ cliente_nome: subject }).eq("id", p.conversation_id);
  }
}

// ── JOB: Profile Picture ──
async function jobProfilePic(supabase: any, instanceId: string, p: any) {
  const inst = await getInstanceDetails(supabase, instanceId);
  if (!inst || !inst.apiUrl || !inst.instanceKey) return;

  const endpoint = `${inst.apiUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(inst.instanceKey)}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: inst.apiKey },
    body: JSON.stringify({ number: p.remote_jid }),
    signal: AbortSignal.timeout(7000),
  });

  if (!res.ok) return;

  const data = await res.json();
  const picUrl = extractProfilePictureUrlFromPayload(data);
  if (picUrl) {
    await supabase
      .from("wa_conversations")
      .update({ profile_picture_url: picUrl })
      .eq("instance_id", instanceId)
      .eq("remote_jid", p.remote_jid);
  }
}

/** Robust extraction of profile picture URL from API response (§41 AGENTS.md) */
function extractProfilePictureUrlFromPayload(payload: any): string | null {
  const INVALID = new Set(["", "none", "null", "undefined"]);
  const candidates = [
    payload?.profilePictureUrl,
    payload?.imgUrl,
    payload?.profilePicUrl,
    payload?.pictureUrl,
    payload?.url,
    payload?.data?.profilePictureUrl,
    payload?.data?.imgUrl,
    payload?.data?.profilePicUrl,
    payload?.data?.pictureUrl,
  ];
  for (const url of candidates) {
    if (typeof url === "string") {
      const trimmed = url.trim();
      if (!INVALID.has(trimmed.toLowerCase()) && trimmed.startsWith("http")) {
        return trimmed;
      }
    }
  }
  return null;
}

// ── JOB: Push Notification ──
async function jobPushNotification(supabase: any, tenantId: string, instanceId: string, p: any) {
  const pushUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-push-notification`;
  const res = await fetch(pushUrl, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      conversationId: p.conversation_id,
      tenantId,
      instanceId,
      contactName: p.contact_name,
      messagePreview: p.message_preview,
      messageId: p.message_id,
      direction: p.direction,
    }),
  });
  await res.text();
}

// ── JOB: Auto-Assign ──
async function jobAutoAssign(supabase: any, instanceId: string, tenantId: string, p: any) {
  const { data: convCheck } = await supabase
    .from("wa_conversations")
    .select("assigned_to")
    .eq("id", p.conversation_id)
    .maybeSingle();

  if (!convCheck || convCheck.assigned_to) return;

  let ownerId: string | null = null;
  let assignSource = "unknown";

  if (!p.from_me && p.content) {
    const canalMatch = p.content.match(/#CANAL:([a-zA-Z0-9_-]+)/);
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

    if (activeConsultores.length === 1) {
      ownerId = (activeConsultores[0].consultores as any).user_id;
      assignSource = "single_consultor";
    } else if (activeConsultores.length === 0) {
      const inst = await getInstanceDetails(supabase, instanceId);
      if (inst?.ownerUserId) {
        ownerId = inst.ownerUserId;
        assignSource = "instance_owner_fallback";
      }
    }
  }

  if (ownerId) {
    await supabase
      .from("wa_conversations")
      .update({ assigned_to: ownerId, status: "open" })
      .eq("id", p.conversation_id)
      .is("assigned_to", null);

    console.log(`[wa-bg-worker] Auto-assigned ${p.conversation_id} to ${ownerId} (${assignSource})`);
  }
}

// ── JOB: Auto-Reply ──
async function jobAutoReply(supabase: any, instanceId: string, tenantId: string, p: any) {
  const { data: autoReplyConfig } = await supabase
    .from("whatsapp_automation_config")
    .select("auto_reply_enabled, auto_reply_message, auto_reply_cooldown_minutes")
    .eq("tenant_id", tenantId)
    .eq("ativo", true)
    .maybeSingle();

  if (!autoReplyConfig?.auto_reply_enabled || !autoReplyConfig?.auto_reply_message) return;

  // Use shared resolver for variable substitution
  const { resolveWaTemplate } = await import("../_shared/resolveWaTemplate.ts");
  const replyMsg = resolveWaTemplate(autoReplyConfig.auto_reply_message, {
    nome: p.contact_name || "",
    telefone: p.phone || "",
  });

  const correlationId = crypto.randomUUID();

  const { data: outMsg } = await supabase.from("wa_messages").insert({
    conversation_id: p.conversation_id,
    direction: "out",
    message_type: "text",
    content: replyMsg,
    is_internal_note: false,
    status: "pending",
    tenant_id: tenantId,
    source: "auto_reply",
    correlation_id: correlationId,
    queued_at: new Date().toISOString(),
  }).select("id").single();

  if (outMsg) {
    const idempKey = `auto_reply:${tenantId}:${p.conversation_id}:${outMsg.id}`;
    await supabase.rpc("enqueue_wa_outbox_item", {
      p_tenant_id: tenantId,
      p_instance_id: instanceId,
      p_remote_jid: p.remote_jid,
      p_message_type: "text",
      p_content: replyMsg,
      p_conversation_id: p.conversation_id,
      p_message_id: outMsg.id,
      p_idempotency_key: idempKey,
    });

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
