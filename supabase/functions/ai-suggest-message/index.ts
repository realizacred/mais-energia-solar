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

    // User client for RLS
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    // Service client for admin operations
    const adminClient = createClient(supabaseUrl, serviceKey);

    const { conversation_id } = await req.json();
    if (!conversation_id) throw new Error("conversation_id is required");

    // Get user tenant
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.tenant_id) throw new Error("Tenant not found");

    const tenantId = profile.tenant_id;

    // Get OpenAI key for this tenant
    const { data: keyRow } = await adminClient
      .from("integration_configs")
      .select("api_key")
      .eq("tenant_id", tenantId)
      .eq("service_key", "openai")
      .eq("is_active", true)
      .single();

    if (!keyRow?.api_key) {
      return new Response(
        JSON.stringify({ error: "OpenAI API key not configured. Go to Admin > Integrations to add it." }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get conversation details
    const { data: conv } = await adminClient
      .from("wa_conversations")
      .select("id, remote_jid, cliente_nome, cliente_telefone, lead_id, instance_id, status")
      .eq("id", conversation_id)
      .eq("tenant_id", tenantId)
      .single();
    if (!conv) throw new Error("Conversation not found");

    // Get last 20 messages for context
    const { data: messages = [] } = await adminClient
      .from("wa_messages")
      .select("direction, content, message_type, created_at, is_internal_note")
      .eq("conversation_id", conversation_id)
      .eq("is_internal_note", false)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get lead data if available
    let leadContext = "";
    if (conv.lead_id) {
      const { data: lead } = await adminClient
        .from("leads")
        .select("nome, cidade, estado, media_consumo, consumo_previsto, tipo_telhado, rede_atendimento, observacoes")
        .eq("id", conv.lead_id)
        .single();
      if (lead) {
        leadContext = `
DADOS DO LEAD:
- Nome: ${lead.nome}
- Cidade/Estado: ${lead.cidade}/${lead.estado}
- Consumo médio: ${lead.media_consumo} kWh
- Consumo previsto: ${lead.consumo_previsto} kWh
- Tipo de telhado: ${lead.tipo_telhado}
- Rede: ${lead.rede_atendimento}
${lead.observacoes ? `- Observações: ${lead.observacoes}` : ""}`;
      }
    }

    // Get latest proposal if exists
    let proposalContext = "";
    if (conv.lead_id) {
      const { data: propostas } = await adminClient
        .from("propostas")
        .select("raw_payload, valor_total, potencia_kwp, status, created_at")
        .eq("lead_id", conv.lead_id)
        .order("created_at", { ascending: false })
        .limit(1);
      if (propostas && propostas.length > 0) {
        const p = propostas[0];
        proposalContext = `
PROPOSTA MAIS RECENTE:
- Valor total: R$ ${p.valor_total || "N/A"}
- Potência: ${p.potencia_kwp || "N/A"} kWp
- Status: ${p.status || "N/A"}
- Data: ${p.created_at}`;
      }
    }

    // Build chat history for AI
    const chatHistory = messages
      .reverse()
      .map((m: any) => {
        const role = m.direction === "in" ? "cliente" : "vendedor";
        return `[${role}]: ${m.content || "(mídia)"}`;
      })
      .join("\n");

    const systemPrompt = `Você é um assistente de vendas de energia solar. Seu papel é ajudar o vendedor a responder o cliente de forma persuasiva, profissional e empática.

REGRAS:
- Responda APENAS com a mensagem sugerida, sem explicações extras
- Use linguagem natural, como se fosse o vendedor digitando
- Seja conciso (máximo 3 parágrafos)
- Use emojis com moderação (máximo 2-3)
- Se houver proposta, mencione dados relevantes
- Nunca invente dados que não estejam no contexto
- Se não tiver contexto suficiente, sugira uma pergunta relevante ao cliente
- Formato WhatsApp: *negrito* para destaque, _itálico_ para ênfase
${leadContext}
${proposalContext}`;

    const userPrompt = `Histórico da conversa:
${chatHistory || "(sem mensagens ainda)"}

Gere uma sugestão de resposta para o vendedor enviar ao cliente.`;

    // Call OpenAI
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
        max_tokens: 500,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errText = await openaiResponse.text();
      console.error("OpenAI error:", openaiResponse.status, errText);
      if (openaiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit da OpenAI excedido. Tente novamente em alguns segundos." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const aiData = await openaiResponse.json();
    const suggestion = aiData.choices?.[0]?.message?.content?.trim();
    if (!suggestion) throw new Error("Empty AI response");

    // Log the task
    await adminClient.from("wa_ai_tasks").insert({
      tenant_id: tenantId,
      conversation_id,
      lead_id: conv.lead_id,
      type: "suggest_message",
      status: "generated",
      suggestion,
      context: { messages_count: messages.length, has_lead: !!conv.lead_id, has_proposal: !!proposalContext },
      requested_by: user.id,
      generated_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ suggestion, task_type: "suggest_message" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ai-suggest-message error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
