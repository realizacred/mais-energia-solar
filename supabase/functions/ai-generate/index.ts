import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Tabela de preços USD por 1K tokens
const PRICING: Record<string, Record<string, { input: number; output: number }>> = {
  gemini: {
    "gemini-2.0-flash": { input: 0.0001, output: 0.0004 },
    "gemini-1.5-pro": { input: 0.00125, output: 0.005 },
    "gemini-1.5-flash": { input: 0.000075, output: 0.0003 },
  },
  openai: {
    "gpt-4o": { input: 0.0025, output: 0.01 },
    "gpt-4o-mini": { input: 0.00015, output: 0.0006 },
    "gpt-4-turbo": { input: 0.01, output: 0.03 },
  },
};

interface AIResponse {
  content: string;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
}

interface RequestBody {
  systemPrompt: string;
  userPrompt: string;
  functionName: string;
  userId: string;
  tenantId: string;
}

// Lovable Gateway removido — apenas Gemini direto e OpenAI direto.

async function callGemini(model: string, system: string, user: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${system}\n\n${user}` }] }],
        generationConfig: { temperature: 0.7, maxOutputTokens: 4096 },
      }),
    }
  );
  if (!res.ok) throw new Error(`Gemini error: ${res.status} - ${await res.text()}`);
  const data = await res.json();
  const meta = data.usageMetadata || {};
  return {
    content: data.candidates?.[0]?.content?.parts?.[0]?.text || "",
    usage: {
      prompt_tokens: meta.promptTokenCount || 0,
      completion_tokens: meta.candidatesTokenCount || 0,
      total_tokens: meta.totalTokenCount || 0,
    },
  };
}

async function callOpenAI(model: string, system: string, user: string): Promise<AIResponse> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      temperature: 0.7,
      max_tokens: 4096,
    }),
  });
  if (!res.ok) throw new Error(`OpenAI error: ${res.status} - ${await res.text()}`);
  const data = await res.json();
  return {
    content: data.choices[0]?.message?.content || "",
    usage: data.usage || { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body: RequestBody = await req.json();
    const { systemPrompt, userPrompt, functionName, userId, tenantId } = body;

    if (!systemPrompt || !userPrompt || !functionName || !userId || !tenantId) {
      throw new Error("Campos obrigatórios: systemPrompt, userPrompt, functionName, userId, tenantId");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // 1. Buscar configuração do tenant
    const { data: providerConfig } = await supabase
      .from("ai_provider_config")
      .select("active_provider, active_model, fallback_enabled")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    let provider = providerConfig?.active_provider || "lovable_gateway";
    let model = providerConfig?.active_model || "google/gemini-2.5-flash";
    const fallbackEnabled = providerConfig?.fallback_enabled ?? true;
    let isFallback = false;

    // 2. Verificar se API key existe para o provedor
    const hasKey = (p: string) => {
      if (p === "lovable_gateway") return !!Deno.env.get("LOVABLE_API_KEY");
      if (p === "gemini") return !!Deno.env.get("GEMINI_API_KEY");
      if (p === "openai") return !!Deno.env.get("OPENAI_API_KEY");
      return false;
    };

    if (provider !== "lovable_gateway" && !hasKey(provider)) {
      if (fallbackEnabled) {
        console.log(`[ai-generate] API key ausente para ${provider} — usando fallback`);
        provider = "lovable_gateway";
        model = "google/gemini-2.5-flash";
        isFallback = true;
      } else {
        throw new Error(`API key não configurada para ${provider}`);
      }
    }

    // 3. Chamar provedor com fallback automático
    let result: AIResponse;
    try {
      if (provider === "gemini") result = await callGemini(model, systemPrompt, userPrompt);
      else if (provider === "openai") result = await callOpenAI(model, systemPrompt, userPrompt);
      else result = await callLovableGateway(model, systemPrompt, userPrompt);
    } catch (err) {
      if (fallbackEnabled && provider !== "lovable_gateway") {
        console.log(`[ai-generate] Erro em ${provider} — fallback para Lovable Gateway:`, err);
        provider = "lovable_gateway";
        model = "google/gemini-2.5-flash";
        isFallback = true;
        result = await callLovableGateway(model, systemPrompt, userPrompt);
      } else {
        throw err;
      }
    }

    // 4. Calcular custo e registrar log
    const pricing = PRICING[provider]?.[model] || { input: 0, output: 0 };
    const estimatedCost =
      (result.usage.prompt_tokens / 1000) * pricing.input +
      (result.usage.completion_tokens / 1000) * pricing.output;

    await supabase.from("ai_usage_logs").insert({
      tenant_id: tenantId,
      user_id: userId,
      function_name: functionName,
      provider,
      model,
      prompt_tokens: result.usage.prompt_tokens,
      completion_tokens: result.usage.completion_tokens,
      total_tokens: result.usage.total_tokens,
      estimated_cost_usd: estimatedCost,
      is_fallback: isFallback,
    });

    return new Response(
      JSON.stringify({
        content: result.content,
        provider,
        model,
        is_fallback: isFallback,
        usage: { ...result.usage, estimated_cost_usd: estimatedCost },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("[ai-generate] error:", error);
    return new Response(
      JSON.stringify({ error: error?.message || "Erro interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
