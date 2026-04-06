import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 10) return null;
  const withCountry = digits.startsWith("55") ? digits : `55${digits}`;
  return `${withCountry}@s.whatsapp.net`;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const admin = createClient(supabaseUrl, serviceRoleKey);

  const stats = { consultores: 0, enviados: 0, skipped: 0, errors: 0 };

  try {
    // ── 1. Buscar consultores ativos com telefone válido ─────
    const { data: consultores, error: cErr } = await admin
      .from("consultores")
      .select("id, nome, telefone, tenant_id")
      .eq("ativo", true)
      .not("telefone", "is", null);

    if (cErr) throw cErr;
    if (!consultores?.length) {
      // console.log("[notify-weekly] No active consultores found");
      return jsonOk({ ...stats, message: "No consultores" });
    }

    // ── 2. Buscar instâncias WA por tenant ──────────────────
    const tenantIds = [...new Set(consultores.map((c) => c.tenant_id))];
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

    // ── 3. Para cada consultor, calcular e enviar ───────────
    for (const consultor of consultores) {
      stats.consultores++;

      const jid = normalizePhone(consultor.telefone || "");
      if (!jid) {
        stats.skipped++;
        continue;
      }

      const instanceId = instanceByTenant[consultor.tenant_id];
      if (!instanceId) {
        stats.skipped++;
        continue;
      }

      // Dedup: já enviou esta semana?
      const idempKey = `weekly-${consultor.id}-${isoWeek()}`;
      const { data: existing } = await admin
        .from("wa_outbox")
        .select("id")
        .eq("idempotency_key", idempKey)
        .maybeSingle();

      if (existing) {
        stats.skipped++;
        continue;
      }

      // ── Métricas do consultor (paralelo) ──────────────────
      const [leadsRes, hotRes, followupsRes] = await Promise.all([
        admin.rpc("get_consultant_lead_metrics", {
          p_consultor_nome: consultor.nome,
          p_tenant_id: consultor.tenant_id,
        }).maybeSingle(),
        admin
          .from("lead_scores")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", consultor.tenant_id)
          .eq("nivel", "hot")
          .gt("calculado_em", new Date(Date.now() - 7 * 86400000).toISOString()),
        admin
          .from("lead_atividades")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", consultor.tenant_id)
          .eq("concluido", false)
          .lt("data_agendada", new Date().toISOString()),
      ]);

      // Fallback: if RPC doesn't exist, use simple counts
      let totalLeads = 0, semStatus = 0;
      if (leadsRes.data) {
        totalLeads = (leadsRes.data as any).total_leads || 0;
        semStatus = (leadsRes.data as any).sem_status || 0;
      } else {
        // Direct query fallback
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

      // ── Montar mensagem ───────────────────────────────────
      const lines: string[] = [
        `Bom dia, ${consultor.nome?.split(" ")[0]}! 👋☀️`,
        "",
        "Aqui está seu resumo semanal:",
        "",
        "📊 *Seus leads esta semana:*",
        `• Total: ${totalLeads} leads`,
        `• 🔥 Hot (alta prioridade): ${hotLeads}`,
        `• ⚠️ Sem classificação: ${semStatus}`,
        `• ⏰ Follow-ups atrasados: ${followupsAtrasados}`,
      ];

      if (hotLeads > 0) {
        lines.push("", "🎯 Você tem leads quentes — entre em contato hoje!");
      }
      if (semStatus > 0) {
        lines.push("", "📋 Classifique seus leads no sistema para ativar automações.");
      }

      lines.push("", "Bom trabalho! 💪", "Mais Energia Solar 🌞");

      const mensagem = lines.join("\n");

      // ── Enfileirar wa_outbox ──────────────────────────────
      const { error: insertErr } = await admin.from("wa_outbox").insert({
        tenant_id: consultor.tenant_id,
        instance_id: instanceId,
        remote_jid: jid,
        message_type: "text",
        content: mensagem,
        status: "pending",
        idempotency_key: idempKey,
      });

      if (insertErr) {
        console.warn(`[notify-weekly] Insert failed for ${consultor.nome}:`, insertErr.message);
        stats.errors++;
      } else {
        stats.enviados++;
      }
    }

    // console.log("[notify-weekly] Done:", JSON.stringify(stats));
    return jsonOk(stats);
  } catch (err: any) {
    console.error("[notify-weekly] Error:", err);
    return new Response(JSON.stringify({ success: false, error: err.message, ...stats }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

/** Returns ISO week string like "2026-W12" for dedup */
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
