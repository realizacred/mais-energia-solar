import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
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

const PRIMARY_MODEL = "google/gemini-2.5-flash";
const FALLBACK_MODEL = "google/gemini-2.5-flash-lite";
const AI_GATEWAY_URL = "https://ai.gateway.lovable.dev/v1/chat/completions";
const MAX_TEXT_LENGTH = 2000;
const AI_TIMEOUT_MS = 8000;

async function callAI(
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
    const response = await fetch(AI_GATEWAY_URL, {
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
        stream: false,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const status = response.status;
      const body = await response.text();
      throw new Error(`AI_HTTP_${status}: ${body}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) throw new Error("AI_EMPTY_RESPONSE");
    return content.trim();
  } finally {
    clearTimeout(timeout);
  }
}

serve(async (req) => {
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

    // Resolve tenant — profiles.user_id is the FK to auth.users.id
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.tenant_id) {
      console.error(
        `[writing-assistant] tenant resolution failed for user=${user.id}: ${profileError?.message || "no profile"}`
      );
      logStatus = 403;
      return new Response(
        JSON.stringify({ error: "Perfil não encontrado. Contate o administrador." }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    tenantId = profile.tenant_id;

    // ── Rate limit ──
    // GUARDRAIL: service_role client is used EXCLUSIVELY for check_rate_limit RPC.
    // It bypasses RLS by design — DO NOT reuse for any data query.
    // If you need tenant-scoped data, use the user-scoped `supabase` client above.
    const supabaseService = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

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
        JSON.stringify({
          error: `Texto muito longo (máx ${MAX_TEXT_LENGTH} caracteres).`,
        }),
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

    // ── API Key ──
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // ── Call AI with fallback ──
    let suggestion: string;
    try {
      suggestion = await callAI(LOVABLE_API_KEY, PRIMARY_MODEL, action, text.trim(), locale);
      logModel = PRIMARY_MODEL;
    } catch (primaryError) {
      console.warn(
        `[writing-assistant] Primary model failed: ${primaryError instanceof Error ? primaryError.message : "unknown"}`
      );
      try {
        suggestion = await callAI(LOVABLE_API_KEY, FALLBACK_MODEL, action, text.trim(), locale);
        logModel = FALLBACK_MODEL;
      } catch (fallbackError) {
        console.error(
          `[writing-assistant] Fallback model also failed: ${fallbackError instanceof Error ? fallbackError.message : "unknown"}`
        );

        // Check for specific error codes
        const errMsg =
          fallbackError instanceof Error ? fallbackError.message : "";
        if (errMsg.includes("AI_HTTP_429")) {
          logStatus = 429;
          return new Response(
            JSON.stringify({
              error: "Limite de requisições de IA excedido. Tente novamente em breve.",
            }),
            { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        if (errMsg.includes("AI_HTTP_402")) {
          logStatus = 402;
          return new Response(
            JSON.stringify({ error: "Créditos de IA esgotados." }),
            { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }

        logStatus = 502;
        return new Response(
          JSON.stringify({
            error:
              "Assistente de escrita temporariamente indisponível. Envie sua mensagem normalmente.",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
