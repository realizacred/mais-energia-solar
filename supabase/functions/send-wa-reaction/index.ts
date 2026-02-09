import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const EVOLUTION_API_KEY = Deno.env.get("EVOLUTION_API_KEY");
    if (!EVOLUTION_API_KEY) {
      return new Response(JSON.stringify({ error: "EVOLUTION_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Verify auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const userClient = createClient(Deno.env.get("SUPABASE_URL")!, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userError } = await userClient.auth.getUser(token);
    if (userError || !userData?.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { message_id, reaction } = await req.json();

    if (!message_id || typeof reaction !== "string") {
      return new Response(JSON.stringify({ error: "message_id and reaction are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get message with conversation and instance data
    const { data: message, error: msgError } = await supabase
      .from("wa_messages")
      .select("*, wa_conversations!inner(instance_id, remote_jid, wa_instances!inner(evolution_instance_key, evolution_api_url, api_key, status))")
      .eq("id", message_id)
      .single();

    if (msgError || !message) {
      return new Response(JSON.stringify({ error: "Message not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const conv = message.wa_conversations;
    const instance = conv.wa_instances;

    if (instance.status !== "connected") {
      return new Response(JSON.stringify({ error: "Instance not connected" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!message.evolution_message_id) {
      return new Response(JSON.stringify({ error: "Message has no evolution_message_id, cannot react" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const baseUrl = instance.evolution_api_url.replace(/\/$/, "");
    const effectiveApiKey = instance.api_key || EVOLUTION_API_KEY;
    const instanceKey = instance.evolution_instance_key;

    // Send reaction via Evolution API
    const reactionBody = {
      key: {
        remoteJid: conv.remote_jid,
        fromMe: message.direction === "out",
        id: message.evolution_message_id,
      },
      reaction: reaction, // emoji or "" to remove
    };

    console.log(`[send-wa-reaction] Sending reaction "${reaction}" to message ${message.evolution_message_id}`);

    const response = await fetch(`${baseUrl}/message/sendReaction/${instanceKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: effectiveApiKey,
      },
      body: JSON.stringify(reactionBody),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      console.error(`[send-wa-reaction] Evolution API error: ${errorBody}`);
      return new Response(JSON.stringify({ error: `Evolution API error: ${errorBody}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await response.json();
    console.log(`[send-wa-reaction] Reaction sent successfully`);

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    console.error("[send-wa-reaction] Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
