import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // 1. Find admin users with phone numbers
    const { data: adminRoles } = await supabase
      .from("user_roles")
      .select("user_id")
      .eq("role", "admin");

    if (!adminRoles?.length) {
      return new Response(JSON.stringify({ ok: false, reason: "no_admins" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminUserIds = adminRoles.map((r: any) => r.user_id);

    // Get admin consultores with phone
    const { data: admins } = await supabase
      .from("consultores")
      .select("user_id, nome, telefone, tenant_id")
      .in("user_id", adminUserIds)
      .not("telefone", "is", null);

    if (!admins?.length) {
      return new Response(JSON.stringify({ ok: false, reason: "no_admin_phones" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: any[] = [];

    for (const admin of admins) {
      const tenantId = admin.tenant_id;
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      // 2. Metrics
      // Total leads
      const { count: totalLeads } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null);

      // New leads (7 days)
      const { count: newLeads } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .is("deleted_at", null)
        .gte("created_at", sevenDaysAgo);

      // Hot leads
      const { count: hotLeads } = await supabase
        .from("lead_scores")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("nivel", "hot");

      // Projetos ganhos (status=concluido last 7 days)
      const { count: projetosGanhos } = await supabase
        .from("projetos")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .in("status", ["concluido", "comissionado", "instalado"])
        .gte("updated_at", sevenDaysAgo);

      // SLA alerts open
      const { count: slaAbertos } = await supabase
        .from("wa_sla_alerts")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("resolved", false);

      // Overdue follow-ups
      const { count: followupsAtrasados } = await supabase
        .from("lead_atividades")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("concluido", false)
        .lt("data_agendada", new Date().toISOString());

      // 3. Build message
      const dataFormatada = new Date().toLocaleDateString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });

      const mensagem = `📊 *Relatório Semanal — ${dataFormatada}*

Leads: ${totalLeads ?? 0} (${newLeads ?? 0} novos)
🔥 Hot leads: ${hotLeads ?? 0}
✅ Projetos ganhos: ${projetosGanhos ?? 0}
⚠️ SLA em aberto: ${slaAbertos ?? 0}
📋 Follow-ups atrasados: ${followupsAtrasados ?? 0}

_Mais Energia Solar 🌞_`;

      // 4. Send via send-whatsapp-message (internal call with service_role)
      const { error: sendError } = await supabase.functions.invoke(
        "send-whatsapp-message",
        {
          body: {
            telefone: admin.telefone,
            mensagem,
            tipo: "automatico",
            tenant_id: tenantId,
          },
        },
      );

      results.push({
        admin: admin.nome,
        tenant_id: tenantId,
        sent: !sendError,
        error: sendError?.message ?? null,
      });
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("director-weekly-report error:", err);
    return new Response(
      JSON.stringify({ ok: false, error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
