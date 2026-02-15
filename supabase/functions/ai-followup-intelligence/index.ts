import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const AI_TIMEOUT = 8000;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Auth: resolve tenant from JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) return error("Unauthorized", 401);

    const { data: { user }, error: authErr } = await sb.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authErr || !user) return error("Unauthorized", 401);

    const { data: profile } = await sb
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();
    if (!profile?.tenant_id) return error("Tenant not found", 403);

    const tenantId = profile.tenant_id;

    // Check plan feature
    const { data: sub } = await sb
      .from("subscriptions")
      .select("plan_id")
      .eq("tenant_id", tenantId)
      .single();

    if (sub?.plan_id) {
      const { data: feat } = await sb
        .from("plan_features")
        .select("enabled")
        .eq("plan_id", sub.plan_id)
        .eq("feature_key", "ai_followup")
        .single();

      if (feat && !feat.enabled) {
        return error("AI follow-up não disponível no seu plano. Upgrade para Pro ou Enterprise.", 403);
      }
    }

    const body = await req.json();
    const { action, conversation_id } = body;

    if (!conversation_id) return error("conversation_id required", 400);

    // Verify conversation belongs to tenant
    const { data: conv } = await sb
      .from("wa_conversations")
      .select("id, cliente_nome, cliente_telefone, remote_jid, instance_id, assigned_to, status, last_message_at, created_at")
      .eq("id", conversation_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!conv) return error("Conversation not found", 404);

    // Load conversation history
    const { data: msgs = [] } = await sb
      .from("wa_messages")
      .select("direction, content, created_at, source, message_type")
      .eq("conversation_id", conversation_id)
      .eq("is_internal_note", false)
      .order("created_at", { ascending: false })
      .limit(20);

    const history = msgs.reverse();

    // Load AI settings
    const { data: aiSettings } = await sb
      .from("wa_ai_settings")
      .select("modo, modelo_preferido, temperature, max_tokens")
      .eq("tenant_id", tenantId)
      .single();

    // Load AI branding
    const { data: tenant } = await sb
      .from("tenants")
      .select("nome, tenant_config")
      .eq("id", tenantId)
      .single();

    const aiName = (tenant?.tenant_config as any)?.ai_name || "Assistente IA";

    // Get OpenAI key
    const { data: keyData } = await sb
      .from("integration_configs")
      .select("api_key")
      .eq("tenant_id", tenantId)
      .eq("service_key", "openai")
      .eq("is_active", true)
      .single();

    if (!keyData?.api_key) {
      return error("Chave OpenAI não configurada. Configure em Integrações.", 400);
    }

    const model = aiSettings?.modelo_preferido || "gpt-4o-mini";
    const temperature = aiSettings?.temperature ?? 0.5;

    // Format history for AI
    const histText = history
      .map((m: any) => `[${m.direction === "in" ? "Cliente" : "Consultor"}${m.source !== "human" ? ` (${m.source})` : ""}]: ${m.content || `(${m.message_type})`}`)
      .join("\n");

    const lastMsg = history.length ? history[history.length - 1] : null;
    const hoursSinceLastMsg = lastMsg
      ? Math.round((Date.now() - new Date(lastMsg.created_at).getTime()) / 3600000)
      : null;

    // Load follow-up history for this conversation
    const { data: fuLogs = [] } = await sb
      .from("wa_followup_logs")
      .select("action, ai_confidence, ai_reason, created_at, tentativa")
      .eq("conversation_id", conversation_id)
      .order("created_at", { ascending: false })
      .limit(5);

    const fuContext = fuLogs.length
      ? `\nFollow-ups anteriores: ${fuLogs.map((l: any) => `${l.action}(conf:${l.ai_confidence ?? "?"}, #${l.tentativa})`).join(", ")}`
      : "";

    switch (action) {
      case "generate_message": {
        const { cenario, tentativa = 1 } = body;
        const result = await callAI(keyData.api_key, model, temperature, {
          system: `Você é ${aiName}, especialista em energia solar. Gere uma mensagem de follow-up natural e personalizada para WhatsApp.

REGRAS:
- Mensagem curta (máx 3 frases)
- Tom amigável e profissional
- NÃO use emojis excessivos (máx 1-2)
- Mencione o nome do cliente se disponível
- Adapte ao contexto da conversa
- Se o cliente demonstrou interesse em algo específico, mencione
- NUNCA pareça robótico ou genérico

Retorne JSON: {"message":"...","confidence":0-100,"reasoning":"...","suggested_delay_minutes":número}`,
          user: `Cliente: ${conv.cliente_nome || "?"} | Cenário: ${cenario || "cliente_sem_resposta"} | Tentativa: ${tentativa} | Última msg há: ${hoursSinceLastMsg ?? "?"}h${fuContext}

HISTÓRICO:
${histText || "(vazio)"}`,
        });
        return json(result);
      }

      case "classify_urgency": {
        const result = await callAI(keyData.api_key, model, temperature, {
          system: `Classificador de urgência para follow-up em vendas de energia solar.
Analise o contexto e retorne JSON: {"urgency":"critical"|"high"|"medium"|"low","score":0-100,"reasons":["..."],"recommended_action":"..."}

Critérios:
- CRITICAL (80-100): Cliente pediu proposta/preço, demonstrou intenção clara de compra, conversa ativa recente
- HIGH (60-79): Cliente fez perguntas técnicas, solicitou visita, mencionou conta de luz alta
- MEDIUM (40-59): Interação moderada, interesse genérico, conversa esfriando
- LOW (0-39): Interação mínima, lead frio, sem sinais de interesse`,
          user: `Cliente: ${conv.cliente_nome || "?"} | Última msg há: ${hoursSinceLastMsg ?? "?"}h | Status: ${conv.status}${fuContext}

HISTÓRICO:
${histText || "(vazio)"}`,
        });
        return json(result);
      }

      case "suggest_timing": {
        // Analyze response patterns from logs
        const { data: responseLogs = [] } = await sb
          .from("wa_followup_logs")
          .select("action, created_at, responded_at, response_time_minutes")
          .eq("tenant_id", tenantId)
          .in("action", ["sent", "responded"])
          .order("created_at", { ascending: false })
          .limit(50);

        const avgResponseTime = responseLogs
          .filter((l: any) => l.response_time_minutes != null)
          .reduce((acc: number, l: any, _: number, arr: any[]) => acc + l.response_time_minutes / arr.length, 0);

        const result = await callAI(keyData.api_key, model, 0.3, {
          system: `Analista de timing para follow-up solar. Com base no histórico e padrões de resposta, sugira o melhor momento para enviar o follow-up.

Retorne JSON: {"best_hour":0-23,"best_day_of_week":"seg"|"ter"|"qua"|"qui"|"sex"|"sab","delay_minutes":número,"reasoning":"...","confidence":0-100}

Considere:
- Horário comercial é preferível (8h-18h)
- Evite fins de semana para B2B
- Analise quando o cliente costuma responder
- Follow-ups muito frequentes irritam`,
          user: `Cliente: ${conv.cliente_nome || "?"} | Última msg há: ${hoursSinceLastMsg ?? "?"}h
Tempo médio de resposta no tenant: ${Math.round(avgResponseTime) || "sem dados"}min
Respostas recentes: ${responseLogs.length} registros${fuContext}

HISTÓRICO RECENTE:
${histText || "(vazio)"}`,
        });
        return json(result);
      }

      case "summarize": {
        const result = await callAI(keyData.api_key, model, 0.3, {
          system: `Resumidor de conversas de vendas solar. Gere um resumo executivo conciso para o consultor.

Retorne JSON: {"summary":"...","key_interests":["..."],"objections":["..."],"next_steps":["..."],"client_sentiment":"positive"|"neutral"|"negative"|"unknown","deal_potential":"high"|"medium"|"low"}`,
          user: `Cliente: ${conv.cliente_nome || "?"} | Criada em: ${conv.created_at} | Última msg há: ${hoursSinceLastMsg ?? "?"}h${fuContext}

HISTÓRICO COMPLETO:
${histText || "(vazio)"}`,
        });
        return json(result);
      }

      default:
        return error(`Unknown action: ${action}`, 400);
    }
  } catch (e: any) {
    console.error("[ai-followup-intelligence] ERROR:", e.message);
    return error(e.message, 500);
  }
});

async function callAI(
  apiKey: string,
  model: string,
  temperature: number,
  prompt: { system: string; user: string }
): Promise<any> {
  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), AI_TIMEOUT);

  try {
    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: prompt.system },
          { role: "user", content: prompt.user },
        ],
        max_tokens: 500,
        temperature,
      }),
      signal: ac.signal,
    });
    clearTimeout(to);

    if (!r.ok) {
      const txt = await r.text();
      throw new Error(`OpenAI HTTP ${r.status}: ${txt.slice(0, 200)}`);
    }

    const d = await r.json();
    const raw = d.choices?.[0]?.message?.content?.trim();
    if (!raw) throw new Error("Empty AI response");

    const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    return JSON.parse(cleaned);
  } catch (e: any) {
    clearTimeout(to);
    if (e.name === "AbortError") throw new Error("AI timeout");
    throw e;
  }
}

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function error(msg: string, status: number) {
  return new Response(JSON.stringify({ error: msg }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
