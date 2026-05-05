import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

import { callAi } from "../_shared/aiCallNoLovable.ts";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceKey);

  let tenantId: string | undefined;
  let leadId: string | undefined;

  try {
    const body = await req.json();
    leadId = body.lead_id;
    tenantId = body.tenant_id;
    const userId = body.user_id;

    if (!leadId || !tenantId) {
      return new Response(
        JSON.stringify({ error: "lead_id and tenant_id required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 1. Fetch tenant config
    const { data: config } = await supabase
      .from("intelligence_config")
      .select("*")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (!config?.ia_analise_sentimento_habilitada) {
      return new Response(
        JSON.stringify({ error: "IA desativada para este tenant", useFallback: true }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 2. Fetch lead data
    const { data: lead, error: leadErr } = await supabase
      .from("leads")
      .select("*, wa_conversations(id, last_message_at, message_count)")
      .eq("id", leadId)
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (leadErr || !lead) {
      return new Response(
        JSON.stringify({ error: "Lead not found", details: leadErr?.message }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // 3. Fetch recent WhatsApp messages via conversation
    let mensagensFormatadas: { quem: string; texto: string; quando: string }[] = [];
    const conv = lead.wa_conversations?.[0];
    if (conv?.id) {
      const { data: mensagens } = await supabase
        .from("wa_messages")
        .select("content, direction, created_at")
        .eq("conversation_id", conv.id)
        .eq("message_type", "text")
        .not("content", "is", null)
        .order("created_at", { ascending: false })
        .limit(15);

      mensagensFormatadas = (mensagens || [])
        .map((m) => ({
          quem: m.direction === "inbound" ? "CLIENTE" : "CONSULTOR",
          texto: m.content || "",
          quando: new Date(m.created_at).toLocaleDateString("pt-BR"),
        }))
        .reverse();
    }

    // 4. Build prompts
    const diasDesdeContato = Math.floor(
      (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
    );

    const systemPrompt = `Você é um analista sênior de vendas de energia solar no Brasil.
Analise a conversa entre consultor e cliente. Seja preciso, direto e acionável.

CLASSIFICAÇÃO DE TEMPERAMENTO:
- "quente": urgência alta, perguntas de implementação ("quando instala?", "preciso preparar o telhado?")
- "morno": interesse moderado, pede comparações, hesita
- "frio": respostas curtas, demora, sem perguntas
- "congelado": sem resposta há dias, ou disse "não vou prosseguir"

DOR PRINCIPAL:
- "preco": menciona valor, caro, investimento, orçamento
- "tempo": urgência, demora, prazo
- "confianca": garantia, medo, quer referências
- "concorrencia": outra empresa, outro orçamento
- "desconhecimento": muitas perguntas técnicas
- "nao_interesse": disse que não quer

RESPONDA SEMPRE EM JSON VÁLIDO com esta estrutura exata:
{
  "temperamento": "quente|morno|frio|congelado",
  "dor_principal": "preco|tempo|confianca|concorrencia|desconhecimento|nao_interesse",
  "urgencia_score": 0-100,
  "objecao_especifica": "frase curta da objeção (max 10 palavras)",
  "sugestoes_abordagem": ["frase 1 pronta para usar", "frase 2", "frase 3"],
  "proximo_passo_sugerido": "desconto|ligacao|visita|esperar|escalar",
  "confianca_ia": 0.0-1.0,
  "justificativa": "por que classificou assim em 2 frases"
}`;

    const userPrompt = `DADOS DO LEAD:
Nome: ${lead.nome || "N/A"}
Cidade: ${lead.cidade || "N/A"}/${lead.estado || "N/A"}
Consumo médio: ${lead.media_consumo || "N/A"} kWh
Valor projeto: R$ ${lead.valor_projeto ? lead.valor_projeto.toLocaleString("pt-BR") : "N/A"}
Tempo desde primeiro contato: ${diasDesdeContato} dias
Observações do consultor: ${lead.observacoes || "Nenhuma"}

${
  mensagensFormatadas.length > 0
    ? `HISTÓRICO DE MENSAGENS (últimas ${mensagensFormatadas.length}):
${mensagensFormatadas.map((m) => `[${m.quando}] ${m.quem}: "${m.texto}"`).join("\n")}`
    : "SEM HISTÓRICO DE MENSAGENS DISPONÍVEL — analise com base nos dados do lead e observações."
}

ANALISE E RESPONDA EM JSON VÁLIDO:`;

    // 5. Call Lovable AI Gateway
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    // Map provider preference to gateway model
    const modelMap: Record<string, string> = {
      openai: "openai/gpt-5-mini",
      gemini: "google/gemini-2.5-flash",
      local: "google/gemini-2.5-flash-lite",
    };
    const model = modelMap[config.ia_provedor || "gemini"] || "google/gemini-2.5-flash";

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), config.ia_timeout_ms || 10000);

    let aiResponse: Response;
    try {
      aiResponse = await fetch(LOVABLE_GATEWAY, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          temperature: config.ia_temperatura || 0.7,
          max_tokens: config.ia_max_tokens || 500,
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("[v2] AI Gateway error:", aiResponse.status, errText);

      if (aiResponse.status === 429) {
        throw new Error("Rate limit exceeded on AI Gateway");
      }
      if (aiResponse.status === 402) {
        throw new Error("AI Gateway credits exhausted");
      }
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content || "";
    const tokensUsed = aiData.usage?.total_tokens || 0;
    const promptTokens = aiData.usage?.prompt_tokens || 0;
    const completionTokens = aiData.usage?.completion_tokens || 0;

    // Estimate cost (very rough — Lovable handles actual billing)
    const estimatedCostUsd = (tokensUsed / 1000) * 0.001;

    // 6. Parse AI response
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("AI response did not contain valid JSON");
    }
    const analise = JSON.parse(jsonMatch[0]);

    // Validate expected fields
    const temperamento = ["quente", "morno", "frio", "congelado"].includes(analise.temperamento)
      ? analise.temperamento
      : "morno";
    const dorPrincipal = analise.dor_principal || "desconhecimento";
    const urgenciaScore = Math.max(0, Math.min(100, Number(analise.urgencia_score) || 50));
    const confiancaIa = Math.max(0, Math.min(1, Number(analise.confianca_ia) || 0.5));

    // 7. Log usage
    await supabase.from("ai_usage_logs").insert({
      tenant_id: tenantId,
      user_id: userId || "00000000-0000-0000-0000-000000000000",
      function_name: "analyze-lead-intelligence-v2",
      provider: config.ia_provedor || "gemini",
      model,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: tokensUsed,
      estimated_cost_usd: estimatedCostUsd,
      is_fallback: false,
    });

    // 8. Check monthly cost limit
    const { data: custoMes } = await supabase.rpc("calcular_custo_ia_mes", {
      p_tenant_id: tenantId,
    });

    const custoMaxMes = config.ia_custo_maximo_mes || 500;
    // Convert USD cost to approximate BRL for comparison (config stores BRL)
    const custoMesBrl = (custoMes || 0) * 5;
    if (custoMesBrl > custoMaxMes) {
      console.warn("[v2] Monthly cost limit exceeded, disabling IA for tenant", tenantId);
      await supabase
        .from("intelligence_config")
        .update({ ia_analise_sentimento_habilitada: false })
        .eq("tenant_id", tenantId);
    }

    // 9. Upsert intelligence profile
    const profilePayload = {
      tenant_id: tenantId,
      lead_id: leadId,
      temperamento,
      dor_principal: dorPrincipal,
      urgencia_score: urgenciaScore,
      objecao_detectada: analise.objecao_especifica || null,
      dias_inativo: conv?.last_message_at
        ? Math.floor((Date.now() - new Date(conv.last_message_at).getTime()) / (1000 * 60 * 60 * 24))
        : diasDesdeContato,
      mensagens_troca: conv?.message_count || 0,
      primeiro_contato: lead.created_at,
      ultimo_contato: conv?.last_message_at || lead.updated_at,
      analisado_por: "ia" as const,
      updated_at: new Date().toISOString(),
    };

    const { data: existing } = await supabase
      .from("lead_intelligence_profiles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("lead_id", leadId)
      .maybeSingle();

    let profileId: string;
    if (existing) {
      await supabase.from("lead_intelligence_profiles").update(profilePayload).eq("id", existing.id);
      profileId = existing.id;
    } else {
      const { data: inserted, error: insErr } = await supabase
        .from("lead_intelligence_profiles")
        .insert(profilePayload)
        .select("id")
        .single();
      if (insErr) throw insErr;
      profileId = inserted.id;
    }

    // 10. Create alert if relevant
    let alertCreated = false;
    const thresholdMorno = config.threshold_morno ?? 50;
    const thresholdQuente = config.threshold_quente ?? 80;

    if (config.alertas_habilitados !== false && urgenciaScore >= thresholdMorno) {
      const tipoAlerta =
        dorPrincipal === "preco" ? "preco_detectado"
        : dorPrincipal === "tempo" ? "tempo_urgente"
        : dorPrincipal === "concorrencia" ? "concorrencia"
        : "reaquecimento_oportunidade";

      const severidade = urgenciaScore >= thresholdQuente ? "alta" : "media";

      const gerenteThreshold = config.wa_notificar_gerente_se_urgencia_acima ?? 90;

      await supabase.from("intelligence_alerts").insert({
        tenant_id: tenantId,
        lead_intelligence_id: profileId,
        lead_id: leadId,
        tipo_alerta: tipoAlerta,
        severidade,
        direcionado_para: urgenciaScore >= gerenteThreshold ? "gerente" : "consultor",
        contexto_json: {
          urgencia_score: urgenciaScore,
          temperamento,
          dor_principal: dorPrincipal,
          objecao_especifica: analise.objecao_especifica,
          sugestao_abordagem: analise.sugestoes_abordagem,
          proximo_passo_sugerido: analise.proximo_passo_sugerido,
          confianca: confiancaIa,
          justificativa: analise.justificativa,
          analisado_por: "ia",
          modelo: model,
          tokens: tokensUsed,
        },
        margem_disponivel: lead.valor_projeto ? 18 : null,
      });
      alertCreated = true;
    }

    const elapsed = Date.now() - startTime;

    return new Response(
      JSON.stringify({
        success: true,
        profile_id: profileId,
        analise: {
          temperamento,
          dor_principal: dorPrincipal,
          urgencia_score: urgenciaScore,
          objecao_especifica: analise.objecao_especifica,
          sugestoes_abordagem: analise.sugestoes_abordagem,
          proximo_passo_sugerido: analise.proximo_passo_sugerido,
          confianca_ia: confiancaIa,
          justificativa: analise.justificativa,
        },
        custo: {
          usd: estimatedCostUsd,
          tokens: tokensUsed,
          elapsed_ms: elapsed,
        },
        alert_created: alertCreated,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("[analyze-lead-intelligence-v2] Error:", err);

    // Attempt fallback to v1 heuristic
    if (tenantId && leadId) {
      try {
        const { data: fallbackConfig } = await supabase
          .from("intelligence_config")
          .select("ia_fallback_heuristica")
          .eq("tenant_id", tenantId)
          .maybeSingle();

        if (fallbackConfig?.ia_fallback_heuristica) {
          console.log("[v2] Falling back to v1 heuristic");

          // Log the failed attempt
          await supabase.from("ai_usage_logs").insert({
            tenant_id: tenantId,
            user_id: "00000000-0000-0000-0000-000000000000",
            function_name: "analyze-lead-intelligence-v2",
            provider: "fallback",
            model: "heuristic",
            prompt_tokens: 0,
            completion_tokens: 0,
            total_tokens: 0,
            estimated_cost_usd: 0,
            is_fallback: true,
          });

          // Call v1 internally
          const v1Response = await fetch(
            `${supabaseUrl}/functions/v1/analyze-lead-intelligence`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${serviceKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({ lead_id: leadId, tenant_id: tenantId }),
            }
          );
          const v1Body = await v1Response.text();
          return new Response(v1Body, {
            status: v1Response.status,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }
      } catch (fallbackErr) {
        console.error("[v2] Fallback also failed:", fallbackErr);
      }
    }

    return new Response(
      JSON.stringify({
        error: err instanceof Error ? err.message : "Unknown error",
        fallback_available: true,
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
