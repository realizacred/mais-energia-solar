import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DEFAULT_TEMPLATE = `Bom dia, {{primeiro_nome}}! 👋☀️

Aqui está seu resumo semanal:

📊 *Seus leads esta semana:*
• Total: {{total_leads}} leads
• 🔥 Hot (alta prioridade): {{hot_leads}}
• ⚠️ Sem classificação: {{sem_status}}
• ⏰ Follow-ups atrasados: {{followups_atrasados}}

{{cta_hot}}{{cta_sem_status}}
Bom trabalho! 💪
Mais Energia Solar 🌞`;

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `${withCountry}@s.whatsapp.net`;
}

/** Hora atual em Brasília (UTC-3, sem DST) */
function brtNow(): { hour: number; dow: number } {
  const now = new Date();
  const brt = new Date(now.getTime() - 3 * 3600000);
  return { hour: brt.getUTCHours(), dow: brt.getUTCDay() };
}

function renderTemplate(tpl: string, vars: Record<string, string | number>): string {
  return tpl.replace(/\{\{(\w+)\}\}/g, (_, k) =>
    vars[k] !== undefined ? String(vars[k]) : ""
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const stats = { tenants: 0, consultores: 0, enviados: 0, skipped: 0, errors: 0 };

  try {
    const url = new URL(req.url);
    const force = url.searchParams.get("force") === "true";
    const forceTenant = url.searchParams.get("tenant_id");

    const { hour, dow } = brtNow();

    // ── 1. Tenants com config ativa para ESTE horário/dia ─────
    let configQuery = admin
      .from("weekly_summary_config")
      .select("tenant_id, enabled, day_of_week, hour_local, template")
      .eq("enabled", true);

    if (!force) {
      configQuery = configQuery.eq("day_of_week", dow).eq("hour_local", hour);
    }
    if (forceTenant) {
      configQuery = configQuery.eq("tenant_id", forceTenant);
    }

    const { data: configs, error: cfgErr } = await configQuery;
    if (cfgErr) throw cfgErr;

    if (!configs?.length) {
      return jsonOk({ ...stats, message: "No tenant scheduled for this hour" });
    }

    stats.tenants = configs.length;
    const cfgByTenant = new Map(configs.map((c) => [c.tenant_id, c]));
    const tenantIds = configs.map((c) => c.tenant_id);

    // ── 2. Consultores ativos desses tenants ──────────────────
    const { data: consultores, error: cErr } = await admin
      .from("consultores")
      .select("id, nome, telefone, tenant_id")
      .eq("ativo", true)
      .not("telefone", "is", null)
      .in("tenant_id", tenantIds);

    if (cErr) throw cErr;
    if (!consultores?.length) {
      return jsonOk({ ...stats, message: "No consultores in scheduled tenants" });
    }

    // ── 3. Instâncias WA conectadas por tenant ────────────────
    const { data: instances } = await admin
      .from("wa_instances")
      .select("id, tenant_id")
      .eq("status", "connected")
      .in("tenant_id", tenantIds);

    const instanceByTenant: Record<string, string> = {};
    for (const inst of instances || []) {
      if (!instanceByTenant[inst.tenant_id]) {
        instanceByTenant[inst.tenant_id] = inst.id;
      }
    }

    // ── 4. Para cada consultor, calcular e enviar ─────────────
    for (const consultor of consultores) {
      stats.consultores++;

      const jid = normalizePhone(consultor.telefone || "");
      if (!jid) { stats.skipped++; continue; }

      const instanceId = instanceByTenant[consultor.tenant_id];
      if (!instanceId) { stats.skipped++; continue; }

      const idempKey = `weekly-${consultor.id}-${isoWeek()}`;
      const { data: existing } = await admin
        .from("wa_outbox")
        .select("id")
        .eq("idempotency_key", idempKey)
        .maybeSingle();

      if (existing && !force) { stats.skipped++; continue; }

      // Métricas
      const [leadsRes, hotRes, followupsRes] = await Promise.all([
        admin.rpc("get_consultant_lead_metrics", {
          p_consultor_nome: consultor.nome,
          p_tenant_id: consultor.tenant_id,
        }).maybeSingle(),
        admin.from("lead_scores")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", consultor.tenant_id)
          .eq("nivel", "hot")
          .gt("calculado_em", new Date(Date.now() - 7 * 86400000).toISOString()),
        admin.from("lead_atividades")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", consultor.tenant_id)
          .eq("concluido", false)
          .lt("data_agendada", new Date().toISOString()),
      ]);

      let totalLeads = 0, semStatus = 0;
      if (leadsRes.data) {
        totalLeads = (leadsRes.data as any).total_leads || 0;
        semStatus = (leadsRes.data as any).sem_status || 0;
      } else {
        const { count: tCount } = await admin
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", consultor.tenant_id)
          .eq("consultor", consultor.nome);
        totalLeads = tCount || 0;
        const { count: sCount } = await admin
          .from("leads")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", consultor.tenant_id)
          .eq("consultor", consultor.nome)
          .is("status_id", null);
        semStatus = sCount || 0;
      }

      const hotLeads = hotRes.count || 0;
      const followupsAtrasados = followupsRes.count || 0;

      const cfg = cfgByTenant.get(consultor.tenant_id)!;
      const template = cfg.template || DEFAULT_TEMPLATE;

      const mensagem = renderTemplate(template, {
        primeiro_nome: consultor.nome?.split(" ")[0] || "",
        nome: consultor.nome || "",
        total_leads: totalLeads,
        hot_leads: hotLeads,
        sem_status: semStatus,
        followups_atrasados: followupsAtrasados,
        cta_hot: hotLeads > 0 ? "🎯 Você tem leads quentes — entre em contato hoje!\n\n" : "",
        cta_sem_status: semStatus > 0 ? "📋 Classifique seus leads no sistema para ativar automações.\n\n" : "",
      }).trim();

      const { error: insertErr } = await admin.from("wa_outbox").insert({
        tenant_id: consultor.tenant_id,
        instance_id: instanceId,
        remote_jid: jid,
        message_type: "text",
        content: mensagem,
        status: "pending",
        idempotency_key: force ? `${idempKey}-${Date.now()}` : idempKey,
      });

      if (insertErr) {
        console.warn(`[notify-weekly] Insert failed for ${consultor.nome}:`, insertErr.message);
        stats.errors++;
      } else {
        stats.enviados++;
      }
    }

    return jsonOk(stats);
  } catch (err: any) {
    console.error("[notify-weekly] Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message, ...stats }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

function isoWeek(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

function jsonOk(data: any) {
  return new Response(JSON.stringify({ success: true, ...data }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
