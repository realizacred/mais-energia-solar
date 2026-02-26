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
    // Claim pending jobs (oldest first, skip already processing)
    const { data: jobs, error } = await supabase
      .from("wa_bg_jobs")
      .select("*")
      .in("status", ["pending", "failed"])
      .lt("attempts", MAX_ATTEMPTS)
      .lte("next_run_at", new Date().toISOString())
      .order("created_at", { ascending: true })
      .limit(MAX_JOBS_PER_RUN);

    if (error) {
      console.error("[wa-bg-worker] Fetch error:", error);
      throw error;
    }

    if (!jobs || jobs.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Mark all as processing
    const jobIds = jobs.map(j => j.id);
    await supabase
      .from("wa_bg_jobs")
      .update({ status: "processing" })
      .in("id", jobIds);

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
        console.log(`[wa-bg-worker] ${job.job_type} done in ${Date.now() - t0_job}ms (${job.idempotency_key})`);
      } catch (err) {
        const nextAttempt = (job.attempts || 0) + 1;
        const backoffMs = Math.min(60_000, 1000 * Math.pow(2, nextAttempt));
        
        await supabase
          .from("wa_bg_jobs")
          .update({
            status: nextAttempt >= MAX_ATTEMPTS ? "failed" : "pending",
            attempts: nextAttempt,
            last_error: String(err).substring(0, 500),
            next_run_at: new Date(Date.now() + backoffMs).toISOString(),
          })
          .eq("id", job.id);
        
        failed++;
        console.warn(`[wa-bg-worker] ${job.job_type} failed (attempt ${nextAttempt}):`, String(err).substring(0, 200));
      }
    }

    const elapsed = Date.now() - t0;
    console.log(`[wa-bg-worker] Done: ${done} ok, ${failed} failed, ${elapsed}ms total`);

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

// ── Helper: get Evolution API instance details ──
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

// ── JOB: Media Fetch ──
async function jobMediaFetch(supabase: any, instanceId: string, tenantId: string, p: any) {
  const inst = await getInstanceDetails(supabase, instanceId);
  if (!inst || !inst.apiUrl || !inst.instanceKey) return;

  const messageId = p.evolution_message_id;
  const messageType = p.message_type;
  const mimeType = p.mime_type;

  const mediaEndpoint = `${inst.apiUrl}/chat/getBase64FromMediaMessage/${encodeURIComponent(inst.instanceKey)}`;
  const messageKey = p.raw_key?.remoteJid
    ? p.raw_key
    : { remoteJid: p.remote_jid || "", fromMe: p.from_me ?? false, id: messageId };

  const mediaRes = await fetch(mediaEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: inst.apiKey },
    body: JSON.stringify({ message: { key: messageKey }, convertToMp4: messageType === "audio" }),
  });

  if (!mediaRes.ok) {
    const errText = await mediaRes.text().catch(() => "");
    throw new Error(`Media API ${mediaRes.status}: ${errText.substring(0, 200)}`);
  }

  const mediaData = await mediaRes.json();
  const base64 = mediaData.base64 || mediaData.data?.base64 || null;
  const mediaMime = mediaData.mimetype || mediaData.data?.mimetype || mimeType || "application/octet-stream";

  if (!base64) throw new Error("No base64 in media response");

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
    .upload(filePath, bytes, { contentType: mediaMime, upsert: true });

  if (uploadError) throw new Error(`Upload error: ${uploadError.message}`);

  const { data: publicUrl } = supabase.storage
    .from("wa-attachments")
    .getPublicUrl(filePath);

  const mediaUrl = publicUrl?.publicUrl || null;
  if (mediaUrl) {
    await supabase.from("wa_messages")
      .update({ media_url: mediaUrl })
      .eq("evolution_message_id", messageId);
    console.log(`[wa-bg-worker] Media stored: ${messageType} -> ${filePath}`);
  }
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
  });

  if (!res.ok) return; // Not critical

  const data = await res.json();
  const picUrl = data?.profilePictureUrl || data?.data?.profilePictureUrl || data?.url || data?.profilePicUrl || null;
  if (picUrl) {
    await supabase
      .from("wa_conversations")
      .update({ profile_picture_url: picUrl })
      .eq("instance_id", instanceId)
      .eq("remote_jid", p.remote_jid);
  }
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
  // Consume response body
  await res.text();
}

// ── JOB: Auto-Assign ──
async function jobAutoAssign(supabase: any, instanceId: string, tenantId: string, p: any) {
  const { data: convCheck } = await supabase
    .from("wa_conversations")
    .select("assigned_to")
    .eq("id", p.conversation_id)
    .maybeSingle();

  if (!convCheck || convCheck.assigned_to) return; // Already assigned

  let ownerId: string | null = null;
  let assignSource = "unknown";

  // Check #CANAL tag
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

  const replyMsg = autoReplyConfig.auto_reply_message
    .replace(/\{nome\}/g, p.contact_name || "")
    .replace(/\{telefone\}/g, p.phone || "");

  const { data: outMsg } = await supabase.from("wa_messages").insert({
    conversation_id: p.conversation_id,
    direction: "out",
    message_type: "text",
    content: replyMsg,
    is_internal_note: false,
    status: "pending",
    tenant_id: tenantId,
    source: "auto_reply",
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
