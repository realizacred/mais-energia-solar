import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-cron-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const PLACEHOLDER_NO_PIC = "none";
const RETRY_AFTER_HOURS = 24;

function extractProfilePictureUrl(payload: any): string | null {
  const raw =
    payload?.profilePictureUrl ||
    payload?.profilePicUrl ||
    payload?.data?.profilePictureUrl ||
    payload?.data?.profilePicUrl ||
    payload?.url ||
    null;

  if (!raw || typeof raw !== "string") return null;
  const normalized = raw.trim();
  if (!normalized || normalized.toLowerCase() === "none") return null;
  return normalized;
}

function shouldPersistNoPhoto(status: number): boolean {
  // 404 = contato sem foto/privacidade; falhas transitórias (500/timeout/rate limit) não devem virar "none"
  return status === 404;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    const retryBefore = new Date(Date.now() - RETRY_AFTER_HOURS * 3600 * 1000).toISOString();

    const { data: convosNull } = await supabase
      .from("wa_conversations")
      .select("id, instance_id, remote_jid, profile_picture_url")
      .is("profile_picture_url", null)
      .eq("is_group", false)
      .limit(40);

    const { data: convosNone } = await supabase
      .from("wa_conversations")
      .select("id, instance_id, remote_jid, profile_picture_url")
      .eq("profile_picture_url", PLACEHOLDER_NO_PIC)
      .eq("is_group", false)
      .lt("updated_at", retryBefore)
      .limit(20);

    const conversations = [...(convosNull || []), ...(convosNone || [])];

    if (conversations.length === 0) {
      return jsonRes({ updated: 0, message: "No conversations need profile pictures" });
    }

    console.log(`[sync-wa-profile-pictures] Processing ${conversations.length} conversations`);

    const instanceCache: Record<string, any> = {};
    let updated = 0;
    let noPhoto = 0;
    let skippedTransient = 0;

    for (const conv of conversations) {
      try {
        if (!(conv.instance_id in instanceCache)) {
          const { data: inst } = await supabase
            .from("wa_instances")
            .select("evolution_api_url, evolution_instance_key, api_key, status")
            .eq("id", conv.instance_id)
            .maybeSingle();
          instanceCache[conv.instance_id] = inst;
        }

        const instance = instanceCache[conv.instance_id];
        if (!instance || instance.status !== "connected") continue;

        const apiUrl = instance.evolution_api_url?.replace(/\/$/, "");
        const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
        const instanceKey = instance.evolution_instance_key;
        if (!apiUrl || !instanceKey) continue;

        const res = await fetch(
          `${apiUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json", apikey: apiKey },
            body: JSON.stringify({ number: conv.remote_jid }),
            signal: AbortSignal.timeout(7000),
          }
        );

        if (!res.ok) {
          const text = await res.text().catch(() => "");
          if (shouldPersistNoPhoto(res.status)) {
            await supabase
              .from("wa_conversations")
              .update({ profile_picture_url: PLACEHOLDER_NO_PIC, updated_at: new Date().toISOString() })
              .eq("id", conv.id);
            noPhoto++;
          } else {
            skippedTransient++;
            console.warn(
              `[sync-wa-profile-pictures] transient error status=${res.status} conv=${conv.id} jid=${conv.remote_jid} body=${text.slice(0, 180)}`
            );
          }
          continue;
        }

        const payload = await res.json();
        const picUrl = extractProfilePictureUrl(payload);

        if (picUrl) {
          await supabase
            .from("wa_conversations")
            .update({ profile_picture_url: picUrl })
            .eq("id", conv.id);
          updated++;
        } else {
          await supabase
            .from("wa_conversations")
            .update({ profile_picture_url: PLACEHOLDER_NO_PIC, updated_at: new Date().toISOString() })
            .eq("id", conv.id);
          noPhoto++;
        }

        await new Promise((r) => setTimeout(r, 180));
      } catch (err) {
        console.warn(`[sync-wa-profile-pictures] Error for ${conv.remote_jid}:`, (err as Error).message);
      }
    }

    console.log(
      `[sync-wa-profile-pictures] Done: ${updated} updated, ${noPhoto} no-photo, ${skippedTransient} transient`
    );
    return jsonRes({ updated, no_photo: noPhoto, skipped_transient: skippedTransient, total: conversations.length });
  } catch (err) {
    console.error("[sync-wa-profile-pictures] Error:", err);
    return jsonRes({ error: String(err) }, 500);
  }
});

function jsonRes(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
