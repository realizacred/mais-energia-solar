import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const VALID_ACTIONS = [
  "improve",
  "professional",
  "friendly",
  "expand",
  "summarize",
  "translate_en",
  "translate_es",
] as const;

type Action = (typeof VALID_ACTIONS)[number];

const ACTION_INSTRUCTIONS: Record<Action, string> = {
  improve:
    "Corrija erros de ortografia e gramática. Melhore a clareza mantendo o sentido original.",
  professional:
    "Reescreva em tom profissional e formal, adequado para comunicação comercial.",
  friendly:
    "Reescreva em tom amigável e acolhedor, mantendo profissionalismo.",
  expand:
    "Expanda este texto curto em uma mensagem mais completa e detalhada, mantendo o sentido.",
  summarize: "Resuma esta mensagem de forma concisa, mantendo os pontos principais.",
  translate_en: "Translate this text to English. Return ONLY the translated text.",
  translate_es: "Traduce este texto al español. Devuelve SOLO el texto traducido.",
};

// ── Model → Provider mapping ──
const OPENAI_MODELS = ["gpt-4o-mini", "gpt-4o", "gpt-4.1-mini"];
const GEMINI_MODELS = [
  "gemini-2.0-flash-lite",
  "gemini-2.0-flash",
  "gemini-2.5-flash",
  "gemini-2.5-pro",
];

type Provider = "openai" | "google_gemini";

function resolveProvider(model: string): Provider {
  if (OPENAI_MODELS.includes(model)) return "openai";
  return "google_gemini";
}

const DEFAULT_MODEL = "gemini-2.5-flash";
const MAX_TEXT_LENGTH = 2000;
const AI_TIMEOUT_MS = 8000;

// ── OpenAI call ──
async function callOpenAI(
  apiKey: string,
  model: string,
  action: Action,
  text: string,
  locale: string
): Promise<string> {
  const systemPrompt = `Você é um assistente de escrita para mensagens comerciais em ${locale}.
Reescreva o texto do usuário conforme a instrução.
Retorne APENAS o texto reescrito, sem explicações, sem aspas, sem prefixos.`;

  const userPrompt = `${ACTION_INSTRUCTIONS[action]}\n\nTexto:\n${text}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI_HTTP_${response.status}: ${body}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI_EMPTY_RESPONSE");
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

// ── Gemini call ──
async function callGemini(
  apiKey: string,
  model: string,
  action: Action,
  text: string,
  locale: string
): Promise<string> {
  const systemPrompt = `Você é um assistente de escrita para mensagens comerciais em ${locale}.
Reescreva o texto do usuário conforme a instrução.
Retorne APENAS o texto reescrito, sem explicações, sem aspas, sem prefixos.`;

  const userPrompt = `${ACTION_INSTRUCTIONS[action]}\n\nTexto:\n${text}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

  try {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ text: userPrompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text();
      throw new Error(`AI_HTTP_${response.status}: ${body}`);
    }

    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!content) throw new Error("AI_EMPTY_RESPONSE");
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startMs = Date.now();
  let logAction = "unknown";
  let logTextLength = 0;
  let logStatus = 500;
  let logModel = "none";
  let tenantId = "unknown";
  let userId = "unknown";

  try {
    // ── Auth ──
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      logStatus = 401;
      return new Response(
        JSON.stringify({ error: "Não autorizado" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      logStatus = 401;
      return new Response(
        JSON.stringify({ error: "Sessão inválida" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    userId = user.id;

    // Resolve tenant
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      logStatus = 403;
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado. Contate o administrador." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    tenantId = profile.tenant_id;

    // ── G3: Tenant status enforcement ──
    const supabaseServiceCheck = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const { data: tenantRow } = await supabaseServiceCheck
      .from("tenants")
      .select("status, deleted_at")
      .eq("id", tenantId)
      .single();

    if (!tenantRow || tenantRow.status !== "active" || tenantRow.deleted_at) {
      logStatus = 403;
      return new Response(
        JSON.stringify({ error: "Acesso bloqueado: empresa inativa." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Resolve preferred model from tenant settings ──
    let primaryModel = DEFAULT_MODEL;
    const { data: aiSettings } = await supabase
      .from("wa_ai_settings")
      .select("templates")
      .maybeSingle();

    if (aiSettings?.templates) {
      const tpl = aiSettings.templates as Record<string, any>;
      const configuredModel = tpl?.writing_assistant?.model;
      if (configuredModel && [...OPENAI_MODELS, ...GEMINI_MODELS].includes(configuredModel)) {
        primaryModel = configuredModel;
      }
    }

    const provider = resolveProvider(primaryModel);

    // ── Get tenant API key from integration_configs ──
    // GUARDRAIL: service_role only for rate limit + key fetch
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: keyRow } = await supabaseService
      .from("integration_configs")
      .select("api_key")
      .eq("tenant_id", tenantId)
      .eq("service_key", provider)
      .eq("is_active", true)
      .single();

    if (!keyRow?.api_key) {
      logStatus = 422;
      const providerName = provider === "openai" ? "OpenAI" : "Google Gemini";
      return new Response(
        JSON.stringify({
          error: `Chave da API ${providerName} não configurada. Vá em Admin → Integrações para adicioná-la.`,
        }),
        { status: 422, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Rate limit ──
    const { data: allowed } = await supabaseService.rpc("check_rate_limit", {
      _function_name: "writing-assistant",
      _identifier: user.id,
      _window_seconds: 60,
      _max_requests: 6,
    });

    if (allowed === false) {
      logStatus = 429;
      return new Response(
        JSON.stringify({
          error: "Limite atingido. Aguarde alguns segundos antes de tentar novamente.",
        }),
        { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Parse body ──
    const body = await req.json();
    const { text, action, locale = "pt-BR" } = body;

    if (!text || typeof text !== "string" || text.trim().length < 3) {
      logStatus = 400;
      return new Response(
        JSON.stringify({ error: "Texto deve ter pelo menos 3 caracteres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (text.length > MAX_TEXT_LENGTH) {
      logStatus = 400;
      return new Response(
        JSON.stringify({ error: `Texto muito longo (máx ${MAX_TEXT_LENGTH} caracteres).` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!VALID_ACTIONS.includes(action)) {
      logStatus = 400;
      return new Response(
        JSON.stringify({ error: `Ação inválida: ${action}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logAction = action;
    logTextLength = text.trim().length;

    // ── Call AI ──
    let suggestion: string;
    const callFn = provider === "openai" ? callOpenAI : callGemini;

    try {
      suggestion = await callFn(keyRow.api_key, primaryModel, action, text.trim(), locale);
      logModel = primaryModel;
    } catch (err) {
      console.error(
        `[writing-assistant] ${provider} model failed: ${err instanceof Error ? err.message : "unknown"}`
      );

      const errMsg = err instanceof Error ? err.message : "";
      if (errMsg.includes("AI_HTTP_429")) {
        logStatus = 429;
        return new Response(
          JSON.stringify({ error: "Limite de requisições da IA excedido. Tente novamente em breve." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (errMsg.includes("AI_HTTP_402") || errMsg.includes("AI_HTTP_403")) {
        logStatus = 402;
        return new Response(
          JSON.stringify({ error: "Chave da API inválida ou sem créditos. Verifique em Admin → Integrações." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      logStatus = 502;
      return new Response(
        JSON.stringify({
          error: "Assistente de escrita temporariamente indisponível. Envie sua mensagem normalmente.",
        }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    logStatus = 200;
    return new Response(
      JSON.stringify({ suggestion, model: logModel }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("[writing-assistant] Unexpected error:", e);
    logStatus = 500;
    return new Response(
      JSON.stringify({ error: "Erro interno do assistente de escrita." }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } finally {
    const latencyMs = Date.now() - startMs;
    // Structured log — NEVER logs text content or suggestion
    console.log(
      JSON.stringify({
        fn: "writing-assistant",
        action: logAction,
        text_length: logTextLength,
        latency_ms: latencyMs,
        status: logStatus,
        model: logModel,
        user_id: userId,
        tenant_id: tenantId,
      })
    );
  }
});
