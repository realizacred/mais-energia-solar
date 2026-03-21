// ──────────────────────────────────────────────────────────────────────────────
// generate-monthly-report — Cron: 0 11 1 * * (8h BRT on 1st of month)
// Sends monthly metrics summary via WhatsApp to all admin users.
// ──────────────────────────────────────────────────────────────────────────────
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function json(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, serviceKey);

    // ─── 1. Calculate previous month range ───
    const now = new Date();
    const brtNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
    const year = brtNow.getFullYear();
    const month = brtNow.getMonth(); // current month (0-indexed), so previous = month - 1

    const prevMonth = month === 0 ? 12 : month;
    const prevYear = month === 0 ? year - 1 : year;

    const startDate = `${prevYear}-${String(prevMonth).padStart(2, "0")}-01`;
    const endDate = `${year}-${String(month + 1).padStart(2, "0")}-01`; // 1st of current month

    const monthNames = [
      "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
      "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
    ];
    const monthLabel = `${monthNames[prevMonth - 1]}/${prevYear}`;

    // ─── 2. Find admin users ───
    const { data: adminRoles } = await sb
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles?.length) {
      return json({ ok: true, message: "No admins found", sent: 0 });
    }

    const adminUserIds = adminRoles.map((r: any) => r.user_id);

    const { data: admins } = await sb
      .from("consultores")
      .select("user_id, nome, telefone, tenant_id")
      .in("user_id", adminUserIds)
      .not("telefone", "is", null);

    if (!admins?.length) {
      return json({ ok: true, message: "No admins with phone", sent: 0 });
    }

    const results: any[] = [];

    for (const admin of admins) {
      const tenantId = admin.tenant_id;

      // ─── 3. Gather metrics for previous month ───
      const [
        { count: leadsNovos },
        { count: propostasEnviadas },
        { count: projetosGanhos },
        { data: comissoesData },
        { count: usinasTotal },
      ] = await Promise.all([
        sb.from("leads").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).is("deleted_at", null)
          .gte("created_at", startDate).lt("created_at", endDate),

        sb.from("proposta_versoes").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .gte("gerado_em", startDate).lt("gerado_em", endDate),

        sb.from("projetos").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId)
          .in("status", ["concluido", "comissionado", "instalado"])
          .gte("updated_at", startDate).lt("updated_at", endDate),

        sb.from("comissoes").select("valor_comissao")
          .eq("tenant_id", tenantId)
          .eq("mes_referencia", prevMonth).eq("ano_referencia", prevYear),

        sb.from("monitor_plants").select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId).eq("is_active", true),
      ]);

      const totalComissoes = (comissoesData || []).reduce(
        (sum: number, c: any) => sum + (c.valor_comissao || 0), 0
      );

      // Online plants (last_seen < 1h)
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: usinasOnline } = await sb
        .from("monitor_plants")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId).eq("is_active", true)
        .gte("last_seen_at", oneHourAgo);

      // Average lead score
      const { data: scores } = await sb
        .from("lead_scores")
        .select("score")
        .eq("tenant_id", tenantId)
        .limit(500);

      const avgScore = scores?.length
        ? Math.round(scores.reduce((s: number, sc: any) => s + (sc.score || 0), 0) / scores.length)
        : 0;

      // ─── 4. Build and send message ───
      const mensagem = [
        `📊 *Relatório Mensal — ${monthLabel}*`,
        ``,
        `📥 Leads novos: ${leadsNovos ?? 0}`,
        `📋 Propostas enviadas: ${propostasEnviadas ?? 0}`,
        `✅ Projetos ganhos: ${projetosGanhos ?? 0}`,
        `💼 Comissões: ${formatBRL(totalComissoes)}`,
        `☀️ Usinas: ${usinasOnline ?? 0}/${usinasTotal ?? 0} online`,
        `🎯 Score médio leads: ${avgScore}`,
        ``,
        `_Mais Energia Solar 🌞_`,
      ].join("\n");

      const { error: sendError } = await sb.functions.invoke("send-whatsapp-message", {
        body: {
          telefone: admin.telefone,
          mensagem,
          tipo: "automatico",
          tenant_id: tenantId,
        },
      });

      results.push({
        admin: admin.nome,
        tenant_id: tenantId,
        sent: !sendError,
        error: sendError?.message ?? null,
      });
    }

    console.log(`[generate-monthly-report] Done: ${results.filter(r => r.sent).length}/${results.length} sent`);

    return json({ ok: true, month: monthLabel, results });
  } catch (err: any) {
    console.error("[generate-monthly-report] Fatal:", err?.message);
    return json({ error: err?.message || "Internal error" }, 500);
  }
});
