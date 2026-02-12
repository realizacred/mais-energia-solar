import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { conversation_id } = await req.json();
    if (!conversation_id) throw new Error("conversation_id is required");

    // Get tenant
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.tenant_id) throw new Error("Tenant not found");
    const tenantId = profile.tenant_id;

    // Get OpenAI key
    const { data: keyRow } = await adminClient
      .from("integration_configs")
      .select("api_key")
      .eq("tenant_id", tenantId)
      .eq("service_key", "openai")
      .eq("is_active", true)
      .single();
    if (!keyRow?.api_key) {
      return new Response(
        JSON.stringify({ error: "Chave OpenAI não configurada. Vá em Admin > Integrações." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get AI settings for model preference
    const { data: aiSettings } = await adminClient
      .from("wa_ai_settings")
      .select("modelo_preferido, temperature, max_tokens")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // Get conversation
    const { data: conv } = await adminClient
      .from("wa_conversations")
      .select("id, cliente_nome, cliente_telefone, lead_id, status, last_message_at")
      .eq("id", conversation_id)
      .eq("tenant_id", tenantId)
      .single();
    if (!conv) throw new Error("Conversation not found");

    // Get all messages (up to 50 for comprehensive summary)
    const { data: messages = [] } = await adminClient
      .from("wa_messages")
      .select("direction, content, message_type, created_at, is_internal_note, source")
      .eq("conversation_id", conversation_id)
      .eq("is_internal_note", false)
      .order("created_at", { ascending: false })
      .limit(50);

    if (messages.length === 0) {
      return new Response(
        JSON.stringify({ error: "Nenhuma mensagem para resumir." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get tags
    const { data: convTags = [] } = await adminClient
      .from("wa_conversation_tags")
      .select("tag:wa_tags(name)")
      .eq("conversation_id", conversation_id);
    const tagNames = (convTags ?? []).map((t: any) => t.tag?.name).filter(Boolean);

    // Get lead data
    let leadInfo = "";
    if (conv.lead_id) {
      const { data: lead } = await adminClient
        .from("leads")
        .select("nome, cidade, estado, media_consumo, tipo_telhado, status_id, proxima_acao, data_proxima_acao, observacoes, lead_statuses(nome)")
        .eq("id", conv.lead_id)
        .single();
      if (lead) {
        leadInfo = `
DADOS DO LEAD:
- Nome: ${lead.nome}
- Cidade/Estado: ${lead.cidade}/${lead.estado}
- Consumo: ${lead.media_consumo} kWh
- Telhado: ${lead.tipo_telhado}
- Status pipeline: ${(lead as any).lead_statuses?.nome || "N/A"}
- Próxima ação: ${lead.proxima_acao || "N/A"}
${lead.observacoes ? `- Obs: ${lead.observacoes}` : ""}`;
      }
    }

    // Get proposal if exists
    let proposalInfo = "";
    if (conv.lead_id) {
      const { data: propostas } = await adminClient
        .from("propostas")
        .select("valor_total, potencia_kwp, status, created_at")
        .eq("lead_id", conv.lead_id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (propostas && propostas.length > 0) {
        const p = propostas[0];
        proposalInfo = `
PROPOSTA:
- Valor: R$ ${p.valor_total || "N/A"}
- Potência: ${p.potencia_kwp || "N/A"} kWp
- Status: ${p.status || "N/A"}`;
      }
    }

    const chatHistory = messages
      .reverse()
      .map((m: any) => {
        const role = m.direction === "in" ? "cliente" : "consultor";
        const src = m.source && m.source !== "human" ? ` [${m.source}]` : "";
        return `[${new Date(m.created_at).toLocaleDateString("pt-BR")} ${new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}] ${role}${src}: ${m.content || "(mídia)"}`;
      })
      .join("\n");

    const model = aiSettings?.modelo_preferido || "gpt-4o-mini";
    const temperature = aiSettings?.temperature ?? 0.4;

    const systemPrompt = `Você é um analista de CRM de energia solar. Analise o histórico completo da conversa e gere um resumo estratégico para o consultor.

Retorne APENAS um JSON com a seguinte estrutura:
{
  "resumo": "resumo em 2-3 frases da conversa completa",
  "assuntos_principais": ["assunto 1", "assunto 2"],
  "dores_cliente": ["dor 1", "dor 2"],
  "objecoes": ["objeção 1"],
  "interesses": ["interesse 1"],
  "estagio_funil": "prospeccao | qualificacao | proposta | negociacao | fechamento | perdido",
  "sentimento_cliente": "positivo | neutro | negativo | indeciso",
  "proxima_acao_sugerida": "ação recomendada em 1 linha",
  "probabilidade_fechamento": 0-100,
  "alertas": ["alerta se houver risco ou urgência"]
}

REGRAS:
- Seja objetivo e direto
- Foque no que é útil para o consultor tomar decisão
- Se não houver dados para um campo, use array vazio [] ou string vazia
- Probabilidade deve considerar engajamento, objeções e estágio
- Alertas são opcionais — só incluir se houver risco real`;

    const userPrompt = `CONVERSA COM: ${conv.cliente_nome || "Cliente desconhecido"}
Tags: ${tagNames.join(", ") || "nenhuma"}
Status: ${conv.status}
Total de mensagens: ${messages.length}
${leadInfo}
${proposalInfo}

HISTÓRICO COMPLETO:
${chatHistory}

Gere o resumo estratégico.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keyRow.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 800,
        temperature,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI error:", openaiResponse.status, errText);
      if (openaiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit da OpenAI excedido." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const aiData = await openaiResponse.json();
    const rawContent = aiData.choices?.[0]?.message?.content?.trim();
    if (!rawContent) throw new Error("Empty AI response");

    let summary: any;
    try {
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      summary = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse summary JSON:", rawContent);
      summary = {
        resumo: rawContent,
        assuntos_principais: [],
        dores_cliente: [],
        objecoes: [],
        interesses: [],
        estagio_funil: "qualificacao",
        sentimento_cliente: "neutro",
        proxima_acao_sugerida: "Revisar conversa manualmente",
        probabilidade_fechamento: 50,
        alertas: [],
      };
    }

    // Log the task
    await adminClient.from("wa_ai_tasks").insert({
      tenant_id: tenantId,
      conversation_id,
      lead_id: conv.lead_id,
      type: "conversation_summary",
      status: "generated",
      suggestion: summary.resumo,
      context: summary,
      requested_by: user.id,
      generated_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ summary, task_type: "conversation_summary" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ai-conversation-summary error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
