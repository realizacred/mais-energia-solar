import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
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
        JSON.stringify({ error: "OpenAI API key not configured." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get conversation
    const { data: conv } = await adminClient
      .from("wa_conversations")
      .select("id, cliente_nome, cliente_telefone, lead_id, status, last_message_at, updated_at")
      .eq("id", conversation_id)
      .eq("tenant_id", tenantId)
      .single();
    if (!conv) throw new Error("Conversation not found");

    // Get last 15 messages
    const { data: messages = [] } = await adminClient
      .from("wa_messages")
      .select("direction, content, message_type, created_at, is_internal_note")
      .eq("conversation_id", conversation_id)
      .eq("is_internal_note", false)
      .order("created_at", { ascending: false })
      .limit(15);

    // Get conversation tags
    const { data: convTags = [] } = await adminClient
      .from("wa_conversation_tags")
      .select("tag:wa_tags(nome)")
      .eq("conversation_id", conversation_id);
    const tagNames = convTags.map((t: any) => t.tag?.nome).filter(Boolean);

    // Get lead data
    let leadInfo = "";
    if (conv.lead_id) {
      const { data: lead } = await adminClient
        .from("leads")
        .select("nome, status_id, data_proxima_acao, proxima_acao, ultimo_contato, created_at, lead_statuses(nome)")
        .eq("id", conv.lead_id)
        .single();
      if (lead) {
        leadInfo = `
DADOS DO LEAD:
- Nome: ${lead.nome}
- Status pipeline: ${(lead as any).lead_statuses?.nome || "N/A"}
- Último contato: ${lead.ultimo_contato || "N/A"}
- Próxima ação: ${lead.proxima_acao || "N/A"}
- Data próxima ação: ${lead.data_proxima_acao || "N/A"}
- Lead criado: ${lead.created_at}`;
      }
    }

    // Check existing followups
    const { data: existingFollowups = [] } = await adminClient
      .from("wa_followup_queue")
      .select("status, tipo, created_at")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(5);

    // Calculate time since last message
    const lastMsgTime = conv.last_message_at ? new Date(conv.last_message_at) : null;
    const hoursSinceLastMsg = lastMsgTime
      ? Math.round((Date.now() - lastMsgTime.getTime()) / (1000 * 60 * 60))
      : null;

    // Check last message direction
    const lastMsg = messages[0];
    const lastMsgDirection = lastMsg?.direction || "unknown";

    const chatHistory = messages
      .reverse()
      .map((m: any) => `[${m.direction === "in" ? "cliente" : "vendedor"}]: ${m.content || "(mídia)"}`)
      .join("\n");

    const systemPrompt = `Você é um planejador de follow-ups para uma empresa de energia solar. Analise o contexto da conversa e sugira a melhor estratégia de follow-up.

Retorne um JSON com a seguinte estrutura:
{
  "urgency": "high" | "medium" | "low",
  "recommended_action": "string (ação recomendada em 1 linha)",
  "suggested_message": "string (mensagem de follow-up sugerida)",
  "reasoning": "string (breve justificativa da estratégia)",
  "wait_hours": number (horas recomendadas para esperar antes de enviar),
  "followup_type": "reminder" | "value_add" | "urgency" | "check_in" | "proposal_followup"
}

REGRAS:
- Se o cliente respondeu por último mas não recebeu resposta, urgência ALTA
- Se o vendedor respondeu por último há mais de 24h sem resposta do cliente, sugerir follow-up
- Se há proposta enviada sem retorno, focar em valor e urgência
- Mensagem em formato WhatsApp (*negrito*, _itálico_)
- Nunca sugerir follow-up se a última mensagem é do vendedor há menos de 4 horas
- Retorne APENAS o JSON, sem texto adicional`;

    const userPrompt = `CONTEXTO:
- Cliente: ${conv.cliente_nome || "Desconhecido"}
- Status conversa: ${conv.status}
- Tags: ${tagNames.join(", ") || "nenhuma"}
- Última mensagem: ${lastMsgDirection === "in" ? "do cliente" : "do vendedor"} há ${hoursSinceLastMsg ?? "?"} horas
- Follow-ups anteriores: ${existingFollowups.length} (${existingFollowups.map((f: any) => f.status).join(", ") || "nenhum"})
${leadInfo}

HISTÓRICO:
${chatHistory || "(sem mensagens)"}

Analise e retorne o JSON com a estratégia de follow-up.`;

    const openaiResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${keyRow.api_key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 600,
        temperature: 0.5,
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

    // Parse JSON response
    let plan: any;
    try {
      // Strip markdown code fences if present
      const cleaned = rawContent.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      plan = JSON.parse(cleaned);
    } catch {
      console.error("Failed to parse AI response as JSON:", rawContent);
      plan = {
        urgency: "medium",
        recommended_action: "Enviar follow-up padrão",
        suggested_message: rawContent,
        reasoning: "Resposta da IA não veio em JSON estruturado",
        wait_hours: 4,
        followup_type: "check_in",
      };
    }

    // Log task
    await adminClient.from("wa_ai_tasks").insert({
      tenant_id: tenantId,
      conversation_id,
      lead_id: conv.lead_id,
      type: "followup_planner",
      status: "generated",
      suggestion: plan.suggested_message || rawContent,
      context: {
        urgency: plan.urgency,
        recommended_action: plan.recommended_action,
        reasoning: plan.reasoning,
        wait_hours: plan.wait_hours,
        followup_type: plan.followup_type,
        hours_since_last_msg: hoursSinceLastMsg,
        last_msg_direction: lastMsgDirection,
      },
      requested_by: user.id,
      generated_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ plan, task_type: "followup_planner" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ai-followup-planner error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
