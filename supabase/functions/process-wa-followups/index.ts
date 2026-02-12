import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    const now = new Date().toISOString();

    // ── Step 0: Reconcile pending follow-ups FIRST ──
    const reconciled = await reconcilePendingFollowups(supabase, now);

    // ── Step 1: Fetch all active rules ──
    const { data: rules, error: rulesError } = await supabase
      .from("wa_followup_rules")
      .select("*")
      .eq("ativo", true);

    if (rulesError) throw rulesError;
    if (!rules || rules.length === 0) {
      return new Response(
        JSON.stringify({ message: "No active rules", processed: 0, reconciled }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Load AI settings per tenant for cooldown + confidence ──
    const tenantIds = [...new Set(rules.map((r: any) => r.tenant_id))];
    const aiSettingsMap = new Map<string, any>();
    for (const tid of tenantIds) {
      const { data: settings } = await supabase
        .from("wa_ai_settings")
        .select("modo, modelo_preferido, temperature, max_tokens, followup_cooldown_hours, followup_confidence_threshold")
        .eq("tenant_id", tid)
        .maybeSingle();
      aiSettingsMap.set(tid, settings || {
        modo: "assistido",
        followup_cooldown_hours: 4,
        followup_confidence_threshold: 60,
        modelo_preferido: "gpt-4o-mini",
        temperature: 0.5,
      });
    }

    let totalCreated = 0;
    let totalSent = 0;
    let totalBlocked = 0;

    for (const rule of rules) {
      const aiSettings = aiSettingsMap.get(rule.tenant_id);
      // If AI mode is disabled, skip all follow-up processing for this tenant
      if (aiSettings?.modo === "desativado") continue;

      const result = await processRule(supabase, rule, aiSettings);
      totalCreated += result.created;
      totalSent += result.sent;
      totalBlocked += result.blocked;
    }

    // ── Trigger outbox if messages were sent ──
    if (totalSent > 0) {
      await supabase.functions.invoke("process-wa-outbox").catch(() => {});
    }

    return new Response(
      JSON.stringify({
        success: true,
        created: totalCreated,
        sent: totalSent,
        blocked: totalBlocked,
        reconciled,
        rules_processed: rules.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("process-wa-followups error:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// ─────────────────────────────────────────────────────
// Process a single rule with cooldown + AI gate
// ─────────────────────────────────────────────────────
async function processRule(
  supabase: any,
  rule: any,
  aiSettings: any
): Promise<{ created: number; sent: number; blocked: number }> {
  const statusFilter = rule.status_conversa || ["open"];
  const cooldownHours = aiSettings?.followup_cooldown_hours ?? 4;
  const cutoffDate = new Date(
    Date.now() - rule.prazo_minutos * 60 * 1000
  ).toISOString();

  // ── Find matching conversations ──
  const { data: conversations, error: convError } = await supabase
    .from("wa_conversations")
    .select("id, last_message_at, assigned_to, cliente_nome, cliente_telefone, remote_jid, instance_id, tenant_id")
    .eq("tenant_id", rule.tenant_id)
    .in("status", statusFilter)
    .lt("last_message_at", cutoffDate);

  if (convError) {
    console.error(`Error fetching convs for rule ${rule.id}:`, convError);
    return { created: 0, sent: 0, blocked: 0 };
  }
  if (!conversations || conversations.length === 0) return { created: 0, sent: 0, blocked: 0 };

  const convIds = conversations.map((c: any) => c.id);

  // ── Get last message direction (for scenario filtering) ──
  const lastMsgMap = new Map<string, string>();
  if (rule.cenario !== "conversa_parada") {
    const directionPromises = convIds.map(async (convId: string) => {
      const { data: lastMsg } = await supabase
        .from("wa_messages")
        .select("direction")
        .eq("conversation_id", convId)
        .eq("is_internal_note", false)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (lastMsg) lastMsgMap.set(convId, lastMsg.direction);
    });
    await Promise.all(directionPromises);
  }

  // ── Get existing follow-ups for dedup ──
  const { data: existingFollowups } = await supabase
    .from("wa_followup_queue")
    .select("conversation_id, tentativa, status")
    .eq("rule_id", rule.id)
    .in("conversation_id", convIds);

  const activeFollowupSet = new Set<string>();
  const attemptCountMap = new Map<string, number>();
  if (existingFollowups) {
    for (const fu of existingFollowups) {
      if (fu.status === "pendente" || fu.status === "enviado") {
        activeFollowupSet.add(fu.conversation_id);
      }
      attemptCountMap.set(
        fu.conversation_id,
        (attemptCountMap.get(fu.conversation_id) || 0) + 1
      );
    }
  }

  // ── Resolve assigned_to from instance when conv has none ──
  const instanceIds = [...new Set(conversations.map((c: any) => c.instance_id).filter(Boolean))];
  const instanceOwnerMap = new Map<string, string>();
  if (instanceIds.length > 0) {
    const { data: instances } = await supabase
      .from("wa_instances")
      .select("id, owner_user_id")
      .in("id", instanceIds);

    const { data: instanceVendedores } = await supabase
      .from("wa_instance_consultores")
      .select("instance_id, consultor_id, consultores:consultor_id(user_id)")
      .in("instance_id", instanceIds);

    if (instances) {
      for (const inst of instances) {
        let userId = inst.owner_user_id || null;
        if (!userId && instanceVendedores) {
          const link = instanceVendedores.find((iv: any) => iv.instance_id === inst.id);
          userId = (link?.consultores as any)?.user_id || null;
        }
        if (userId) instanceOwnerMap.set(inst.id, userId);
      }
    }
  }

  // ── COOLDOWN CHECK: filter out conversations with recent activity ──
  const cooldownCutoff = new Date(Date.now() - cooldownHours * 60 * 60 * 1000).toISOString();
  const eligibleConversations = conversations.filter((conv: any) => {
    // If last message is MORE RECENT than cooldown cutoff, BLOCK
    if (conv.last_message_at && conv.last_message_at > cooldownCutoff) {
      return false; // Too recent — cooldown active
    }
    return true;
  });

  // ── Build insert list ──
  const toInsert: any[] = [];
  const autoSendCandidates: { conv: any; attempt: number }[] = [];
  let blocked = 0;

  for (const conv of eligibleConversations) {
    // Scenario-specific direction check
    if (rule.cenario === "equipe_sem_resposta") {
      const lastDir = lastMsgMap.get(conv.id);
      if (!lastDir || lastDir !== "in") continue;
    } else if (rule.cenario === "cliente_sem_resposta") {
      const lastDir = lastMsgMap.get(conv.id);
      if (!lastDir || lastDir !== "out") continue;
    }

    if (activeFollowupSet.has(conv.id)) continue;

    const pastAttempts = attemptCountMap.get(conv.id) || 0;
    if (pastAttempts >= rule.max_tentativas) continue;

    const resolvedAssignedTo =
      conv.assigned_to || instanceOwnerMap.get(conv.instance_id) || null;

    const attempt = pastAttempts + 1;
    toInsert.push({
      tenant_id: rule.tenant_id,
      rule_id: rule.id,
      conversation_id: conv.id,
      status: "pendente",
      tentativa: attempt,
      scheduled_at: new Date().toISOString(),
      assigned_to: resolvedAssignedTo,
    });

    if (rule.envio_automatico && rule.mensagem_template) {
      autoSendCandidates.push({ conv, attempt });
    }
  }

  // Count blocked by cooldown
  blocked = conversations.length - eligibleConversations.length;

  // ── Batch insert ──
  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("wa_followup_queue")
      .insert(toInsert);

    if (insertError) {
      console.error(`Error inserting followups for rule ${rule.id}:`, insertError);
      return { created: 0, sent: 0, blocked };
    }
  }

  // ── AI Gate for auto-send ──
  let sent = 0;
  const confidenceThreshold = aiSettings?.followup_confidence_threshold ?? 60;

  for (const { conv } of autoSendCandidates) {
    const baseMessage = rule.mensagem_template!
      .replace(/\{nome\}/g, conv.cliente_nome || "")
      .replace(/\{vendedor\}/g, "")
      .replace(/\{consultor\}/g, "");

    // ── AI GATE: Validate if follow-up makes sense ──
    let finalMessage = baseMessage;
    let shouldSend = true;

    // Only call AI gate if tenant has OpenAI configured and mode is not "desativado"
    if (aiSettings?.modo !== "desativado") {
      const gateResult = await aiGateCheck(supabase, conv, baseMessage, rule, aiSettings);
      
      if (gateResult.confidence < confidenceThreshold) {
        // Below threshold → save as suggestion only, don't send
        console.log(`[followup-gate] Blocked for conv ${conv.id}: confidence=${gateResult.confidence}, threshold=${confidenceThreshold}`);
        
        await supabase
          .from("wa_followup_queue")
          .update({
            status: "bloqueado_ia",
            mensagem_enviada: `[IA bloqueou: ${gateResult.reason}] ${gateResult.adjustedMessage || baseMessage}`,
          })
          .eq("conversation_id", conv.id)
          .eq("rule_id", rule.id)
          .eq("status", "pendente");
        
        blocked++;
        continue;
      }

      // AI approved — use adjusted message if provided
      if (gateResult.adjustedMessage) {
        finalMessage = gateResult.adjustedMessage;
      }
    }

    // ── Send the message ──
    const { data: msg } = await supabase
      .from("wa_messages")
      .insert({
        conversation_id: conv.id,
        direction: "out",
        message_type: "text",
        content: finalMessage,
        is_internal_note: false,
        status: "pending",
        tenant_id: rule.tenant_id,
        source: "followup",
      })
      .select()
      .single();

    if (msg && conv.remote_jid && conv.instance_id) {
      await supabase.from("wa_outbox").insert({
        instance_id: conv.instance_id,
        conversation_id: conv.id,
        message_id: msg.id,
        remote_jid: conv.remote_jid,
        message_type: "text",
        content: finalMessage,
        status: "pending",
        tenant_id: rule.tenant_id,
      });

      await supabase
        .from("wa_followup_queue")
        .update({
          status: "enviado",
          sent_at: new Date().toISOString(),
          mensagem_enviada: finalMessage,
        })
        .eq("conversation_id", conv.id)
        .eq("rule_id", rule.id)
        .eq("status", "pendente");

      sent++;
    }
  }

  return { created: toInsert.length, sent, blocked };
}

// ─────────────────────────────────────────────────────
// AI Gate: Validate follow-up context before sending
// Returns confidence (0-100) and optionally adjusted message
// ─────────────────────────────────────────────────────
async function aiGateCheck(
  supabase: any,
  conv: any,
  proposedMessage: string,
  rule: any,
  aiSettings: any
): Promise<{ confidence: number; reason: string; adjustedMessage?: string }> {
  try {
    // Get OpenAI key for this tenant
    const { data: keyRow } = await supabase
      .from("integration_configs")
      .select("api_key")
      .eq("tenant_id", conv.tenant_id)
      .eq("service_key", "openai")
      .eq("is_active", true)
      .single();

    if (!keyRow?.api_key) {
      // No AI key → allow with default confidence
      return { confidence: 75, reason: "Sem chave OpenAI configurada — envio padrão" };
    }

    // Get last 10 messages for context
    const { data: messages = [] } = await supabase
      .from("wa_messages")
      .select("direction, content, created_at, source")
      .eq("conversation_id", conv.id)
      .eq("is_internal_note", false)
      .order("created_at", { ascending: false })
      .limit(10);

    const chatHistory = messages
      .reverse()
      .map((m: any) => `[${m.direction === "in" ? "cliente" : "consultor"}${m.source !== "human" ? ` (${m.source})` : ""}]: ${m.content || "(mídia)"}`)
      .join("\n");

    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
    const lastMsgDir = lastMsg?.direction || "unknown";
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
- Se o cliente acabou de responder e está aguardando resposta humana
- Se a conversa parece encerrada naturalmente (cliente recusou, desistiu)
- Se já foram enviados muitos follow-ups automáticos consecutivos
- Se o tom do cliente indica irritação com mensagens anteriores

REGRAS DE CAUTELA (confidence 30-70):
- Se o contexto é ambíguo
- Se o cliente não respondeu mas a mensagem proposta é genérica demais
- Se seria melhor esperar mais tempo

REGRAS DE APROVAÇÃO (confidence > 70):
- Se o cliente demonstrou interesse mas não finalizou
- Se há proposta pendente sem retorno
- Se o timing é adequado`;

    const userPrompt = `CONTEXTO:
- Cliente: ${conv.cliente_nome || "Desconhecido"}
- Última mensagem: ${lastMsgDir === "in" ? "do cliente" : "do consultor"} há ${hoursSinceLast ?? "?"} horas
- Cenário da regra: ${rule.cenario}
- Tentativa: ${rule.max_tentativas}

HISTÓRICO:
${chatHistory || "(sem mensagens)"}

MENSAGEM PROPOSTA:
${proposedMessage}

Avalie e retorne o JSON.`;

    const model = aiSettings?.modelo_preferido || "gpt-4o-mini";
    const temperature = aiSettings?.temperature ?? 0.3;

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
    });

    if (!response.ok) {
      console.error(`[ai-gate] OpenAI error: ${response.status}`);
      // On API failure, allow with moderate confidence
      return { confidence: 65, reason: "Erro na API — envio com cautela" };
    }

    const data = await response.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return { confidence: 65, reason: "Resposta vazia da IA" };

    try {
      const cleaned = raw.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
      const parsed = JSON.parse(cleaned);
      return {
        confidence: Math.min(100, Math.max(0, parsed.confidence || 50)),
        reason: parsed.reason || "Sem justificativa",
        adjustedMessage: parsed.adjusted_message || undefined,
      };
    } catch {
      return { confidence: 60, reason: "Resposta da IA não parseável" };
    }
  } catch (err: any) {
    console.error("[ai-gate] Error:", err.message);
    return { confidence: 65, reason: `Erro: ${err.message}` };
  }
}

// ─────────────────────────────────────────────────────
// Reconcile: mark follow-ups as "respondido" when
// the conversation has new activity AFTER the follow-up
// ─────────────────────────────────────────────────────
async function reconcilePendingFollowups(
  supabase: any,
  now: string
): Promise<number> {
  const { data: pendingFollowups } = await supabase
    .from("wa_followup_queue")
    .select("id, conversation_id, created_at, rule_id, rule:wa_followup_rules(cenario)")
    .in("status", ["pendente", "enviado"]);

  if (!pendingFollowups || pendingFollowups.length === 0) return 0;

  const pendingConvIds = [...new Set(pendingFollowups.map((fu: any) => fu.conversation_id))];

  const { data: recentMessages } = await supabase
    .from("wa_messages")
    .select("conversation_id, created_at, direction")
    .in("conversation_id", pendingConvIds)
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

  const toMarkResponded: string[] = [];
  for (const fu of pendingFollowups) {
    const cenario = (fu.rule as any)?.cenario;

    if (cenario === "equipe_sem_resposta") {
      const latestOut = latestOutgoing.get(fu.conversation_id);
      if (latestOut && latestOut > fu.created_at) {
        toMarkResponded.push(fu.id);
        continue;
      }
    }

    const latestIn = latestIncoming.get(fu.conversation_id);
    if (latestIn && latestIn > fu.created_at) {
      toMarkResponded.push(fu.id);
    }
  }

  if (toMarkResponded.length > 0) {
    await supabase
      .from("wa_followup_queue")
      .update({ status: "respondido", responded_at: now })
      .in("id", toMarkResponded);
  }

  return toMarkResponded.length;
}
