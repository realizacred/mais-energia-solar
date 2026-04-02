import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { recebimento_id, telefone, mensagem } = await req.json();

    if (!recebimento_id || !telefone || !mensagem) {
      return new Response(
        JSON.stringify({ error: "recebimento_id, telefone e mensagem são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 1. Buscar tenant_id do recebimento
    const { data: recebimento, error: recErr } = await supabase
      .from("recebimentos")
      .select("id, tenant_id")
      .eq("id", recebimento_id)
      .single();

    if (recErr || !recebimento) {
      return new Response(
        JSON.stringify({ error: "Recebimento não encontrado" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const tenantId = recebimento.tenant_id;

    // 2. Buscar instância WA conectada do tenant
    const { data: waInstance } = await supabase
      .from("wa_instances")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!waInstance) {
      return new Response(
        JSON.stringify({ error: "Nenhuma instância WhatsApp conectada" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 3. Montar remoteJid
    const cleanPhone = telefone.replace(/\D/g, "");
    const remoteJid = `${cleanPhone}@s.whatsapp.net`;

    // 4. Enfileirar via RPC com service role
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const idempKey = `cobranca_manual:${recebimento_id}:${Date.now()}`;

    const { error: enqueueErr } = await adminClient.rpc("enqueue_wa_outbox_item", {
      p_tenant_id: tenantId,
      p_instance_id: waInstance.id,
      p_remote_jid: remoteJid,
      p_message_type: "text",
      p_content: mensagem,
      p_idempotency_key: idempKey,
    });

    if (enqueueErr) {
      console.error("[enviar-cobranca-wa] Erro ao enfileirar:", enqueueErr.message);
      return new Response(
        JSON.stringify({ error: "Falha ao enfileirar mensagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("[enviar-cobranca-wa] Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
