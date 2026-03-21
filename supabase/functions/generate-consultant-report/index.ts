import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAuth = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAuth.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub as string;

    const supabase = createClient(supabaseUrl, serviceKey);

    // Get tenant
    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      return new Response(JSON.stringify({ error: "Tenant not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const tenantId = profile.tenant_id;

    const body = await req.json();
    const { consultor_id, mes, ano } = body;

    if (!consultor_id || mes === undefined || ano === undefined) {
      return new Response(JSON.stringify({ error: "consultor_id, mes, ano required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch consultant
    const { data: consultor } = await supabase
      .from("consultores")
      .select("nome, email, telefone")
      .eq("id", consultor_id)
      .eq("tenant_id", tenantId)
      .single();

    if (!consultor) {
      return new Response(JSON.stringify({ error: "Consultor not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Period
    const startDate = new Date(ano, mes - 1, 1).toISOString();
    const endDate = new Date(ano, mes, 0, 23, 59, 59).toISOString();
    const mesNome = new Date(ano, mes - 1).toLocaleDateString("pt-BR", { month: "long", year: "numeric", timeZone: "America/Sao_Paulo" });

    // Leads assigned to consultant in period
    const { data: leads = [] } = await supabase
      .from("leads")
      .select("id, nome, status_id, valor_projeto, created_at")
      .eq("tenant_id", tenantId)
      .eq("consultor", consultor.nome)
      .gte("created_at", startDate)
      .lte("created_at", endDate)
      .is("deleted_at", null);

    // Lead status counts
    const { data: statuses = [] } = await supabase
      .from("lead_statuses")
      .select("id, nome")
      .eq("tenant_id", tenantId);

    const statusMap = new Map(statuses.map((s: any) => [s.id, s.nome]));
    const statusCounts: Record<string, number> = {};
    leads.forEach((l: any) => {
      const name = statusMap.get(l.status_id) || "Sem status";
      statusCounts[name] = (statusCounts[name] || 0) + 1;
    });

    // Won projects
    const { data: projetos = [] } = await supabase
      .from("projetos")
      .select("id, valor_total")
      .eq("tenant_id", tenantId)
      .eq("consultor_id", consultor_id)
      .in("status", ["concluido", "comissionado", "instalado"])
      .gte("updated_at", startDate)
      .lte("updated_at", endDate);

    // Commissions
    const { data: comissoes = [] } = await supabase
      .from("comissoes")
      .select("valor_comissao, status")
      .eq("tenant_id", tenantId)
      .eq("consultor_id", consultor_id)
      .eq("mes_referencia", mes)
      .eq("ano_referencia", ano);

    const totalComissoes = comissoes.reduce((s: number, c: any) => s + (c.valor_comissao || 0), 0);

    // KPIs
    const totalLeads = leads.length;
    const projetosGanhos = projetos.length;
    const taxaConversao = totalLeads > 0 ? ((projetosGanhos / totalLeads) * 100).toFixed(1) : "0";
    const ticketMedio = projetosGanhos > 0
      ? (projetos.reduce((s: number, p: any) => s + (p.valor_total || 0), 0) / projetosGanhos)
      : 0;

    // Brand
    const { data: brand } = await supabase
      .from("brand_settings")
      .select("logo_url, color_primary")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // Generate HTML
    const primaryColor = brand?.color_primary || "#f97316";
    const logoHtml = brand?.logo_url
      ? `<img src="${brand.logo_url}" alt="Logo" style="max-height:48px;margin-bottom:16px;" />`
      : "";

    const statusRows = Object.entries(statusCounts)
      .map(([name, count]) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee;">${name}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;text-align:center;font-weight:600;">${count}</td></tr>`)
      .join("");

    // Funnel bars
    const maxCount = Math.max(...Object.values(statusCounts), 1);
    const funnelBars = Object.entries(statusCounts)
      .map(([name, count]) => {
        const pct = Math.round((count / maxCount) * 100);
        return `<div style="margin-bottom:8px;"><div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:2px;"><span>${name}</span><span style="font-weight:600;">${count}</span></div><div style="background:#f3f4f6;border-radius:4px;overflow:hidden;"><div style="height:24px;background:${primaryColor};width:${pct}%;border-radius:4px;"></div></div></div>`;
      })
      .join("");

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><title>Relatório - ${consultor.nome}</title>
<style>
  body { font-family: 'Segoe UI', sans-serif; max-width: 800px; margin: 0 auto; padding: 32px; color: #1a1a1a; }
  .header { text-align: center; border-bottom: 3px solid ${primaryColor}; padding-bottom: 24px; margin-bottom: 32px; }
  .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 32px; }
  .kpi { border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; text-align: center; border-top: 3px solid ${primaryColor}; }
  .kpi-value { font-size: 28px; font-weight: 700; color: ${primaryColor}; }
  .kpi-label { font-size: 12px; color: #6b7280; margin-top: 4px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
  th { background: #f9fafb; padding: 10px 12px; text-align: left; font-size: 13px; font-weight: 600; border-bottom: 2px solid #e5e7eb; }
  .section-title { font-size: 16px; font-weight: 700; margin: 32px 0 16px; padding-bottom: 8px; border-bottom: 2px solid ${primaryColor}; }
  .footer { margin-top: 48px; text-align: center; font-size: 11px; color: #9ca3af; }
</style>
</head>
<body>
  <div class="header">
    ${logoHtml}
    <h1 style="margin:0;font-size:22px;">Relatório de Performance</h1>
    <p style="color:#6b7280;margin:8px 0 0;">${consultor.nome} — ${mesNome}</p>
  </div>

  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-value">${totalLeads}</div><div class="kpi-label">Leads</div></div>
    <div class="kpi"><div class="kpi-value">${projetosGanhos}</div><div class="kpi-label">Projetos Ganhos</div></div>
    <div class="kpi"><div class="kpi-value">${taxaConversao}%</div><div class="kpi-label">Taxa de Conversão</div></div>
    <div class="kpi"><div class="kpi-value">R$ ${ticketMedio.toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</div><div class="kpi-label">Ticket Médio</div></div>
  </div>

  <div class="section-title">Leads por Status</div>
  <table>
    <thead><tr><th>Status</th><th style="text-align:center;">Quantidade</th></tr></thead>
    <tbody>${statusRows || '<tr><td colspan="2" style="padding:12px;text-align:center;color:#9ca3af;">Nenhum lead no período</td></tr>'}</tbody>
  </table>

  <div class="section-title">Funil de Vendas</div>
  ${funnelBars || '<p style="color:#9ca3af;">Sem dados para exibir</p>'}

  <div class="section-title">Comissões</div>
  <div class="kpi-grid" style="grid-template-columns:repeat(2,1fr);">
    <div class="kpi"><div class="kpi-value">R$ ${totalComissoes.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</div><div class="kpi-label">Total Comissões</div></div>
    <div class="kpi"><div class="kpi-value">${comissoes.length}</div><div class="kpi-label">Lançamentos</div></div>
  </div>

  <div class="footer">
    Gerado em ${new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })} às ${new Date().toLocaleTimeString("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" })}
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
    });
  } catch (err) {
    console.error("[generate-consultant-report] Error:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
