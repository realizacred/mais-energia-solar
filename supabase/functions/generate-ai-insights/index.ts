import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { enforceFeature, enforceUsageLimit, checkUsageLimit, trackUsage } from "../_shared/entitlement.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// AI caller — tenant OpenAI key ONLY (no external gateway)
async function callAI(
  tenantApiKey: string | null,
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; max_tokens?: number; model?: string } = {}
): Promise<{ content: string; provider: string; usage: any }> {
  const { temperature = 0.4, max_tokens = 4000, model = "gpt-4o-mini" } = options;

  if (!tenantApiKey) {
    throw new Error("No AI provider available. Configure OpenAI key in Admin > Integrations.");
  }

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${tenantApiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
      max_tokens,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    const status = res.status;
    if (status === 429) throw new Error("AI_RATE_LIMIT: Limite de requisições da OpenAI excedido. Aguarde 1 minuto.");
    if (status === 401 || status === 403) throw new Error("AI_AUTH_INVALID: Chave da API OpenAI inválida ou expirada. Atualize em Admin → Integrações.");
    if (status === 402) throw new Error("AI_NO_CREDITS: Sem créditos na conta OpenAI. Verifique o faturamento.");
    if (status === 404 || status === 410) throw new Error("AI_MODEL_UNAVAILABLE: Modelo de IA não disponível.");
    throw new Error(`AI_PROVIDER_ERROR: Erro OpenAI (${status}) - ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const content = data.choices?.[0]?.message?.content || "{}";
  return { content, provider: "openai_tenant", usage: data.usage || {} };
}

// ── Per-tenant insight generation (shared by cron + manual) ──
async function generateInsightForTenant(
  supabase: any,
  tenantId: string,
  insightType: string,
  filters: Record<string, any>,
  userId: string | null
): Promise<{ success: boolean; insightId?: string; error?: string }> {
  // Get AI provider config
  let activeProvider = "openai";
  let activeModel = "gpt-4o-mini";

  try {
    const { data: providerConfig } = await supabase
      .from("ai_provider_config")
      .select("active_provider, active_model")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (providerConfig?.active_provider) activeProvider = providerConfig.active_provider;
    if (providerConfig?.active_model) activeModel = providerConfig.active_model;
  } catch {
    console.warn(`[generate-ai-insights] config fetch failed for tenant ${tenantId}, using defaults`);
  }

  // Get tenant OpenAI key
  let tenantApiKey: string | null = null;
  const { data: keyRow } = await supabase
    .from("integration_configs")
    .select("api_key")
    .eq("tenant_id", tenantId)
    .eq("service_key", "openai")
    .eq("is_active", true)
    .maybeSingle();
  tenantApiKey = keyRow?.api_key || null;

  if (!tenantApiKey) {
    return { success: false, error: "No OpenAI key configured for tenant" };
  }

  console.log(`[generate-ai-insights] Generating ${insightType} for tenant ${tenantId} (key: true)`);

  // ── Gather CRM Data ──────────────────────────────────────────
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const today = now.toISOString().split("T")[0];

  const [
    leadsResult,
    leadsRecentResult,
    statusesResult,
    vendedoresResult,
    scoresResult,
    clientesResult,
    atividadesResult,
    comissoesResult,
    recebimentosResult,
  ] = await Promise.all([
    supabase.from("leads").select("id, nome, telefone, cidade, estado, media_consumo, consumo_previsto, tipo_telhado, rede_atendimento, consultor, status_id, created_at, updated_at, ultimo_contato, visto, visto_admin, data_proxima_acao, proxima_acao, area").eq("tenant_id", tenantId).order("created_at", { ascending: false }).limit(500),
    supabase.from("leads").select("id, nome, media_consumo, consultor, created_at, status_id").eq("tenant_id", tenantId).gte("created_at", sevenDaysAgo).order("created_at", { ascending: false }),
    supabase.from("lead_status").select("id, nome, cor, ordem").eq("tenant_id", tenantId).order("ordem"),
    supabase.from("consultores").select("id, nome, user_id, ativo, created_at").eq("tenant_id", tenantId),
    supabase.from("lead_scores").select("lead_id, score, nivel, probabilidade_fechamento, valor_estimado, recomendacao, calculado_em").eq("tenant_id", tenantId).order("score", { ascending: false }),
    supabase.from("clientes").select("id, nome, valor_projeto, potencia_kwp, lead_id, created_at").eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo),
    supabase.from("lead_atividades").select("id, lead_id, tipo, descricao, data_agendada, concluido, created_at, created_by").eq("tenant_id", tenantId).gte("created_at", thirtyDaysAgo).order("created_at", { ascending: false }).limit(200),
    supabase.from("comissoes").select("id, consultor_id, valor_comissao, valor_base, status, mes_referencia, ano_referencia").eq("tenant_id", tenantId).limit(100),
    supabase.from("parcelas_recebimento").select("id, valor, status, data_vencimento, data_pagamento").eq("tenant_id", tenantId).limit(200),
  ]);

  const leads = leadsResult.data || [];
  const leadsRecent = leadsRecentResult.data || [];
  const statuses = statusesResult.data || [];
  const vendedores = (vendedoresResult.data || []).filter((v: any) => v.ativo);
  const scores = scoresResult.data || [];
  const clientes = clientesResult.data || [];
  const atividades = atividadesResult.data || [];
  const recebimentos = recebimentosResult.data || [];

  // ── Build Analytics Summary ──────────────────────────────────
  const statusMap = new Map(statuses.map((s: any) => [s.id, s.nome]));
  const scoreMap = new Map(scores.map((s: any) => [s.lead_id, s]));

  const leadsByStatus: Record<string, number> = {};
  leads.forEach((l: any) => {
    const statusName = String(l.status_id ? statusMap.get(l.status_id) || "Sem status" : "Sem status");
    leadsByStatus[statusName] = (leadsByStatus[statusName] || 0) + 1;
  });

  const leadsByVendor: Record<string, number> = {};
  leads.forEach((l: any) => {
    const v = l.vendedor || "Sem vendedor";
    leadsByVendor[v] = (leadsByVendor[v] || 0) + 1;
  });

  const hotLeads = scores.filter((s: any) => s.nivel === "hot");
  const warmLeads = scores.filter((s: any) => s.nivel === "warm");
  const coldLeads = scores.filter((s: any) => s.nivel === "cold");

  const receitaPrevista = scores.reduce((acc: number, s: any) => acc + (s.valor_estimado || 0), 0);
  const receitaRealizada = clientes.reduce((acc: number, c: any) => acc + (c.valor_projeto || 0), 0);

  const followUpsPendentes = atividades.filter((a: any) => !a.concluido && a.data_agendada);
  const followUpsAtrasados = followUpsPendentes.filter((a: any) => new Date(a.data_agendada) < now);

  const leadsParados = leads.filter((l: any) => {
    const score = scoreMap.get(l.id) as { nivel?: string } | undefined;
    if (!score || score.nivel !== "hot") return false;
    const lastContact = l.ultimo_contato ? new Date(l.ultimo_contato) : new Date(l.created_at);
    const daysSince = Math.floor((now.getTime() - lastContact.getTime()) / (1000 * 60 * 60 * 24));
    return daysSince > 3;
  });

  const parcelasAtrasadas = recebimentos.filter((p: any) =>
    p.status === "pendente" && p.data_vencimento && new Date(p.data_vencimento) < now
  );

  const ticketMedio = clientes.length > 0
    ? clientes.reduce((acc: number, c: any) => acc + (c.valor_projeto || 0), 0) / clientes.length
    : 0;

  const leadsLast30 = leads.filter((l: any) => new Date(l.created_at) >= new Date(thirtyDaysAgo));
  const conversoes30d = clientes.length;
  const taxaConversao = leadsLast30.length > 0 ? (conversoes30d / leadsLast30.length * 100) : 0;

  const crmContext = `
## DADOS DO CRM (${today})

### RESUMO GERAL
- Total de leads ativos: ${leads.length}
- Leads novos últimos 7 dias: ${leadsRecent.length}
- Clientes convertidos últimos 30 dias: ${clientes.length}
- Taxa de conversão (30d): ${taxaConversao.toFixed(1)}%
- Ticket médio: R$ ${ticketMedio.toFixed(2)}
- Receita prevista (pipeline): R$ ${receitaPrevista.toFixed(2)}
- Receita realizada (30d): R$ ${receitaRealizada.toFixed(2)}

### FUNIL DE VENDAS
${Object.entries(leadsByStatus).map(([status, count]) => `- ${status}: ${count} leads`).join("\n")}

### SCORING DE LEADS
- 🔥 Hot (alta probabilidade): ${hotLeads.length} leads
- 🟡 Warm (média probabilidade): ${warmLeads.length} leads  
- 🔵 Cold (baixa probabilidade): ${coldLeads.length} leads

### LEADS HOT PARADOS (sem contato há >3 dias)
${leadsParados.slice(0, 10).map((l: any) => {
  const score = scoreMap.get(l.id) as { score?: number | string } | undefined;
  return `- ${l.nome} (${l.cidade}/${l.estado}) - Score: ${score?.score || "N/A"} - ${l.media_consumo}kWh - Vendedor: ${l.vendedor || "N/A"}`;
}).join("\n") || "Nenhum"}

### DISTRIBUIÇÃO POR VENDEDOR
${Object.entries(leadsByVendor).map(([vendor, count]) => `- ${vendor}: ${count} leads`).join("\n")}

### VENDEDORES ATIVOS
${vendedores.map((v: any) => `- ${v.nome}`).join("\n")}

### FOLLOW-UPS
- Total pendentes: ${followUpsPendentes.length}
- Atrasados: ${followUpsAtrasados.length}
${followUpsAtrasados.slice(0, 5).map((a: any) => `  ⚠ ${a.descricao} (agendado: ${new Date(a.data_agendada).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })})`).join("\n")}

### INADIMPLÊNCIA
- Parcelas atrasadas: ${parcelasAtrasadas.length}
- Valor total atrasado: R$ ${parcelasAtrasadas.reduce((acc: number, p: any) => acc + (p.valor || 0), 0).toFixed(2)}

### TOP 10 LEADS POR SCORE
${scores.slice(0, 10).map((s: any) => {
  const lead = leads.find((l: any) => l.id === s.lead_id);
  return lead ? `- ${lead.nome} | Score: ${s.score} | ${s.nivel} | ${lead.media_consumo}kWh | ${lead.vendedor || "N/A"} | Prob: ${(s.probabilidade_fechamento * 100).toFixed(0)}%` : null;
}).filter(Boolean).join("\n")}
`;

  // ── AI Prompt by type ────────────────────────────────────────
  let systemPrompt = "";
  let userPrompt = "";

  if (insightType === "daily_summary") {
    systemPrompt = `Você é o Diretor Comercial IA de uma empresa de energia solar. Analise os dados do CRM e gere um relatório executivo completo e acionável.

Responda SEMPRE em JSON válido com esta estrutura exata:
{
  "resumo_executivo": "string (2-3 parágrafos resumindo o momento comercial)",
  "kpis": [
    {"label": "string", "valor": "string", "tendencia": "up|down|stable", "destaque": true|false}
  ],
  "gargalos": [
    {"etapa": "string", "descricao": "string", "impacto": "alto|medio|baixo"}
  ],
  "destaques_positivos": ["string"],
  "pontos_atencao": ["string"]
}`;
    userPrompt = `Gere o RESUMO EXECUTIVO DIÁRIO com base nos dados abaixo.\n\n${crmContext}`;
  } else if (insightType === "alert") {
    systemPrompt = `Você é o Diretor Comercial IA. Analise os dados e identifique TODOS os riscos e alertas comerciais.

Responda SEMPRE em JSON válido:
{
  "alertas": [
    {
      "tipo": "lead_parado|followup_atrasado|conversao_queda|proposta_expirando|inadimplencia|vendedor_inativo|outro",
      "severidade": "critico|alto|medio|baixo",
      "titulo": "string curto",
      "descricao": "string detalhada",
      "dados": {"lead_nome": "string", "vendedor": "string", "dias": number, "valor": number},
      "acao_sugerida": "string"
    }
  ],
  "score_saude_comercial": number (0-100),
  "resumo_riscos": "string (1 parágrafo)"
}`;
    userPrompt = `Identifique TODOS os alertas e riscos com base nos dados:\n\n${crmContext}`;
  } else if (insightType === "action_plan") {
    systemPrompt = `Você é o Diretor Comercial IA. Gere um plano de ação concreto com tarefas priorizadas por vendedor.

Responda SEMPRE em JSON válido:
{
  "plano_geral": "string (visão geral do plano)",
  "tarefas_por_vendedor": {
    "Nome do Vendedor": [
      {
        "prioridade": "P0|P1|P2",
        "lead_nome": "string",
        "lead_id": "uuid ou null",
        "motivo": "string explicando por que é prioridade",
        "acao": "ligar|whatsapp|visita|enviar_proposta|follow_up|outro",
        "acao_detalhada": "string com instrução específica",
        "urgencia_horas": number
      }
    ]
  },
  "meta_dia": "string (objetivo do dia)",
  "meta_semana": "string (objetivo da semana)"
}`;
    userPrompt = `Gere o PLANO DE AÇÃO para hoje/semana com base nos dados. Priorize leads HOT parados e follow-ups atrasados.\n\n${crmContext}`;
  } else {
    systemPrompt = `Você é o Diretor Comercial IA. Gere um relatório semanal completo de performance comercial.

Responda SEMPRE em JSON válido:
{
  "periodo": "string",
  "resumo": "string (3-4 parágrafos)",
  "metricas": [{"label": "string", "valor_atual": "string", "valor_anterior": "string", "variacao": "string"}],
  "ranking_vendedores": [{"nome": "string", "leads": number, "conversoes": number, "valor": number, "destaque": "string"}],
  "recomendacoes_estrategicas": ["string"],
  "projecao_proxima_semana": "string"
}`;
    userPrompt = `Gere o RELATÓRIO SEMANAL completo:\n\n${crmContext}`;
  }

  // ── Call AI ────────────────────────────────────────────────────
  console.log(`[generate-ai-insights] Calling AI for ${insightType} (tenant ${tenantId})...`);

  const { content: rawContent, provider, usage: aiUsage } = await callAI(
    tenantApiKey,
    [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt },
    ],
    { temperature: 0.4, max_tokens: 4000, model: activeModel }
  );

  console.log(`[generate-ai-insights] AI response via ${provider}`);

  // Parse JSON from AI response (handle markdown code blocks)
  let payload: any;
  try {
    const jsonMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)```/);
    const jsonStr = jsonMatch ? jsonMatch[1].trim() : rawContent.trim();
    payload = JSON.parse(jsonStr);
  } catch {
    console.error("[generate-ai-insights] Failed to parse AI response:", rawContent);
    payload = { raw_response: rawContent, parse_error: true };
  }

  // ── Save insight ─────────────────────────────────────────────
  const { data: savedInsight, error: saveError } = await supabase
    .from("ai_insights")
    .insert({
      tenant_id: tenantId,
      insight_type: insightType,
      payload,
      generated_by_user_id: userId,
      period_start: thirtyDaysAgo.split("T")[0],
      period_end: today,
      filters,
    })
    .select()
    .single();

  if (saveError) {
    console.error("[generate-ai-insights] Save error:", saveError);
    throw saveError;
  }

  console.log(`[generate-ai-insights] Successfully generated ${insightType} via ${provider}, saved as ${savedInsight.id}`);

  // ── Log AI usage ─────────────────────────────────────────────
  try {
    const promptTokens = aiUsage.prompt_tokens || 0;
    const completionTokens = aiUsage.completion_tokens || 0;
    const totalTokens = aiUsage.total_tokens || (promptTokens + completionTokens);
    const estimatedCost = (promptTokens / 1000) * 0.00015 + (completionTokens / 1000) * 0.0006;

    await supabase.from("ai_usage_logs").insert({
      tenant_id: tenantId,
      user_id: userId || "00000000-0000-0000-0000-000000000000",
      function_name: "generate-ai-insights",
      provider: activeProvider,
      model: activeModel,
      prompt_tokens: promptTokens,
      completion_tokens: completionTokens,
      total_tokens: totalTokens,
      estimated_cost_usd: estimatedCost,
      is_fallback: false,
    });
  } catch (logError) {
    console.error("[generate-ai-insights] log error:", logError);
  }

  return { success: true, insightId: savedInsight.id };
}

// ── Main handler ─────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // ── CRON mode: x-cron-secret header ──────────────────────────
    const cronSecret = Deno.env.get("CRON_SECRET");
    const cronHeader = req.headers.get("x-cron-secret");
    const isCronCall = !!(cronSecret && cronHeader && cronHeader === cronSecret);

    if (isCronCall) {
      console.log("[generate-ai-insights] CRON mode activated");
      const supabase = createClient(supabaseUrl, supabaseKey);

      // Get all active tenants
      const { data: tenants, error: tErr } = await supabase
        .from("tenants")
        .select("id, nome")
        .eq("status", "active")
        .is("deleted_at", null);

      if (tErr || !tenants?.length) {
        console.log(`[generate-ai-insights] CRON: No active tenants found (${tErr?.message || "0 tenants"})`);
        return new Response(JSON.stringify({
          success: true,
          message: "Nenhum tenant ativo encontrado",
          processed: 0,
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }

      const results: Array<{ tenant: string; success: boolean; insightId?: string; error?: string }> = [];

      for (const tenant of tenants) {
        try {
          // Entitlement check per tenant — skip if feature not available
          const denial = await enforceFeature(supabase, tenant.id, "ai_insights", corsHeaders, { skipAudit: true });
          if (denial) {
            console.log(`[generate-ai-insights] CRON: Skipping tenant ${tenant.nome} — ai_insights not in plan`);
            results.push({ tenant: tenant.nome, success: false, error: "feature_not_available" });
            continue;
          }

          // Usage limit check per tenant
          const limitCheck = await checkUsageLimit(supabase, tenant.id, "max_ai_insights_month");
          if (!limitCheck.allowed) {
            console.log(`[generate-ai-insights] CRON: Skipping tenant ${tenant.nome} — ai_insights limit reached (${limitCheck.current_value}/${limitCheck.limit_value})`);
            results.push({ tenant: tenant.nome, success: false, error: "limit_exceeded" });
            continue;
          }

          const result = await generateInsightForTenant(
            supabase,
            tenant.id,
            "daily_summary",
            { auto: true, source: "cron" },
            null
          );
          if (result.success) {
            await trackUsage(supabase, tenant.id, "ai_insights", 1, { source: "cron" });
          }
          results.push({ tenant: tenant.nome, ...result });
        } catch (err: any) {
          console.error(`[generate-ai-insights] CRON error for tenant ${tenant.nome}:`, err.message);
          results.push({ tenant: tenant.nome, success: false, error: err.message });
        }
      }

      const successCount = results.filter(r => r.success).length;
      console.log(`[generate-ai-insights] CRON done: ${successCount}/${tenants.length} tenants processed`);

      return new Response(JSON.stringify({
        success: true,
        processed: successCount,
        total: tenants.length,
        results,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ── Manual mode: JWT required ────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await supabaseAuth.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: roles } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id);

    const isAdmin = roles?.some((r: any) => ["admin", "gerente"].includes(r.role));
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Acesso negado" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    // G3: Tenant status enforcement
    if (profile?.tenant_id) {
      const { data: tRow } = await supabase.from("tenants").select("status, deleted_at").eq("id", profile.tenant_id).single();
      if (!tRow || tRow.status !== "active" || tRow.deleted_at) {
        return new Response(JSON.stringify({ error: "tenant_inactive" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
    }

    const tenantId = profile?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Backend entitlement check (admin bypass already validated above via roles)
    if (!isAdmin) {
      const denial = await enforceFeature(supabase, tenantId, "ai_insights", corsHeaders, { userId: user.id });
      if (denial) return denial;

      // Usage limit check
      const limitDenial = await enforceUsageLimit(supabase, tenantId, "max_ai_insights_month", corsHeaders, { userId: user.id });
      if (limitDenial) return limitDenial;
    }

    const body = await req.json();
    const { insight_type = "daily_summary", filters = {} } = body;

    const result = await generateInsightForTenant(supabase, tenantId, insight_type, filters, user.id);
    if (result.success) {
      await trackUsage(supabase, tenantId, "ai_insights", 1, { userId: user.id, source: "manual" });
    }

    if (!result.success) {
      return new Response(JSON.stringify({ error: result.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch the saved insight to return full data
    const { data: savedInsight } = await supabase
      .from("ai_insights")
      .select("*")
      .eq("id", result.insightId)
      .single();

    return new Response(JSON.stringify({ success: true, insight: savedInsight }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const err = error as Error;
    console.error("[generate-ai-insights] Error:", error);
    return new Response(
      JSON.stringify({ error: err.message || "Erro interno" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
