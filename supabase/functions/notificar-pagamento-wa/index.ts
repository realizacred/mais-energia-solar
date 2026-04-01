import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { corsHeaders } from "https://deno.land/x/cors@v1.2.2/mod.ts";

const _corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: _corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } }
    );

    const { pagamento_id, tipo } = await req.json();

    if (!pagamento_id || !tipo) {
      return new Response(
        JSON.stringify({ error: "pagamento_id e tipo são obrigatórios" }),
        { status: 400, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Buscar pagamento + recebimento + cliente
    const { data: pagamento, error: pagErr } = await supabase
      .from("pagamentos")
      .select("id, valor_pago, forma_pagamento, recebimento_id")
      .eq("id", pagamento_id)
      .single();

    if (pagErr || !pagamento) {
      return new Response(
        JSON.stringify({ error: "Pagamento não encontrado", details: pagErr?.message }),
        { status: 404, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: recebimento, error: recErr } = await supabase
      .from("recebimentos")
      .select("id, descricao, valor_total, total_pago, cliente_id, tenant_id")
      .eq("id", pagamento.recebimento_id)
      .single();

    if (recErr || !recebimento) {
      return new Response(
        JSON.stringify({ error: "Recebimento não encontrado" }),
        { status: 404, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = recebimento.tenant_id;

    // 2. Buscar nome do cliente (opcional)
    let nomeCliente = "Avulso";
    if (recebimento.cliente_id) {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", recebimento.cliente_id)
        .single();
      if (cliente?.nome) nomeCliente = cliente.nome;
    }

    // 3. Buscar configuração de notificação do tenant
    const { data: premises } = await supabase
      .from("tenant_premises")
      .select("wa_notif_pagamento, wa_notif_quitado, wa_notif_numero")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // Verificar se notificação está habilitada para este tipo
    if (tipo === "pagamento_recebido" && premises?.wa_notif_pagamento === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "notificação de pagamento desabilitada" }),
        { status: 200, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (tipo === "quitado" && premises?.wa_notif_quitado === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "notificação de quitação desabilitada" }),
        { status: 200, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 4. Determinar número de destino (admin)
    let targetPhone = premises?.wa_notif_numero;

    // Fallback: buscar número da primeira instância WA do tenant
    if (!targetPhone) {
      const { data: instance } = await supabase
        .from("wa_instances")
        .select("phone_number")
        .eq("tenant_id", tenantId)
        .eq("status", "connected")
        .limit(1)
        .maybeSingle();
      targetPhone = instance?.phone_number;
    }

    if (!targetPhone) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "nenhum número configurado para notificação" }),
        { status: 200, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 5. Buscar instância WA para envio
    const { data: waInstance } = await supabase
      .from("wa_instances")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!waInstance) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "nenhuma instância WA conectada" }),
        { status: 200, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 6. Formatar valor
    const fmtBRL = (v: number) =>
      v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const saldo = (recebimento.valor_total || 0) - (recebimento.total_pago || 0);

    // 7. Montar mensagem
    let mensagem: string;
    if (tipo === "quitado") {
      mensagem = [
        "✅ *Recebimento Quitado!*",
        `Cliente: ${nomeCliente}`,
        `Total recebido: ${fmtBRL(recebimento.valor_total || 0)}`,
        `_${recebimento.descricao || "Sem descrição"}_`,
        "Parabéns pela venda! 🎉",
      ].join("\n");
    } else {
      mensagem = [
        "💰 *Pagamento Recebido*",
        `Cliente: ${nomeCliente}`,
        `Valor: ${fmtBRL(pagamento.valor_pago || 0)}`,
        `Forma: ${pagamento.forma_pagamento || "N/I"}`,
        `Saldo restante: ${fmtBRL(Math.max(saldo, 0))}`,
        `_${recebimento.descricao || "Sem descrição"}_`,
      ].join("\n");
    }

    // 8. Enfileirar via RPC
    const cleanPhone = targetPhone.replace(/\D/g, "");
    const remoteJid = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
    const idempKey = `pagamento_notif:${pagamento_id}:${tipo}:${new Date().toISOString().slice(0, 10)}`;

    // Use service role for the enqueue operation
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error: enqueueErr } = await adminClient.rpc("enqueue_wa_outbox_item", {
      p_tenant_id: tenantId,
      p_instance_id: waInstance.id,
      p_remote_jid: remoteJid,
      p_content: mensagem,
      p_message_type: "text",
      p_idempotency_key: idempKey,
    });

    if (enqueueErr) {
      console.error("[notificar-pagamento-wa] Erro ao enfileirar:", enqueueErr.message);
      return new Response(
        JSON.stringify({ error: "Falha ao enfileirar mensagem" }),
        { status: 500, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, tipo, destino: cleanPhone }),
      { status: 200, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[notificar-pagamento-wa] Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ..._corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
