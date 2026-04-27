/**
 * list-evolution-instances
 * Consulta o servidor Evolution (Classic ou GO) e retorna a lista de instâncias
 * existentes para que o usuário possa vincular uma já criada sem digitar o nome.
 *
 * Body: { api_url: string, api_key: string, api_flavor?: "classic" | "go" }
 * Resp: { success: true, instances: Array<{ name, status, phone_number?, profile_name? }> }
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization") || req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return json(401, { success: false, error: "Não autorizado" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: userData } = await supabase.auth.getUser(token);
    if (!userData?.user) return json(401, { success: false, error: "Sessão inválida" });

    const { data: roleData } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .in("role", ["admin", "gerente"])
      .limit(1)
      .maybeSingle();
    if (!roleData) return json(403, { success: false, error: "Acesso negado" });

    const body = await req.json().catch(() => ({}));
    const apiUrl = String(body?.api_url || "").trim().replace(/\/+$/, "");
    const apiKeyInput = String(body?.api_key || "").trim();
    const apiFlavor = body?.api_flavor === "go" ? "go" : "classic";

    if (!apiUrl) return json(400, { success: false, error: "api_url é obrigatório" });

    const apiKey = apiKeyInput || Deno.env.get("EVOLUTION_API_KEY") || "";
    if (!apiKey) return json(400, { success: false, error: "api_key não fornecida e EVOLUTION_API_KEY não configurada no servidor" });

    const fetchUrl = `${apiUrl}/instance/fetchInstances`;
    const resp = await fetch(fetchUrl, {
      method: "GET",
      headers: { apikey: apiKey, "Content-Type": "application/json" },
    });
    const text = await resp.text();
    if (!resp.ok) {
      return json(400, { success: false, error: `Servidor Evolution retornou ${resp.status}: ${text.slice(0, 200)}` });
    }

    let raw: any;
    try { raw = JSON.parse(text); } catch { return json(502, { success: false, error: "Resposta inválida do servidor Evolution" }); }
    const arr: any[] = Array.isArray(raw) ? raw : (Array.isArray(raw?.instances) ? raw.instances : []);

    // Normaliza diferentes formatos retornados (Classic vs GO)
    const instances = arr.map((it: any) => {
      const inst = it?.instance || it;
      const name = inst?.instanceName || inst?.name || it?.name || it?.instanceName || "";
      const state = inst?.state || inst?.status || it?.connectionStatus || it?.status || "unknown";
      const status =
        state === "open" || state === "connected" ? "connected" :
        state === "close" || state === "disconnected" ? "disconnected" :
        state === "connecting" ? "connecting" : String(state || "unknown");
      const phone = inst?.owner || inst?.wid || inst?.number || it?.ownerJid || it?.number || null;
      const profile = inst?.profileName || inst?.pushName || it?.profileName || null;
      return { name, status, phone_number: phone ? String(phone).split("@")[0] : null, profile_name: profile };
    }).filter((i: any) => i.name);

    // Marca quais já estão vinculadas no tenant atual
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userData.user.id)
      .maybeSingle();
    let alreadyLinked: string[] = [];
    if (profile?.tenant_id) {
      const { data: existing } = await supabase
        .from("wa_instances")
        .select("evolution_instance_key")
        .eq("tenant_id", profile.tenant_id)
        .eq("evolution_api_url", apiUrl);
      alreadyLinked = (existing || []).map((r: any) => r.evolution_instance_key);
    }

    const enriched = instances.map((i) => ({ ...i, already_linked: alreadyLinked.includes(i.name) }));

    return json(200, { success: true, api_flavor: apiFlavor, instances: enriched });
  } catch (e: any) {
    console.error("[list-evolution-instances] error:", e);
    return json(500, { success: false, error: e?.message || String(e) });
  }
});
