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
  const metrics = { tenants_processed: 0, alerts_created: 0, alerts_resolved: 0, ai_summaries: 0, errors: 0 };

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
        // and no outbound message after it
        const { data: convs } = await sb.rpc("get_sla_violating_conversations" as any, {
          _tenant_id: cfg.tenant_id,
          _cutoff: cutoff,
        });

        // Fallback if RPC doesn't exist yet — direct query
        let violations: any[] = [];
        if (!convs) {
          const { data: openConvs } = await sb
            .from("wa_conversations")
            .select("id, assigned_to, cliente_nome, cliente_telefone, last_message_at, remote_jid, instance_id")
            .eq("tenant_id", cfg.tenant_id)
            .eq("status", "open")
            .eq("is_group", false)
            .lt("last_message_at", cutoff);

          if (openConvs?.length) {
            // For each, check if last message is inbound (client waiting)
            for (const conv of openConvs) {
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
          violations = convs;
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

        // Create new alerts
        for (const v of newViolations) {
          let aiSummary: string | null = null;

          // Generate AI summary if enabled
          if (cfg.gerar_resumo_ia) {
            try {
              aiSummary = await generateAISummary(sb, cfg.tenant_id, v.id, v.cliente_nome);
              if (aiSummary) metrics.ai_summaries++;
            } catch (e: any) {
              console.warn(`[sla] AI summary failed for conv=${v.id}:`, e.message);
            }
          }

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
          const alertConvIds = [...new Set(unresolvedAlerts.map((a: any) => a.conversation_id))];
          // Check if any of these conversations now have an outbound message after the alert
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

async function generateAISummary(
  sb: any,
  tenantId: string,
  conversationId: string,
  clienteName: string | null
): Promise<string | null> {
  // Get OpenAI key for tenant
  const { data: keyRow } = await sb
    .from("integration_configs")
    .select("api_key")
    .eq("tenant_id", tenantId)
    .eq("service_key", "openai")
    .eq("is_active", true)
    .single();

  if (!keyRow?.api_key) return null;

  // Get last 10 messages
  const { data: messages = [] } = await sb
    .from("wa_messages")
    .select("direction, content, created_at")
    .eq("conversation_id", conversationId)
    .eq("is_internal_note", false)
    .order("created_at", { ascending: false })
    .limit(10);

  const hist = messages
    .reverse()
    .map((m: any) => `[${m.direction === "in" ? "Cliente" : "Atendente"}]: ${m.content || "(mídia)"}`)
    .join("\n");

  const sys = `Você é um assistente de supervisão de atendimento solar. Gere um resumo CURTO (máximo 2 frases) do estado da conversa, focando em:
1. O que o cliente pediu/precisa
2. Se está aguardando resposta
Formato: direto, sem saudação. Exemplo: "Cliente perguntou sobre financiamento do sistema de 5kWp. Aguarda resposta há 2h."`;

  const usr = `Cliente: ${clienteName || "Desconhecido"}\n\nÚltimas mensagens:\n${hist || "(sem histórico)"}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${keyRow.api_key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: sys },
          { role: "user", content: usr },
        ],
        max_tokens: 150,
        temperature: 0.3,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    if (!r.ok) return null;

    const data = await r.json();
    return data.choices?.[0]?.message?.content?.trim() || null;
  } catch {
    return null;
  }
}
