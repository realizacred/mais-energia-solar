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

/**
 * AUTH MODEL: "internal / service_role" — NOT a public webhook.
 * Called by other edge functions or cron jobs with service_role key.
 * No JWT validation (no end-user calls this directly).
 *
 * TENANT RESOLUTION (deterministic, multi-tenant safe):
 * 1. body.tenant_id (explicit — preferred for multi-tenant)
 * 2. lead.tenant_id (if lead_id provided)
 * 3. cliente.tenant_id (if cliente_id provided)
 * 4. servico.tenant_id (if servico_id provided)
 * 5. wa_config — ONLY if exactly 1 record exists (single-tenant compat)
 *    In multi-tenant (>1 config): FAIL with clear error
 */
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

    const body = await req.json().catch(() => ({}));
    const { tipo, lead_id, lead_data, status_anterior, status_novo, servico_id, cliente_id } = body;

    console.log("[process-wa-auto] Processing:", { tipo, lead_id, status_novo });

    // ── TENANT RESOLUTION (deterministic, multi-tenant safe) ──
    let tenantId: string | null = body.tenant_id || null;
    let tenantSource = tenantId ? "body" : "";

    // Validate explicit tenant_id if provided — HARD FAIL if invalid (no fallback)
    if (tenantId) {
      const { data: tenantRow } = await supabaseAdmin
        .from("tenants")
        .select("id")
        .eq("id", tenantId)
        .eq("ativo", true)
        .maybeSingle();
      if (!tenantRow) {
        console.error(`[process-wa-auto] BLOCKED: body.tenant_id=${tenantId} not found or inactive — no fallback`);
        return new Response(
          JSON.stringify({ success: false, error: "Tenant inválido ou inativo" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Strategy 2: From lead
    if (!tenantId && lead_id) {
      const { data: leadRow } = await supabaseAdmin
        .from("leads")
        .select("tenant_id")
        .eq("id", lead_id)
        .maybeSingle();
      if (leadRow?.tenant_id) {
        tenantId = leadRow.tenant_id;
        tenantSource = "lead";
      }
    }

    // Strategy 3: From cliente
    if (!tenantId && cliente_id) {
      const { data: clienteRow } = await supabaseAdmin
        .from("clientes")
        .select("tenant_id")
        .eq("id", cliente_id)
        .maybeSingle();
      if (clienteRow?.tenant_id) {
        tenantId = clienteRow.tenant_id;
        tenantSource = "cliente";
      }
    }

    // Strategy 4: From servico
    if (!tenantId && servico_id) {
      const { data: servicoRow } = await supabaseAdmin
        .from("servicos_agendados")
        .select("tenant_id")
        .eq("id", servico_id)
        .maybeSingle();
      if (servicoRow?.tenant_id) {
        tenantId = servicoRow.tenant_id;
        tenantSource = "servico";
      }
    }

    // Strategy 5: wa_config — ONLY if exactly 1 record (single-tenant compat)
    if (!tenantId) {
      const { data: allConfigs } = await supabaseAdmin
        .from("whatsapp_automation_config")
        .select("tenant_id")
        .limit(2); // fetch max 2 to detect multi-tenant

      if (allConfigs && allConfigs.length === 1 && allConfigs[0].tenant_id) {
        tenantId = allConfigs[0].tenant_id;
        tenantSource = "wa_config_single";
        console.log(`[process-wa-auto] Single-tenant fallback: ${tenantId}`);
      } else if (allConfigs && allConfigs.length > 1) {
        console.error("[process-wa-auto] BLOCKED: Multiple wa_configs found — tenant_id obrigatório no body");
        return new Response(
          JSON.stringify({ success: false, error: "Multi-tenant: tenant_id obrigatório no body da requisição" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!tenantId) {
      console.error("[process-wa-auto] BLOCKED: tenant não resolvido de nenhuma fonte");

      // Log error for audit
      await supabaseAdmin.from("whatsapp_automation_logs").insert({
        template_id: null,
        lead_id: lead_id || null,
        cliente_id: cliente_id || null,
        servico_id: servico_id || null,
        telefone: "N/A",
        mensagem_enviada: "",
        status: "erro",
        erro_detalhes: "Tenant não resolvido — automação bloqueada (nenhuma fonte determinística)",
        tenant_id: null,
      }).then(({ error }) => {
        if (error) console.error("[process-wa-auto] Audit log insert failed:", error);
      });

      return new Response(
        JSON.stringify({ success: false, error: "Tenant não resolvido. Automação bloqueada." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[process-wa-auto] tenant=${tenantId} via ${tenantSource}`);

    // ── FETCH CONFIG (scoped by resolved tenant) ──────────────
    const { data: config } = await supabaseAdmin
      .from("whatsapp_automation_config")
      .select("automacoes_ativas, ativo, modo_envio")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!config?.automacoes_ativas || !config?.ativo) {
      console.log("[process-wa-auto] Automações desativadas para tenant:", tenantId);
      return new Response(
        JSON.stringify({ success: false, message: "Automações desativadas" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── FETCH TEMPLATES (scoped by tenant) ─────────────────────
    const { data: templates, error: templatesError } = await supabaseAdmin
      .from("whatsapp_automation_templates")
      .select("*, tenant_id")
      .eq("tipo", tipo)
      .eq("ativo", true)
      .eq("tenant_id", tenantId)
      .order("ordem");

    if (templatesError || !templates?.length) {
      console.log("[process-wa-auto] Nenhum template ativo para:", tipo, "tenant:", tenantId);
      return new Response(
        JSON.stringify({ success: false, message: "Nenhum template ativo" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── FETCH RELATED DATA ─────────────────────────────────────
    let lead: Lead | null = lead_data || null;
    if (lead_id && !lead) {
      const { data: leadData } = await supabaseAdmin
        .from("leads")
        .select("*")
        .eq("id", lead_id)
        .single();
      lead = leadData;
    }

    let cliente = null;
    if (cliente_id) {
      const { data: clienteData } = await supabaseAdmin
        .from("clientes")
        .select("*")
        .eq("id", cliente_id)
        .single();
      cliente = clienteData;
    }

    let servico = null;
    if (servico_id) {
      const { data: servicoData } = await supabaseAdmin
        .from("servicos_agendados")
        .select("*, clientes(nome, telefone)")
        .eq("id", servico_id)
        .single();
      servico = servicoData;
    }

    // ── PROCESS TEMPLATES ──────────────────────────────────────
    const results: Array<{ template: string; success: boolean; error?: string }> = [];

    for (const template of templates as AutomationTemplate[]) {
      try {
        const shouldSend = checkTriggerConditions(template, {
          tipo,
          lead,
          cliente,
          servico,
          status_anterior,
          status_novo,
        });

        if (!shouldSend) {
          console.log(`[process-wa-auto] Template ${template.nome} — condições não atendidas`);
          continue;
        }

        const recipient = lead || cliente || servico?.clientes;
        if (!recipient?.telefone) {
          console.log("[process-wa-auto] Sem telefone para enviar");
          continue;
        }

        const mensagem = substituirVariaveis(template.mensagem, {
          nome: recipient.nome,
          cidade: lead?.cidade || cliente?.cidade || "",
          estado: lead?.estado || cliente?.estado || "",
          consumo: lead?.media_consumo?.toString() || "",
          vendedor: lead?.vendedor || "",
        });

        // Send via send-whatsapp-message — PROPAGATE tenant_id explicitly
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
            tenant_id: tenantId, // ← EXPLICIT propagation
          }),
        });

        const sendResult = await sendResponse.json();

        // Log with explicit tenant_id
        await supabaseAdmin.from("whatsapp_automation_logs").insert({
          template_id: template.id,
          lead_id: lead?.id || null,
          cliente_id: cliente?.id || null,
          servico_id: servico_id || null,
          telefone: recipient.telefone,
          mensagem_enviada: mensagem,
          status: sendResult.success ? "enviado" : "erro",
          erro_detalhes: sendResult.error || null,
          tenant_id: tenantId,
        });

        results.push({
          template: template.nome,
          success: sendResult.success,
          error: sendResult.error,
        });

        console.log(`[process-wa-auto] Template ${template.nome}: ${sendResult.success}`);
      } catch (err: any) {
        console.error(`[process-wa-auto] Erro template ${template.nome}:`, err);

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
          if (error) console.error("[process-wa-auto] Log insert failed:", error);
        });

        results.push({
          template: template.nome,
          success: false,
          error: err.message,
        });
      }
    }

    console.log(`[process-wa-auto] Done tenant=${tenantId} src=${tenantSource}: ${results.length} templates`);

    return new Response(
      JSON.stringify({ success: true, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[process-wa-auto] Unhandled error:", error);
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
