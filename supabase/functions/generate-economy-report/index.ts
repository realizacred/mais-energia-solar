import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function formatBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Unauthorized");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Validate user
    const anonClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authErr } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));
    if (authErr || !user) throw new Error("Unauthorized");

    const { data: profile } = await supabase
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (!profile?.tenant_id) throw new Error("No tenant");
    const tenantId = profile.tenant_id;

    const { unit_id } = await req.json();
    if (!unit_id) throw new Error("unit_id required");

    // 1. Fetch UC
    const { data: uc, error: ucErr } = await supabase
      .from("units")
      .select("id, nome, codigo_uc, tipo_uc, concessionaria_nome, classificacao_grupo, classificacao_subgrupo, endereco, cliente_id")
      .eq("id", unit_id)
      .eq("tenant_id", tenantId)
      .maybeSingle();
    if (ucErr || !uc) throw new Error("UC not found");

    // 2. Fetch client
    let clienteNome = "—";
    if (uc.cliente_id) {
      const { data: cliente } = await supabase
        .from("clientes")
        .select("nome")
        .eq("id", uc.cliente_id)
        .maybeSingle();
      if (cliente) clienteNome = cliente.nome;
    }

    // 3. Fetch tenant info
    const { data: tenant } = await supabase
      .from("tenants")
      .select("nome, cnpj, telefone, email, cidade, estado")
      .eq("id", tenantId)
      .maybeSingle();

    // 4. Fetch invoices for economy data
    const { data: invoices } = await supabase
      .from("unit_invoices")
      .select("*")
      .eq("unit_id", unit_id)
      .eq("tenant_id", tenantId)
      .order("referencia_ano", { ascending: true })
      .order("referencia_mes", { ascending: true });

    const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    // Build economy rows
    const rows = (invoices || []).map((inv: any) => {
      const compensado = Number(inv.energia_compensada_kwh || 0);
      const tarifa = Number(inv.tarifa_media || inv.tarifa_energia || 0);
      const economia = compensado * tarifa;
      return {
        periodo: `${MONTHS[(inv.referencia_mes || 1) - 1]}/${inv.referencia_ano}`,
        consumo: Number(inv.consumo_kwh || 0),
        compensado,
        injetado: Number(inv.energia_injetada_kwh || 0),
        tarifa,
        economia,
        valor_fatura: Number(inv.valor_total || 0),
      };
    });

    const totalEconomia = rows.reduce((s, r) => s + r.economia, 0);
    const totalCompensado = rows.reduce((s, r) => s + r.compensado, 0);
    const avgEconomiaMensal = rows.length > 0 ? totalEconomia / rows.length : 0;
    const projecao25Anos = avgEconomiaMensal * 12 * 25;

    // 5. Generate HTML
    const dataHoje = new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
    const enderecoStr = uc.endereco
      ? [uc.endereco.logradouro, uc.endereco.numero, uc.endereco.bairro, uc.endereco.cidade, uc.endereco.estado].filter(Boolean).join(", ")
      : "—";

    const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Relatório de Economia — ${uc.nome}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; color: #1a1a2e; background: #fff; padding: 40px; max-width: 900px; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #f97316; padding-bottom: 20px; margin-bottom: 30px; }
    .header h1 { font-size: 22px; color: #1a1a2e; }
    .header .company { text-align: right; font-size: 12px; color: #64748b; }
    .section { margin-bottom: 24px; }
    .section-title { font-size: 14px; font-weight: 700; color: #f97316; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 12px; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; }
    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 24px; font-size: 13px; }
    .info-grid .label { color: #64748b; }
    .info-grid .value { font-weight: 600; }
    .kpi-row { display: flex; gap: 16px; margin-bottom: 24px; }
    .kpi { flex: 1; background: #f8fafc; border: 1px solid #e2e8f0; border-left: 4px solid #f97316; border-radius: 8px; padding: 16px; }
    .kpi .kpi-value { font-size: 22px; font-weight: 800; color: #1a1a2e; }
    .kpi .kpi-label { font-size: 11px; color: #64748b; margin-top: 4px; }
    table { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 8px; }
    th { background: #f1f5f9; color: #475569; font-weight: 700; text-align: left; padding: 8px; border-bottom: 2px solid #e2e8f0; }
    td { padding: 7px 8px; border-bottom: 1px solid #f1f5f9; }
    tr:nth-child(even) td { background: #fafbfc; }
    .text-right { text-align: right; }
    .total-row td { font-weight: 800; background: #fff7ed !important; border-top: 2px solid #f97316; }
    .footer { margin-top: 40px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 16px; }
    @media print { body { padding: 20px; } }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>📊 Relatório de Economia Solar</h1>
      <p style="font-size:12px;color:#64748b;margin-top:4px;">Gerado em ${dataHoje}</p>
    </div>
    <div class="company">
      <strong>${tenant?.nome || "Empresa"}</strong><br/>
      ${tenant?.email || ""}<br/>
      ${tenant?.telefone || ""}
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados da Unidade Consumidora</div>
    <div class="info-grid">
      <span class="label">Denominação:</span><span class="value">${uc.nome}</span>
      <span class="label">Contrato:</span><span class="value">${uc.codigo_uc || "—"}</span>
      <span class="label">Cliente:</span><span class="value">${clienteNome}</span>
      <span class="label">Concessionária:</span><span class="value">${uc.concessionaria_nome || "—"}</span>
      <span class="label">Classificação:</span><span class="value">${uc.classificacao_grupo || "—"} ${uc.classificacao_subgrupo || ""}</span>
      <span class="label">Endereço:</span><span class="value">${enderecoStr}</span>
    </div>
  </div>

  <div class="kpi-row">
    <div class="kpi">
      <div class="kpi-value">${formatBRL(totalEconomia)}</div>
      <div class="kpi-label">Total Economizado</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${totalCompensado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh</div>
      <div class="kpi-label">Energia Compensada</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${formatBRL(avgEconomiaMensal)}</div>
      <div class="kpi-label">Média Mensal</div>
    </div>
    <div class="kpi">
      <div class="kpi-value">${formatBRL(projecao25Anos)}</div>
      <div class="kpi-label">Projeção 25 Anos</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Economia Mensal Detalhada</div>
    <table>
      <thead>
        <tr>
          <th>Período</th>
          <th class="text-right">Consumo (kWh)</th>
          <th class="text-right">Compensado (kWh)</th>
          <th class="text-right">Injetado (kWh)</th>
          <th class="text-right">Tarifa (R$/kWh)</th>
          <th class="text-right">Economia (R$)</th>
          <th class="text-right">Fatura (R$)</th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(r => `
        <tr>
          <td>${r.periodo}</td>
          <td class="text-right">${r.consumo.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
          <td class="text-right">${r.compensado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
          <td class="text-right">${r.injetado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
          <td class="text-right">${r.tarifa.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}</td>
          <td class="text-right">${formatBRL(r.economia)}</td>
          <td class="text-right">${formatBRL(r.valor_fatura)}</td>
        </tr>`).join("")}
        <tr class="total-row">
          <td>TOTAL</td>
          <td class="text-right">${rows.reduce((s, r) => s + r.consumo, 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
          <td class="text-right">${totalCompensado.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
          <td class="text-right">${rows.reduce((s, r) => s + r.injetado, 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}</td>
          <td></td>
          <td class="text-right">${formatBRL(totalEconomia)}</td>
          <td class="text-right">${formatBRL(rows.reduce((s, r) => s + r.valor_fatura, 0))}</td>
        </tr>
      </tbody>
    </table>
  </div>

  <div class="footer">
    ${tenant?.nome || "Mais Energia Solar"} — Relatório gerado automaticamente em ${dataHoje}
  </div>
</body>
</html>`;

    return new Response(html, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `attachment; filename="economia-${uc.codigo_uc || uc.id}.html"`,
      },
    });
  } catch (err) {
    console.error("[generate-economy-report]", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
