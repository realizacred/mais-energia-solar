import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );

  try {
    // Get conversations without profile pictures (individual chats only)
    const { data: conversations, error } = await supabase
      .from("wa_conversations")
      .select("id, instance_id, remote_jid")
      .is("profile_picture_url", null)
      .eq("is_group", false)
      .limit(30); // Process in batches to avoid timeout

    if (error) throw error;
    if (!conversations || conversations.length === 0) {
      return new Response(JSON.stringify({ updated: 0, message: "No conversations need profile pictures" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`[sync-wa-profile-pictures] Processing ${conversations.length} conversations`);

    // Cache instance details
    const instanceCache: Record<string, { evolution_api_url: string; evolution_instance_key: string; api_key: string } | null> = {};

    let updated = 0;
    let failed = 0;

    for (const conv of conversations) {
      try {
        // Get instance details (cached)
        if (!(conv.instance_id in instanceCache)) {
          const { data: inst } = await supabase
            .from("wa_instances")
            .select("evolution_api_url, evolution_instance_key, api_key")
            .eq("id", conv.instance_id)
            .maybeSingle();
          instanceCache[conv.instance_id] = inst;
        }

        const instance = instanceCache[conv.instance_id];
        if (!instance) continue;

        const apiUrl = instance.evolution_api_url?.replace(/\/$/, "");
        const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
        const instanceKey = instance.evolution_instance_key;

        if (!apiUrl || !instanceKey) continue;

        const endpoint = `${apiUrl}/chat/fetchProfilePictureUrl/${encodeURIComponent(instanceKey)}`;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json", apikey: apiKey },
          body: JSON.stringify({ number: conv.remote_jid }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          console.warn(`[sync-wa-profile-pictures] API error ${res.status} for ${conv.remote_jid}: ${errText.substring(0, 200)}`);
          failed++;
          continue;
        }

        const data = await res.json();
        console.log(`[sync-wa-profile-pictures] API response for ${conv.remote_jid}: ${JSON.stringify(data).substring(0, 300)}`);
        const picUrl = data?.profilePictureUrl || data?.data?.profilePictureUrl || data?.url || data?.profilePicUrl || data?.picture || null;

        if (picUrl) {
          await supabase
            .from("wa_conversations")
            .update({ profile_picture_url: picUrl })
            .eq("id", conv.id);
          updated++;
          console.log(`[sync-wa-profile-pictures] Updated: ${conv.remote_jid}`);
        } else {
          console.log(`[sync-wa-profile-pictures] No picture found for ${conv.remote_jid}`);
          failed++;
        }

        // Small delay to avoid rate limiting the Evolution API
        await new Promise((r) => setTimeout(r, 300));
      } catch (err) {
        console.warn(`[sync-wa-profile-pictures] Error for ${conv.remote_jid}:`, err);
        failed++;
      }
    }

    console.log(`[sync-wa-profile-pictures] Done: ${updated} updated, ${failed} failed`);

    return new Response(
      JSON.stringify({ updated, failed, total: conversations.length }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[sync-wa-profile-pictures] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
