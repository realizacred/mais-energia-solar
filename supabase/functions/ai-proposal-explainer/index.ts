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

    const { proposal_id, conversation_id, format: msgFormat = "short" } = await req.json();
    if (!proposal_id) throw new Error("proposal_id is required");

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

    // Get proposal
    const { data: proposta } = await adminClient
      .from("propostas")
      .select("id, raw_payload, valor_total, potencia_kwp, economia_mensal, payback_meses, lead_id, status, created_at")
      .eq("id", proposal_id)
      .eq("tenant_id", tenantId)
      .single();
    if (!proposta) throw new Error("Proposal not found");

    // Get lead name
    let clienteName = "cliente";
    if (proposta.lead_id) {
      const { data: lead } = await adminClient
        .from("leads")
        .select("nome, media_consumo, cidade, estado")
        .eq("id", proposta.lead_id)
        .single();
      if (lead) {
        clienteName = lead.nome || "cliente";
      }
    }

    // Extract equipment from raw_payload
    const rawPayload = proposta.raw_payload as any;
    let equipmentInfo = "";
    if (rawPayload?.pricingTable && Array.isArray(rawPayload.pricingTable)) {
      const items = rawPayload.pricingTable
        .filter((r: any) => r?.item)
        .map((r: any) => `- ${r.category || "Item"}: ${r.item}`)
        .join("\n");
      if (items) equipmentInfo = `\nEQUIPAMENTOS:\n${items}`;
    }

    const formatInstruction = msgFormat === "detailed"
      ? "Crie uma mensagem DETALHADA (4-6 parágrafos) explicando cada aspecto da proposta: equipamentos, economia, payback, financiamento."
      : "Crie uma mensagem CURTA (2-3 parágrafos) com o resumo mais impactante da proposta.";

    const systemPrompt = `Você é um especialista em energia solar. Crie uma mensagem persuasiva para o vendedor enviar ao cliente explicando a proposta.

REGRAS:
- ${formatInstruction}
- Use formato WhatsApp: *negrito*, _itálico_
- Comece com saudação usando o nome do cliente
- Destaque economia e retorno do investimento
- Seja profissional mas acessível
- Inclua um CTA ao final
- Não invente dados que não estejam no contexto
- Emojis com moderação (3-5 máximo)`;

    const userPrompt = `DADOS DA PROPOSTA:
- Cliente: ${clienteName}
- Valor total: R$ ${proposta.valor_total || "N/A"}
- Potência: ${proposta.potencia_kwp || "N/A"} kWp
- Economia mensal: R$ ${proposta.economia_mensal || "N/A"}
- Payback: ${proposta.payback_meses || "N/A"} meses
- Status: ${proposta.status || "N/A"}
${equipmentInfo}

Gere a mensagem explicativa para o vendedor enviar.`;

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
        max_tokens: msgFormat === "detailed" ? 800 : 400,
        temperature: 0.7,
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
    const suggestion = aiData.choices?.[0]?.message?.content?.trim();
    if (!suggestion) throw new Error("Empty AI response");

    // Log task
    await adminClient.from("wa_ai_tasks").insert({
      tenant_id: tenantId,
      conversation_id: conversation_id || null,
      lead_id: proposta.lead_id,
      type: "proposal_explainer",
      status: "generated",
      suggestion,
      context: { proposal_id, format: msgFormat, valor_total: proposta.valor_total },
      requested_by: user.id,
      generated_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({ suggestion, task_type: "proposal_explainer" }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("ai-proposal-explainer error:", err);
    return new Response(
      JSON.stringify({ error: err.message || "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
