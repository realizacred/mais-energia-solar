import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { slug } = await req.json();
    if (!slug || typeof slug !== "string") {
      return new Response(JSON.stringify({ error: "slug é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1) Resolve consultant via secure RPC
    const { data: consultor, error: cErr } = await supabase
      .rpc("resolve_consultor_public", { _codigo: slug })
      .maybeSingle();

    if (cErr || !consultor) {
      return new Response(JSON.stringify({ error: "Consultor não encontrado" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2) Find instance via wa_instance_consultores (M:N)
    const { data: links } = await supabase
      .from("wa_instance_consultores")
      .select("instance_id")
      .eq("consultor_id", consultor.id);

    let instanceId: string | null = null;
    let phoneNumber: string | null = null;

    if (links && links.length > 0) {
      // Prefer instance that already has phone_number cached
      const instanceIds = links.map((l: any) => l.instance_id);
      const { data: instances } = await supabase
        .from("wa_instances")
        .select("id, phone_number, evolution_api_url, evolution_instance_key, api_key, status")
        .in("id", instanceIds)
        .in("status", ["active", "connected"])
        .limit(5);

      if (instances && instances.length > 0) {
        // Try one with phone already cached
        const withPhone = instances.find((i: any) => i.phone_number);
        if (withPhone) {
          instanceId = withPhone.id;
          phoneNumber = withPhone.phone_number;
        } else {
          // Fetch from Evolution API for first active instance
          const inst = instances[0];
          instanceId = inst.id;
          phoneNumber = await fetchAndCachePhone(supabase, inst);
        }
      }
    }

    // 3) Fallback: any active instance for the tenant
    if (!phoneNumber) {
      const { data: fallbackInst } = await supabase
        .from("wa_instances")
        .select("id, phone_number, evolution_api_url, evolution_instance_key, api_key, status")
        .eq("tenant_id", consultor.tenant_id)
        .in("status", ["active", "connected"])
        .limit(1)
        .maybeSingle();

      if (fallbackInst) {
        instanceId = fallbackInst.id;
        phoneNumber = fallbackInst.phone_number || await fetchAndCachePhone(supabase, fallbackInst);
      }
    }

    if (!phoneNumber) {
      return new Response(JSON.stringify({ error: "Nenhuma instância WhatsApp ativa encontrada" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      consultor_nome: consultor.nome,
      slug: consultor.slug || consultor.codigo,
      phone_number: phoneNumber,
      tenant_id: consultor.tenant_id,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[resolve-wa-channel] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function fetchAndCachePhone(supabase: any, instance: any): Promise<string | null> {
  try {
    const apiUrl = instance.evolution_api_url?.replace(/\/$/, "");
    const apiKey = instance.api_key || Deno.env.get("EVOLUTION_API_KEY") || "";
    const instanceKey = instance.evolution_instance_key;

    if (!apiUrl || !instanceKey) return null;

    const listResp = await fetch(`${apiUrl}/instance/fetchInstances`, {
      headers: { apikey: apiKey },
    });

    if (!listResp.ok) {
      console.warn("[resolve-wa-channel] Evolution API error:", listResp.status);
      return null;
    }

    const instances = await listResp.json();
    
    // Try multiple known Evolution API response formats
    const match = Array.isArray(instances)
      ? instances.find((i: any) => {
          const name = i.instance?.instanceName || i.instanceName || i.name || i.id;
          return name === instanceKey;
        })
      : null;

    if (!match) {
      console.warn(`[resolve-wa-channel] No match for instanceKey="${instanceKey}"`);
      return null;
    }

    // Try multiple known paths for the owner/number (Evolution API v1 vs v2)
    const ownerJid = match?.instance?.owner || match?.owner || match?.ownerJid;
    const number = match?.instance?.number || match?.number;
    
    const rawPhone = ownerJid || number;
    if (!rawPhone) {
      console.warn("[resolve-wa-channel] No owner/number found. Match keys:", Object.keys(match));
      return null;
    }

    const phone = String(rawPhone).replace("@s.whatsapp.net", "").replace(/\D/g, "");
    if (!phone) return null;

    // Cache in DB
    await supabase
      .from("wa_instances")
      .update({ phone_number: phone })
      .eq("id", instance.id);

    console.log(`[resolve-wa-channel] Cached phone ${phone} for instance ${instance.id}`);
    return phone;
  } catch (e) {
    console.error("[resolve-wa-channel] fetchAndCachePhone error:", e);
    return null;
  }
}
