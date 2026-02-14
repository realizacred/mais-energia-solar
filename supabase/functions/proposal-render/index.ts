import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  try {
    // ── 1. AUTH ──────────────────────────────────────────────
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Não autorizado", 401);
    }

    const callerClient = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsErr } =
      await callerClient.auth.getClaims(token);
    if (claimsErr || !claimsData?.claims) {
      return jsonError("Token inválido", 401);
    }
    const userId = claimsData.claims.sub as string;

    const adminClient = createClient(supabaseUrl, serviceRoleKey);

    // Resolve tenant
    const { data: profile } = await adminClient
      .from("profiles")
      .select("tenant_id, ativo")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id || !profile.ativo) {
      return jsonError("Usuário inativo ou sem tenant", 403);
    }
    const tenantId = profile.tenant_id;

    // ── 2. PARSE PAYLOAD ────────────────────────────────────
    const body = await req.json();
    const { versao_id } = body;

    if (!versao_id) {
      return jsonError("versao_id é obrigatório", 400);
    }

    // ── 3. BUSCAR VERSÃO + SNAPSHOT ─────────────────────────
    const { data: versao, error: versaoErr } = await adminClient
      .from("proposta_versoes")
      .select(
        "id, proposta_id, versao_numero, status, grupo, snapshot, potencia_kwp, valor_total, economia_mensal, payback_meses, valido_ate, observacoes"
      )
      .eq("id", versao_id)
      .eq("tenant_id", tenantId)
      .single();

    if (versaoErr || !versao) {
      return jsonError("Versão não encontrada neste tenant", 404);
    }

    if (!versao.snapshot) {
      return jsonError("Versão sem snapshot — gere a proposta primeiro", 400);
    }

    // ── 4. IDEMPOTÊNCIA: verificar render existente ─────────
    const { data: existingRender } = await adminClient
      .from("proposta_renders")
      .select("id, url, created_at")
      .eq("versao_id", versao_id)
      .eq("tenant_id", tenantId)
      .eq("tipo", "html")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingRender) {
      return jsonOk({
        success: true,
        idempotent: true,
        render_id: existingRender.id,
        url: existingRender.url,
      });
    }

    // ── 5. BUSCAR PROPOSTA + LEAD + TEMPLATE + BRANDING ─────
    const { data: proposta } = await adminClient
      .from("propostas_nativas")
      .select("id, titulo, codigo, lead_id, cliente_id, template_id")
      .eq("id", versao.proposta_id)
      .eq("tenant_id", tenantId)
      .single();

    // Lead/Cliente info
    let clienteNome = "Cliente";
    let clienteTelefone = "";
    if (proposta?.cliente_id) {
      const { data: cli } = await adminClient
        .from("clientes")
        .select("nome, telefone")
        .eq("id", proposta.cliente_id)
        .eq("tenant_id", tenantId)
        .single();
      if (cli) {
        clienteNome = cli.nome;
        clienteTelefone = cli.telefone;
      }
    } else if (proposta?.lead_id) {
      const { data: lead } = await adminClient
        .from("leads")
        .select("nome, telefone")
        .eq("id", proposta.lead_id)
        .eq("tenant_id", tenantId)
        .single();
      if (lead) {
        clienteNome = lead.nome;
        clienteTelefone = lead.telefone ?? "";
      }
    }

    // Branding
    const { data: brand } = await adminClient
      .from("brand_settings")
      .select(
        "logo_url, color_primary, color_primary_foreground, color_background, color_foreground, font_heading, font_body"
      )
      .eq("tenant_id", tenantId)
      .maybeSingle();

    // Tenant name
    const { data: tenantData } = await adminClient
      .from("tenants")
      .select("nome")
      .eq("id", tenantId)
      .single();

    // ── 6. GERAR HTML ───────────────────────────────────────
    const snap = versao.snapshot as any;
    const html = renderProposalHtml({
      tenantNome: tenantData?.nome ?? "Empresa",
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

    // ── 7. SALVAR RENDER ────────────────────────────────────
    const { data: render, error: renderErr } = await adminClient
      .from("proposta_renders")
      .insert({
        tenant_id: tenantId,
        versao_id: versao.id,
        tipo: "html",
        url: null, // HTML inline por enquanto; URL gerada quando publicar
        storage_path: null,
        tamanho_bytes: new TextEncoder().encode(html).length,
        gerado_por: userId,
      })
      .select("id")
      .single();

    if (renderErr) {
      return jsonError(`Erro ao salvar render: ${renderErr.message}`, 500);
    }

    return jsonOk({
      success: true,
      idempotent: false,
      render_id: render!.id,
      html,
      // TODO: quando implementar storage, retornar url aqui
      url: null,
    });
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

  const formatBRL = (v: number) =>
    `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const itensRows = itens
    .map(
      (it: any) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${it.descricao}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${it.quantidade}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatBRL(it.preco_unitario)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${formatBRL(it.subtotal)}</td>
    </tr>`
    )
    .join("");

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
  .totals .grid { grid-template-columns:1fr 1fr 1fr; }
  .highlight { background:hsl(${p.primaryColor}/0.06); border-radius:8px; padding:16px; text-align:center; }
  .highlight .value { font-size:24px; color:hsl(${p.primaryColor}); }
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
      <div><span class="label">Consumo Médio</span><div class="value">${tec.consumo_medio_kwh ?? "-"} kWh/mês</div></div>
      <div><span class="label">Geração Estimada</span><div class="value">${tec.geracao_estimada_kwh ?? "-"} kWh/mês</div></div>
      <div><span class="label">Concessionária</span><div class="value">${trib.concessionaria ?? trib.estado ?? "-"}</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Lei 14.300 — Regime de Compensação</div>
    <div class="grid">
      <div><span class="label">Ano de Referência</span><div class="value">${lei.fio_b_ano ?? "-"}</div></div>
      <div><span class="label">Fio B (não compensado)</span><div class="value">${lei.percentual_nao_compensado ?? "-"}%</div></div>
      <div><span class="label">Tarifa Fio B</span><div class="value">${formatBRL(trib.tarifa_fio_b ?? 0)}/kWh</div></div>
      <div><span class="label">Custo Disponibilidade</span><div class="value">${formatBRL(trib.custo_disponibilidade ?? 0)}/mês</div></div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Equipamentos</div>
    <table>
      <thead><tr>
        <th>Descrição</th><th style="text-align:center">Qtd</th><th style="text-align:right">Unit.</th><th style="text-align:right">Subtotal</th>
      </tr></thead>
      <tbody>${itensRows}</tbody>
    </table>
  </div>

  <div class="totals">
    <div class="grid">
      <div class="highlight">
        <span class="label">Investimento Total</span>
        <div class="value">${formatBRL(fin.valor_total ?? 0)}</div>
      </div>
      <div class="highlight">
        <span class="label">Economia Mensal</span>
        <div class="value">${formatBRL(fin.economia_mensal ?? 0)}</div>
      </div>
      <div class="highlight">
        <span class="label">Payback Estimado</span>
        <div class="value">${fin.payback_meses ?? "-"} meses</div>
      </div>
    </div>
  </div>

  ${fin.desconto_percentual > 0 ? `
  <div class="section" style="padding-top:0">
    <div class="grid">
      <div><span class="label">Subtotal Equipamentos</span><div class="value">${formatBRL(fin.subtotal_equipamentos ?? 0)}</div></div>
      <div><span class="label">Desconto (${fin.desconto_percentual}%)</span><div class="value" style="color:#16a34a">-${formatBRL(fin.desconto_valor ?? 0)}</div></div>
    </div>
  </div>` : ""}

  <div class="footer">
    Proposta gerada em ${new Date().toLocaleDateString("pt-BR")} • ${p.tenantNome} • Válida até ${p.validoAte ?? "consultar"}
  </div>
</div>
</body>
</html>`;
}

function jsonOk(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function jsonError(message: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
