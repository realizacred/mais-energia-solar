/**
 * Helper compartilhado de chamada de IA SEM Lovable AI Gateway.
 * Usa Gemini direto (GEMINI_API_KEY) com fallback opcional para OpenAI (OPENAI_API_KEY).
 *
 * Mantém uma resposta compatível com o formato OpenAI Chat Completions
 * para minimizar refatoração nos call sites:
 *   { choices: [{ message: { content: string } }], usage: {...} }
 */

export interface AiMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface AiCallOptions {
  messages: AiMessage[];
  /** Modelo lógico — "flash" | "pro". Mapeado por provedor. */
  tier?: "flash" | "pro";
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
  signal?: AbortSignal;
}

export interface AiCallResponse {
  choices: Array<{ message: { content: string } }>;
  usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
  provider: "gemini" | "openai";
  model: string;
}

const GEMINI_MODELS: Record<string, string> = {
  flash: "gemini-2.5-flash",
  pro: "gemini-2.5-pro",
};

const OPENAI_MODELS: Record<string, string> = {
  flash: "gpt-4o-mini",
  pro: "gpt-4o",
};

function joinSystem(messages: AiMessage[]): { system: string; user: string } {
  const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
  const usr = messages
    .filter((m) => m.role !== "system")
    .map((m) => (m.role === "user" ? m.content : `Assistente: ${m.content}`))
    .join("\n\n");
  return { system: sys, user: usr };
}

async function callGemini(opts: AiCallOptions): Promise<AiCallResponse> {
  const apiKey = Deno.env.get("GEMINI_API_KEY");
  if (!apiKey) throw new Error("GEMINI_API_KEY não configurada");

  const model = GEMINI_MODELS[opts.tier ?? "flash"];
  const { system, user } = joinSystem(opts.messages);

  const body: any = {
    contents: [{ role: "user", parts: [{ text: user }] }],
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      maxOutputTokens: opts.maxTokens ?? 2048,
    },
  };
  if (system) body.systemInstruction = { parts: [{ text: system }] };
  if (opts.jsonMode) body.generationConfig.responseMimeType = "application/json";

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: opts.signal,
    },
  );
  if (!res.ok) throw new Error(`Gemini error ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  const content = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ?? "";
  const meta = data.usageMetadata ?? {};

  return {
    choices: [{ message: { content } }],
    usage: {
      prompt_tokens: meta.promptTokenCount ?? 0,
      completion_tokens: meta.candidatesTokenCount ?? 0,
      total_tokens: meta.totalTokenCount ?? 0,
    },
    provider: "gemini",
    model,
  };
}

async function callOpenAI(opts: AiCallOptions): Promise<AiCallResponse> {
  const apiKey = Deno.env.get("OPENAI_API_KEY");
  if (!apiKey) throw new Error("OPENAI_API_KEY não configurada");

  const model = OPENAI_MODELS[opts.tier ?? "flash"];
  const body: any = {
    model,
    messages: opts.messages,
    temperature: opts.temperature ?? 0.7,
    max_tokens: opts.maxTokens ?? 2048,
  };
  if (opts.jsonMode) body.response_format = { type: "json_object" };

  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: opts.signal,
  });
  if (!res.ok) throw new Error(`OpenAI error ${res.status}: ${(await res.text()).slice(0, 200)}`);

  const data = await res.json();
  return {
    choices: [{ message: { content: data.choices?.[0]?.message?.content ?? "" } }],
    usage: data.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
    provider: "openai",
    model,
  };
}

/**
 * Tenta Gemini → fallback OpenAI. Lança se nenhum estiver configurado / ambos falharem.
 */
export async function callAi(opts: AiCallOptions): Promise<AiCallResponse> {
  const hasGemini = !!Deno.env.get("GEMINI_API_KEY");
  const hasOpenAI = !!Deno.env.get("OPENAI_API_KEY");

  if (!hasGemini && !hasOpenAI) {
    throw new Error("Nenhuma API key de IA configurada (GEMINI_API_KEY ou OPENAI_API_KEY)");
  }

  if (hasGemini) {
    try {
      return await callGemini(opts);
    } catch (err) {
      if (!hasOpenAI) throw err;
      console.warn("[ai] Gemini falhou, fallback OpenAI:", (err as Error).message);
    }
  }
  return callOpenAI(opts);
}
