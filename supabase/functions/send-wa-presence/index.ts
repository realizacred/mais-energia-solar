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
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { instance_id, number, presence } = await req.json();

    if (!instance_id || !number || !presence) {
      return new Response(JSON.stringify({ error: "instance_id, number e presence são obrigatórios" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const validPresences = ["composing", "paused", "available"];
    if (!validPresences.includes(presence)) {
      return new Response(JSON.stringify({ error: `presence inválido. Use: ${validPresences.join(", ")}` }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Fetch instance details (incl. api_flavor)
    const { data: instance, error: instErr } = await supabase
      .from("wa_instances")
      .select("evolution_instance_key, evolution_api_url, api_key, status, api_flavor")
      .eq("id", instance_id)
      .single();

    if (instErr || !instance) {
      return new Response(JSON.stringify({ error: "Instância não encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (instance.status !== "connected") {
      return new Response(JSON.stringify({ error: "Instância não está conectada" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key não configurada" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use shared adapter (Classic + GO)
    const { buildContext, sendPresenceRequest } = await import("../_shared/wa-provider.ts");
    const ctx = buildContext({
      api_flavor: (instance as any).api_flavor,
      evolution_api_url: instance.evolution_api_url,
      evolution_instance_key: instance.evolution_instance_key,
      api_key: apiKey,
    });
    const { url, init } = sendPresenceRequest(ctx, { number, presence, delay: 2000 });

    const evoRes = await fetch(url, init);

    if (!evoRes.ok) {
      const errText = await evoRes.text();
      console.warn(`[send-wa-presence] Evolution API error (flavor=${ctx.flavor}): ${evoRes.status} ${errText}`);
      return new Response(JSON.stringify({ error: "Erro ao enviar presença" }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await evoRes.text(); // consume body

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[send-wa-presence] Error:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
