import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface TenantUsage {
  tenant_id: string;
  tenant_nome: string;
  metric_key: string;
  current_value: number;
  limit_value: number;
  percentage: number;
  status: "warning" | "blocked";
}

const METRIC_LABELS: Record<string, string> = {
  max_ai_insights_month: "Insights IA",
  max_reports_pdf_month: "Relatórios PDF",
  max_automations: "Automações",
  max_performance_alerts: "Alertas de Performance",
  max_leads_month: "Leads",
  max_wa_messages_month: "Mensagens WhatsApp",
  max_proposals_month: "Propostas",
  max_users: "Usuários",
};

const LIMIT_TO_USAGE_MAP: Record<string, string> = {
  max_ai_insights_month: "ai_insights",
  max_reports_pdf_month: "relatorios_pdf",
  max_automations: "automacoes_executadas",
  max_performance_alerts: "alertas_performance",
  max_leads_month: "leads_criados",
  max_wa_messages_month: "wa_messages_sent",
  max_proposals_month: "propostas_geradas",
  max_users: "users_count",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Get active tenants with subscriptions
    const { data: tenants, error: tErr } = await supabase
      .from("tenants")
      .select("id, nome")
      .eq("ativo", true);
    if (tErr) throw tErr;

    const { data: subs, error: sErr } = await supabase
      .from("subscriptions")
      .select("tenant_id, plan_id, status, plans(code)")
      .in("status", ["active", "trialing"]);
    if (sErr) throw sErr;

    const subMap = new Map<string, string>();
    (subs || []).forEach((s: any) => {
      subMap.set(s.tenant_id, s.plans?.code ?? "free");
    });

    // 2. Get plan limits
    const { data: limits, error: lErr } = await supabase
      .from("plan_limits")
      .select("plan_id, limit_key, limit_value, plans(code)");
    if (lErr) throw lErr;

    const limitMap = new Map<string, number>();
    (limits || []).forEach((l: any) => {
      limitMap.set(`${l.plans?.code}::${l.limit_key}`, l.limit_value);
    });

    // 3. Get current month usage
    const now = new Date();
    const periodStart = new Date(now.getFullYear(), now.getMonth(), 1)
      .toISOString()
      .split("T")[0];

    const { data: counters, error: cErr } = await supabase
      .from("usage_counters")
      .select("tenant_id, metric_key, current_value")
      .eq("period_start", periodStart);
    if (cErr) throw cErr;

    const usageMap = new Map<string, number>();
    (counters || []).forEach((c: any) => {
      usageMap.set(`${c.tenant_id}::${c.metric_key}`, c.current_value);
    });

    // 4. Detect upsell opportunities
    const opportunities: TenantUsage[] = [];
    const metricKeys = Object.keys(LIMIT_TO_USAGE_MAP);

    for (const t of tenants || []) {
      const planCode = subMap.get(t.id);
      if (!planCode) continue; // no subscription

      for (const mk of metricKeys) {
        const limitVal = limitMap.get(`${planCode}::${mk}`) ?? -1;
        if (limitVal <= 0) continue; // unlimited

        const usageKey = LIMIT_TO_USAGE_MAP[mk];
        const currentVal = usageMap.get(`${t.id}::${usageKey}`) ?? 0;
        const pct = Math.round((currentVal / limitVal) * 100);

        if (pct >= 80) {
          opportunities.push({
            tenant_id: t.id,
            tenant_nome: t.nome,
            metric_key: mk,
            current_value: currentVal,
            limit_value: limitVal,
            percentage: pct,
            status: pct >= 100 ? "blocked" : "warning",
          });
        }
      }
    }

    // 5. Dedup — batch-fetch existing unresolved events (AP-20 fix)
    let created = 0;
    let notified = 0;

    // Batch SELECT: fetch all unresolved events for the relevant tenant+metric pairs
    const oppTenantIds = [...new Set(opportunities.map(o => o.tenant_id))];
    const oppMetricKeys = [...new Set(opportunities.map(o => o.metric_key))];

    const { data: allExisting } = await supabase
      .from("upsell_events")
      .select("id, tenant_id, metric_key, status, notified_at")
      .in("tenant_id", oppTenantIds.length > 0 ? oppTenantIds : ["__none__"])
      .in("metric_key", oppMetricKeys.length > 0 ? oppMetricKeys : ["__none__"])
      .is("resolved_at", null)
      .order("created_at", { ascending: false });

    // Build map: "tenant_id::metric_key" → most recent existing event
    const existingMap = new Map<string, any>();
    for (const ev of allExisting || []) {
      const key = `${ev.tenant_id}::${ev.metric_key}`;
      if (!existingMap.has(key)) existingMap.set(key, ev); // keep most recent (ordered desc)
    }

    // Classify opportunities: status-change updates, new inserts, notifications
    const statusUpdates: { id: string; opp: TenantUsage; oldStatus: string }[] = [];
    const newInserts: TenantUsage[] = [];

    for (const opp of opportunities) {
      const key = `${opp.tenant_id}::${opp.metric_key}`;
      const existing = existingMap.get(key);

      if (existing) {
        if (existing.status !== opp.status) {
          statusUpdates.push({ id: existing.id, opp, oldStatus: existing.status });
        }
        // Same status → skip
      } else {
        newInserts.push(opp);
      }
    }

    // Batch UPDATE for status changes
    if (statusUpdates.length > 0) {
      // Group by new status for batch update (most common: warning→blocked or blocked→warning)
      // Since each row may have different values, we do per-status-group updates
      const updateIds = statusUpdates.map(u => u.id);
      // Update all changed events with their individual values
      // Unfortunately each has different percentage/current_value, so we update individually
      // but we already eliminated the N+1 SELECT — the updates are unavoidable per-row
      for (const upd of statusUpdates) {
        await supabase
          .from("upsell_events")
          .update({
            status: upd.opp.status,
            percentage: upd.opp.percentage,
            current_value: upd.opp.current_value,
            limit_value: upd.opp.limit_value,
          })
          .eq("id", upd.id);

        // Re-notify on status escalation (warning → blocked)
        if (upd.opp.status === "blocked" && upd.oldStatus === "warning") {
          const sent = await sendUpsellWhatsApp(supabase, upd.opp);
          if (sent) {
            await supabase
              .from("upsell_events")
              .update({ notified_at: new Date().toISOString(), notification_channel: "whatsapp" })
              .eq("id", upd.id);
            notified++;
          }
        }
      }
    }

    // Batch INSERT for new events
    if (newInserts.length > 0) {
      const rows = newInserts.map(opp => ({
        tenant_id: opp.tenant_id,
        metric_key: opp.metric_key,
        percentage: opp.percentage,
        status: opp.status,
        current_value: opp.current_value,
        limit_value: opp.limit_value,
      }));

      const { data: insertedEvents } = await supabase
        .from("upsell_events")
        .insert(rows)
        .select("id, tenant_id, metric_key");

      created = newInserts.length;

      // Send WhatsApp notifications for new events
      if (insertedEvents) {
        for (let i = 0; i < insertedEvents.length; i++) {
          const ev = insertedEvents[i];
          const opp = newInserts[i];
          const sent = await sendUpsellWhatsApp(supabase, opp);
          if (sent) {
            await supabase
              .from("upsell_events")
              .update({ notified_at: new Date().toISOString(), notification_channel: "whatsapp" })
              .eq("id", ev.id);
            notified++;
          }
        }
      }
    }

    // 6. Auto-resolve events where usage dropped below 80% (AP-20 fix: batch update)
    const { data: activeEvents } = await supabase
      .from("upsell_events")
      .select("id, tenant_id, metric_key")
      .is("resolved_at", null);

    const resolveIds: string[] = [];
    for (const ev of activeEvents || []) {
      const planCode = subMap.get(ev.tenant_id);
      if (!planCode) continue;
      const limitVal = limitMap.get(`${planCode}::${ev.metric_key}`) ?? -1;
      if (limitVal <= 0) continue;
      const usageKey = LIMIT_TO_USAGE_MAP[ev.metric_key] ?? ev.metric_key;
      const currentVal = usageMap.get(`${ev.tenant_id}::${usageKey}`) ?? 0;
      const pct = Math.round((currentVal / limitVal) * 100);
      if (pct < 80) {
        resolveIds.push(ev.id);
      }
    }

    let resolved = 0;
    if (resolveIds.length > 0) {
      await supabase
        .from("upsell_events")
        .update({ resolved_at: new Date().toISOString() })
        .in("id", resolveIds);
      resolved = resolveIds.length;
    }

    const summary = {
      total_opportunities: opportunities.length,
      events_created: created,
      notifications_sent: notified,
      events_resolved: resolved,
      timestamp: new Date().toISOString(),
    };

    console.log("[detect-upsell] Summary:", JSON.stringify(summary));

    return new Response(JSON.stringify(summary), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[detect-upsell] Error:", err);
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

/**
 * Send upsell WhatsApp notification to the admin(s) of the tenant.
 * Uses wa_outbox via the canonical RPC if an instance is available.
 */
async function sendUpsellWhatsApp(
  supabase: any,
  opp: TenantUsage,
): Promise<boolean> {
  try {
    // Get the first active WA instance for this tenant
    const { data: instance } = await supabase
      .from("wa_instances")
      .select("id, phone_number")
      .eq("tenant_id", opp.tenant_id)
      .eq("status", "connected")
      .limit(1)
      .maybeSingle();

    if (!instance) {
      console.log(`[detect-upsell] No WA instance for tenant ${opp.tenant_id}, skipping notification`);
      return false;
    }

    // Get admin profile with phone for this tenant
    const { data: admin } = await supabase
      .from("profiles")
      .select("telefone, user_id")
      .eq("tenant_id", opp.tenant_id)
      .not("telefone", "is", null)
      .limit(1)
      .maybeSingle();

    if (!admin?.telefone) {
      console.log(`[detect-upsell] No admin phone for tenant ${opp.tenant_id}`);
      return false;
    }

    // Normalize phone to JID
    const phone = admin.telefone.replace(/\D/g, "");
    if (phone.length < 10) return false;
    const remoteJid = `${phone}@s.whatsapp.net`;

    const featureLabel = METRIC_LABELS[opp.metric_key] || opp.metric_key;

    let message: string;
    if (opp.status === "blocked") {
      message = `🚫 *Limite atingido — ${featureLabel}*\n\nSeu limite foi atingido (${opp.current_value}/${opp.limit_value}).\nAlguns recursos podem parar de funcionar.\n\nFale conosco para liberar o acesso e continuar crescendo! 🚀`;
    } else {
      message = `⚠️ *Atenção — ${featureLabel}*\n\nVocê já utilizou ${opp.percentage}% do seu plano (${opp.current_value}/${opp.limit_value}).\nEvite bloqueios e continue crescendo com um upgrade! 📈`;
    }

    const idempKey = `upsell:${opp.tenant_id}:${opp.metric_key}:${opp.status}:${new Date().toISOString().slice(0, 10)}`;

    const { error } = await supabase.rpc("enqueue_wa_outbox_item", {
      p_tenant_id: opp.tenant_id,
      p_instance_id: instance.id,
      p_remote_jid: remoteJid,
      p_message_type: "text",
      p_content: message,
      p_conversation_id: null,
      p_message_id: null,
      p_idempotency_key: idempKey,
    });

    if (error) {
      console.error(`[detect-upsell] WA enqueue error:`, error.message);
      return false;
    }

    console.log(`[detect-upsell] WA notification queued for ${opp.tenant_nome} (${opp.metric_key})`);
    return true;
  } catch (err) {
    console.error(`[detect-upsell] WA notification error:`, err);
    return false;
  }
}