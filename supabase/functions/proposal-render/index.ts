import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-client-timeout, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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
    if (!authHeader?.startsWith("Bearer ")) return jsonError("Não autorizado", 401);

    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authErr } = await callerClient.auth.getUser();
    if (authErr || !user) {
      console.error("[proposal-render] Auth failed:", authErr?.message);
      return jsonError("Sessão expirada. Faça login novamente.", 401);
    }
    const userId = user.id;

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

    // ── 3. BUSCAR VERSÃO ────────────────────────────────────
    const { data: versao, error: versaoErr } = await adminClient
      .from("proposta_versoes")
      .select("id, proposta_id, versao_numero, status, grupo, snapshot, potencia_kwp, valor_total, economia_mensal, payback_meses, valido_ate, observacoes, calc_hash, engine_version, template_id_used")
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

    // ── 5. DADOS PARALELOS ──────────────────────────────────
    // Determine template ID: prefer versao.template_id_used, fallback to proposta.template_id
    const [propostaRes, brandRes, cenariosRes, seriesRes] = await Promise.all([
      adminClient.from("propostas_nativas")
        .select("id, titulo, codigo, lead_id, cliente_id, template_id")
        .eq("id", versao.proposta_id).eq("tenant_id", tenantId).single(),
      adminClient.from("brand_settings")
        .select("logo_url, color_primary, color_primary_foreground, color_background, color_foreground, font_heading, font_body")
        .eq("tenant_id", tenantId).maybeSingle(),
      adminClient.from("proposta_cenarios")
        .select("id, ordem, nome, tipo, is_default, preco_final, entrada_valor, entrada_percent, taxa_juros_mensal, taxa_juros_anual, cet_anual, num_parcelas, valor_parcela, valor_financiado, payback_meses, tir_anual, roi_25_anos, economia_primeiro_ano, financiador_id")
        .eq("versao_id", versao_id).eq("tenant_id", tenantId).order("ordem"),
      adminClient.from("proposta_versao_series")
        .select("cenario_id, ano, geracao_kwh, tarifa_vigente, degradacao_acumulada, economia_rs, economia_acumulada_rs, fluxo_caixa, fluxo_caixa_acumulado, parcela_financiamento")
        .eq("versao_id", versao_id).eq("tenant_id", tenantId).order("ano"),
    ]);

    const proposta = propostaRes.data;
    const brand = brandRes.data;
    const cenarios = cenariosRes.data ?? [];
    const allSeries = seriesRes.data ?? [];

    // Resolve client name
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

    // Group series by cenário
    const seriesByCenario = new Map<string, typeof allSeries>();
    for (const s of allSeries) {
      const key = s.cenario_id ?? "__base__";
      if (!seriesByCenario.has(key)) seriesByCenario.set(key, []);
      seriesByCenario.get(key)!.push(s);
    }

    // ── 6. RESOLVE TEMPLATE BLOCKS ──────────────────────────
    const templateId = (versao as any).template_id_used || proposta?.template_id;
    let templateBlocks: any[] | null = null;

    if (templateId) {
      const { data: tpl } = await adminClient
        .from("proposta_templates")
        .select("id, template_html, tipo")
        .eq("id", templateId)
        .eq("tenant_id", tenantId)
        .maybeSingle();

      if (tpl?.template_html && tpl.tipo !== "docx") {
        try {
          templateBlocks = typeof tpl.template_html === "string"
            ? JSON.parse(tpl.template_html)
            : tpl.template_html;
          if (!Array.isArray(templateBlocks)) templateBlocks = null;
        } catch {
          templateBlocks = null;
        }
      }
    }

    // ── 7. GERAR HTML ───────────────────────────────────────
    const snap = versao.snapshot as any;
    const renderParams: RenderParams = {
      tenantNome: tenant.nome ?? "Empresa",
      logoUrl: brand?.logo_url ?? null,
      primaryColor: brand?.color_primary ?? "220 70% 50%",
      successColor: "142 71% 45%",
      destructiveColor: "0 84% 60%",
      fontHeading: brand?.font_heading ?? "Inter",
      fontBody: brand?.font_body ?? "Inter",
      clienteNome,
      clienteTelefone,
      propostaCodigo: proposta?.codigo ?? `#${versao.versao_numero}`,
      versaoNumero: versao.versao_numero,
      grupo: versao.grupo ?? snap.grupo ?? "B",
      validoAte: versao.valido_ate,
      engineVersion: versao.engine_version ?? snap.engine_version ?? null,
      calcHash: versao.calc_hash ?? snap.calc_hash ?? null,
      snap,
      cenarios,
      seriesByCenario,
    };

    let html: string;

    if (templateBlocks && templateBlocks.length > 0) {
      // ── Render using template blocks (semantic + editor blocks)
      const variables = buildVariablesFromSnapshot(snap, renderParams);
      html = renderTemplateBlocksToHtml(templateBlocks, variables, renderParams);
    } else if (!templateId) {
      // No template linked — explicit error instead of silent legacy fallback
      console.error("[proposal-render] No template_id_used or template_id found for versao:", versao_id);
      return jsonError(
        "Nenhum template WEB foi vinculado à proposta/versão. Selecione um template no wizard e gere novamente.",
        400,
      );
    } else {
      // Template exists but has no blocks (edge case: empty template_html)
      console.error("[proposal-render] Template found but template_html is empty/invalid:", templateId);
      return jsonError(
        "O template selecionado não possui conteúdo HTML válido. Edite o template ou selecione outro.",
        400,
      );
    }

    // ── 8. SALVAR ───────────────────────────────────────────
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

    // ── PROMOTE STATUS ──────────────────────────────────────
    await Promise.all([
      adminClient.from("propostas_nativas")
        .update({ status: "gerada" })
        .eq("id", versao.proposta_id)
        .eq("tenant_id", tenantId),
      adminClient.from("proposta_versoes")
        .update({
          generation_status: "ready",
          generated_at: new Date().toISOString(),
        })
        .eq("id", versao.id)
        .eq("tenant_id", tenantId),
    ]);

    return jsonOk({ success: true, idempotent: false, render_id: render!.id, html, url: null });
  } catch (err) {
    console.error("[proposal-render] Error:", err);
    return jsonError(err.message ?? "Erro interno", 500);
  }
});

// ══════════════════════════════════════════════════════════════
// TYPES
// ══════════════════════════════════════════════════════════════

interface CenarioRow {
  id: string; ordem: number; nome: string; tipo: string;
  is_default: boolean; preco_final: number;
  entrada_valor: number; entrada_percent: number;
  taxa_juros_mensal: number; taxa_juros_anual: number;
  cet_anual: number; num_parcelas: number; valor_parcela: number;
  valor_financiado: number; payback_meses: number;
  tir_anual: number; roi_25_anos: number;
  economia_primeiro_ano: number; financiador_id: string | null;
}

interface SeriesRow {
  cenario_id: string | null; ano: number; geracao_kwh: number;
  tarifa_vigente: number; degradacao_acumulada: number;
  economia_rs: number; economia_acumulada_rs: number;
  fluxo_caixa: number; fluxo_caixa_acumulado: number;
  parcela_financiamento: number;
}

interface RenderParams {
  tenantNome: string;
  logoUrl: string | null;
  primaryColor: string;
  successColor: string;
  destructiveColor: string;
  fontHeading: string;
  fontBody: string;
  clienteNome: string;
  clienteTelefone: string;
  propostaCodigo: string;
  versaoNumero: number;
  grupo: string;
  validoAte: string | null;
  engineVersion: string | null;
  calcHash: string | null;
  snap: any;
  cenarios: CenarioRow[];
  seriesByCenario: Map<string, SeriesRow[]>;
}

// ══════════════════════════════════════════════════════════════
// TEMPLATE BLOCK RENDERER (server-side equivalent of TemplateHtmlRenderer + SemanticBlockRenderer)
// ══════════════════════════════════════════════════════════════

/** Build variables map from snapshot — same keys used by SemanticBlockRenderer */
function buildVariablesFromSnapshot(snap: any, p: RenderParams): Record<string, string> {
  const fin = snap.financeiro ?? {};
  const tec = snap.tecnico ?? {};
  const itens = snap.itens ?? [];
  const ucs = snap.ucs ?? [];

  // Find first module and inverter
  const modulo = itens.find((i: any) => i.categoria === "modulo" || i.categoria === "módulo" || i.descricao?.toLowerCase().includes("módulo") || i.descricao?.toLowerCase().includes("painel"));
  const inversor = itens.find((i: any) => i.categoria === "inversor" || i.descricao?.toLowerCase().includes("inversor"));

  const vars: Record<string, string> = {
    // Empresa / Brand
    empresa_nome: p.tenantNome,
    empresa_logo_url: p.logoUrl ?? "",
    logo_url: p.logoUrl ?? "",

    // Cliente
    cliente_nome: p.clienteNome,
    cliente_telefone: p.clienteTelefone,
    cliente_cidade: ucs[0]?.cidade ?? snap.cidade ?? "",
    cliente_estado: ucs[0]?.estado ?? snap.estado ?? "",
    cidade: ucs[0]?.cidade ?? snap.cidade ?? "",
    estado: ucs[0]?.estado ?? snap.estado ?? "",

    // Technical
    potencia_kwp: formatNum(tec.potencia_kwp ?? snap.potencia_kwp ?? 0),
    geracao_mensal: formatNum(tec.geracao_estimada_kwh ?? tec.geracao_mensal ?? 0),
    consumo_mensal: formatNum(tec.consumo_total_kwh ?? tec.consumo_medio_kwh ?? 0),

    // Financial
    valor_total: formatCur(fin.valor_total ?? 0),
    economia_mensal: formatCur(fin.economia_mensal ?? 0),
    economia_anual: formatCur((fin.economia_mensal ?? 0) * 12),
    economia_25_anos: formatCur(fin.economia_25_anos ?? (fin.economia_mensal ?? 0) * 12 * 25),
    economia_percentual: formatNum(fin.economia_percentual ?? 90),
    payback_meses: String(fin.payback_meses ?? snap.payback_meses ?? 0),
    payback_anos: formatNum((fin.payback_meses ?? snap.payback_meses ?? 0) / 12, 1),
    vpl: formatCur(fin.vpl ?? 0),
    tir: formatNum(fin.tir ?? 0, 1),
    roi_25_anos: formatCur(fin.roi_25_anos ?? 0),

    // Equipment
    modulo_fabricante: modulo?.fabricante ?? "",
    modulo_modelo: modulo?.modelo ?? "",
    modulo_potencia: modulo?.potencia_w ? `${modulo.potencia_w}W` : "",
    modulo_potencia_w: String(modulo?.potencia_w ?? ""),
    modulo_quantidade: String(modulo?.quantidade ?? 0),
    modulo_garantia: snap.modulo_garantia ?? "25 anos",
    inversor_fabricante: inversor?.fabricante ?? "",
    inversor_modelo: inversor?.modelo ?? "",
    inversor_garantia: snap.inversor_garantia ?? "10 anos",

    // Proposal
    proposta_codigo: p.propostaCodigo,
    versao_numero: String(p.versaoNumero),
    grupo: p.grupo,
    valido_ate: p.validoAte ?? "30 dias",

    // Consultor (from snapshot if available)
    consultor_nome: snap.consultor_nome ?? "",
    consultor_telefone: snap.consultor_telefone ?? "",
  };

  // Also flatten any top-level snapshot keys as variables
  for (const [key, val] of Object.entries(snap)) {
    if (typeof val === "string" || typeof val === "number") {
      if (!vars[key]) vars[key] = String(val);
    }
  }

  return vars;
}

function formatNum(v: number, decimals = 0): string {
  return v.toLocaleString("pt-BR", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

function formatCur(v: number): string {
  return (v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Replace {{variable}} placeholders in content */
function replaceVariables(content: string, vars: Record<string, string>): string {
  if (!content) return content;
  return content.replace(/\{\{([^}]+)\}\}/g, (_match, key) => {
    const trimmed = key.trim();
    if (vars[trimmed] !== undefined) return escHtml(vars[trimmed]);
    const underscored = trimmed.replace(/\./g, "_");
    if (vars[underscored] !== undefined) return escHtml(vars[underscored]);
    const afterDot = trimmed.split(".").pop() || "";
    if (vars[afterDot] !== undefined) return escHtml(vars[afterDot]);
    return "";
  });
}

function escHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// ── Block tree builder (mirrors client-side buildTree) ──────

interface BlockNode {
  block: any;
  children: BlockNode[];
}

function buildBlockTree(blocks: any[]): BlockNode[] {
  const roots: BlockNode[] = [];
  const nodeMap = new Map<string, BlockNode>();

  for (const b of blocks) {
    nodeMap.set(b.id, { block: b, children: [] });
  }

  // Sort by order
  const sorted = [...blocks].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  for (const b of sorted) {
    const node = nodeMap.get(b.id)!;
    if (b.parentId && nodeMap.has(b.parentId)) {
      nodeMap.get(b.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

// ── Server-side semantic block renderers ────────────────────

function renderSemanticBlock(type: string, vars: Record<string, string>, p: RenderParams): string {
  switch (type) {
    case "proposal_hero": return renderHeroBlock(vars, p);
    case "proposal_kpis": return renderKpisBlock(vars, p);
    case "proposal_comparison": return renderComparisonBlock(vars, p);
    case "proposal_equipment": return renderEquipmentBlock(vars, p);
    case "proposal_financial": return renderFinancialBlock(vars, p);
    case "proposal_guarantees": return renderGuaranteesBlock(vars, p);
    case "proposal_payment": return renderPaymentBlock(vars, p);
    case "proposal_cta": return renderCtaBlock(vars, p);
    default: return "";
  }
}

const SEMANTIC_TYPES = new Set([
  "proposal_hero", "proposal_kpis", "proposal_comparison", "proposal_equipment",
  "proposal_financial", "proposal_guarantees", "proposal_payment", "proposal_cta",
]);

function v(vars: Record<string, string>, key: string, fallback = ""): string {
  return vars[key] ?? fallback;
}

function renderHeroBlock(vars: Record<string, string>, p: RenderParams): string {
  const logoUrl = v(vars, "empresa_logo_url") || v(vars, "logo_url");
  const empresaNome = v(vars, "empresa_nome", "Energia Solar");
  const clienteNome = v(vars, "cliente_nome", "Cliente");
  const cidade = v(vars, "cliente_cidade") || v(vars, "cidade");
  const estado = v(vars, "cliente_estado") || v(vars, "estado");

  return `
  <div style="background:linear-gradient(135deg, #1B3A8C, #0D2460);padding:clamp(48px,8vw,80px) 24px;text-align:center;position:relative;overflow:hidden;">
    <div style="position:absolute;top:-100px;right:-100px;width:300px;height:300px;border-radius:50%;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08)"></div>
    <div style="position:absolute;bottom:-60px;left:-60px;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,0.03)"></div>
    <div style="max-width:720px;margin:0 auto;position:relative;z-index:1">
      ${logoUrl ? `<div style="margin-bottom:24px"><img src="${escHtml(logoUrl)}" alt="${escHtml(empresaNome)}" style="height:42px;max-width:200px;object-fit:contain" onerror="this.style.display='none'"></div>` : ""}
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.4);font-weight:700;margin:0 0 16px;font-family:'${p.fontHeading}',sans-serif">Proposta Comercial Personalizada</p>
      <h1 style="font-family:'${p.fontHeading}',sans-serif;font-size:clamp(1.8rem,5vw,2.8rem);font-weight:900;color:#fff;margin:0 0 12px;line-height:1.1;letter-spacing:-0.03em">Olá, <span style="color:#F07B24">${escHtml(clienteNome)}</span>!</h1>
      ${cidade ? `<p style="font-size:1.05rem;color:rgba(255,255,255,0.55);margin:0;line-height:1.7">Solução exclusiva de energia solar para <strong style="color:rgba(255,255,255,0.8)">${escHtml(cidade)}${estado ? `/${escHtml(estado)}` : ""}</strong></p>` : ""}
    </div>
  </div>`;
}

function renderKpisBlock(vars: Record<string, string>, _p: RenderParams): string {
  const kpis = [
    { icon: "⚡", label: "Potência", value: v(vars, "potencia_kwp", "0"), suffix: " kWp", color: "#F07B24" },
    { icon: "💰", label: "Economia/mês", value: `R$ ${v(vars, "economia_mensal", "0")}`, suffix: "", color: "#22C55E" },
    { icon: "🔋", label: "Geração Mensal", value: v(vars, "geracao_mensal", "0"), suffix: " kWh", color: "#F07B24" },
    { icon: "📅", label: "Retorno", value: v(vars, "payback_meses", "0"), suffix: " meses", color: "#22C55E" },
  ];

  return `
  <div style="background:linear-gradient(135deg, #1B3A8C, #0D2460);padding:0 24px 56px">
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;max-width:900px;margin:0 auto">
      ${kpis.map(k => `
      <div style="background:rgba(255,255,255,0.06);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);border-radius:16px;padding:24px 20px;text-align:center">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 8px;font-weight:700">${k.icon} ${k.label}</p>
        <p style="font-size:1.6rem;font-weight:900;color:${k.color};margin:0">${k.value}${k.suffix}</p>
      </div>`).join("")}
    </div>
  </div>`;
}

function renderComparisonBlock(vars: Record<string, string>, _p: RenderParams): string {
  return `
  <div style="background:#F8FAFC;padding:56px 24px">
    <div style="max-width:800px;margin:0 auto">
      <div style="text-align:center;margin-bottom:40px">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#F07B24;font-weight:700;margin:0 0 8px">Comparativo</p>
        <h2 style="font-size:1.6rem;font-weight:800;color:#0F172A;margin:0">Antes vs Depois da Energia Solar</h2>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid rgba(239,68,68,0.15);position:relative;overflow:hidden">
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#ef4444,#f97316)"></div>
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#ef4444;font-weight:800;margin:0 0 20px">❌ Sem Solar</p>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><span style="font-size:22px">💸</span><div><p style="font-size:10px;color:#94A3B8;margin:0;text-transform:uppercase;letter-spacing:1px">Conta de Luz</p><p style="font-weight:800;color:#ef4444;margin:0;font-size:1.1rem">R$ ${v(vars, "economia_mensal", "0")}/mês</p></div></div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><span style="font-size:22px">📈</span><div><p style="font-size:10px;color:#94A3B8;margin:0;text-transform:uppercase;letter-spacing:1px">Gasto em 25 anos</p><p style="font-weight:800;color:#ef4444;margin:0;font-size:1.1rem">R$ ${v(vars, "economia_25_anos", "0")}+</p></div></div>
        </div>
        <div style="background:#fff;border-radius:16px;padding:28px;border:1px solid rgba(34,197,94,0.2);position:relative;overflow:hidden">
          <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,#22C55E,#10B981)"></div>
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#22C55E;font-weight:800;margin:0 0 20px">✅ Com Solar</p>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><span style="font-size:22px">☀️</span><div><p style="font-size:10px;color:#94A3B8;margin:0;text-transform:uppercase;letter-spacing:1px">Economia</p><p style="font-weight:800;color:#22C55E;margin:0;font-size:1.1rem">${v(vars, "economia_percentual", "90")}% na conta</p></div></div>
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px"><span style="font-size:22px">💰</span><div><p style="font-size:10px;color:#94A3B8;margin:0;text-transform:uppercase;letter-spacing:1px">Economia 25 anos</p><p style="font-weight:800;color:#22C55E;margin:0;font-size:1.1rem">R$ ${v(vars, "economia_25_anos", "0")}</p></div></div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderEquipmentBlock(vars: Record<string, string>, _p: RenderParams): string {
  return `
  <div style="background:#fff;padding:56px 24px">
    <div style="max-width:800px;margin:0 auto">
      <div style="text-align:center;margin-bottom:40px">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#F07B24;font-weight:700;margin:0 0 8px">⚙️ Tecnologia</p>
        <h2 style="font-size:1.6rem;font-weight:800;color:#0F172A;margin:0">Componentes do Seu Sistema</h2>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px">
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:16px;padding:28px">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#F07B24,#F59E0B);display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;flex-shrink:0">☀️</div>
            <div><h3 style="font-size:0.95rem;font-weight:800;color:#0F172A;margin:0">Módulos Solares</h3><p style="font-size:11px;color:#94A3B8;margin:2px 0 0">Painéis fotovoltaicos</p></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0"><p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin:0 0 4px;font-weight:700">Fabricante</p><p style="font-weight:700;margin:0;font-size:0.85rem;color:#0F172A">${v(vars, "modulo_fabricante", "—")}</p></div>
            <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0"><p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin:0 0 4px;font-weight:700">Quantidade</p><p style="font-weight:700;margin:0;font-size:0.85rem;color:#0F172A">${v(vars, "modulo_quantidade", "0")} painéis</p></div>
            <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0;grid-column:1/-1"><p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin:0 0 4px;font-weight:700">Modelo · Potência</p><p style="font-weight:700;margin:0;font-size:0.85rem;color:#F07B24">${v(vars, "modulo_modelo", "—")} · ${v(vars, "modulo_potencia", v(vars, "modulo_potencia_w", "—"))}</p></div>
          </div>
        </div>
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:16px;padding:28px">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,#1E3A5F,#3B82F6);display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;flex-shrink:0">🔌</div>
            <div><h3 style="font-size:0.95rem;font-weight:800;color:#0F172A;margin:0">Inversor Solar</h3><p style="font-size:11px;color:#94A3B8;margin:2px 0 0">Conversão inteligente</p></div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
            <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0"><p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin:0 0 4px;font-weight:700">Fabricante</p><p style="font-weight:700;margin:0;font-size:0.85rem;color:#0F172A">${v(vars, "inversor_fabricante", "—")}</p></div>
            <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0"><p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin:0 0 4px;font-weight:700">Modelo</p><p style="font-weight:700;margin:0;font-size:0.85rem;color:#0F172A">${v(vars, "inversor_modelo", "—")}</p></div>
            <div style="background:#fff;border-radius:10px;padding:14px 16px;border:1px solid #E2E8F0;grid-column:1/-1"><p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:#94A3B8;margin:0 0 4px;font-weight:700">Garantia</p><p style="font-weight:700;margin:0;font-size:0.85rem;color:#F07B24">${v(vars, "inversor_garantia", "—")}</p></div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function renderFinancialBlock(vars: Record<string, string>, _p: RenderParams): string {
  const metrics = [
    { label: "Investimento", value: `R$ ${v(vars, "valor_total", "0")}`, bg: "linear-gradient(135deg, #0F172A, #1E3A5F)", color: "#F07B24" },
    { label: "Economia Anual", value: `R$ ${v(vars, "economia_anual", "0")}`, bg: "linear-gradient(135deg, #22C55E, #16A34A)", color: "#fff" },
    { label: "Payback", value: `${v(vars, "payback_meses", "0")} meses`, bg: "linear-gradient(135deg, #0F172A, #1E3A5F)", color: "#F07B24" },
  ];

  return `
  <div style="background:#F8FAFC;padding:56px 24px">
    <div style="max-width:900px;margin:0 auto">
      <div style="text-align:center;margin-bottom:40px">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#F07B24;font-weight:700;margin:0 0 8px">📊 Análise Financeira</p>
        <h2 style="font-size:1.6rem;font-weight:800;color:#0F172A;margin:0">Retorno do Seu Investimento</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px">
        ${metrics.map(m => `
        <div style="background:${m.bg};border-radius:16px;padding:28px 24px;text-align:center">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 10px;font-weight:700">${m.label}</p>
          <p style="font-size:1.6rem;font-weight:900;color:${m.color};margin:0">${m.value}</p>
        </div>`).join("")}
      </div>
    </div>
  </div>`;
}

function renderGuaranteesBlock(vars: Record<string, string>, _p: RenderParams): string {
  const guarantees = [
    { icon: "🛡️", title: "Garantia dos Módulos", desc: v(vars, "modulo_garantia", "25 anos de garantia de performance") },
    { icon: "⚡", title: "Garantia do Inversor", desc: v(vars, "inversor_garantia", "10 anos de garantia") },
    { icon: "🔧", title: "Instalação Profissional", desc: "Equipe técnica certificada com experiência comprovada" },
    { icon: "📋", title: "Suporte Completo", desc: "Acompanhamento pós-venda, homologação e monitoramento" },
  ];

  return `
  <div style="background:#fff;padding:56px 24px">
    <div style="max-width:800px;margin:0 auto">
      <div style="text-align:center;margin-bottom:40px">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#F07B24;font-weight:700;margin:0 0 8px">🛡️ Segurança</p>
        <h2 style="font-size:1.6rem;font-weight:800;color:#0F172A;margin:0">Por Que Confiar na ${escHtml(v(vars, "empresa_nome", "Nossa Empresa"))}</h2>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
        ${guarantees.map(g => `
        <div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:16px;padding:24px 20px;display:flex;align-items:flex-start;gap:14px">
          <div style="width:40px;height:40px;border-radius:10px;background:rgba(27,58,140,0.04);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0">${g.icon}</div>
          <div><h3 style="font-size:0.9rem;font-weight:700;color:#0F172A;margin:0 0 4px">${g.title}</h3><p style="font-size:0.8rem;color:#64748B;margin:0;line-height:1.5">${g.desc}</p></div>
        </div>`).join("")}
      </div>
    </div>
  </div>`;
}

function renderPaymentBlock(vars: Record<string, string>, p: RenderParams): string {
  return `
  <div style="background:#F8FAFC;padding:56px 24px">
    <div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #E2E8F0;border-radius:16px;padding:32px;text-align:center">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#F07B24;font-weight:700;margin:0 0 8px">💳 Condições</p>
      <h2 style="font-family:'${p.fontHeading}',sans-serif;font-size:1.4rem;font-weight:800;color:#0F172A;margin:0 0 24px">Investimento</h2>
      <div style="background:linear-gradient(135deg,#0F172A,#1E3A5F);border-radius:12px;padding:24px 20px;margin-bottom:16px">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 8px;font-weight:700">Valor Total</p>
        <p style="font-size:2rem;font-weight:900;color:#F07B24;margin:0">R$ ${v(vars, "valor_total", "0")}</p>
      </div>
      <p style="font-size:0.85rem;color:#64748B;line-height:1.6;margin:0">Consulte condições de financiamento e parcelamento com seu consultor.</p>
    </div>
  </div>`;
}

function renderCtaBlock(vars: Record<string, string>, p: RenderParams): string {
  const consultorNome = v(vars, "consultor_nome");
  const consultorTel = v(vars, "consultor_telefone");

  return `
  <div style="background:linear-gradient(135deg,#0D2460,#1B3A8C);padding:64px 24px;text-align:center">
    <div style="max-width:600px;margin:0 auto">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:#F07B24;font-weight:700;margin:0 0 16px">✅ Próximo Passo</p>
      <h2 style="font-family:'${p.fontHeading}',sans-serif;font-size:clamp(1.3rem,4vw,1.8rem);font-weight:900;color:#fff;margin:0 0 12px">Pronto para Economizar?</h2>
      <p style="color:rgba(255,255,255,0.55);font-size:0.95rem;margin:0 0 32px;line-height:1.7">Aceite sua proposta agora e comece a gerar sua própria energia.</p>
      ${consultorNome ? `<p style="color:rgba(255,255,255,0.5);font-size:0.85rem;margin:0 0 24px">Consultor: <strong style="color:#fff">${escHtml(consultorNome)}</strong>${consultorTel ? ` · ${escHtml(consultorTel)}` : ""}</p>` : ""}
      <div style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap">
        <button style="background:linear-gradient(135deg,#F07B24,#E06010);color:#fff;border:none;border-radius:12px;padding:16px 40px;font-family:'${p.fontHeading}',sans-serif;font-weight:800;font-size:1rem;cursor:pointer;box-shadow:0 6px 24px rgba(240,123,36,0.35);text-transform:uppercase;letter-spacing:0.05em">ACEITAR PROPOSTA</button>
        ${consultorTel ? `<a href="https://wa.me/55${consultorTel.replace(/\D/g, "")}" target="_blank" rel="noopener noreferrer" style="background:#25D366;color:#fff;border:none;border-radius:12px;padding:16px 28px;font-family:'${p.fontHeading}',sans-serif;font-weight:700;font-size:0.95rem;text-decoration:none;display:inline-flex;align-items:center;gap:8px;box-shadow:0 4px 16px rgba(37,211,102,0.3)">💬 WhatsApp</a>` : ""}
      </div>
    </div>
  </div>`;
}

// ── Render block node to HTML ───────────────────────────────

function renderBlockNodeToHtml(node: BlockNode, vars: Record<string, string>, p: RenderParams): string {
  const { block, children } = node;

  if (block.isVisible === false) return "";

  // Semantic blocks
  if (SEMANTIC_TYPES.has(block.type)) {
    return renderSemanticBlock(block.type, vars, p);
  }

  const style = buildStyleString(block.style);
  const content = replaceVariables(block.content ?? "", vars);
  const childrenHtml = children.map(c => renderBlockNodeToHtml(c, vars, p)).join("");

  switch (block.type) {
    case "section": {
      const maxW = block.style?.contentWidth === "boxed" ? "max-width:1200px;margin:0 auto;" : "";
      return `<div style="${style}"><div style="${maxW}display:flex;flex-wrap:wrap">${childrenHtml}</div></div>`;
    }
    case "column":
      return `<div style="${style};width:${block.style?.width ? `${block.style.width}%` : "100%"};display:flex;flex-direction:column">${childrenHtml}</div>`;
    case "inner_section":
      return `<div style="${style};display:flex;flex-wrap:wrap">${childrenHtml}</div>`;
    case "editor":
      return `<div style="${style}">${content}</div>`;
    case "image":
      return content ? `<div style="${style}"><img src="${escHtml(content)}" alt="" style="max-width:100%;height:auto"></div>` : "";
    case "divider":
      return `<hr style="border:none;border-top:1px solid #e2e8f0;width:100%;${style}">`;
    case "button":
      return `<div style="text-align:${block.style?.textAlign || "center"}"><button style="padding:10px 24px;border-radius:${block.style?.borderRadius || 8}px;background:${block.style?.backgroundColor || "#F07B24"};color:${block.style?.color || "#fff"};border:none;font-weight:700;cursor:pointer;font-size:0.95rem">${content || "Botão"}</button></div>`;
    case "video":
      return content ? `<div style="${style}"><iframe src="${escHtml(content)}" style="width:100%;height:315px;border:none;border-radius:8px" allowfullscreen></iframe></div>` : "";
    default:
      return childrenHtml ? `<div style="${style}">${childrenHtml}</div>` : `<div style="${style}">${content}</div>`;
  }
}

function buildStyleString(style: any): string {
  if (!style) return "";
  const parts: string[] = [];
  if (style.marginTop) parts.push(`margin-top:${style.marginTop}px`);
  if (style.marginRight) parts.push(`margin-right:${style.marginRight}px`);
  if (style.marginBottom) parts.push(`margin-bottom:${style.marginBottom}px`);
  if (style.marginLeft) parts.push(`margin-left:${style.marginLeft}px`);
  if (style.paddingTop) parts.push(`padding-top:${style.paddingTop}px`);
  if (style.paddingRight) parts.push(`padding-right:${style.paddingRight}px`);
  if (style.paddingBottom) parts.push(`padding-bottom:${style.paddingBottom}px`);
  if (style.paddingLeft) parts.push(`padding-left:${style.paddingLeft}px`);
  if (style.borderWidth && style.borderWidth !== "0") {
    parts.push(`border:${style.borderWidth}px solid ${style.borderColor || "#e2e8f0"}`);
  }
  if (style.borderRadius && style.borderRadius !== "0") parts.push(`border-radius:${style.borderRadius}px`);
  if (style.boxShadow && style.boxShadow !== "none") parts.push(`box-shadow:${style.boxShadow}`);
  if (style.fontFamily) parts.push(`font-family:${style.fontFamily}`);
  if (style.fontSize) parts.push(`font-size:${style.fontSize}px`);
  if (style.fontWeight) parts.push(`font-weight:${style.fontWeight}`);
  if (style.textAlign) parts.push(`text-align:${style.textAlign}`);
  if (style.color) parts.push(`color:${style.color}`);
  if (style.useGradient && style.gradientStart && style.gradientEnd) {
    const angle = style.staticGradientAngle ?? style.gradientAngle ?? 180;
    parts.push(`background:linear-gradient(${angle}deg,${style.gradientStart},${style.gradientEnd})`);
  } else if (style.backgroundColor && style.backgroundColor !== "transparent") {
    parts.push(`background-color:${style.backgroundColor}`);
  }
  return parts.join(";");
}

/** Render template blocks into a full HTML document */
function renderTemplateBlocksToHtml(blocks: any[], vars: Record<string, string>, p: RenderParams): string {
  const tree = buildBlockTree(blocks.filter((b: any) => b.isVisible !== false));
  const bodyHtml = tree.map(n => renderBlockNodeToHtml(n, vars, p)).join("");

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Proposta ${escHtml(p.propostaCodigo)} — ${escHtml(p.tenantNome)}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family:'${p.fontBody}',sans-serif; color:#1a1a2e; background:#f8f9fa; }
  img { max-width:100%; height:auto; }
  @media print { body { background:#fff; } }
</style>
</head>
<body>
${bodyHtml}
</body>
</html>`;
}

// ══════════════════════════════════════════════════════════════
// LEGACY HTML RENDERER (fallback when no template blocks exist)
// ══════════════════════════════════════════════════════════════

function renderLegacyHtml(p: RenderParams): string {
  const fin = p.snap.financeiro ?? {};
  const tec = p.snap.tecnico ?? {};
  const lei = p.snap.regra_lei_14300 ?? {};
  const itens = p.snap.itens ?? [];
  const premissas = p.snap.premissas ?? {};
  const ucs = p.snap.ucs ?? [];
  const servicos = p.snap.servicos ?? [];
  const vcResults = p.snap.variaveis_custom ?? [];

  const hasCenarios = p.cenarios.length > 0;
  const pagamentos = !hasCenarios ? (p.snap.pagamento_opcoes ?? []) : [];

  const safe = (v: unknown, fallback = "-"): string => {
    if (v == null || v === "" || v === "undefined" || v === "null") return fallback;
    return String(v);
  };

  const fmt = (v: number | null | undefined) => {
    const n = v ?? 0;
    return `R$ ${n.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };
  const fmtPct = (v: number | null | undefined) => {
    const n = v ?? 0;
    return `${n.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
  };

  const itensRows = itens.map((it: any) => `
    <tr>
      <td style="padding:8px;border-bottom:1px solid #eee">${safe(it.descricao)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${safe(it.quantidade)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(it.preco_unitario)}</td>
      <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(it.subtotal)}</td>
    </tr>`).join("");

  const ucsSection = ucs.length > 0 ? `
  <div class="section">
    <div class="section-title">Unidades Consumidoras (${ucs.length})</div>
    ${ucs.map((uc: any) => `
    <div style="margin-bottom:12px;padding:12px;background:#f8f9fa;border-radius:8px">
      <div style="font-weight:600;margin-bottom:6px">${safe(uc.nome)} — ${safe(uc.tipo_dimensionamento)} (${safe(uc.subgrupo)})</div>
      <div class="grid">
        <div><span class="label">Consumo Médio</span><div class="value">${uc.tipo_dimensionamento === "MT" ? `P: ${safe(uc.consumo_mensal_p)} / FP: ${safe(uc.consumo_mensal_fp)}` : `${safe(uc.consumo_mensal)} kWh/mês`}</div></div>
        <div><span class="label">Fase</span><div class="value">${safe(uc.fase)}</div></div>
        <div><span class="label">Local</span><div class="value">${safe(uc.cidade)}/${safe(uc.estado)}</div></div>
        <div><span class="label">Telhado</span><div class="value">${safe(uc.tipo_telhado)}</div></div>
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
          <td style="padding:8px;border-bottom:1px solid #eee">${safe(s.descricao)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee">${safe(s.categoria)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:right">${fmt(s.valor)}</td>
          <td style="padding:8px;border-bottom:1px solid #eee;text-align:center">${s.incluso_no_preco ? "✓" : "Extra"}</td>
        </tr>`).join("")}</tbody>
    </table>
  </div>` : "";

  const cenariosSection = hasCenarios ? renderLegacyCenariosSection(p) : renderLegacyPagamentos(pagamentos, p.primaryColor, fmt);

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
      <div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #eee"><span>Margem (${fin.margem_percentual ?? 0}%)</span><strong style="color:hsl(${p.successColor})">${fmt(fin.margem_valor ?? 0)}</strong></div>
      ${fin.desconto_percentual > 0 ? `<div style="display:flex;justify-content:space-between;padding:10px 16px;border-bottom:1px solid #eee"><span>Desconto (${fin.desconto_percentual}%)</span><strong style="color:hsl(${p.destructiveColor})">-${fmt(fin.desconto_valor ?? 0)}</strong></div>` : ""}
      <div style="display:flex;justify-content:space-between;padding:12px 16px;background:hsl(${p.primaryColor}/0.06);font-weight:700;font-size:16px"><span>Investimento Total</span><span style="color:hsl(${p.primaryColor})">${fmt(fin.valor_total ?? 0)}</span></div>
    </div>
  </div>`;

  const baseSeries = p.seriesByCenario.get("__base__") ?? [];
  const defaultCenario = p.cenarios.find(c => c.is_default) ?? p.cenarios[0];
  const defaultSeries = defaultCenario ? (p.seriesByCenario.get(defaultCenario.id) ?? []) : baseSeries;
  const showSeries = defaultSeries.length > 0 ? defaultSeries : baseSeries;

  const seriesSection = showSeries.length > 0 ? `
  <div class="section">
    <div class="section-title">Projeção Financeira — 25 Anos${defaultCenario ? ` (${defaultCenario.nome})` : ""}</div>
    <div style="overflow-x:auto">
      <table style="font-size:12px;min-width:700px">
        <thead>
          <tr>
            <th>Ano</th>
            <th style="text-align:right">Geração kWh</th>
            <th style="text-align:right">Tarifa R$/kWh</th>
            <th style="text-align:right">Economia/Ano</th>
            <th style="text-align:right">Acumulado</th>
            <th style="text-align:right">Fluxo Caixa Ac.</th>
          </tr>
        </thead>
        <tbody>
          ${showSeries.filter((_: any, i: number) => i < 5 || i === 9 || i === 14 || i === 19 || i === 24).map((s: any) => `
          <tr${(s.fluxo_caixa_acumulado ?? 0) >= 0 ? ` style="color:hsl(${p.successColor})"` : ""}>
            <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;font-weight:600">${safe(s.ano)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${Math.round(s.geracao_kwh ?? 0).toLocaleString("pt-BR")}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">R$ ${s.tarifa_vigente?.toFixed(3) ?? "-"}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${fmt(s.economia_rs)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right">${fmt(s.economia_acumulada_rs)}</td>
            <td style="padding:6px 8px;border-bottom:1px solid #f0f0f0;text-align:right;font-weight:600">${fmt(s.fluxo_caixa_acumulado)}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  </div>` : "";

  const vcSection = vcResults.length > 0 ? `
  <div class="section">
    <div class="section-title">Dados Complementares</div>
    <div class="grid">
      ${vcResults.map((vc: any) => `
      <div><span class="label">${safe(vc.label)}</span><div class="value">${safe(vc.valor_calculado)}</div></div>`).join("")}
    </div>
  </div>` : "";

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
  .cenario-card { border:2px solid hsl(${p.primaryColor}/0.15); border-radius:12px; padding:20px; text-align:center; }
  .cenario-card.default { border-color:hsl(${p.primaryColor}); box-shadow:0 4px 12px hsl(${p.primaryColor}/0.15); }
  .cenario-card .cenario-name { font-family:'${p.fontHeading}',sans-serif; font-weight:700; font-size:14px; margin-bottom:8px; }
  .cenario-card .cenario-price { font-size:24px; font-weight:800; color:hsl(${p.primaryColor}); margin-bottom:4px; }
  .cenario-card .cenario-detail { font-size:12px; color:#666; margin-bottom:2px; }
  .cenario-card .cenario-badge { display:inline-block; padding:2px 8px; border-radius:8px; font-size:10px; font-weight:700; text-transform:uppercase; margin-top:8px; }
  .cenario-metrics { display:grid; grid-template-columns:1fr 1fr 1fr; gap:4px; margin-top:12px; padding-top:12px; border-top:1px solid #eee; }
  .cenario-metrics .metric { text-align:center; }
  .cenario-metrics .metric-value { font-size:14px; font-weight:700; color:hsl(${p.primaryColor}); }
  .cenario-metrics .metric-label { font-size:10px; color:#888; text-transform:uppercase; }
  @media print { body { background:#fff; } .container { box-shadow:none; } }
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
      <div><span class="label">Fio B (não compensado)</span><div class="value">${lei.percentual_nao_compensado ?? lei.percentual_fio_b != null ? (lei.percentual_fio_b * 100).toFixed(0) : "-"}%</div></div>
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
        <div class="value" style="font-size:18px">${fmtPct(fin.tir ?? 0)}</div>
      </div>
      <div class="highlight">
        <span class="label">ROI 25 anos</span>
        <div class="value" style="font-size:18px">${fmt(fin.roi_25_anos ?? 0)}</div>
      </div>
    </div>` : ""}
  </div>

  ${cenariosSection}
  ${seriesSection}
  ${premissasSection}
  ${vcSection}

  <div class="footer">
    <div>Proposta gerada em ${new Date().toLocaleDateString("pt-BR")} • ${p.tenantNome} • Válida até ${p.validoAte ?? "consultar"}</div>
    ${p.engineVersion ? `<div style="margin-top:4px;font-size:10px;color:#bbb">Engine v${p.engineVersion}${p.calcHash ? ` • Hash ${p.calcHash.slice(0, 12)}` : ""}</div>` : ""}
  </div>
</div>
</body>
</html>`;
}

// ── Legacy Cenários Comparativos ────────────────────────────

function renderLegacyCenariosSection(p: RenderParams): string {
  if (p.cenarios.length === 0) return "";

  const fmt = (v: number) => `R$ ${(v ?? 0).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const cols = Math.min(p.cenarios.length, 3);
  const cards = p.cenarios.map(c => {
    const isDefault = c.is_default;
    const tipoLabel = c.tipo === "a_vista" ? "À Vista" : c.tipo === "financiamento" ? "Financiamento" : c.tipo === "parcelado" ? "Parcelado" : c.tipo;

    return `
    <div class="cenario-card${isDefault ? " default" : ""}">
      ${isDefault ? `<div class="cenario-badge" style="background:hsl(${p.primaryColor}/0.1);color:hsl(${p.primaryColor})">★ Recomendado</div>` : ""}
      <div class="cenario-name">${c.nome}</div>
      <div style="font-size:11px;color:#888;text-transform:uppercase;margin-bottom:4px">${tipoLabel}</div>
      <div class="cenario-price">${c.tipo === "a_vista"
        ? fmt(c.preco_final)
        : `${c.num_parcelas}x ${fmt(c.valor_parcela)}`
      }</div>
      ${c.entrada_valor > 0 ? `<div class="cenario-detail">+ Entrada: ${fmt(c.entrada_valor)}</div>` : ""}
      ${c.taxa_juros_mensal > 0 ? `<div class="cenario-detail">${c.taxa_juros_mensal.toFixed(2)}% a.m. (CET ${c.cet_anual.toFixed(1)}% a.a.)</div>` : ""}
      <div class="cenario-metrics">
        <div class="metric">
          <div class="metric-value">${c.payback_meses} m</div>
          <div class="metric-label">Payback</div>
        </div>
        <div class="metric">
          <div class="metric-value">${c.tir_anual.toFixed(1)}%</div>
          <div class="metric-label">TIR</div>
        </div>
        <div class="metric">
          <div class="metric-value">${fmt(c.roi_25_anos)}</div>
          <div class="metric-label">ROI 25a</div>
        </div>
      </div>
    </div>`;
  }).join("");

  return `
  <div class="section">
    <div class="section-title">Cenários de Investimento (${p.cenarios.length})</div>
    <div style="display:grid;grid-template-columns:repeat(${cols},1fr);gap:16px">
      ${cards}
    </div>
  </div>`;
}

// ── Legacy Pagamentos Fallback ──────────────────────────────

function renderLegacyPagamentos(pagamentos: any[], primaryColor: string, fmt: (v: number) => string): string {
  if (pagamentos.length === 0) return "";

  return `
  <div class="section">
    <div class="section-title">Opções de Pagamento</div>
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">
      ${pagamentos.map((pg: any, i: number) => `
      <div style="padding:16px;border:2px solid hsl(${primaryColor}/0.2);border-radius:12px;text-align:center">
        <div style="font-size:11px;color:#666;text-transform:uppercase;margin-bottom:4px">Opção ${i + 1}</div>
        <div style="font-weight:700;margin-bottom:8px">${pg.nome ?? pg.tipo ?? ""}</div>
        ${pg.num_parcelas > 1
          ? `<div style="font-size:20px;font-weight:800;color:hsl(${primaryColor})">${pg.num_parcelas}x ${fmt(pg.valor_parcela ?? 0)}</div>`
          : `<div style="font-size:20px;font-weight:800;color:hsl(${primaryColor})">${fmt(pg.valor_financiado ?? 0)}</div>`
        }
        ${pg.entrada > 0 ? `<div style="font-size:12px;color:#666;margin-top:4px">+ Entrada: ${fmt(pg.entrada)}</div>` : ""}
        ${pg.taxa_mensal > 0 ? `<div style="font-size:12px;color:#666;margin-top:2px">${pg.taxa_mensal.toFixed(2)}% a.m.</div>` : ""}
      </div>`).join("")}
    </div>
  </div>`;
}

// ── Helpers ─────────────────────────────────────────────────

function jsonOk(data: unknown) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status: 200,
  });
}

function jsonError(msg: string, status = 400) {
  return new Response(JSON.stringify({ success: false, error: msg }), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
    status,
  });
}
