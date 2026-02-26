import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (body: Record<string, unknown>, s = 200) =>
  new Response(JSON.stringify(body), { status: s, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const t0 = Date.now();
  const metrics = { tenants_processed: 0, alerts_created: 0, alerts_resolved: 0, alerts_deferred: 0, ai_summaries: 0, errors: 0 };

  try {
    const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // Get all active tenants with SLA config
    const { data: configs } = await sb
      .from("wa_sla_config")
      .select("tenant_id, prazo_resposta_minutos, escalonar_apos_minutos, gerar_resumo_ia, horario_comercial_inicio, horario_comercial_fim, ignorar_fora_horario")
      .eq("ativo", true);

    if (!configs?.length) {
      console.log("[sla] No active SLA configs");
      return json({ ...metrics, success: true, timing_ms: Date.now() - t0 });
    }

    for (const cfg of configs) {
      try {
        metrics.tenants_processed++;

        // G3: Check tenant is active
        const { data: tenant } = await sb
          .from("tenants")
          .select("status, deleted_at")
          .eq("id", cfg.tenant_id)
          .single();
        if (!tenant || tenant.status !== "active" || tenant.deleted_at) continue;

        // Check business hours if configured
        if (cfg.ignorar_fora_horario && cfg.horario_comercial_inicio && cfg.horario_comercial_fim) {
          const now = new Date();
          const hours = now.getHours();
          const minutes = now.getMinutes();
          const currentTime = hours * 60 + minutes;
          const [startH, startM] = (cfg.horario_comercial_inicio as string).split(":").map(Number);
          const [endH, endM] = (cfg.horario_comercial_fim as string).split(":").map(Number);
          const startTime = startH * 60 + startM;
          const endTime = endH * 60 + endM;
          if (currentTime < startTime || currentTime > endTime) continue;
        }

        const cutoff = new Date(Date.now() - cfg.prazo_resposta_minutos * 60 * 1000).toISOString();
        const escalationCutoff = new Date(Date.now() - cfg.escalonar_apos_minutos * 60 * 1000).toISOString();

        // Find open conversations with last inbound message older than SLA threshold
        const { data: convs } = await sb.rpc("get_sla_violating_conversations" as any, {
          _tenant_id: cfg.tenant_id,
          _cutoff: cutoff,
        });

        let violations: any[] = [];
        if (!convs) {
          const { data: openConvs } = await sb
            .from("wa_conversations")
            .select("id, assigned_to, cliente_nome, cliente_telefone, last_message_at, remote_jid, instance_id, sla_paused_until")
            .eq("tenant_id", cfg.tenant_id)
            .eq("status", "open")
            .eq("is_group", false)
            .lt("last_message_at", cutoff);

          if (openConvs?.length) {
            for (const conv of openConvs) {
              // Skip conversations with active SLA pause
              if (conv.sla_paused_until && new Date(conv.sla_paused_until) > new Date()) {
                continue;
              }

              const { data: lastMsg } = await sb
                .from("wa_messages")
                .select("direction, created_at")
                .eq("conversation_id", conv.id)
                .eq("is_internal_note", false)
                .order("created_at", { ascending: false })
                .limit(1)
                .single();

              if (lastMsg?.direction === "in") {
                const minutesSince = Math.round(
                  (Date.now() - new Date(lastMsg.created_at).getTime()) / 60000
                );
                violations.push({
                  ...conv,
                  tipo: "atendente_sem_resposta",
                  tempo_sem_resposta_minutos: minutesSince,
                  needs_escalation: new Date(lastMsg.created_at).toISOString() < escalationCutoff,
                });
              }
            }
          }
        } else {
          // Filter out paused conversations from RPC results too
          for (const v of convs) {
            const { data: convRow } = await sb
              .from("wa_conversations")
              .select("sla_paused_until")
              .eq("id", v.id)
              .single();
            if (convRow?.sla_paused_until && new Date(convRow.sla_paused_until) > new Date()) {
              continue;
            }
            violations.push(v);
          }
        }

        // Check for existing unresolved alerts to avoid duplicates
        const convIds = violations.map((v: any) => v.id);
        if (convIds.length === 0) continue;

        const { data: existingAlerts } = await sb
          .from("wa_sla_alerts")
          .select("conversation_id")
          .eq("tenant_id", cfg.tenant_id)
          .eq("resolved", false)
          .in("conversation_id", convIds);

        const existingSet = new Set((existingAlerts || []).map((a: any) => a.conversation_id));
        const newViolations = violations.filter((v: any) => !existingSet.has(v.id));

        // Get AI API key for this tenant (used for summary + classification)
        let aiApiKey: string | null = null;
        if (cfg.gerar_resumo_ia) {
          const { data: keyRow } = await sb
            .from("integration_configs")
            .select("api_key")
            .eq("tenant_id", cfg.tenant_id)
            .eq("service_key", "openai")
            .eq("is_active", true)
            .single();
          aiApiKey = keyRow?.api_key || null;
        }

        // Also try Lovable AI as fallback
        const lovableKey = Deno.env.get("LOVABLE_API_KEY");

        // Create new alerts
        for (const v of newViolations) {
          let aiSummary: string | null = null;
          let shouldAlert = true;

          // Get last messages for AI analysis
          const { data: recentMsgs = [] } = await sb
            .from("wa_messages")
            .select("direction, content, created_at")
            .eq("conversation_id", v.id)
            .eq("is_internal_note", false)
            .order("created_at", { ascending: false })
            .limit(10);

          const hist = recentMsgs
            .slice()
            .reverse()
            .map((m: any) => `[${m.direction === "in" ? "Cliente" : "Atendente"}]: ${m.content || "(mídia)"}`)
            .join("\n");

          // AI classification: should we alert now, defer, or skip?
          const effectiveKey = aiApiKey || lovableKey;
          if (effectiveKey && cfg.gerar_resumo_ia) {
            try {
              const classification = await classifyConversationForSla(
                effectiveKey,
                !!aiApiKey, // true = OpenAI, false = Lovable gateway
                v.cliente_nome,
                hist,
                v.tempo_sem_resposta_minutos
              );

              if (classification) {
                aiSummary = classification.summary;
                if (aiSummary) metrics.ai_summaries++;

                if (classification.action === "defer" && classification.defer_hours) {
                  // Pause SLA for this conversation until the suggested time
                  const pauseUntil = new Date(Date.now() + classification.defer_hours * 3600 * 1000).toISOString();
                  await sb
                    .from("wa_conversations")
                    .update({ sla_paused_until: pauseUntil })
                    .eq("id", v.id);
                  shouldAlert = false;
                  metrics.alerts_deferred++;
                  console.log(`[sla] Deferred alert for conv=${v.id} until ${pauseUntil}: ${classification.reason}`);
                } else if (classification.action === "skip") {
                  shouldAlert = false;
                  console.log(`[sla] Skipped alert for conv=${v.id}: ${classification.reason}`);
                }
                // action === "alert" → proceed normally
              }
            } catch (e: any) {
              console.warn(`[sla] AI classification failed for conv=${v.id}:`, e.message);
              // Fallback: alert anyway
            }
          }

          if (!shouldAlert) continue;

          const { error: insertErr } = await sb.from("wa_sla_alerts").insert({
            tenant_id: cfg.tenant_id,
            conversation_id: v.id,
            tipo: v.tipo || "atendente_sem_resposta",
            assigned_to: v.assigned_to,
            ai_summary: aiSummary,
            tempo_sem_resposta_minutos: v.tempo_sem_resposta_minutos,
            escalated: v.needs_escalation || false,
            escalated_at: v.needs_escalation ? new Date().toISOString() : null,
          });

          if (insertErr) {
            console.error(`[sla] Insert alert error:`, insertErr.message);
            metrics.errors++;
          } else {
            metrics.alerts_created++;
          }
        }

        // Escalate existing alerts that exceeded escalation time
        const { data: toEscalate } = await sb
          .from("wa_sla_alerts")
          .select("id")
          .eq("tenant_id", cfg.tenant_id)
          .eq("resolved", false)
          .eq("escalated", false)
          .lt("created_at", escalationCutoff);

        if (toEscalate?.length) {
          await sb
            .from("wa_sla_alerts")
            .update({ escalated: true, escalated_at: new Date().toISOString() })
            .in("id", toEscalate.map((a: any) => a.id));
        }

        // Auto-resolve alerts where conversation got a response
        const { data: unresolvedAlerts } = await sb
          .from("wa_sla_alerts")
          .select("id, conversation_id, created_at")
          .eq("tenant_id", cfg.tenant_id)
          .eq("resolved", false);

        if (unresolvedAlerts?.length) {
          for (const alert of unresolvedAlerts) {
            const { data: response } = await sb
              .from("wa_messages")
              .select("id")
              .eq("conversation_id", alert.conversation_id)
              .eq("direction", "out")
              .eq("is_internal_note", false)
              .gt("created_at", alert.created_at)
              .limit(1)
              .single();

            if (response) {
              await sb
                .from("wa_sla_alerts")
                .update({ resolved: true, resolved_at: new Date().toISOString() })
                .eq("id", alert.id);
              metrics.alerts_resolved++;
            }
          }
        }
      } catch (e: any) {
        metrics.errors++;
        console.error(`[sla] Tenant ${cfg.tenant_id} error:`, e.message);
      }
    }

    const timing = Date.now() - t0;
    console.log(`[sla] OK`, JSON.stringify({ ...metrics, timing_ms: timing }));
    return json({ ...metrics, success: true, timing_ms: timing });
  } catch (e: any) {
    metrics.errors++;
    console.error("[sla] FATAL:", e.message);
    return json({ ...metrics, error: e.message }, 500);
  }
});

/**
 * Uses AI to classify whether a conversation should trigger an SLA alert now,
 * be deferred to a later time, or be skipped entirely.
 */
async function classifyConversationForSla(
  apiKey: string,
  isOpenAI: boolean,
  clienteName: string | null,
  messageHistory: string,
  minutesSinceLastResponse: number
): Promise<{ action: "alert" | "defer" | "skip"; defer_hours?: number; reason: string; summary: string } | null> {
  const systemPrompt = `Você é um assistente de supervisão de atendimento. Analise a conversa e decida se devemos criar um ALERTA DE SLA agora.

REGRAS:
- Se o CLIENTE disse que vai responder depois (ex: "mando quando chegar", "vou ver", "depois envio"), a ação deve ser "defer" com defer_hours apropriado (ex: 4h para "quando chegar do trabalho", 12h para "amanhã").
- Se a conversa foi CONCLUÍDA ou o cliente já tem tudo que precisa, a ação deve ser "skip".
- Se o ATENDENTE realmente precisa responder e o cliente está esperando, a ação deve ser "alert".
- Se a última mensagem do cliente é uma pergunta ou pedido sem resposta, a ação deve ser "alert".

Responda APENAS com JSON válido:
{"action": "alert|defer|skip", "defer_hours": <número ou null>, "reason": "<razão curta>", "summary": "<resumo de 1-2 frases do estado da conversa>"}`;

  const userPrompt = `Cliente: ${clienteName || "Desconhecido"}
Tempo sem resposta do atendente: ${minutesSinceLastResponse} minutos

Últimas mensagens:
${messageHistory || "(sem histórico)"}`;

  const url = isOpenAI
    ? "https://api.openai.com/v1/chat/completions"
    : "https://ai.gateway.lovable.dev/v1/chat/completions";

  const model = isOpenAI ? "gpt-4o-mini" : "google/gemini-2.5-flash-lite";

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const r = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!r.ok) return null;

    const data = await r.json();
    const raw = data.choices?.[0]?.message?.content?.trim();
    if (!raw) return null;

    // Extract JSON from response (handle markdown code blocks)
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (!["alert", "defer", "skip"].includes(parsed.action)) return null;

    return {
      action: parsed.action,
      defer_hours: parsed.defer_hours ? Number(parsed.defer_hours) : undefined,
      reason: String(parsed.reason || ""),
      summary: String(parsed.summary || ""),
    };
  } catch {
    return null;
  }
}
