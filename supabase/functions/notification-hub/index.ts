import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sanitizeError } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface NotificationHubRequest {
  evento: string;
  tenant_id: string;
  dados: Record<string, any>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const body = (await req.json()) as NotificationHubRequest;
    const { evento, tenant_id, dados } = body;

    if (!evento || !tenant_id) {
      return jsonError("evento e tenant_id são obrigatórios", 400);
    }

    console.log(`[notification-hub] Evento: ${evento}, Tenant: ${tenant_id}`);

    // 1. Buscar regras ativas para o evento e tenant
    const { data: rules, error: rulesErr } = await supabase
      .from("notification_rules")
      .select("*")
      .eq("tenant_id", tenant_id)
      .eq("evento", evento)
      .eq("ativo", true);

    if (rulesErr) {
      console.error("[notification-hub] Erro ao buscar regras:", rulesErr);
      return jsonError("Erro ao buscar regras de notificação", 500);
    }

    if (!rules || rules.length === 0) {
      console.log(`[notification-hub] Nenhuma regra ativa para ${evento}`);
      return jsonOk({ disparado: 0, canais: [] });
    }

    const disparos = [];

    // 2. Processar cada regra
    for (const rule of rules) {
      try {
        const result = await processRule(supabase, rule, dados);
        if (result) {
          disparos.push({ rule_id: rule.id, canal: rule.canal, success: true });
        }
      } catch (err) {
        console.error(`[notification-hub] Falha na regra ${rule.id}:`, err);
        disparos.push({ rule_id: rule.id, canal: rule.canal, success: false, error: sanitizeError(err) });
      }
    }

    return jsonOk({ 
      disparado: disparos.filter(d => d.success).length, 
      canais: [...new Set(disparos.map(d => d.canal))] 
    });

  } catch (err) {
    console.error("[notification-hub] Erro inesperado:", err);
    return jsonError(sanitizeError(err), 500);
  }
});

async function processRule(supabase: any, rule: any, dados: any) {
  const { tenant_id, destinatario, canal, template_mensagem } = rule;

  // A. Resolver destinatário (email/telefone)
  const contactInfo = await resolveContact(supabase, tenant_id, destinatario, dados);
  if (!contactInfo) {
    console.warn(`[notification-hub] Destinatário ${destinatario} não resolvido para dados:`, dados);
    return false;
  }

  // B. Renderizar template
  const mensagem = renderTemplate(template_mensagem || "", dados);

  // C. Enfileirar no canal correto
  switch (canal) {
    case "whatsapp":
      return await enqueueWhatsApp(supabase, tenant_id, contactInfo.telefone, mensagem, dados);
    case "email":
      return await enqueueEmail(supabase, tenant_id, contactInfo.email, mensagem, dados);
    case "inapp":
      return await enqueueInApp(supabase, tenant_id, contactInfo.user_id, mensagem, dados);
    default:
      console.warn(`[notification-hub] Canal não suportado: ${canal}`);
      return false;
  }
}

async function resolveContact(supabase: any, tenantId: string, destinatario: string, dados: any) {
  switch (destinatario) {
    case "cliente":
      if (dados.cliente_id) {
        const { data: c } = await supabase.from("clientes").select("email, telefone").eq("id", dados.cliente_id).single();
        return c;
      }
      break;
    case "consultor":
      const consultorId = dados.consultor_id || dados.vendedor_id;
      if (consultorId) {
        const { data: v } = await supabase.from("profiles").select("email, telefone, user_id").eq("id", consultorId).single();
        return v;
      }
      break;
    case "gerente":
    case "admin":
      // Buscar o admin/gerente do tenant
      const { data: admins } = await supabase
        .from("profiles")
        .select("email, telefone, user_id")
        .eq("tenant_id", tenantId)
        .eq("role", destinatario)
        .eq("ativo", true)
        .limit(1);
      return admins?.[0];
  }
  return null;
}

function renderTemplate(template: string, dados: any) {
  let rendered = template;
  for (const [key, value] of Object.entries(dados)) {
    const regex = new RegExp(`{{${key}}}`, "g");
    rendered = rendered.replace(regex, String(value));
  }
  return rendered;
}

async function enqueueWhatsApp(supabase: any, tenantId: string, telefone: string, mensagem: string, dados: any) {
  if (!telefone) return false;
  
  // Buscar instância WA conectada
  const { data: instance } = await supabase
    .from("wa_instances")
    .select("id")
    .eq("tenant_id", tenantId)
    .eq("status", "connected")
    .limit(1)
    .maybeSingle();

  if (!instance) return false;

  const cleanPhone = telefone.replace(/\D/g, "");
  const remoteJid = `${cleanPhone}@s.whatsapp.net`;
  const idempKey = `notif_hub_wa:${tenantId}:${Date.now()}`;

  const { error } = await supabase.rpc("enqueue_wa_outbox_item", {
    p_tenant_id: tenantId,
    p_instance_id: instance.id,
    p_remote_jid: remoteJid,
    p_content: mensagem,
    p_message_type: "text",
    p_idempotency_key: idempKey,
  });

  return !error;
}

async function enqueueEmail(supabase: any, tenantId: string, email: string, mensagem: string, dados: any) {
  if (!email) return false;
  
  // Como não há email_queue, enviamos via email_accounts se houver, ou apenas logamos
  // Por enquanto, apenas logamos que o disparo foi enfileirado (simulado)
  console.log(`[notification-hub] Email enfileirado para ${email}: ${mensagem.slice(0, 50)}...`);
  
  // Se houver uma tabela email_outbox futura, inserir aqui.
  return true; 
}

async function enqueueInApp(supabase: any, tenantId: string, userId: string, mensagem: string, dados: any) {
  if (!userId) return false;

  const { error } = await supabase.from("user_notifications").insert({
    user_id: userId,
    tenant_id: tenantId,
    title: "Notificação do Sistema",
    message: mensagem,
    metadata: dados,
  });

  return !error;
}

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
