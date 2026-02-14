import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // ── 1. AUTH + TENANT ────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Não autorizado", 401);
    }

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } = await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) return jsonError("Token inválido", 401);
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    const { data: profile } = await adminClient.from("profiles").select("tenant_id, ativo").eq("user_id", userId).single();
    if (!profile?.tenant_id || !profile.ativo) return jsonError("Usuário inativo ou sem tenant", 403);
    const tenantId = profile.tenant_id;

    const { data: tenant } = await adminClient.from("tenants").select("id, status, nome").eq("id", tenantId).single();
    if (!tenant || tenant.status !== "active") return jsonError("Tenant suspenso ou inativo", 403);

    const { data: roles } = await adminClient.from("user_roles").select("role").eq("user_id", userId);
    const hasPermission = roles?.some((r: any) => ["admin", "gerente", "financeiro", "consultor"].includes(r.role));
    if (!hasPermission) return jsonError("Sem permissão", 403);

    // ── 2. PARSE ────────────────────────────────────────────
    const body = await req.json();
    const { versao_id } = body;
    if (!versao_id) return jsonError("versao_id é obrigatório", 400);

    // ── 3. BUSCAR VERSÃO + SNAPSHOT ─────────────────────────
    const { data: versao, error: versaoErr } = await adminClient
      .from("proposta_versoes")
      .select("id, proposta_id, versao_numero, status, grupo, snapshot, potencia_kwp, valor_total, economia_mensal, payback_meses, valido_ate, observacoes")
      .eq("id", versao_id)
      .eq("tenant_id", tenantId)
      .single();

    if (versaoErr || !versao) return jsonError("Versão não encontrada neste tenant", 404);
    if (!versao.snapshot) return jsonError("Versão sem snapshot — gere a proposta primeiro", 400);

    // ── 4. IDEMPOTÊNCIA ─────────────────────────────────────
    const { data: existingRender } = await adminClient
      .from("proposta_renders")
      .select("id, url, html, created_at")
      .eq("versao_id", versao_id)
      .eq("tenant_id", tenantId)
      .eq("tipo", "html")
      .maybeSingle();

    if (existingRender) {
      return jsonOk({ success: true, idempotent: true, render_id: existingRender.id, url: existingRender.url, html: existingRender.html });
    }

    // ── 5. BUSCAR DADOS PARA RENDER ─────────────────────────
    const { data: proposta } = await adminClient
      .from("propostas_nativas")
      .select("id, titulo, codigo, lead_id, cliente_id, template_id")
      .eq("id", versao.proposta_id)
      .eq("tenant_id", tenantId)
      .single();

    let clienteNome = "Cliente";
    let clienteTelefone = "";
    if (proposta?.cliente_id) {
      const { data: cli } = await adminClient.from("clientes").select("nome, telefone").eq("id", proposta.cliente_id).eq("tenant_id", tenantId).maybeSingle();
      if (cli) { clienteNome = cli.nome; clienteTelefone = cli.telefone; }
    }
    if (clienteNome === "Cliente" && proposta?.lead_id) {
      const { data: lead } = await adminClient.from("leads").select("nome, telefone").eq("id", proposta.lead_id).eq("tenant_id", tenantId).maybeSingle();
      if (lead) { clienteNome = lead.nome; clienteTelefone = lead.telefone ?? ""; }
    }

    const { data: brand } = await adminClient
      .from("brand_settings")
      .select("logo_url, color_primary, color_primary_foreground, color_background, color_foreground, font_heading, font_body")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // ── 6. GERAR HTML ───────────────────────────────────────
    const snap = versao.snapshot as any;
    const html = renderProposalHtml({
      tenantNome: tenant.nome ?? "Empresa",
      logoUrl: brand?.logo_url ?? null,
      primaryColor: brand?.color_primary ?? "220 70% 50%",
      fontHeading: brand?.font_heading ?? "Inter",
      fontBody: brand?.font_body ?? "Inter",
      clienteNome,
      clienteTelefone,
      propostaCodigo: proposta?.codigo ?? `#${versao.versao_numero}`,
      versaoNumero: versao.versao_numero,
      grupo: versao.grupo ?? snap.grupo ?? "B",
      validoAte: versao.valido_ate,
      snap,
    });

    // ── 7. SALVAR ───────────────────────────────────────────
    const { data: render, error: renderErr } = await adminClient
      .from("proposta_renders")
      .insert({
        tenant_id: tenantId, versao_id: versao.id, tipo: "html", html,
        url: null, storage_path: null,
        tamanho_bytes: new TextEncoder().encode(html).length,
        gerado_por: userId,
      })
      .select("id")
      .single();

    if (renderErr) {
      if (renderErr.code === "23505") {
        const { data: dup } = await adminClient.from("proposta_renders").select("id, url, html").eq("versao_id", versao_id).eq("tenant_id", tenantId).eq("tipo", "html").maybeSingle();
        if (dup) return jsonOk({ success: true, idempotent: true, render_id: dup.id, url: dup.url, html: dup.html });
      }
      return jsonError(`Erro ao salvar render: ${renderErr.message}`, 500);
    }

    return jsonOk({ success: true, idempotent: false, render_id: render!.id, html, url: null });
  } catch (err) {
    console.error("[proposal-render] Error:", err);
    return jsonError(err.message ?? "Erro interno", 500);
  }
});

// ── HTML RENDERER ───────────────────────────────────────────

interface RenderParams {
  tenantNome: string;
  logoUrl: string | null;
  primaryColor: string;
  fontHeading: string;
  fontBody: string;
  clienteNome: string;
  clienteTelefone: string;
  propostaCodigo: string;
  versaoNumero: number;
  grupo: string;
  validoAte: string | null;
  snap: any;
}

function renderProposalHtml(p: RenderParams): string {
  const fin = p.snap.financeiro ?? {};
  const tec = p.snap.tecnico ?? {};
  const trib = p.snap.tributacao ?? {};
  const lei = p.snap.regra_lei_14300 ?? {};
  const itens = p.snap.itens ?? [];
  const premissas = p.snap.premissas ?? {};
  const ucs = p.snap.ucs ?? [];
  const servicos = p.snap.servicos ?? [];
  const pagamentos = p.snap.pagamento_opcoes ?? [];
  const venda = p.snap.venda ?? {};

  const fmt = (v: number) => `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itensRows = itens.map((it: any) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${it.descricao}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.quantidade}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(it.preco_unitario)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(it.subtotal)}</td>
    </tr>`).join("");

  const ucsSection = ucs.length > 0 ? `
  <div class="section">
    <div class="section-title">Unidades Consumidoras (${ucs.length})</div>
    ${ucs.map((uc: any) => `
    <div style="margin-bottom:12px;padding:12px;background:#f8f9fa;border-radius:8px">
      <div style="font-weight:600;margin-bottom:6px">${uc.nome} — ${uc.tipo_dimensionamento} (${uc.subgrupo})</div>
      <div class="grid">
        <div><span class="label">Consumo</span><div class="value">${uc.tipo_dimensionamento === "MT" ? `P: ${uc.consumo_mensal_p} / FP: ${uc.consumo_mensal_fp}` : `${uc.consumo_mensal} kWh/mês`}</div></div>
        <div><span class="label">Fase</span><div class="value">${uc.fase}</div></div>
        <div><span class="label">Local</span><div class="value">${uc.cidade}/${uc.estado}</div></div>
        <div><span class="label">Telhado</span><div class="value">${uc.tipo_telhado || "-"}</div></div>
      </div>
    </div>`).join("")}
  </div>` : "";

  const servicosSection = servicos.length > 0 ? `
  <div class="section">
    <div class="section-title">Serviços</div>
    <table>
      <thead><tr><th>Serviço</th><th>Categoria</th><th style="text-align:right">Valor</th><th style="text-align:center">Incluso</th></tr></thead>
      <tbody>${servicos.map((s: any) => `
        <tr>
          <td style="padding:8px;border-bottom:1px solid #eee">${s.descricao}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${s.categoria}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(s.valor)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${s.incluso_no_preco ? "✓" : "Extra"}</td>
        </tr>`).join("")}</tbody>
    </table>
  </div>` : "";

  const pagamentoSection = pagamentos.length > 0 ? `
  <div class="section">
    <div class="section-title">Opções de Pagamento</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
      ${pagamentos.map((pg: any, i: number) => `
      <div style="padding:16px;border:2px solid hsl(${p.primaryColor}/0.2);border-radius:12px;text-align:center">
        <div style="font-size:11px;color:#666;text-transform:uppercase;margin-bottom:4px">Opção ${i + 1}</div>
        <div style="font-weight:700;margin-bottom:4px">${pg.nome}</div>
        <div style="font-size:22px;font-weight:700;color:hsl(${p.primaryColor})">${pg.tipo === "a_vista" ? fmt(pg.valor_parcela) : `${pg.num_parcelas}x ${fmt(pg.valor_parcela)}`}</div>
        ${pg.entrada > 0 ? `<div style="font-size:12px;color:#666;margin-top:4px">+ entrada ${fmt(pg.entrada)}</div>` : ""}
        ${pg.taxa_mensal > 0 ? `<div style="font-size:11px;color:#999">${pg.taxa_mensal}% a.m.</div>` : ""}
      </div>`).join("")}
    </div>
  </div>` : "";

  const premissasSection = premissas ? `
  <div class="section">
    <div class="section-title">Premissas do Cálculo</div>
    <div class="grid">
      <div><span class="label">Inflação Energética</span><div class="value">${premissas.inflacao_energetica ?? 6.5}% a.a.</div></div>
      <div><span class="label">Perda Eficiência</span><div class="value">${premissas.perda_eficiencia_anual ?? 0.5}% a.a.</div></div>
      <div><span class="label">Troca Inversor</span><div class="value">Ano ${premissas.troca_inversor_anos ?? 15} (${premissas.troca_inversor_custo ?? 30}%)</div></div>
      <div><span class="label">Taxa Desconto VPL</span><div class="value">${premissas.vpl_taxa_desconto ?? 10}%</div></div>
    </div>
  </div>` : "";

  const vendaSection = `
  <div class="section">
    <div class="section-title">Composição do Investimento</div>
    <div style="border:1px solid #eee;border-radius:8px;overflow:hidden">
      <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #eee"><span>Equipamentos</span><strong>${fmt(fin.custo_kit ?? 0)}</strong></div>
      <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #eee"><span>Serviços</span><strong>${fmt(fin.custo_servicos_inclusos ?? 0)}</strong></div>
      ${fin.custo_comissao > 0 ? `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #eee"><span>Comissão</span><strong>${fmt(fin.custo_comissao)}</strong></div>` : ""}
      <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #eee"><span>Margem (${fin.margem_percentual ?? 0}%)</span><strong style="color:#16a34a">${fmt(fin.margem_valor ?? 0)}</strong></div>
      ${fin.desconto_percentual > 0 ? `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #eee"><span>Desconto (${fin.desconto_percentual}%)</span><strong style="color:#dc2626">-${fmt(fin.desconto_valor ?? 0)}</strong></div>` : ""}
      <div style="display:flex;justify-content:space-between;padding:12px 16px;background:hsl(${p.primaryColor}/0.06);font-weight:700;font-size:16px"><span>Investimento Total</span><span style="color:hsl(${p.primaryColor})">${fmt(fin.valor_total ?? 0)}</span></div>
    </div>
  </div>`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Proposta ${p.propostaCodigo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'${p.fontBody}',sans-serif; color:#1a1a2e; background:#f8f9fa; }
  .container { max-width:800px; margin:0 auto; background:#fff; }
  .header { background:hsl(${p.primaryColor}); color:#fff; padding:32px; display:flex; align-items:center; gap:20px; }
  .header img { max-height:60px; }
  .header h1 { font-family:'${p.fontHeading}',sans-serif; font-size:22px; }
  .header p { opacity:0.85; font-size:13px; margin-top:4px; }
  .section { padding:24px 32px; }
  .section-title { font-family:'${p.fontHeading}',sans-serif; font-size:16px; font-weight:700; margin-bottom:12px; color:hsl(${p.primaryColor}); border-bottom:2px solid hsl(${p.primaryColor}/0.2); padding-bottom:6px; }
  .grid { display:grid; grid-template-columns:1fr 1fr; gap:8px 24px; }
  .label { font-size:12px; color:#666; }
  .value { font-size:15px; font-weight:600; margin-bottom:8px; }
  table { width:100%; border-collapse:collapse; font-size:14px; }
  th { text-align:left; padding:10px 8px; background:hsl(${p.primaryColor}/0.08); font-weight:600; font-size:12px; text-transform:uppercase; }
  .totals { background:#f8f9fa; padding:20px 32px; }
  .totals .grid-3 { display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; }
  .highlight { background:hsl(${p.primaryColor}/0.06); border-radius:8px; padding:16px; text-align:center; }
  .highlight .value { font-size:24px; color:hsl(${p.primaryColor}); margin-bottom:0; }
  .footer { padding:20px 32px; font-size:11px; color:#999; text-align:center; border-top:1px solid #eee; }
  .badge { display:inline-block; padding:3px 10px; border-radius:12px; font-size:11px; font-weight:600; background:hsl(${p.primaryColor}/0.1); color:hsl(${p.primaryColor}); }
</style>
</head>
<body>
<div class="container">
  <div class="header">
    ${p.logoUrl ? `<img src="${p.logoUrl}" alt="Logo">` : ""}
    <div>
      <h1>${p.tenantNome}</h1>
      <p>Proposta Comercial de Energia Solar</p>
    </div>
  </div>

  <div class="section">
    <div class="grid">
      <div><span class="label">Cliente</span><div class="value">${p.clienteNome}</div></div>
      <div><span class="label">Proposta</span><div class="value">${p.propostaCodigo} <span class="badge">v${p.versaoNumero}</span></div></div>
      <div><span class="label">Grupo Tarifário</span><div class="value">Grupo ${p.grupo}</div></div>
      <div><span class="label">Validade</span><div class="value">${p.validoAte ?? "30 dias"}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Dados Técnicos</div>
    <div class="grid">
      <div><span class="label">Potência do Sistema</span><div class="value">${tec.potencia_kwp ?? "-"} kWp</div></div>
      <div><span class="label">Consumo Total</span><div class="value">${tec.consumo_total_kwh ?? tec.consumo_medio_kwh ?? "-"} kWh/mês</div></div>
      <div><span class="label">Geração Estimada</span><div class="value">${tec.geracao_estimada_kwh ?? "-"} kWh/mês</div></div>
      <div><span class="label">UCs</span><div class="value">${tec.num_ucs ?? 1}</div></div>
    </div>
  </div>

  ${ucsSection}

  <div class="section">
    <div class="section-title">Lei 14.300 — Regime de Compensação</div>
    <div class="grid">
      <div><span class="label">Ano de Referência</span><div class="value">${lei.fio_b_ano ?? "-"}</div></div>
      <div><span class="label">Fio B (não compensado)</span><div class="value">${lei.percentual_nao_compensado ?? "-"}%</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Equipamentos</div>
    <table>
      <thead><tr><th>Descrição</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Subtotal</th></tr></thead>
      <tbody>${itensRows}</tbody>
    </table>
  </div>

  ${servicosSection}
  ${vendaSection}

  <div class="totals">
    <div class="grid-3">
      <div class="highlight">
        <span class="label">Investimento Total</span>
        <div class="value">${fmt(fin.valor_total ?? 0)}</div>
      </div>
      <div class="highlight">
        <span class="label">Economia Mensal</span>
        <div class="value">${fmt(fin.economia_mensal ?? 0)}</div>
      </div>
      <div class="highlight">
        <span class="label">Payback</span>
        <div class="value">${fin.payback_meses ?? "-"} meses</div>
      </div>
    </div>
    ${fin.vpl != null ? `
    <div class="grid-3" style="margin-top:12px">
      <div class="highlight">
        <span class="label">VPL</span>
        <div class="value" style="font-size:18px">${fmt(fin.vpl)}</div>
      </div>
      <div class="highlight">
        <span class="label">TIR</span>
        <div class="value" style="font-size:18px">${(fin.tir ?? 0).toFixed(1)}%</div>
      </div>
      <div class="highlight">
        <span class="label">ROI 25 anos</span>
        <div class="value" style="font-size:18px">${fmt(fin.roi_25_anos ?? 0)}</div>
      </div>
    </div>` : ""}
  </div>

  ${premissasSection}
  ${pagamentoSection}

  <div class="footer">
    Proposta gerada em ${new Date().toLocaleDateString("pt-BR")} • ${p.tenantNome} • Válida até ${p.validoAte ?? "consultar"}
  </div>
</div>
</body>
</html>`;
}

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
