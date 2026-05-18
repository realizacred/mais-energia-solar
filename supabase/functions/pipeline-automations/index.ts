import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { sanitizeError } from "../_shared/error-utils.ts";
import { checkFeatureAccess, checkUsageLimit, trackUsage } from "../_shared/entitlement.ts";
import { buildAutomationContext, renderTemplate, resolveVariable } from "./context.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const body = await req.json();
    const { automation_id, trigger_data } = body;

    // Se recebermos automation_id e trigger_data, estamos no novo fluxo baseado em eventos
    if (automation_id && trigger_data) {
      console.log(`[pipeline-automations] Event trigger: auto=${automation_id} projeto=${trigger_data.projeto_id}`);
      
      const { data: auto, error: autoErr } = await supabase
        .from("pipeline_automations")
        .select("*")
        .eq("id", automation_id)
        .single();

      if (autoErr || !auto) throw new Error(`Automation not found: ${automation_id}`);
      if (!auto.ativo) return new Response(JSON.stringify({ skipped: "automation_inactive" }));

      // Entitlement check
      const entitlement = await checkFeatureAccess(supabase, auto.tenant_id, "automacoes");
      if (!entitlement.has_access) return new Response(JSON.stringify({ skipped: "no_entitlement" }));

      const context = await buildAutomationContext(supabase, trigger_data.projeto_id, auto.tenant_id, trigger_data);
      
      const flow = auto.metadata?.flow || { nodes: [] };
      const nodes = flow.nodes || [];

      let executedActions = 0;
      let currentContext = context;

      for (const node of nodes) {
        if (node.type === 'search') {
          const config = node.config;
          const searchResult: any = {};

          try {
            switch (config.searchType) {
              case 'responsavel': {
                const { data: funil } = await supabase
                  .from('projeto_funis')
                  .select('responsavel_id, consultores:responsavel_id(nome, email, telefone)')
                  .eq('id', config.funil_id)
                  .single();
                
                if (funil?.consultores) {
                  searchResult.responsavel = {
                    id: funil.responsavel_id,
                    nome: funil.consultores.nome,
                    email: funil.consultores.email,
                    telefone: funil.consultores.telefone,
                  };
                }
                break;
              }
              case 'projeto': {
                searchResult.projeto = context.projeto;
                break;
              }
              case 'cliente': {
                const { data: proj } = await supabase.from('projetos').select('cliente_id').eq('id', context.projeto_id).single();
                const { data: cliente } = await supabase
                  .from('clientes')
                  .select('*')
                  .eq('id', proj?.cliente_id)
                  .single();
                if (cliente) searchResult.cliente = cliente;
                break;
              }
            }
            currentContext = { ...currentContext, procurar: { ...currentContext.procurar, ...searchResult } };
          } catch (err) {
            console.error(`[pipeline-automations] Search failed for node ${node.id}:`, err);
          }
        }

        if (node.type === 'action') {
          const config = node.config;

          if (config.actionType === 'whatsapp') {
            // 1. Resolver destinatário
            let telefone = "";
            switch (config.wa_destinatario_tipo) {
              case 'cliente':
                telefone = currentContext.cliente.telefone;
                break;
              case 'responsavel':
                telefone = currentContext.responsavel.telefone;
                break;
              case 'fixo':
                telefone = config.wa_destinatario_valor;
                break;
              case 'variavel':
                telefone = resolveVariable(config.wa_destinatario_valor, currentContext);
                break;
            }

            if (!telefone) {
              console.warn(`[pipeline-automations] WA skipped: no phone found for type ${config.wa_destinatario_tipo}`);
              continue;
            }

            // 2. Formatar JID (RB-105: nunca wa.me)
            const numLimpo = telefone.replace(/\D/g, '');
            const remoteJid = `${numLimpo}@s.whatsapp.net`;

            // 3. Interpolar template
            const content = renderTemplate(config.wa_content_template, currentContext);

            // 4. Calcular scheduled_at
            let scheduledAt: string | null = null;
            if (config.wa_schedule_enabled && config.wa_scheduled_valor) {
              const multiplier = config.wa_schedule_tipo === 'dias' ? 24 * 3600000 : 3600000;
              scheduledAt = new Date(Date.now() + config.wa_scheduled_valor * multiplier).toISOString();
            }

            // 5. Enfileirar via RPC (RB-105)
            const { error: waErr } = await supabase.rpc('enqueue_wa_outbox_item', {
              p_tenant_id: auto.tenant_id,
              p_instance_id: config.wa_instance_id,
              p_remote_jid: remoteJid,
              p_message_type: config.wa_message_type || 'text',
              p_content: content,
              p_media_url: config.wa_media_url || null,
              p_media_filename: config.wa_media_filename || null,
              p_scheduled_at: scheduledAt,
              p_idempotency_key: `auto_${auto.id}_${trigger_data.projeto_id}_${node.id}_${Date.now()}`
            });

            if (waErr) {
              console.error(`[pipeline-automations] WA enqueue failed:`, waErr.message);
              continue;
            }
            executedActions++;
          }
          
          // Suporte legado a mover_etapa se configurado no novo flow
          if (config.actionType === 'mover_etapa' && config.destino_etapa_id) {
             const { error: moveErr } = await supabase
              .from('projetos')
              .update({ etapa_id: config.destino_etapa_id })
              .eq('id', trigger_data.projeto_id);
             if (!moveErr) executedActions++;
          }
        }
      }

      if (executedActions > 0) {
        await supabase
          .from("pipeline_automations")
          .update({
            execucoes_total: (auto.execucoes_total || 0) + 1,
            ultima_execucao: new Date().toISOString(),
          } as any)
          .eq("id", auto.id);
        
        await trackUsage(supabase, auto.tenant_id, "automacoes_executadas", executedActions, { source: "pipeline-event" });
      }

      return new Response(JSON.stringify({ success: true, executed: executedActions }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- CÓDIGO LEGADO PARA GATILHOS DE TEMPO (MANTIDO PARA COMPATIBILIDADE) ---
    // Fetch all active automations with tipo_gatilho = 'tempo_parado'
    const { data: automations, error: autoErr } = await supabase
      .from("pipeline_automations")
      .select("id, tenant_id, stage_id, tempo_horas, tipo_acao, destino_stage_id, notificar_responsavel, pipeline_id, execucoes_total")
      .eq("ativo", true)
      .eq("tipo_gatilho", "tempo_parado");

    if (autoErr) throw autoErr;
    if (!automations || automations.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let totalProcessed = 0;
    let totalMoved = 0;
    let totalErrors = 0;

    for (const auto of automations) {
      const entitlement = await checkFeatureAccess(supabase, auto.tenant_id, "automacoes");
      if (!entitlement.has_access) continue;

      const limitCheck = await checkUsageLimit(supabase, auto.tenant_id, "max_automations");
      if (!limitCheck.allowed) continue;

      const cutoffDate = new Date(Date.now() - auto.tempo_horas * 60 * 60 * 1000).toISOString();

      const { data: stalledDeals, error: dealsErr } = await supabase
        .from("deal_kanban_projection")
        .select("deal_id, customer_name, owner_id, last_stage_change")
        .eq("stage_id", auto.stage_id)
        .eq("tenant_id", auto.tenant_id)
        .lt("last_stage_change", cutoffDate)
        .limit(50);

      if (dealsErr) {
        console.error(`[pipeline-automations] Error fetching deals for auto ${auto.id}:`, dealsErr.message);
        totalErrors++;
        continue;
      }

      if (!stalledDeals || stalledDeals.length === 0) continue;

      let autoExecutions = 0;

      for (const deal of stalledDeals) {
        try {
          const { count: recentLogCount } = await supabase
            .from("pipeline_automation_logs")
            .select("id", { count: "exact", head: true })
            .eq("automation_id", auto.id)
            .eq("deal_id", deal.deal_id)
            .eq("status", "sucesso")
            .gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

          if ((recentLogCount ?? 0) > 0) continue;

          if (auto.tipo_acao === "mover_etapa" && auto.destino_stage_id) {
            const { error: moveErr } = await supabase.rpc("move_deal_to_stage", {
              _deal_id: deal.deal_id,
              _to_stage_id: auto.destino_stage_id,
            });

            if (moveErr) {
              await supabase.from("pipeline_automation_logs").insert({
                tenant_id: auto.tenant_id,
                automation_id: auto.id,
                deal_id: deal.deal_id,
                acao_executada: "mover_etapa",
                status: "erro",
                erro_mensagem: moveErr.message,
                detalhes: { from_stage: auto.stage_id, to_stage: auto.destino_stage_id },
              });
              totalErrors++;
              continue;
            }
            totalMoved++;
          }

          await supabase.from("pipeline_automation_logs").insert({
            tenant_id: auto.tenant_id,
            automation_id: auto.id,
            deal_id: deal.deal_id,
            acao_executada: auto.tipo_acao,
            status: "sucesso",
            detalhes: {
              customer_name: deal.customer_name,
              from_stage: auto.stage_id,
              to_stage: auto.destino_stage_id,
              stalled_since: deal.last_stage_change,
            },
          });

          totalProcessed++;
          autoExecutions++;
          await trackUsage(supabase, auto.tenant_id, "automacoes_executadas", 1, { source: "pipeline-automations" });

        } catch (err) {
          totalErrors++;
        }
      }

      if (autoExecutions > 0) {
        await supabase
          .from("pipeline_automations")
          .update({
            execucoes_total: (auto.execucoes_total || 0) + autoExecutions,
            ultima_execucao: new Date().toISOString(),
          } as any)
          .eq("id", auto.id);
      }
    }

    return new Response(
      JSON.stringify({ processed: totalProcessed, moved: totalMoved, errors: totalErrors, elapsed_ms: Date.now() - startMs }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[pipeline-automations] Fatal error:", err.message);
    return new Response(JSON.stringify({ error: sanitizeError(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
