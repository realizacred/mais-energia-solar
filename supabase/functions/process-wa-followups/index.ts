import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// ── Config ──
const MAX_AI_PER_CYCLE = 10;
const AI_TIMEOUT_MS = 5000;
const MAX_PER_INSTANCE = 5; // rate limit: max messages per instance per execution

interface Metrics {
  skipped_lock: boolean;
  claimed_count: number;
  filtered_scenario: number;
  created_count: number;
  sent_count: number;
  ai_approved: number;
  ai_timeouts: number;
  pending_review: number;
  errors: number;
  reconciled: number;
  duration_ms: number;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const startTime = Date.now();
  const metrics: Metrics = {
    skipped_lock: false,
    claimed_count: 0,
    filtered_scenario: 0,
    created_count: 0,
    sent_count: 0,
    ai_approved: 0,
    ai_timeouts: 0,
    pending_review: 0,
    errors: 0,
    reconciled: 0,
    duration_ms: 0,
  };

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // ── Advisory lock ──
    const { data: lockAcquired, error: lockError } = await supabase.rpc("try_followup_lock");
    if (lockError || !lockAcquired) {
      metrics.skipped_lock = true;
      metrics.duration_ms = Date.now() - startTime;
      console.log("[followup] SKIP lock_busy", JSON.stringify(metrics));
      return jsonResponse({ ...metrics, success: true });
    }

    try {
      // ── Step 0: Reconcile ──
      metrics.reconciled = await reconcilePendingFollowups(supabase);

      // ── Step 1: Claim candidates via RPC (single query, no N+1) ──
      const { data: candidates, error: claimErr } = await supabase.rpc("claim_followup_candidates", { _limit: 200 });
      if (claimErr) throw claimErr;
      if (!candidates || candidates.length === 0) {
        metrics.duration_ms = Date.now() - startTime;
        console.log("[followup] OK no_candidates", JSON.stringify(metrics));
        return jsonResponse({ ...metrics, success: true });
      }

      metrics.claimed_count = candidates.length;

      // ── Step 2: Scenario filter (direction-based) ──
      const eligible = candidates.filter((c: any) => {
        if (c.cenario === "equipe_sem_resposta" && c.last_msg_direction !== "in") {
          metrics.filtered_scenario++;
          return false;
        }
        if (c.cenario === "cliente_sem_resposta" && c.last_msg_direction !== "out") {
          metrics.filtered_scenario++;
          return false;
        }
        return true;
      });

      // ── Step 3: Resolve assigned_to from instance when null ──
      const needsOwner = eligible.filter((c: any) => !c.assigned_to);
      if (needsOwner.length > 0) {
        const instanceIds = [...new Set(needsOwner.map((c: any) => c.instance_id).filter(Boolean))];
        if (instanceIds.length > 0) {
          const ownerMap = await resolveInstanceOwners(supabase, instanceIds);
          for (const c of needsOwner) {
            if (!c.assigned_to && c.instance_id) {
              c.assigned_to = ownerMap.get(c.instance_id) || null;
            }
          }
        }
      }

      // ── Step 4: Load AI settings per tenant (batch) ──
      const tenantIds = [...new Set(eligible.map((c: any) => c.tenant_id))];
      const aiSettingsMap = await loadAiSettings(supabase, tenantIds);

      // ── Step 5: Cooldown filter ──
      const afterCooldown = eligible.filter((c: any) => {
        const settings = aiSettingsMap.get(c.tenant_id);
        if (settings?.modo === "desativado") return false;
        // Cooldown is now implicit in claim_followup_candidates via prazo_minutos cutoff
        return true;
      });

      // ── Step 6: Batch INSERT into wa_followup_queue (idempotent via ON CONFLICT) ──
      const toInsert = afterCooldown.map((c: any) => ({
        tenant_id: c.tenant_id,
        rule_id: c.rule_id,
        conversation_id: c.conversation_id,
        status: "pendente",
        tentativa: Number(c.attempt_count) + 1,
        scheduled_at: new Date().toISOString(),
        assigned_to: c.assigned_to,
      }));

      if (toInsert.length > 0) {
        const { error: insertErr } = await supabase
          .from("wa_followup_queue")
          .insert(toInsert)
          .select("id"); // ON CONFLICT handled by partial unique index — duplicates raise, caught below

        if (insertErr) {
          // Unique violation = idempotent skip, not an error
          if (insertErr.code === "23505") {
            console.log("[followup] IDEMPOTENT some duplicates skipped");
          } else {
            throw insertErr;
          }
        }
        metrics.created_count = toInsert.length;
      }

      // ── Step 7: Auto-send with AI gate ──
      const autoSendCandidates = afterCooldown.filter(
        (c: any) => c.envio_automatico && c.mensagem_template
      );

      // Rate limit per instance
      const instanceSendCount = new Map<string, number>();
      let aiProcessed = 0;

      for (const c of autoSendCandidates) {
        // Instance rate limit
        const instCount = instanceSendCount.get(c.instance_id) || 0;
        if (instCount >= MAX_PER_INSTANCE) continue;

        const settings = aiSettingsMap.get(c.tenant_id);
        const baseMessage = (c.mensagem_template as string)
          .replace(/\{nome\}/g, c.cliente_nome || "")
          .replace(/\{vendedor\}/g, "")
          .replace(/\{consultor\}/g, "");

        let finalMessage = baseMessage;
        let status: string = "enviado";

        // AI gate (only if mode is not desativado and within budget)
        if (settings?.modo !== "desativado" && aiProcessed < MAX_AI_PER_CYCLE) {
          aiProcessed++;
          const gateResult = await aiGateCheck(supabase, c, baseMessage, settings);

          if (gateResult.timeout) {
            // Timeout → pendente_revisao, NEVER auto-send
            metrics.ai_timeouts++;
            metrics.pending_review++;
            await updateFollowupStatus(supabase, c.conversation_id, c.rule_id, "pendente_revisao",
              `[IA timeout] ${baseMessage}`);
            continue;
          }

          const threshold = settings?.followup_confidence_threshold ?? 60;
          if (gateResult.confidence < threshold) {
            metrics.pending_review++;
            await updateFollowupStatus(supabase, c.conversation_id, c.rule_id, "pendente_revisao",
              `[IA: ${gateResult.reason}] ${gateResult.adjustedMessage || baseMessage}`);
            continue;
          }

          metrics.ai_approved++;
          if (gateResult.adjustedMessage) {
            finalMessage = gateResult.adjustedMessage;
          }
        } else if (settings?.modo !== "desativado" && aiProcessed >= MAX_AI_PER_CYCLE) {
          // Budget exhausted → leave as pendente for next cycle
          continue;
        }

        // ── Send message ──
        try {
          const { data: msg } = await supabase
            .from("wa_messages")
            .insert({
              conversation_id: c.conversation_id,
              direction: "out",
              message_type: "text",
              content: finalMessage,
              is_internal_note: false,
              status: "pending",
              tenant_id: c.tenant_id,
              source: "followup",
            })
            .select("id")
            .single();

          if (msg && c.remote_jid && c.instance_id) {
            await supabase.from("wa_outbox").insert({
              instance_id: c.instance_id,
              conversation_id: c.conversation_id,
              message_id: msg.id,
              remote_jid: c.remote_jid,
              message_type: "text",
              content: finalMessage,
              status: "pending",
              tenant_id: c.tenant_id,
            });

            await updateFollowupStatus(supabase, c.conversation_id, c.rule_id, "enviado", finalMessage);
            instanceSendCount.set(c.instance_id, instCount + 1);
            metrics.sent_count++;
          }
        } catch (sendErr: any) {
          metrics.errors++;
          console.error(`[followup] SEND_ERROR conv=${c.conversation_id}`, sendErr.message);
          await updateFollowupStatus(supabase, c.conversation_id, c.rule_id, "falhou",
            `[erro envio] ${sendErr.message}`);
        }
      }

      // ── Trigger outbox ──
      if (metrics.sent_count > 0) {
        await supabase.functions.invoke("process-wa-outbox").catch(() => {});
      }
    } finally {
      // Always release lock
      try { await supabase.rpc("release_followup_lock"); } catch { /* best effort */ }
    }

    metrics.duration_ms = Date.now() - startTime;
    console.log("[followup] OK", JSON.stringify(metrics));
    return jsonResponse({ ...metrics, success: true });
  } catch (error: any) {
    metrics.errors++;
    metrics.duration_ms = Date.now() - startTime;
    console.error("[followup] FATAL", error.message, JSON.stringify(metrics));

    // Best-effort lock release
    try {
      const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
      await sb.rpc("release_followup_lock");
    } catch { /* best effort */ }

    return jsonResponse({ ...metrics, error: error.message }, 500);
  }
});

// ─────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function updateFollowupStatus(
  supabase: any,
  conversationId: string,
  ruleId: string,
  status: string,
  message?: string
) {
  const update: any = { status };
  if (status === "enviado") {
    update.sent_at = new Date().toISOString();
  }
  if (message) {
    update.mensagem_enviada = message;
  }
  await supabase
    .from("wa_followup_queue")
    .update(update)
    .eq("conversation_id", conversationId)
    .eq("rule_id", ruleId)
    .eq("status", "pendente");
}

async function resolveInstanceOwners(
  supabase: any,
  instanceIds: string[]
): Promise<Map<string, string>> {
  const ownerMap = new Map<string, string>();

  const [{ data: instances }, { data: links }] = await Promise.all([
    supabase.from("wa_instances").select("id, owner_user_id").in("id", instanceIds),
    supabase
      .from("wa_instance_consultores")
      .select("instance_id, consultor_id, consultores:consultor_id(user_id)")
      .in("instance_id", instanceIds),
  ]);

  if (instances) {
    for (const inst of instances) {
      let userId = inst.owner_user_id || null;
      if (!userId && links) {
        const link = links.find((l: any) => l.instance_id === inst.id);
        userId = (link?.consultores as any)?.user_id || null;
      }
      if (userId) ownerMap.set(inst.id, userId);
    }
  }

  return ownerMap;
}

async function loadAiSettings(
  supabase: any,
  tenantIds: string[]
): Promise<Map<string, any>> {
  const map = new Map<string, any>();
  if (tenantIds.length === 0) return map;

  const { data } = await supabase
    .from("wa_ai_settings")
    .select("tenant_id, modo, modelo_preferido, temperature, max_tokens, followup_cooldown_hours, followup_confidence_threshold")
    .in("tenant_id", tenantIds);

  const defaults = {
    modo: "assistido",
    followup_cooldown_hours: 4,
    followup_confidence_threshold: 60,
    modelo_preferido: "gpt-4o-mini",
    temperature: 0.5,
  };

  for (const tid of tenantIds) {
    const found = data?.find((s: any) => s.tenant_id === tid);
    map.set(tid, found || defaults);
  }

  return map;
}

// ─────────────────────────────────────────────────────
// AI Gate with hard timeout
// ─────────────────────────────────────────────────────

interface AIGateResult {
  confidence: number;
  reason: string;
  adjustedMessage?: string;
  timeout: boolean;
}

async function aiGateCheck(
  supabase: any,
  conv: any,
  proposedMessage: string,
  aiSettings: any
): Promise<AIGateResult> {
  try {
    const { data: keyRow } = await supabase
      .from("integration_configs")
      .select("api_key")
      .eq("tenant_id", conv.tenant_id)
      .eq("service_key", "openai")
      .eq("is_active", true)
      .single();

    if (!keyRow?.api_key) {
      // No key → pendente_revisao (safe default, never auto-send without AI)
      return { confidence: 0, reason: "Sem chave OpenAI — requer revisão manual", timeout: false };
    }

    const { data: messages = [] } = await supabase
      .from("wa_messages")
      .select("direction, content, created_at, source")
      .eq("conversation_id", conv.conversation_id)
      .eq("is_internal_note", false)
      .order("created_at", { ascending: false })
      .limit(10);

    const chatHistory = messages
      .reverse()
      .map((m: any) => `[${m.direction === "in" ? "cliente" : "consultor"}${m.source !== "human" ? ` (${m.source})` : ""}]: ${m.content || "(mídia)"}`)
      .join("\n");

    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const hoursSinceLast = lastMsg
      ? Math.round((Date.now() - new Date(lastMsg.created_at).getTime()) / (1000 * 60 * 60))
      : null;

    const systemPrompt = `Você é um auditor de follow-up para energia solar. Analise o contexto e decida se o follow-up proposto é adequado.

Retorne APENAS um JSON:
{
  "confidence": 0-100,
  "reason": "justificativa curta",
  "adjusted_message": "mensagem ajustada (ou null se a original está boa)"
}

REGRAS DE BLOQUEIO (confidence < 30):
- Cliente acabou de responder e aguarda resposta humana
- Conversa encerrada naturalmente (recusa, desistência)
- Muitos follow-ups automáticos consecutivos
- Tom do cliente indica irritação

REGRAS DE CAUTELA (confidence 30-70):
- Contexto ambíguo
- Mensagem genérica demais
- Melhor esperar mais tempo

REGRAS DE APROVAÇÃO (confidence > 70):
- Cliente demonstrou interesse sem finalizar
- Proposta pendente sem retorno
- Timing adequado`;

    const userPrompt = `CONTEXTO:
- Cliente: ${conv.cliente_nome || "Desconhecido"}
- Última mensagem: ${conv.last_msg_direction === "in" ? "do cliente" : "do consultor"} há ${hoursSinceLast ?? "?"} horas
- Cenário: ${conv.cenario}
- Tentativa: ${conv.attempt_count + 1}/${conv.max_tentativas}

HISTÓRICO:
${chatHistory || "(sem mensagens)"}

MENSAGEM PROPOSTA:
${proposedMessage}

Avalie e retorne o JSON.`;

    const model = aiSettings?.modelo_preferido || "gpt-4o-mini";
    const temperature = aiSettings?.temperature ?? 0.3;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);

    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
          max_tokens: 300,
          temperature,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!response.ok) {
        return { confidence: 0, reason: `OpenAI HTTP ${response.status}`, timeout: false };
      }

      const data = await response.json();
      const raw = data.choices?.[0]?.message?.content?.trim();
      if (!raw) return { confidence: 0, reason: "Resposta vazia da IA", timeout: false };

      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        confidence: Math.min(100, Math.max(0, parsed.confidence || 0)),
        reason: parsed.reason || "Sem justificativa",
        adjustedMessage: parsed.adjusted_message || undefined,
        timeout: false,
      };
    } catch (fetchErr: any) {
      clearTimeout(timeout);
      if (fetchErr.name === "AbortError") {
        return { confidence: 0, reason: "Timeout IA (5s)", timeout: true };
      }
      return { confidence: 0, reason: `Erro fetch: ${fetchErr.message}`, timeout: false };
    }
  } catch (err: any) {
    return { confidence: 0, reason: `Erro: ${err.message}`, timeout: false };
  }
}

// ─────────────────────────────────────────────────────
// Reconcile: mark follow-ups as responded
// ─────────────────────────────────────────────────────

async function reconcilePendingFollowups(supabase: any): Promise<number> {
  const { data: pending } = await supabase
    .from("wa_followup_queue")
    .select("id, conversation_id, created_at, rule_id, rule:wa_followup_rules(cenario)")
    .in("status", ["pendente", "pendente_revisao", "enviado"]);

  if (!pending || pending.length === 0) return 0;

  const convIds = [...new Set(pending.map((fu: any) => fu.conversation_id))];

  const { data: recentMessages } = await supabase
    .from("wa_messages")
    .select("conversation_id, created_at, direction")
    .in("conversation_id", convIds)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: false });

  if (!recentMessages) return 0;

  const latestIncoming = new Map<string, string>();
  const latestOutgoing = new Map<string, string>();
  for (const msg of recentMessages) {
    if (msg.direction === "in" && !latestIncoming.has(msg.conversation_id)) {
      latestIncoming.set(msg.conversation_id, msg.created_at);
    }
    if (msg.direction === "out" && !latestOutgoing.has(msg.conversation_id)) {
      latestOutgoing.set(msg.conversation_id, msg.created_at);
    }
  }

  const toMark: string[] = [];
  for (const fu of pending) {
    const cenario = (fu.rule as any)?.cenario;
    if (cenario === "equipe_sem_resposta") {
      const latestOut = latestOutgoing.get(fu.conversation_id);
      if (latestOut && latestOut > fu.created_at) { toMark.push(fu.id); continue; }
    }
    const latestIn = latestIncoming.get(fu.conversation_id);
    if (latestIn && latestIn > fu.created_at) { toMark.push(fu.id); }
  }

  if (toMark.length > 0) {
    await supabase
      .from("wa_followup_queue")
      .update({ status: "respondido", responded_at: new Date().toISOString() })
      .in("id", toMark);
  }

  return toMark.length;
}
