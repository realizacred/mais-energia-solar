/**
 * notificar-agendamento-wa
 * Dispara notificação WA ao cliente quando appointment tipo 'instalacao'
 * é criado ou atualizado (data/hora alterada).
 * 
 * RB-25: fire-and-forget — falha WA não bloqueia o fluxo.
 * RB-26: usa enqueue_wa_outbox_item RPC.
 */
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

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { appointment_id } = await req.json();

    if (!appointment_id) {
      return new Response(
        JSON.stringify({ error: "appointment_id é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Buscar appointment
    const { data: appointment, error: aptErr } = await supabase
      .from("appointments")
      .select("id, tenant_id, appointment_type, starts_at, ends_at, lead_id, cliente_id, assigned_to, notificar_wa, wa_notificado_em")
      .eq("id", appointment_id)
      .single();

    if (aptErr || !appointment) {
      return new Response(
        JSON.stringify({ error: "Appointment não encontrado", details: aptErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Só processar instalação
    if (appointment.appointment_type !== "instalacao") {
      return new Response(
        JSON.stringify({ skipped: true, reason: "tipo não é instalacao" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar toggle
    if (appointment.notificar_wa === false) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "notificação WA desativada pelo usuário" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const tenantId = appointment.tenant_id;

    // 2. Buscar telefone do cliente
    let telefoneCliente: string | null = null;
    let nomeCliente = "Cliente";

    if (appointment.cliente_id) {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("nome, telefone")
        .eq("id", appointment.cliente_id)
        .single();
      if (cliente) {
        nomeCliente = cliente.nome || "Cliente";
        telefoneCliente = cliente.telefone;
      }
    }

    if (!telefoneCliente && appointment.lead_id) {
      const { data: lead } = await supabase
        .from("leads")
        .select("nome, telefone")
        .eq("id", appointment.lead_id)
        .single();
      if (lead) {
        nomeCliente = lead.nome || nomeCliente;
        telefoneCliente = lead.telefone;
      }
    }

    if (!telefoneCliente) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "cliente/lead sem telefone" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Buscar template do tenant
    const { data: premises } = await supabase
      .from("tenant_premises")
      .select("wa_template_agendamento_instalacao")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    const template = premises?.wa_template_agendamento_instalacao
      || "Olá {{nome_cliente}}! Sua instalação solar está agendada para {{data}} às {{hora}}. Qualquer dúvida, fale com {{consultor}}.";

    // 4. Buscar nome do consultor
    let consultorNome = "nosso time";
    if (appointment.assigned_to) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("user_id", appointment.assigned_to)
        .maybeSingle();
      if (profile?.full_name) consultorNome = profile.full_name;
    }

    // 5. Formatar data/hora (Brasília)
    const startsAt = new Date(appointment.starts_at);
    const dataFormatada = startsAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const horaFormatada = startsAt.toLocaleTimeString("pt-BR", {
      timeZone: "America/Sao_Paulo",
      hour: "2-digit",
      minute: "2-digit",
    });

    // 6. Substituir variáveis
    const mensagem = template
      .replace(/\{\{nome_cliente\}\}/g, nomeCliente)
      .replace(/\{\{data\}\}/g, dataFormatada)
      .replace(/\{\{hora\}\}/g, horaFormatada)
      .replace(/\{\{consultor\}\}/g, consultorNome);

    // 7. Buscar instância WA conectada
    const { data: waInstance } = await adminClient
      .from("wa_instances")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!waInstance) {
      return new Response(
        JSON.stringify({ skipped: true, reason: "nenhuma instância WA conectada" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 8. Enfileirar mensagem (RB-26)
    const cleanPhone = telefoneCliente.replace(/\D/g, "");
    const remoteJid = cleanPhone.includes("@") ? cleanPhone : `${cleanPhone}@s.whatsapp.net`;
    const idempKey = `agendamento_instalacao:${appointment_id}:${startsAt.toISOString().slice(0, 16)}`;

    const { error: enqueueErr } = await adminClient.rpc("enqueue_wa_outbox_item", {
      p_tenant_id: tenantId,
      p_instance_id: waInstance.id,
      p_remote_jid: remoteJid,
      p_content: mensagem,
      p_message_type: "text",
      p_idempotency_key: idempKey,
    });

    if (enqueueErr) {
      console.error("[notificar-agendamento-wa] Erro ao enfileirar:", enqueueErr.message);
      return new Response(
        JSON.stringify({ error: "Falha ao enfileirar mensagem" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 9. Registrar timestamp de notificação
    await adminClient
      .from("appointments")
      .update({ wa_notificado_em: new Date().toISOString() })
      .eq("id", appointment_id);

    return new Response(
      JSON.stringify({ success: true, destino: cleanPhone }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[notificar-agendamento-wa] Erro inesperado:", err);
    return new Response(
      JSON.stringify({ error: "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
