import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

interface LeadData {
  id: string;
  nome: string;
  telefone: string;
  cidade: string;
  estado: string;
  media_consumo: number;
  consumo_previsto: number;
  tipo_telhado: string;
  area: string;
  rede_atendimento: string;
  ultimo_contato: string | null;
  created_at: string;
  visto: boolean;
  status_nome?: string;
}

interface ScoreResult {
  lead_id: string;
  score: number;
  level: "hot" | "warm" | "cold";
  factors: string[];
  recommendation: string;
}

// Dual-mode AI: tenant OpenAI key first, Lovable gateway as fallback
async function callAI(
  tenantApiKey: string | null,
  lovableApiKey: string | null,
  messages: Array<{ role: string; content: string }>,
  options: { temperature?: number; max_tokens?: number } = {}
): Promise<{ content: string; provider: string }> {
  const { temperature = 0.3, max_tokens = 2000 } = options;

  // 1) Try tenant's own OpenAI key
  if (tenantApiKey) {
    try {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${tenantApiKey}`,
        },
        body: JSON.stringify({
          model: "gpt-4o-mini",
          messages,
          temperature,
          max_tokens,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        return { content: data.choices?.[0]?.message?.content || "", provider: "openai_tenant" };
      }
      console.warn(`[lead-scoring] Tenant OpenAI failed (${res.status}), trying fallback...`);
    } catch (e) {
      console.warn("[lead-scoring] Tenant OpenAI error, trying fallback:", e);
    }
  }

  // 2) Fallback: Lovable AI Gateway
  if (lovableApiKey) {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lovableApiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature,
        max_tokens,
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`AI fallback error: ${res.status} - ${errText}`);
    }
    const data = await res.json();
    return { content: data.choices?.[0]?.message?.content || "", provider: "lovable_fallback" };
  }

  throw new Error("No AI provider available. Configure OpenAI key in Admin > Integrations.");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Missing authorization header" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    const lovableApiKey = Deno.env.get("LOVABLE_API_KEY") || null;

    const userClient = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { leads } = await req.json() as { leads: LeadData[] };

    if (!leads || !Array.isArray(leads) || leads.length === 0) {
      return new Response(
        JSON.stringify({ error: "No leads provided" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`[lead-scoring] Scoring ${leads.length} leads for user ${user.id}`);

    // Resolve tenant's OpenAI key
    const adminClient = createClient(supabaseUrl, serviceKey);
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    let tenantApiKey: string | null = null;
    if (profile?.tenant_id) {
      const { data: keyRow } = await adminClient
        .from("integration_configs")
        .select("api_key")
        .eq("tenant_id", profile.tenant_id)
        .eq("service_key", "openai")
        .eq("is_active", true)
        .single();
      tenantApiKey = keyRow?.api_key || null;
    }

    // Prepare lead summaries for AI analysis
    const leadSummaries = leads.map((lead) => {
      const daysSinceCreation = Math.floor(
        (Date.now() - new Date(lead.created_at).getTime()) / (1000 * 60 * 60 * 24)
      );
      const daysSinceContact = lead.ultimo_contato
        ? Math.floor(
            (Date.now() - new Date(lead.ultimo_contato).getTime()) / (1000 * 60 * 60 * 24)
          )
        : daysSinceCreation;

      return {
        id: lead.id,
        consumo: lead.media_consumo,
        tipo_telhado: lead.tipo_telhado,
        area: lead.area,
        rede: lead.rede_atendimento,
        dias_criacao: daysSinceCreation,
        dias_contato: daysSinceContact,
        visualizado: lead.visto,
        status: lead.status_nome || "Novo",
        cidade: lead.cidade,
        estado: lead.estado,
      };
    });

    const prompt = `Você é um especialista em vendas de energia solar. Analise os leads abaixo e atribua uma pontuação de 0 a 100 para cada um, considerando:

CRITÉRIOS DE PONTUAÇÃO:
- Consumo alto (>400kWh): +30 pontos (cliente com maior economia potencial)
- Consumo médio (200-400kWh): +20 pontos
- Consumo baixo (<200kWh): +10 pontos
- Tipo de telhado favorável (Cerâmico, Fibrocimento): +15 pontos
- Telhado metálico: +10 pontos
- Lead recente (< 3 dias): +15 pontos
- Lead visualizado mas não contatado: -10 pontos
- Muitos dias sem contato (>5 dias): -15 pontos
- Área urbana: +5 pontos
- Rede trifásica (maior potencial): +10 pontos

LEADS PARA ANÁLISE:
${JSON.stringify(leadSummaries, null, 2)}

RESPONDA APENAS em JSON válido, sem markdown, no formato:
{
  "scores": [
    {
      "lead_id": "uuid",
      "score": 0-100,
      "level": "hot" | "warm" | "cold",
      "factors": ["fator positivo 1", "fator negativo 1"],
      "recommendation": "ação recomendada em 1 frase"
    }
  ]
}

Critérios de level:
- hot: score >= 70 (prioridade máxima)
- warm: score 40-69 (acompanhar)
- cold: score < 40 (nutrir)`;

    console.log(`[lead-scoring] Calling AI (tenant_key: ${!!tenantApiKey}, lovable_key: ${!!lovableApiKey})...`);

    const { content, provider } = await callAI(
      tenantApiKey,
      lovableApiKey,
      [{ role: "user", content: prompt }],
      { temperature: 0.3, max_tokens: 2000 }
    );

    console.log(`[lead-scoring] AI response via ${provider}`);

    // Parse the JSON response
    let cleanContent = content.trim();
    if (cleanContent.startsWith("```json")) cleanContent = cleanContent.slice(7);
    if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
    if (cleanContent.endsWith("```")) cleanContent = cleanContent.slice(0, -3);
    cleanContent = cleanContent.trim();

    let scores: ScoreResult[];
    try {
      const parsed = JSON.parse(cleanContent);
      scores = parsed.scores || [];
    } catch (parseError) {
      console.error("[lead-scoring] Failed to parse AI response:", cleanContent);
      scores = leads.map((lead) => {
        const baseScore = Math.min(100, Math.max(0, lead.media_consumo / 5));
        return {
          lead_id: lead.id,
          score: Math.round(baseScore),
          level: baseScore >= 70 ? "hot" : baseScore >= 40 ? "warm" : "cold",
          factors: [`Consumo: ${lead.media_consumo}kWh`],
          recommendation: "Entrar em contato para avaliação",
        } as ScoreResult;
      });
    }

    console.log(`[lead-scoring] Successfully scored ${scores.length} leads via ${provider}`);

    return new Response(
      JSON.stringify({ scores }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("[lead-scoring] Error:", error);
    const errorMessage = error instanceof Error ? error.message : "Internal server error";
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
