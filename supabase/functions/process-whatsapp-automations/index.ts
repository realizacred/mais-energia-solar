import { createClient } from "npm:@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface AutomationTemplate {
  id: string;
  nome: string;
  tipo: string;
  gatilho_config: Record<string, any>;
  mensagem: string;
  ativo: boolean;
  tenant_id: string | null;
}

interface Lead {
  id: string;
  nome: string;
  telefone: string;
  cidade?: string;
  estado?: string;
  media_consumo?: number;
  vendedor?: string;
  ultimo_contato?: string;
  created_at: string;
  tenant_id?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ===== STAGING GUARD =====
    const isStaging = Deno.env.get("IS_STAGING") === "true";
    if (isStaging) {
      console.warn("[STAGING] Automações WhatsApp BLOCKED — ambiente de staging");
      return new Response(JSON.stringify({
        success: true,
        staging: true,
        message: "[STAGING] Automações NÃO processadas — ambiente de staging",
        results: [],
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Parse request body
    const body = await req.json().catch(() => ({}));
    const { tipo, lead_id, lead_data, status_anterior, status_novo, servico_id, cliente_id } = body;

    console.log("[process-wa-auto] Processing automation:", { tipo, lead_id, status_novo });

    // ── TENANT RESOLUTION (multi-source) ──────────────────────
    let tenantId: string | null = null;

    // Strategy 1: From whatsapp_automation_config
    const { data: config } = await supabaseAdmin
      .from("whatsapp_automation_config")
      .select("automacoes_ativas, ativo, modo_envio, tenant_id")
      .maybeSingle();

    if (config?.tenant_id) {
      tenantId = config.tenant_id;
      console.log(`[process-wa-auto] tenant from wa_config: ${tenantId}`);
    }

    // Strategy 2: From lead (if provided)
    if (!tenantId && lead_id) {
      const { data: leadRow } = await supabaseAdmin
        .from("leads")
        .select("tenant_id")
        .eq("id", lead_id)
        .maybeSingle();
      tenantId = leadRow?.tenant_id || null;
      if (tenantId) console.log(`[process-wa-auto] tenant from lead: ${tenantId}`);
    }

    // Strategy 3: From cliente (if provided)
    if (!tenantId && cliente_id) {
      const { data: clienteRow } = await supabaseAdmin
        .from("clientes")
        .select("tenant_id")
        .eq("id", cliente_id)
        .maybeSingle();
      tenantId = clienteRow?.tenant_id || null;
      if (tenantId) console.log(`[process-wa-auto] tenant from cliente: ${tenantId}`);
    }

    // Strategy 4: From servico agendado (if provided)
    if (!tenantId && servico_id) {
      const { data: servicoRow } = await supabaseAdmin
        .from("servicos_agendados")
        .select("tenant_id")
        .eq("id", servico_id)
        .maybeSingle();
      tenantId = servicoRow?.tenant_id || null;
      if (tenantId) console.log(`[process-wa-auto] tenant from servico: ${tenantId}`);
    }

    if (!tenantId) {
      console.error("[process-wa-auto] CRITICAL: Could not resolve tenant_id from any source");
      // Log the failure for audit
      await supabaseAdmin.from("whatsapp_automation_logs").insert({
        template_id: null,
        lead_id: lead_id || null,
        cliente_id: cliente_id || null,
        servico_id: servico_id || null,
        telefone: "N/A",
        mensagem_enviada: "",
        status: "erro",
        erro_detalhes: "Tenant não resolvido — automação bloqueada",
        tenant_id: null, // intentionally null — this is an error record
      }).then(({ error }) => {
        if (error) console.error("[process-wa-auto] Failed to log tenant resolution error:", error);
      });

      return new Response(
        JSON.stringify({ success: false, error: "Tenant não resolvido. Automação bloqueada." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se automações estão ativas
    if (!config?.automacoes_ativas || !config?.ativo) {
      console.log("[process-wa-auto] Automações desativadas");
      return new Response(
        JSON.stringify({ success: false, message: "Automações desativadas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar templates ativos do tipo especificado — scoped to tenant
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from("whatsapp_automation_templates")
      .select("*, tenant_id")
      .eq("tipo", tipo)
      .eq("ativo", true)
      .eq("tenant_id", tenantId)
      .order("ordem");

    if (templatesError || !templates?.length) {
      console.log("[process-wa-auto] Nenhum template ativo encontrado para:", tipo);
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum template ativo" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar dados do lead se necessário
    let lead: Lead | null = lead_data || null;
    if (lead_id && !lead) {
      const { data: leadData } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("id", lead_id)
        .single();
      lead = leadData;
    }

    // Buscar dados do cliente se necessário
    let cliente = null;
    if (cliente_id) {
      const { data: clienteData } = await supabaseAdmin
        .from("clientes")
        .select("*")
        .eq("id", cliente_id)
        .single();
      cliente = clienteData;
    }

    // Buscar dados do serviço agendado se necessário
    let servico = null;
    if (servico_id) {
      const { data: servicoData } = await supabaseAdmin
        .from("servicos_agendados")
        .select("*, clientes(nome, telefone)")
        .eq("id", servico_id)
        .single();
      servico = servicoData;
    }

    const results: Array<{ template: string; success: boolean; error?: string }> = [];

    for (const template of templates as AutomationTemplate[]) {
      try {
        // Verificar condições do gatilho
        const shouldSend = checkTriggerConditions(template, {
          tipo,
          lead,
          cliente,
          servico,
          status_anterior,
          status_novo,
        });

        if (!shouldSend) {
          console.log(`[process-wa-auto] Template ${template.nome} não atende condições`);
          continue;
        }

        // Determinar destinatário e mensagem
        const recipient = lead || cliente || servico?.clientes;
        if (!recipient?.telefone) {
          console.log("[process-wa-auto] Sem telefone para enviar");
          continue;
        }

        // Substituir variáveis na mensagem
        const mensagem = substituirVariaveis(template.mensagem, {
          nome: recipient.nome,
          cidade: lead?.cidade || cliente?.cidade || "",
          estado: lead?.estado || cliente?.estado || "",
          consumo: lead?.media_consumo?.toString() || "",
          vendedor: lead?.vendedor || "",
        });

        // Enviar mensagem via edge function — pass tenant_id explicitly
        const sendUrl = `${Deno.env.get("SUPABASE_URL")}/functions/v1/send-whatsapp-message`;
        const sendResponse = await fetch(sendUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
          },
          body: JSON.stringify({
            telefone: recipient.telefone,
            mensagem,
            lead_id: lead?.id || null,
            tipo: "automatico",
            tenant_id: tenantId, // ← EXPLICIT tenant_id propagated to send-whatsapp-message
          }),
        });

        const sendResult = await sendResponse.json();

        // Registrar log — EXPLICIT tenant_id
        await supabaseAdmin.from("whatsapp_automation_logs").insert({
          template_id: template.id,
          lead_id: lead?.id || null,
          cliente_id: cliente?.id || null,
          servico_id: servico_id || null,
          telefone: recipient.telefone,
          mensagem_enviada: mensagem,
          status: sendResult.success ? "enviado" : "erro",
          erro_detalhes: sendResult.error || null,
          tenant_id: tenantId, // ← EXPLICIT tenant_id
        });

        results.push({
          template: template.nome,
          success: sendResult.success,
          error: sendResult.error,
        });

        console.log(`[process-wa-auto] Template ${template.nome} processado: ${sendResult.success}`);
      } catch (err: any) {
        console.error(`[process-wa-auto] Erro no template ${template.nome}:`, err);

        // Log error with tenant_id
        await supabaseAdmin.from("whatsapp_automation_logs").insert({
          template_id: template.id,
          lead_id: lead?.id || null,
          cliente_id: cliente?.id || null,
          servico_id: servico_id || null,
          telefone: "N/A",
          mensagem_enviada: "",
          status: "erro",
          erro_detalhes: err.message,
          tenant_id: tenantId,
        }).then(({ error }) => {
          if (error) console.error("[process-wa-auto] Failed to log template error:", error);
        });

        results.push({
          template: template.nome,
          success: false,
          error: err.message,
        });
      }
    }

    console.log(`[process-wa-auto] Done for tenant=${tenantId}: ${results.length} templates processed`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[process-wa-auto] Erro processando automações:", error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ── Trigger condition checker ─────────────────────────────

function checkTriggerConditions(
  template: AutomationTemplate,
  context: {
    tipo: string;
    lead: Lead | null;
    cliente: any;
    servico: any;
    status_anterior?: string;
    status_novo?: string;
  }
): boolean {
  const config = template.gatilho_config;

  switch (template.tipo) {
    case "boas_vindas":
      return true;

    case "mudanca_status":
      if (config.status_destino && context.status_novo) {
        return context.status_novo.toLowerCase().includes(config.status_destino.toLowerCase());
      }
      return false;

    case "inatividade":
      if (config.dias_sem_contato && context.lead?.ultimo_contato) {
        const ultimoContato = new Date(context.lead.ultimo_contato);
        const agora = new Date();
        const diasSemContato = Math.floor(
          (agora.getTime() - ultimoContato.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diasSemContato >= config.dias_sem_contato;
      }
      if (config.dias_sem_contato && context.lead?.created_at) {
        const criacao = new Date(context.lead.created_at);
        const agora = new Date();
        const diasDesde = Math.floor(
          (agora.getTime() - criacao.getTime()) / (1000 * 60 * 60 * 24)
        );
        return diasDesde >= config.dias_sem_contato;
      }
      return false;

    case "agendamento":
      if (config.horas_antes && context.servico?.data_agendada) {
        const dataAgendada = new Date(context.servico.data_agendada);
        const agora = new Date();
        const horasAte = (dataAgendada.getTime() - agora.getTime()) / (1000 * 60 * 60);
        return horasAte > 0 && horasAte <= config.horas_antes;
      }
      return false;

    default:
      return true;
  }
}

function substituirVariaveis(mensagem: string, dados: Record<string, string>): string {
  let resultado = mensagem;
  for (const [chave, valor] of Object.entries(dados)) {
    resultado = resultado.replace(new RegExp(`\\{${chave}\\}`, "g"), valor || "");
  }
  return resultado;
}
