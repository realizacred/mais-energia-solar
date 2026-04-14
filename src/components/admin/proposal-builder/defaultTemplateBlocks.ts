/**
 * Default rich template blocks for the Visual Proposal Builder.
 *
 * 5 strategic templates aligned with the sales funnel:
 *   1. PREMIUM CONSULTIVO — Trust-building, detailed, for bigger deals
 *   2. FECHAMENTO RÁPIDO — WhatsApp, urgency, fast decision
 *   3. EDUCACIONAL — Cold leads, educational, self-service
 *   4. HÍBRIDO OFF-GRID — Multiple inverters, battery, structure services
 *   5. CORPORATIVO — B2B, multi-UC, ROI-focused
 *
 * All templates use CSS variables from landingThemes.ts for theme compatibility.
 * Uses {{variable}} format from variablesCatalog.
 * Página pública — exceção RB-02 documentada.
 */

import type { TemplateBlock, ProposalType } from "./types";

function uid(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

export type TemplateStyle = "consultivo" | "fechamento" | "escala" | "hibrido" | "corporativo" | "dashboard" | "impactoVisual" | "simulacaoFinanceira" | "propostaRapida" | "conversaoCases";

/**
 * Factory principal — cria blocos por estilo de template.
 * Default = "consultivo" para manter compatibilidade.
 */
export function createDefaultTemplateBlocks(proposalType: ProposalType = "grid", style: TemplateStyle = "consultivo"): TemplateBlock[] {
  switch (style) {
    case "fechamento":
      return createFechamentoBlocks(proposalType);
    case "escala":
      return createEscalaBlocks(proposalType);
    case "hibrido":
      return createHibridoBlocks(proposalType);
    case "corporativo":
      return createCorporativoBlocks(proposalType);
    case "dashboard":
      return createDashboardBlocks(proposalType);
    case "impactoVisual":
      return createImpactoVisualBlocks(proposalType);
    case "simulacaoFinanceira":
      return createSimulacaoFinanceiraBlocks(proposalType);
    case "propostaRapida":
      return createPropostaRapidaBlocks(proposalType);
    case "conversaoCases":
      return createConversaoCasesBlocks(proposalType);
    default:
      return createConsultivoBlocks(proposalType);
  }
}

// ── Shared helpers ─────────────────────────────────────────
function makeBase(proposalType: ProposalType): Pick<TemplateBlock, "_proposalType" | "isVisible"> {
  return { _proposalType: proposalType, isVisible: true };
}

function sec(base: Pick<TemplateBlock, "_proposalType" | "isVisible">, order: number, style: Partial<TemplateBlock["style"]>): TemplateBlock {
  return { ...base, id: uid(), type: "section", content: "", parentId: null, order, style: { paddingTop: "56", paddingBottom: "56", paddingLeft: "24", paddingRight: "24", contentWidth: "boxed", ...style } };
}

function col(base: Pick<TemplateBlock, "_proposalType" | "isVisible">, parentId: string, order: number, style: Partial<TemplateBlock["style"]> = {}): TemplateBlock {
  return { ...base, id: uid(), type: "column", content: "", parentId, order, style: { width: 100, ...style } };
}

function txt(base: Pick<TemplateBlock, "_proposalType" | "isVisible">, parentId: string, order: number, content: string, style: Partial<TemplateBlock["style"]> = {}): TemplateBlock {
  return { ...base, id: uid(), type: "editor", parentId, order, content, style };
}

function btn(base: Pick<TemplateBlock, "_proposalType" | "isVisible">, parentId: string, order: number, label: string, style: Partial<TemplateBlock["style"]> = {}): TemplateBlock {
  return { ...base, id: uid(), type: "button", content: label, parentId, order, style: { textAlign: "center", borderRadius: "14", fontSize: "18", fontWeight: "800", paddingTop: "18", paddingBottom: "18", paddingLeft: "48", paddingRight: "48", ...style } };
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1 — PREMIUM CONSULTIVO
// Foco: confiança, detalhamento, comparativo antes/depois
// Ideal para: venda assistida, projetos maiores
// ═══════════════════════════════════════════════════════════════

function createConsultivoBlocks(pt: ProposalType): TemplateBlock[] {
  const b = makeBase(pt);
  const blocks: TemplateBlock[] = [];

  // ── HERO ──
  const heroS = sec(b, 0, {
    paddingTop: "80", paddingBottom: "80",
    useGradient: true, gradientStart: "var(--az, #0F172A)", gradientEnd: "var(--az2, #1E3A5F)",
    staticGradientAngle: 160, textAlign: "center",
  });
  blocks.push(heroS);
  const heroC = col(b, heroS.id, 0); blocks.push(heroC);

  blocks.push(txt(b, heroC.id, 0, `
    <div style="max-width:720px;margin:0 auto;">
      <div style="display:inline-flex;align-items:center;gap:8px;margin-bottom:24px;">
        <img src="{{empresa_logo_url}}" alt="{{empresa_nome}}" style="height:36px;max-width:180px;object-fit:contain;" onerror="this.style.display='none'" />
      </div>
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.4);font-weight:700;margin:0 0 16px;">Proposta Comercial Personalizada</p>
      <h1 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:clamp(2rem,5vw,3rem);font-weight:900;color:#fff;margin:0 0 16px;line-height:1.08;letter-spacing:-0.03em;">
        Olá, <span style="color:var(--la, #F07B24);">{{cliente_nome}}</span>!
      </h1>
      <p style="font-size:1.1rem;color:rgba(255,255,255,0.55);margin:0 0 40px;line-height:1.7;">
        Preparamos uma solução exclusiva de energia solar para <strong style="color:rgba(255,255,255,0.8);">{{cliente_cidade}}/{{cliente_estado}}</strong>.
      </p>
    </div>
  `));

  // KPI cards
  blocks.push(txt(b, heroC.id, 1, `
    <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;max-width:800px;margin:0 auto;">
      <div style="background:rgba(255,255,255,0.06);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 36px;min-width:200px;text-align:center;flex:1;">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 10px;font-weight:700;">⚡ Potência</p>
        <p style="font-size:2.2rem;font-weight:900;color:var(--la, #F07B24);margin:0;font-family:var(--font-numbers,'Montserrat',sans-serif);">{{potencia_kwp}} kWp</p>
      </div>
      <div style="background:rgba(255,255,255,0.06);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 36px;min-width:200px;text-align:center;flex:1;">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 10px;font-weight:700;">💰 Economia/mês</p>
        <p style="font-size:2.2rem;font-weight:900;color:var(--verde, #22C55E);margin:0;font-family:var(--font-numbers,'Montserrat',sans-serif);">R$ {{economia_mensal}}</p>
      </div>
      <div style="background:rgba(255,255,255,0.06);backdrop-filter:blur(12px);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:28px 36px;min-width:200px;text-align:center;flex:1;">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 10px;font-weight:700;">🔋 Geração Mensal</p>
        <p style="font-size:2.2rem;font-weight:900;color:var(--la, #F07B24);margin:0;font-family:var(--font-numbers,'Montserrat',sans-serif);">{{geracao_mensal}} kWh</p>
      </div>
    </div>
  `));

  // ── ANTES vs DEPOIS ──
  const compS = sec(b, 1, { backgroundColor: "var(--fundo, #F8FAFC)" });
  blocks.push(compS);
  const compC = col(b, compS.id, 0); blocks.push(compC);

  blocks.push(txt(b, compC.id, 0, `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">Comparativo</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Antes vs Depois da Energia Solar</h2>
    </div>
  `));

  blocks.push(txt(b, compC.id, 1, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:24px;max-width:800px;margin:0 auto;">
      <div style="background:var(--card-bg, #fff);border-radius:20px;padding:32px;position:relative;overflow:hidden;border:1px solid rgba(239,68,68,0.15);">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#ef4444,#f97316);"></div>
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#ef4444;font-weight:800;margin:0 0 24px;">❌ Sem Solar</p>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
          <span style="font-size:24px;">💸</span>
          <div>
            <p style="font-size:10px;color:var(--cinza, #94A3B8);margin:0;text-transform:uppercase;letter-spacing:1px;">Conta de Luz</p>
            <p style="font-weight:800;color:#ef4444;margin:0;font-size:1.2rem;">R$ {{economia_mensal}}/mês</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
          <span style="font-size:24px;">📈</span>
          <div>
            <p style="font-size:10px;color:var(--cinza, #94A3B8);margin:0;text-transform:uppercase;letter-spacing:1px;">Gasto em 25 anos</p>
            <p style="font-weight:800;color:#ef4444;margin:0;font-size:1.2rem;">R$ {{economia_25_anos}}+</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <span style="font-size:24px;">🌍</span>
          <div>
            <p style="font-size:10px;color:var(--cinza, #94A3B8);margin:0;text-transform:uppercase;letter-spacing:1px;">CO₂</p>
            <p style="font-weight:700;color:var(--cinza, #64748B);margin:0;">{{co2_evitado_ton_ano}} ton/ano</p>
          </div>
        </div>
      </div>
      <div style="background:var(--card-bg, #fff);border-radius:20px;padding:32px;position:relative;overflow:hidden;border:1px solid rgba(34,197,94,0.2);">
        <div style="position:absolute;top:0;left:0;right:0;height:4px;background:linear-gradient(90deg,#22C55E,#10B981);"></div>
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#22C55E;font-weight:800;margin:0 0 24px;">✅ Com Solar</p>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
          <span style="font-size:24px;">☀️</span>
          <div>
            <p style="font-size:10px;color:var(--cinza, #94A3B8);margin:0;text-transform:uppercase;letter-spacing:1px;">Economia</p>
            <p style="font-weight:800;color:#22C55E;margin:0;font-size:1.2rem;">{{economia_percentual}}% na conta</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:18px;">
          <span style="font-size:24px;">💰</span>
          <div>
            <p style="font-size:10px;color:var(--cinza, #94A3B8);margin:0;text-transform:uppercase;letter-spacing:1px;">Economia 25 anos</p>
            <p style="font-weight:800;color:#22C55E;margin:0;font-size:1.2rem;">R$ {{economia_25_anos}}</p>
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:14px;">
          <span style="font-size:24px;">🌱</span>
          <div>
            <p style="font-size:10px;color:var(--cinza, #94A3B8);margin:0;text-transform:uppercase;letter-spacing:1px;">Impacto</p>
            <p style="font-weight:700;color:#22C55E;margin:0;">Zero emissões</p>
          </div>
        </div>
      </div>
    </div>
  `));

  // ── TECNOLOGIA ──
  const techS = sec(b, 2, { backgroundColor: "var(--card-bg, #fff)" });
  blocks.push(techS);
  const techC = col(b, techS.id, 0); blocks.push(techC);

  blocks.push(txt(b, techC.id, 0, `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">⚙️ Tecnologia</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Componentes do Seu Sistema</h2>
      <p style="color:var(--cinza, #64748B);font-size:0.9rem;margin:10px auto 0;max-width:500px;">Equipamentos de alta performance com garantia estendida de fábrica.</p>
    </div>
  `));

  blocks.push(txt(b, techC.id, 1, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:800px;margin:0 auto;">
      <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:32px;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,var(--la, #F07B24),#F59E0B);display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;flex-shrink:0;">☀️</div>
          <div>
            <h3 style="font-size:1rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Módulos Solares</h3>
            <p style="font-size:11px;color:var(--cinza, #94A3B8);margin:2px 0 0;">Painéis fotovoltaicos</p>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:var(--card-bg, #fff);border-radius:12px;padding:16px;border:1px solid var(--card-border, #E2E8F0);">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;">Fabricante</p>
            <p style="font-weight:700;color:var(--body-text, #0F172A);margin:0;font-size:0.9rem;">{{modulo_fabricante}}</p>
          </div>
          <div style="background:var(--card-bg, #fff);border-radius:12px;padding:16px;border:1px solid var(--card-border, #E2E8F0);">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;">Quantidade</p>
            <p style="font-weight:700;color:var(--body-text, #0F172A);margin:0;font-size:0.9rem;">{{modulo_quantidade}} painéis</p>
          </div>
          <div style="background:var(--card-bg, #fff);border-radius:12px;padding:16px;border:1px solid var(--card-border, #E2E8F0);grid-column:1/-1;">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;">Modelo · Potência</p>
            <p style="font-weight:700;color:var(--la, #F07B24);margin:0;font-size:0.9rem;">{{modulo_modelo}} · {{modulo_potencia}}</p>
          </div>
        </div>
      </div>
      <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:32px;">
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:24px;">
          <div style="width:48px;height:48px;border-radius:14px;background:linear-gradient(135deg,var(--az, #1E3A5F),#3B82F6);display:flex;align-items:center;justify-content:center;font-size:22px;color:#fff;flex-shrink:0;">🔌</div>
          <div>
            <h3 style="font-size:1rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Inversor Solar</h3>
            <p style="font-size:11px;color:var(--cinza, #94A3B8);margin:2px 0 0;">Conversão inteligente</p>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:var(--card-bg, #fff);border-radius:12px;padding:16px;border:1px solid var(--card-border, #E2E8F0);">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;">Fabricante</p>
            <p style="font-weight:700;color:var(--body-text, #0F172A);margin:0;font-size:0.9rem;">{{inversor_fabricante}}</p>
          </div>
          <div style="background:var(--card-bg, #fff);border-radius:12px;padding:16px;border:1px solid var(--card-border, #E2E8F0);">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;">Modelo</p>
            <p style="font-weight:700;color:var(--body-text, #0F172A);margin:0;font-size:0.9rem;">{{inversor_modelo}}</p>
          </div>
          <div style="background:var(--card-bg, #fff);border-radius:12px;padding:16px;border:1px solid var(--card-border, #E2E8F0);grid-column:1/-1;">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;">🛡️ Garantia</p>
            <p style="font-weight:700;color:var(--verde, #22C55E);margin:0;font-size:0.9rem;">{{inversor_garantia}}</p>
          </div>
        </div>
      </div>
    </div>
  `));

  // ── FINANCEIRO ──
  const finS = sec(b, 3, { backgroundColor: "var(--fundo, #F8FAFC)" });
  blocks.push(finS);
  const finC = col(b, finS.id, 0); blocks.push(finC);

  blocks.push(txt(b, finC.id, 0, `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">📊 Análise Financeira</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Retorno do Seu Investimento</h2>
    </div>
  `));

  blocks.push(txt(b, finC.id, 1, `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;max-width:900px;margin-left:auto;margin-right:auto;">
      <div style="background:linear-gradient(135deg, var(--az, #0F172A), var(--az2, #1E3A5F));border-radius:20px;padding:32px;text-align:center;">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 10px;font-weight:700;">Investimento</p>
        <p style="font-size:2rem;font-weight:900;color:var(--la, #F07B24);margin:0;">R$ {{valor_total}}</p>
      </div>
      <div style="background:linear-gradient(135deg, #22C55E, #16A34A);border-radius:20px;padding:32px;text-align:center;">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.5);margin:0 0 10px;font-weight:700;">Economia Anual</p>
        <p style="font-size:2rem;font-weight:900;color:#fff;margin:0;">R$ {{economia_anual}}</p>
      </div>
      <div style="background:linear-gradient(135deg, var(--az, #0F172A), var(--az2, #1E3A5F));border-radius:20px;padding:32px;text-align:center;">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 10px;font-weight:700;">Payback</p>
        <p style="font-size:2rem;font-weight:900;color:var(--la, #F07B24);margin:0;">{{payback}} meses</p>
      </div>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;max-width:900px;margin:0 auto;">
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:24px;text-align:center;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">Geração Mensal</p>
        <p style="font-weight:800;color:var(--body-text, #0F172A);font-size:1.3rem;margin:0;">{{geracao_mensal}} kWh</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:24px;text-align:center;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">Economia 25 Anos</p>
        <p style="font-weight:800;color:var(--verde, #22C55E);font-size:1.3rem;margin:0;">R$ {{economia_25_anos}}</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:24px;text-align:center;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">CO₂ Evitado/Ano</p>
        <p style="font-weight:800;color:var(--verde, #22C55E);font-size:1.3rem;margin:0;">{{co2_evitado_ton_ano}} ton</p>
      </div>
    </div>
  `));

  // ── CTA ──
  const ctaS = sec(b, 4, {
    paddingTop: "72", paddingBottom: "80",
    useGradient: true, gradientStart: "var(--az, #0F172A)", gradientEnd: "var(--az2, #1E3A5F)",
    staticGradientAngle: 160, textAlign: "center",
  });
  blocks.push(ctaS);
  const ctaC = col(b, ctaS.id, 0); blocks.push(ctaC);

  blocks.push(txt(b, ctaC.id, 0, `
    <div style="max-width:600px;margin:0 auto;text-align:center;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.4);font-weight:700;margin:0 0 16px;">🚀 Próximo Passo</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:2rem;font-weight:900;color:#fff;margin:0 0 16px;">Pronto para economizar?</h2>
      <p style="color:rgba(255,255,255,0.55);margin:0 0 36px;font-size:1rem;line-height:1.7;">
        Fale com <strong style="color:var(--la, #F07B24);">{{consultor_nome}}</strong> e dê o primeiro passo.
      </p>
    </div>
  `));

  blocks.push(btn(b, ctaC.id, 1, "✅ Aceitar Proposta", { backgroundColor: "var(--verde, #22C55E)", color: "#fff" }));

  blocks.push(txt(b, ctaC.id, 2, `
    <p style="text-align:center;margin-top:24px;font-size:12px;color:rgba(255,255,255,0.3);">
      {{empresa_nome}} · Proposta personalizada · Condição válida por tempo limitado
    </p>
  `));

  return blocks;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2 — FECHAMENTO RÁPIDO (WhatsApp)
// Foco: decisão rápida, urgência, alto impacto
// ═══════════════════════════════════════════════════════════════

function createFechamentoBlocks(pt: ProposalType): TemplateBlock[] {
  const b = makeBase(pt);
  const blocks: TemplateBlock[] = [];

  // ── HERO ──
  const heroS = sec(b, 0, {
    paddingTop: "80", paddingBottom: "80",
    useGradient: true, gradientStart: "var(--az, #0F172A)", gradientEnd: "var(--az2, #1E293B)",
    staticGradientAngle: 135, textAlign: "center",
  });
  blocks.push(heroS);
  const heroC = col(b, heroS.id, 0); blocks.push(heroC);

  blocks.push(txt(b, heroC.id, 0, `
    <div style="max-width:600px;margin:0 auto;">
      <img src="{{empresa_logo_url}}" alt="{{empresa_nome}}" style="height:32px;margin:0 auto 20px;display:block;max-width:160px;object-fit:contain;" onerror="this.style.display='none'" />
      <div style="display:inline-block;background:var(--la, #F07B24);color:#fff;padding:8px 20px;border-radius:100px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin-bottom:24px;">
        ⚡ Proposta Exclusiva
      </div>
      <h1 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:clamp(1.8rem,5vw,2.8rem);font-weight:900;color:#fff;margin:0 0 12px;line-height:1.1;">
        {{cliente_nome}}, sua economia começa <span style="color:var(--verde, #22C55E);">agora!</span>
      </h1>
      <p style="font-size:1rem;color:rgba(255,255,255,0.5);margin:0 0 40px;">
        Sistema de {{potencia_kwp}} kWp · {{cliente_cidade}}/{{cliente_estado}}
      </p>
      <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:24px;padding:36px;max-width:360px;margin:0 auto;">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 10px;font-weight:700;">Sua economia mensal</p>
        <p style="font-size:3.5rem;font-weight:900;color:var(--verde, #22C55E);margin:0;line-height:1;">R$ {{economia_mensal}}</p>
        <p style="font-size:12px;color:rgba(255,255,255,0.35);margin:10px 0 0;">por mês na sua conta de luz</p>
      </div>
    </div>
  `));

  // ── KPIs ──
  const kpiS = sec(b, 1, { backgroundColor: "var(--fundo, #F8FAFC)" });
  blocks.push(kpiS);
  const kpiC = col(b, kpiS.id, 0); blocks.push(kpiC);

  blocks.push(txt(b, kpiC.id, 0, `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:800px;margin:0 auto;">
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:32px;text-align:center;">
        <p style="font-size:32px;margin:0 0 10px;">💰</p>
        <p style="font-size:1.8rem;font-weight:900;color:var(--la, #F07B24);margin:0;">R$ {{valor_total}}</p>
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--cinza, #94A3B8);margin:10px 0 0;font-weight:700;">Investimento</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:32px;text-align:center;">
        <p style="font-size:32px;margin:0 0 10px;">⏱️</p>
        <p style="font-size:1.8rem;font-weight:900;color:var(--az, #1E3A5F);margin:0;">{{payback}} meses</p>
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--cinza, #94A3B8);margin:10px 0 0;font-weight:700;">Payback</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:32px;text-align:center;">
        <p style="font-size:32px;margin:0 0 10px;">📈</p>
        <p style="font-size:1.8rem;font-weight:900;color:var(--verde, #22C55E);margin:0;">R$ {{economia_anual}}</p>
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:1.5px;color:var(--cinza, #94A3B8);margin:10px 0 0;font-weight:700;">Economia Anual</p>
      </div>
    </div>
  `));

  // ── TECH ──
  const techS = sec(b, 2, { backgroundColor: "var(--card-bg, #fff)" });
  blocks.push(techS);
  const techC = col(b, techS.id, 0); blocks.push(techC);

  blocks.push(txt(b, techC.id, 0, `
    <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:32px;max-width:700px;margin:0 auto;">
      <h3 style="font-size:1.1rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 24px;text-align:center;">⚙️ Seu Sistema Solar</h3>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
        <div style="background:var(--card-bg, #fff);border-radius:12px;padding:16px;border:1px solid var(--card-border, #E2E8F0);">
          <p style="font-size:9px;text-transform:uppercase;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;letter-spacing:1px;">Módulos</p>
          <p style="font-weight:700;color:var(--body-text, #0F172A);margin:0;font-size:0.85rem;">{{modulo_quantidade}}x {{modulo_fabricante}} {{modulo_potencia}}</p>
        </div>
        <div style="background:var(--card-bg, #fff);border-radius:12px;padding:16px;border:1px solid var(--card-border, #E2E8F0);">
          <p style="font-size:9px;text-transform:uppercase;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;letter-spacing:1px;">Inversor</p>
          <p style="font-weight:700;color:var(--body-text, #0F172A);margin:0;font-size:0.85rem;">{{inversor_fabricante}} {{inversor_modelo}}</p>
        </div>
        <div style="background:var(--card-bg, #fff);border-radius:12px;padding:16px;border:1px solid var(--card-border, #E2E8F0);">
          <p style="font-size:9px;text-transform:uppercase;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;letter-spacing:1px;">Geração</p>
          <p style="font-weight:700;color:var(--la, #F07B24);margin:0;font-size:0.85rem;">{{geracao_mensal}} kWh/mês</p>
        </div>
        <div style="background:var(--card-bg, #fff);border-radius:12px;padding:16px;border:1px solid var(--card-border, #E2E8F0);">
          <p style="font-size:9px;text-transform:uppercase;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;letter-spacing:1px;">Garantia</p>
          <p style="font-weight:700;color:var(--verde, #22C55E);margin:0;font-size:0.85rem;">{{inversor_garantia}}</p>
        </div>
      </div>
    </div>
  `));

  // ── CTA ──
  const ctaS = sec(b, 3, {
    paddingTop: "64", paddingBottom: "80",
    useGradient: true, gradientStart: "var(--az, #0F172A)", gradientEnd: "var(--az2, #1E293B)",
    staticGradientAngle: 135, textAlign: "center",
  });
  blocks.push(ctaS);
  const ctaC = col(b, ctaS.id, 0); blocks.push(ctaC);

  blocks.push(txt(b, ctaC.id, 0, `
    <div style="max-width:520px;margin:0 auto;text-align:center;">
      <div style="display:inline-block;background:rgba(239,68,68,0.12);color:#ef4444;padding:8px 20px;border-radius:100px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin-bottom:24px;">
        ⏰ Condição válida por tempo limitado
      </div>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:2rem;font-weight:900;color:#fff;margin:0 0 12px;">
        Pronto para começar a economizar?
      </h2>
      <p style="color:rgba(255,255,255,0.5);margin:0 0 36px;font-size:0.95rem;">
        Clique abaixo e garanta essa condição exclusiva.
      </p>
    </div>
  `));

  blocks.push(btn(b, ctaC.id, 1, "🚀 ACEITAR PROPOSTA", { backgroundColor: "var(--verde, #22C55E)", color: "#fff", fontSize: "20", fontWeight: "900", borderRadius: "16", paddingTop: "22", paddingBottom: "22", paddingLeft: "56", paddingRight: "56" }));

  blocks.push(txt(b, ctaC.id, 2, `
    <div style="text-align:center;margin-top:28px;">
      <p style="font-size:12px;color:rgba(255,255,255,0.25);margin:0 0 4px;">🔒 Dados protegidos · {{empresa_nome}}</p>
      <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;">Consultor: {{consultor_nome}}</p>
    </div>
  `));

  return blocks;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3 — EDUCACIONAL (Leads frios)
// Foco: educação, construção de valor, como funciona
// ═══════════════════════════════════════════════════════════════

function createEscalaBlocks(pt: ProposalType): TemplateBlock[] {
  const b = makeBase(pt);
  const blocks: TemplateBlock[] = [];

  // ── HERO ──
  const heroS = sec(b, 0, {
    paddingTop: "72", paddingBottom: "72",
    useGradient: true, gradientStart: "var(--az, #0F172A)", gradientEnd: "var(--az2, #1E3A5F)",
    staticGradientAngle: 160, textAlign: "center",
  });
  blocks.push(heroS);
  const heroC = col(b, heroS.id, 0); blocks.push(heroC);

  blocks.push(txt(b, heroC.id, 0, `
    <div style="max-width:640px;margin:0 auto;">
      <img src="{{empresa_logo_url}}" alt="{{empresa_nome}}" style="height:32px;margin:0 auto 24px;display:block;max-width:160px;object-fit:contain;" onerror="this.style.display='none'" />
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.4);font-weight:700;margin:0 0 16px;">☀️ Simulação Personalizada</p>
      <h1 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:clamp(1.8rem,4vw,2.4rem);font-weight:900;color:#fff;margin:0 0 16px;line-height:1.15;">
        Descubra quanto você pode economizar com energia solar
      </h1>
      <p style="font-size:1.05rem;color:rgba(255,255,255,0.5);margin:0 0 40px;line-height:1.7;">
        Olá, <strong style="color:var(--la, #F07B24);">{{cliente_nome}}</strong>! Simulação exclusiva para {{cliente_cidade}}/{{cliente_estado}}.
      </p>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;">
        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px 32px;min-width:170px;text-align:center;">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 8px;font-weight:700;">Economia/mês</p>
          <p style="font-size:2rem;font-weight:900;color:var(--verde, #22C55E);margin:0;">R$ {{economia_mensal}}</p>
        </div>
        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px 32px;min-width:170px;text-align:center;">
          <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 8px;font-weight:700;">Potência</p>
          <p style="font-size:2rem;font-weight:900;color:var(--la, #F07B24);margin:0;">{{potencia_kwp}} kWp</p>
        </div>
      </div>
    </div>
  `));

  // ── COMO FUNCIONA ──
  const eduS = sec(b, 1, { backgroundColor: "var(--fundo, #F8FAFC)" });
  blocks.push(eduS);
  const eduC = col(b, eduS.id, 0); blocks.push(eduC);

  blocks.push(txt(b, eduC.id, 0, `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">💡 Entenda</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Como Funciona a Energia Solar</h2>
    </div>
  `));

  blocks.push(txt(b, eduC.id, 1, `
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:840px;margin:0 auto;">
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:32px;text-align:center;">
        <div style="width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#F07B24,#F59E0B);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;color:#fff;">☀️</div>
        <h4 style="font-size:0.95rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 10px;">1. Captação</h4>
        <p style="font-size:0.82rem;color:var(--cinza, #64748B);margin:0;line-height:1.6;">Os painéis solares captam a luz do sol e convertem em eletricidade limpa.</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:32px;text-align:center;">
        <div style="width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#3B82F6,#1E3A5F);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;color:#fff;">⚡</div>
        <h4 style="font-size:0.95rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 10px;">2. Conversão</h4>
        <p style="font-size:0.82rem;color:var(--cinza, #64748B);margin:0;line-height:1.6;">O inversor transforma a energia em corrente alternada para uso na sua casa.</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:32px;text-align:center;">
        <div style="width:60px;height:60px;border-radius:16px;background:linear-gradient(135deg,#22C55E,#16A34A);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;color:#fff;">💰</div>
        <h4 style="font-size:0.95rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 10px;">3. Economia</h4>
        <p style="font-size:0.82rem;color:var(--cinza, #64748B);margin:0;line-height:1.6;">A energia gerada abate da sua conta de luz. O excedente vira créditos!</p>
      </div>
    </div>
  `));

  // ── SEU SISTEMA ──
  const sisS = sec(b, 2, { backgroundColor: "var(--card-bg, #fff)" });
  blocks.push(sisS);
  const sisC = col(b, sisS.id, 0); blocks.push(sisC);

  blocks.push(txt(b, sisC.id, 0, `
    <div style="text-align:center;margin-bottom:36px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">🔧 Seu Sistema</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">O que está incluso</h2>
    </div>
  `));

  blocks.push(txt(b, sisC.id, 1, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:700px;margin:0 auto;">
      <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:28px;">
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--la, #F07B24);font-weight:800;margin:0 0 16px;">☀️ Painéis</p>
        <p style="font-weight:800;color:var(--body-text, #0F172A);margin:0 0 4px;font-size:1rem;">{{modulo_quantidade}}x {{modulo_fabricante}}</p>
        <p style="color:var(--cinza, #64748B);margin:0;font-size:0.85rem;">{{modulo_modelo}} · {{modulo_potencia}}</p>
      </div>
      <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:28px;">
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:2px;color:var(--la, #F07B24);font-weight:800;margin:0 0 16px;">🔌 Inversor</p>
        <p style="font-weight:800;color:var(--body-text, #0F172A);margin:0 0 4px;font-size:1rem;">{{inversor_fabricante}} {{inversor_modelo}}</p>
        <p style="color:var(--cinza, #64748B);margin:0;font-size:0.85rem;">Garantia: {{inversor_garantia}}</p>
      </div>
    </div>
  `));

  // ── INVESTIMENTO ──
  const valS = sec(b, 3, { backgroundColor: "var(--fundo, #F8FAFC)" });
  blocks.push(valS);
  const valC = col(b, valS.id, 0); blocks.push(valC);

  blocks.push(txt(b, valC.id, 0, `
    <div style="text-align:center;margin-bottom:36px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">💰 Investimento</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Quanto você vai economizar</h2>
    </div>
  `));

  blocks.push(txt(b, valC.id, 1, `
    <div style="max-width:700px;margin:0 auto;">
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
        <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:28px;text-align:center;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 8px;font-weight:700;">Economia Mensal</p>
          <p style="font-size:1.8rem;font-weight:900;color:var(--verde, #22C55E);margin:0;">R$ {{economia_mensal}}</p>
        </div>
        <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:28px;text-align:center;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 8px;font-weight:700;">Economia Anual</p>
          <p style="font-size:1.8rem;font-weight:900;color:var(--verde, #22C55E);margin:0;">R$ {{economia_anual}}</p>
        </div>
      </div>
      <div style="background:linear-gradient(135deg, var(--az, #0F172A), var(--az2, #1E3A5F));border-radius:20px;padding:32px;text-align:center;">
        <p style="font-size:10px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 10px;font-weight:700;">Economia em 25 anos</p>
        <p style="font-size:2.4rem;font-weight:900;color:var(--la, #F07B24);margin:0;">R$ {{economia_25_anos}}</p>
        <p style="font-size:12px;color:rgba(255,255,255,0.35);margin:10px 0 0;">com payback em {{payback}} meses</p>
      </div>
    </div>
  `));

  // ── CTA ──
  const ctaS = sec(b, 4, { backgroundColor: "var(--card-bg, #fff)", paddingTop: "64", paddingBottom: "72", textAlign: "center" });
  blocks.push(ctaS);
  const ctaC = col(b, ctaS.id, 0); blocks.push(ctaC);

  blocks.push(txt(b, ctaC.id, 0, `
    <div style="max-width:520px;margin:0 auto;text-align:center;">
      <p style="font-size:48px;margin:0 0 16px;">🤝</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:900;color:var(--body-text, #0F172A);margin:0 0 12px;">Gostou da simulação?</h2>
      <p style="color:var(--cinza, #64748B);margin:0 0 36px;font-size:0.95rem;line-height:1.7;">
        Fale com um especialista da <strong style="color:var(--body-text, #0F172A);">{{empresa_nome}}</strong> e tire suas dúvidas.
      </p>
    </div>
  `));

  blocks.push(btn(b, ctaC.id, 1, "💬 Falar com Consultor", { backgroundColor: "var(--la, #F07B24)", color: "#fff", fontSize: "16", fontWeight: "700" }));

  blocks.push(txt(b, ctaC.id, 2, `
    <div style="text-align:center;margin-top:24px;">
      <p style="font-size:12px;color:var(--cinza, #94A3B8);margin:0;">Consultor: <strong>{{consultor_nome}}</strong> · {{empresa_nome}}</p>
    </div>
  `));

  return blocks;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 4 — HÍBRIDO / OFF-GRID
// Foco: múltiplos inversores, bateria, estrutura, serviços
// Ideal para: projetos complexos, off-grid, backup
// ═══════════════════════════════════════════════════════════════

function createHibridoBlocks(pt: ProposalType): TemplateBlock[] {
  const b = makeBase(pt);
  const blocks: TemplateBlock[] = [];

  // ── HERO ──
  const heroS = sec(b, 0, {
    paddingTop: "80", paddingBottom: "80",
    useGradient: true, gradientStart: "#0C1222", gradientEnd: "#1A2744",
    staticGradientAngle: 150, textAlign: "center",
  });
  blocks.push(heroS);
  const heroC = col(b, heroS.id, 0); blocks.push(heroC);

  blocks.push(txt(b, heroC.id, 0, `
    <div style="max-width:720px;margin:0 auto;">
      <img src="{{empresa_logo_url}}" alt="{{empresa_nome}}" style="height:36px;margin:0 auto 24px;display:block;max-width:180px;object-fit:contain;" onerror="this.style.display='none'" />
      <div style="display:inline-flex;align-items:center;gap:8px;background:rgba(34,197,94,0.15);color:#22C55E;padding:8px 20px;border-radius:100px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:2px;margin-bottom:24px;">
        🔋 Sistema Híbrido com Backup
      </div>
      <h1 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:clamp(2rem,5vw,2.8rem);font-weight:900;color:#fff;margin:0 0 16px;line-height:1.1;">
        <span style="color:var(--la, #F07B24);">{{cliente_nome}}</span>, independência energética total
      </h1>
      <p style="font-size:1.05rem;color:rgba(255,255,255,0.5);margin:0 0 40px;line-height:1.7;">
        Sistema solar com armazenamento e backup para {{cliente_cidade}}/{{cliente_estado}}. Funciona mesmo sem a rede elétrica.
      </p>
      <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:14px;">
        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px 28px;min-width:150px;text-align:center;flex:1;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 8px;font-weight:700;">Potência</p>
          <p style="font-size:1.8rem;font-weight:900;color:var(--la, #F07B24);margin:0;">{{potencia_kwp}} kWp</p>
        </div>
        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px 28px;min-width:150px;text-align:center;flex:1;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 8px;font-weight:700;">Economia/mês</p>
          <p style="font-size:1.8rem;font-weight:900;color:var(--verde, #22C55E);margin:0;">R$ {{economia_mensal}}</p>
        </div>
        <div style="background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.1);border-radius:20px;padding:24px 28px;min-width:150px;text-align:center;flex:1;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 8px;font-weight:700;">Geração</p>
          <p style="font-size:1.8rem;font-weight:900;color:var(--la, #F07B24);margin:0;">{{geracao_mensal}} kWh</p>
        </div>
      </div>
    </div>
  `));

  // ── EQUIPAMENTOS — Módulos + Inversores + Bateria ──
  const eqS = sec(b, 1, { backgroundColor: "var(--fundo, #F8FAFC)" });
  blocks.push(eqS);
  const eqC = col(b, eqS.id, 0); blocks.push(eqC);

  blocks.push(txt(b, eqC.id, 0, `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">⚙️ Equipamentos</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Sistema Completo</h2>
    </div>
  `));

  blocks.push(txt(b, eqC.id, 1, `
    <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:20px;max-width:900px;margin:0 auto;">
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:28px;text-align:center;">
        <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#F07B24,#F59E0B);display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 16px;color:#fff;">☀️</div>
        <h4 style="font-size:0.95rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 12px;">Módulos Solares</h4>
        <p style="font-weight:800;color:var(--la, #F07B24);margin:0 0 4px;font-size:1.1rem;">{{modulo_quantidade}} painéis</p>
        <p style="color:var(--cinza, #64748B);margin:0;font-size:0.8rem;">{{modulo_fabricante}} · {{modulo_modelo}}</p>
        <p style="color:var(--cinza, #94A3B8);margin:4px 0 0;font-size:0.75rem;">{{modulo_potencia}} por painel</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:28px;text-align:center;">
        <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#3B82F6,#1E3A5F);display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 16px;color:#fff;">🔌</div>
        <h4 style="font-size:0.95rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 12px;">Inversores</h4>
        <p style="font-weight:800;color:var(--az, #1E3A5F);margin:0 0 4px;font-size:1.1rem;">{{inversores_utilizados}}x Inversor</p>
        <p style="color:var(--cinza, #64748B);margin:0;font-size:0.8rem;">{{inversor_fabricante}} · {{inversor_modelo}}</p>
        <p style="color:var(--verde, #22C55E);margin:4px 0 0;font-size:0.75rem;">Garantia: {{inversor_garantia}}</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:2px solid var(--verde, #22C55E);border-radius:20px;padding:28px;text-align:center;position:relative;">
        <div style="position:absolute;top:-10px;left:50%;transform:translateX(-50%);background:var(--verde, #22C55E);color:#fff;padding:3px 14px;border-radius:100px;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1px;">Backup</div>
        <div style="width:56px;height:56px;border-radius:16px;background:linear-gradient(135deg,#22C55E,#16A34A);display:flex;align-items:center;justify-content:center;font-size:26px;margin:0 auto 16px;color:#fff;">🔋</div>
        <h4 style="font-size:0.95rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 12px;">Bateria</h4>
        <p style="font-weight:800;color:var(--verde, #22C55E);margin:0 0 4px;font-size:1.1rem;">Armazenamento</p>
        <p style="color:var(--cinza, #64748B);margin:0;font-size:0.8rem;">Backup para falta de energia</p>
        <p style="color:var(--cinza, #94A3B8);margin:4px 0 0;font-size:0.75rem;">Funciona sem a rede</p>
      </div>
    </div>
  `));

  // ── SERVIÇOS INCLUSOS ──
  const svcS = sec(b, 2, { backgroundColor: "var(--card-bg, #fff)" });
  blocks.push(svcS);
  const svcC = col(b, svcS.id, 0); blocks.push(svcC);

  blocks.push(txt(b, svcC.id, 0, `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">🛠️ Serviços</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">O que está incluso</h2>
    </div>
  `));

  blocks.push(txt(b, svcC.id, 1, `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;max-width:800px;margin:0 auto;">
      <div style="display:flex;align-items:flex-start;gap:14px;background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:24px;">
        <div style="width:40px;height:40px;border-radius:12px;background:rgba(240,123,36,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📐</div>
        <div>
          <h4 style="font-size:0.9rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 4px;">Projeto Técnico</h4>
          <p style="font-size:0.8rem;color:var(--cinza, #64748B);margin:0;line-height:1.5;">Dimensionamento e projeto elétrico completo com ART.</p>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:24px;">
        <div style="width:40px;height:40px;border-radius:12px;background:rgba(240,123,36,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">🏗️</div>
        <div>
          <h4 style="font-size:0.9rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 4px;">Estrutura de Fixação</h4>
          <p style="font-size:0.8rem;color:var(--cinza, #64748B);margin:0;line-height:1.5;">Estrutura adequada para {{tipo_telhado}} com fixação reforçada.</p>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:24px;">
        <div style="width:40px;height:40px;border-radius:12px;background:rgba(34,197,94,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">⚡</div>
        <div>
          <h4 style="font-size:0.9rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 4px;">Instalação Completa</h4>
          <p style="font-size:0.8rem;color:var(--cinza, #64748B);margin:0;line-height:1.5;">Equipe técnica certificada com seguro e garantia de serviço.</p>
        </div>
      </div>
      <div style="display:flex;align-items:flex-start;gap:14px;background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:24px;">
        <div style="width:40px;height:40px;border-radius:12px;background:rgba(34,197,94,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;flex-shrink:0;">📋</div>
        <div>
          <h4 style="font-size:0.9rem;font-weight:800;color:var(--body-text, #0F172A);margin:0 0 4px;">Homologação</h4>
          <p style="font-size:0.8rem;color:var(--cinza, #64748B);margin:0;line-height:1.5;">Processo completo junto à {{distribuidora_nome}} com acompanhamento.</p>
        </div>
      </div>
    </div>
  `));

  // ── FINANCEIRO ──
  const finS = sec(b, 3, { backgroundColor: "var(--fundo, #F8FAFC)" });
  blocks.push(finS);
  const finC = col(b, finS.id, 0); blocks.push(finC);

  blocks.push(txt(b, finC.id, 0, `
    <div style="text-align:center;margin-bottom:36px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">📊 Investimento</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Retorno Garantido</h2>
    </div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;max-width:800px;margin:0 auto;">
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:28px;text-align:center;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 8px;font-weight:700;">Investimento</p>
        <p style="font-size:1.6rem;font-weight:900;color:var(--body-text, #0F172A);margin:0;">R$ {{valor_total}}</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:28px;text-align:center;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 8px;font-weight:700;">Payback</p>
        <p style="font-size:1.6rem;font-weight:900;color:var(--az, #1E3A5F);margin:0;">{{payback}} meses</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:28px;text-align:center;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 8px;font-weight:700;">Economia 25 anos</p>
        <p style="font-size:1.6rem;font-weight:900;color:var(--verde, #22C55E);margin:0;">R$ {{economia_25_anos}}</p>
      </div>
    </div>
  `));

  // ── CTA ──
  const ctaS = sec(b, 4, {
    paddingTop: "72", paddingBottom: "80",
    useGradient: true, gradientStart: "#0C1222", gradientEnd: "#1A2744",
    staticGradientAngle: 150, textAlign: "center",
  });
  blocks.push(ctaS);
  const ctaC = col(b, ctaS.id, 0); blocks.push(ctaC);

  blocks.push(txt(b, ctaC.id, 0, `
    <div style="max-width:580px;margin:0 auto;text-align:center;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.4);font-weight:700;margin:0 0 16px;">🔋 Independência Energética</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:2rem;font-weight:900;color:#fff;margin:0 0 16px;">Nunca mais fique sem energia</h2>
      <p style="color:rgba(255,255,255,0.5);margin:0 0 36px;font-size:1rem;line-height:1.7;">
        Com o sistema híbrido da <strong style="color:var(--la, #F07B24);">{{empresa_nome}}</strong>, sua casa ou empresa funciona 24h.
      </p>
    </div>
  `));

  blocks.push(btn(b, ctaC.id, 1, "✅ Aceitar Proposta", { backgroundColor: "var(--verde, #22C55E)", color: "#fff" }));

  blocks.push(txt(b, ctaC.id, 2, `
    <p style="text-align:center;margin-top:24px;font-size:12px;color:rgba(255,255,255,0.25);">
      {{empresa_nome}} · Consultor: {{consultor_nome}} · {{consultor_telefone}}
    </p>
  `));

  return blocks;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 5 — CORPORATIVO / B2B
// Foco: ROI empresarial, multi-UC, profissional, dados
// ═══════════════════════════════════════════════════════════════

function createCorporativoBlocks(pt: ProposalType): TemplateBlock[] {
  const b = makeBase(pt);
  const blocks: TemplateBlock[] = [];

  // ── HERO ──
  const heroS = sec(b, 0, {
    paddingTop: "72", paddingBottom: "72",
    useGradient: true, gradientStart: "#0F172A", gradientEnd: "#1E293B",
    staticGradientAngle: 180, textAlign: "center",
  });
  blocks.push(heroS);
  const heroC = col(b, heroS.id, 0); blocks.push(heroC);

  blocks.push(txt(b, heroC.id, 0, `
    <div style="max-width:760px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:32px;">
        <img src="{{empresa_logo_url}}" alt="{{empresa_nome}}" style="height:40px;max-width:200px;object-fit:contain;" onerror="this.style.display='none'" />
      </div>
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:rgba(255,255,255,0.35);font-weight:700;margin:0 0 16px;">Proposta Comercial</p>
      <h1 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:clamp(1.8rem,4vw,2.6rem);font-weight:900;color:#fff;margin:0 0 12px;line-height:1.12;">
        Reduza os custos operacionais da <span style="color:var(--la, #F07B24);">{{cliente_empresa}}</span>
      </h1>
      <p style="font-size:1rem;color:rgba(255,255,255,0.45);margin:0 0 40px;line-height:1.7;">
        Proposta de geração distribuída para {{cliente_nome}} em {{cliente_cidade}}/{{cliente_estado}}.
      </p>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;max-width:700px;margin:0 auto;">
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px 8px;text-align:center;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin:0 0 6px;font-weight:700;">Potência</p>
          <p style="font-size:1.3rem;font-weight:900;color:var(--la, #F07B24);margin:0;">{{potencia_kwp}} kWp</p>
        </div>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px 8px;text-align:center;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin:0 0 6px;font-weight:700;">Economia</p>
          <p style="font-size:1.3rem;font-weight:900;color:var(--verde, #22C55E);margin:0;">R$ {{economia_mensal}}/m</p>
        </div>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px 8px;text-align:center;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin:0 0 6px;font-weight:700;">Payback</p>
          <p style="font-size:1.3rem;font-weight:900;color:#fff;margin:0;">{{payback}} meses</p>
        </div>
        <div style="background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.08);border-radius:16px;padding:20px 8px;text-align:center;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.35);margin:0 0 6px;font-weight:700;">Geração</p>
          <p style="font-size:1.3rem;font-weight:900;color:var(--la, #F07B24);margin:0;">{{geracao_mensal}} kWh</p>
        </div>
      </div>
    </div>
  `));

  // ── ANÁLISE TÉCNICA ──
  const techS = sec(b, 1, { backgroundColor: "var(--fundo, #F8FAFC)" });
  blocks.push(techS);
  const techC = col(b, techS.id, 0); blocks.push(techC);

  blocks.push(txt(b, techC.id, 0, `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">⚙️ Análise Técnica</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Especificações do Sistema</h2>
    </div>
  `));

  blocks.push(txt(b, techC.id, 1, `
    <div style="max-width:800px;margin:0 auto;">
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;overflow:hidden;">
        <div style="display:grid;grid-template-columns:1fr 1fr;border-bottom:1px solid var(--card-border, #E2E8F0);">
          <div style="padding:24px;border-right:1px solid var(--card-border, #E2E8F0);">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">Módulos Fotovoltaicos</p>
            <p style="font-weight:800;color:var(--body-text, #0F172A);margin:0;font-size:1rem;">{{modulo_quantidade}}x {{modulo_fabricante}}</p>
            <p style="color:var(--cinza, #64748B);margin:4px 0 0;font-size:0.8rem;">{{modulo_modelo}} · {{modulo_potencia}}/un</p>
          </div>
          <div style="padding:24px;">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">Inversores</p>
            <p style="font-weight:800;color:var(--body-text, #0F172A);margin:0;font-size:1rem;">{{inversores_utilizados}}x {{inversor_fabricante}}</p>
            <p style="color:var(--cinza, #64748B);margin:4px 0 0;font-size:0.8rem;">{{inversor_modelo}} · Garantia {{inversor_garantia}}</p>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0;">
          <div style="padding:24px;text-align:center;border-right:1px solid var(--card-border, #E2E8F0);">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">Estrutura</p>
            <p style="font-weight:700;color:var(--body-text, #0F172A);margin:0;">{{tipo_telhado}}</p>
          </div>
          <div style="padding:24px;text-align:center;border-right:1px solid var(--card-border, #E2E8F0);">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">Rede</p>
            <p style="font-weight:700;color:var(--body-text, #0F172A);margin:0;">{{fase}}</p>
          </div>
          <div style="padding:24px;text-align:center;">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">Concessionária</p>
            <p style="font-weight:700;color:var(--body-text, #0F172A);margin:0;">{{distribuidora_nome}}</p>
          </div>
        </div>
      </div>
    </div>
  `));

  // ── ROI / FINANCEIRO ──
  const finS = sec(b, 2, { backgroundColor: "var(--card-bg, #fff)" });
  blocks.push(finS);
  const finC = col(b, finS.id, 0); blocks.push(finC);

  blocks.push(txt(b, finC.id, 0, `
    <div style="text-align:center;margin-bottom:40px;">
      <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">📊 Viabilidade Financeira</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.8rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Retorno sobre o Investimento</h2>
    </div>
  `));

  blocks.push(txt(b, finC.id, 1, `
    <div style="max-width:800px;margin:0 auto;">
      <div style="background:linear-gradient(135deg, #0F172A, #1E293B);border-radius:20px;padding:40px;margin-bottom:20px;">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:24px;text-align:center;">
          <div>
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.35);margin:0 0 8px;font-weight:700;">Investimento Total</p>
            <p style="font-size:2rem;font-weight:900;color:var(--la, #F07B24);margin:0;">R$ {{valor_total}}</p>
          </div>
          <div>
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.35);margin:0 0 8px;font-weight:700;">Economia Anual</p>
            <p style="font-size:2rem;font-weight:900;color:var(--verde, #22C55E);margin:0;">R$ {{economia_anual}}</p>
          </div>
          <div>
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.35);margin:0 0 8px;font-weight:700;">ROI 25 Anos</p>
            <p style="font-size:2rem;font-weight:900;color:#fff;margin:0;">R$ {{economia_25_anos}}</p>
          </div>
        </div>
      </div>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:12px;">
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:14px;padding:20px;text-align:center;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">Payback</p>
          <p style="font-weight:900;color:var(--body-text, #0F172A);font-size:1.2rem;margin:0;">{{payback}} meses</p>
        </div>
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:14px;padding:20px;text-align:center;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">Economia/mês</p>
          <p style="font-weight:900;color:var(--verde, #22C55E);font-size:1.2rem;margin:0;">R$ {{economia_mensal}}</p>
        </div>
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:14px;padding:20px;text-align:center;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">Geração</p>
          <p style="font-weight:900;color:var(--body-text, #0F172A);font-size:1.2rem;margin:0;">{{geracao_mensal}} kWh</p>
        </div>
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:14px;padding:20px;text-align:center;">
          <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 6px;font-weight:700;">CO₂/ano</p>
          <p style="font-weight:900;color:var(--verde, #22C55E);font-size:1.2rem;margin:0;">{{co2_evitado_ton_ano}} ton</p>
        </div>
      </div>
    </div>
  `));

  // ── CTA ──
  const ctaS = sec(b, 3, {
    paddingTop: "64", paddingBottom: "72",
    useGradient: true, gradientStart: "#0F172A", gradientEnd: "#1E293B",
    staticGradientAngle: 180, textAlign: "center",
  });
  blocks.push(ctaS);
  const ctaC = col(b, ctaS.id, 0); blocks.push(ctaC);

  blocks.push(txt(b, ctaC.id, 0, `
    <div style="max-width:600px;margin:0 auto;text-align:center;">
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:2rem;font-weight:900;color:#fff;margin:0 0 16px;">Pronto para reduzir custos?</h2>
      <p style="color:rgba(255,255,255,0.45);margin:0 0 36px;font-size:1rem;line-height:1.7;">
        Entre em contato com <strong style="color:var(--la, #F07B24);">{{consultor_nome}}</strong> para avançar com a proposta.
      </p>
    </div>
  `));

  blocks.push(btn(b, ctaC.id, 1, "✅ Aceitar Proposta", { backgroundColor: "var(--verde, #22C55E)", color: "#fff" }));

  blocks.push(txt(b, ctaC.id, 2, `
    <div style="text-align:center;margin-top:28px;">
      <p style="font-size:12px;color:rgba(255,255,255,0.3);margin:0 0 4px;">{{empresa_nome}} · CNPJ: {{empresa_cnpj_cpf}}</p>
      <p style="font-size:11px;color:rgba(255,255,255,0.2);margin:0;">{{consultor_nome}} · {{consultor_telefone}} · {{consultor_email}}</p>
    </div>
  `));

  return blocks;
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 6 — DASHBOARD (Gdash-style)
// Foco: visual limpo, comparativo gráfico, simulador, mobile-first
// Ideal para: alta conversão, WhatsApp, decisão visual
// ═══════════════════════════════════════════════════════════════

function createDashboardBlocks(pt: ProposalType): TemplateBlock[] {
  const b = makeBase(pt);
  const blocks: TemplateBlock[] = [];

  // ── HERO — Header limpo com logo + cliente ──
  const heroS = sec(b, 0, {
    paddingTop: "40", paddingBottom: "32",
    backgroundColor: "var(--card-bg, #fff)",
  });
  blocks.push(heroS);
  const heroC = col(b, heroS.id, 0); blocks.push(heroC);

  blocks.push(txt(b, heroC.id, 0, `
    <div style="max-width:900px;margin:0 auto;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap;margin-bottom:32px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="width:48px;height:48px;border-radius:50%;background:var(--fundo, #F1F5F9);border:2px solid var(--card-border, #E2E8F0);display:flex;align-items:center;justify-content:center;font-size:20px;">👤</div>
          <div>
            <p style="font-weight:800;color:var(--body-text, #0F172A);margin:0;font-size:1rem;font-family:var(--font-heading,'Montserrat',sans-serif);">{{cliente_nome}}</p>
            <p style="color:var(--cinza, #64748B);margin:2px 0 0;font-size:0.8rem;">{{cliente_cidade}}/{{cliente_estado}}</p>
          </div>
        </div>
        <img src="{{empresa_logo_url}}" alt="{{empresa_nome}}" style="height:40px;max-width:160px;object-fit:contain;" onerror="this.style.display='none'" />
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:20px;">
        <!-- Card Projeto -->
        <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--cinza, #94A3B8);font-weight:700;margin:0 0 20px;">☀️ SEU PROJETO EXCLUSIVO</p>
          <div style="background:var(--fundo, #F8FAFC);border-radius:14px;padding:20px;margin-bottom:20px;text-align:center;border:1px solid var(--card-border, #E2E8F0);">
            <p style="font-size:2rem;font-weight:900;color:var(--la, #F07B24);margin:0;font-family:var(--font-numbers,'Montserrat',sans-serif);">{{modulo_quantidade}} Painéis</p>
            <p style="font-size:0.85rem;color:var(--cinza, #64748B);margin:6px 0 0;">{{potencia_kwp}} kWp</p>
          </div>
          <p style="font-size:0.82rem;color:var(--cinza, #64748B);margin:0;">
            <strong style="color:var(--body-text, #0F172A);">Marca:</strong> {{modulo_fabricante}}<br/>
            <strong style="color:var(--body-text, #0F172A);">Modelo:</strong> {{modulo_modelo}}
          </p>
        </div>

        <!-- Card Impacto Financeiro -->
        <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--cinza, #94A3B8);font-weight:700;margin:0 0 20px;">📊 IMPACTO FINANCEIRO</p>
          <!-- Barra comparativa visual -->
          <div style="display:flex;align-items:flex-end;gap:16px;justify-content:center;height:160px;margin-bottom:16px;">
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;">
              <p style="font-size:10px;color:var(--cinza, #94A3B8);margin:0;font-weight:700;">COM SOLAR</p>
              <div style="width:100%;max-width:80px;height:40px;background:var(--az, #3B82F6);border-radius:8px 8px 0 0;"></div>
              <p style="font-weight:800;color:var(--az, #3B82F6);margin:0;font-size:0.85rem;">Nova Conta:</p>
              <p style="font-weight:900;color:var(--body-text, #0F172A);margin:0;font-size:1.1rem;">R$ 30</p>
            </div>
            <div style="display:flex;flex-direction:column;align-items:center;gap:6px;flex:1;">
              <p style="font-size:10px;color:var(--cinza, #94A3B8);margin:0;font-weight:700;">SEM SOLAR</p>
              <div style="width:100%;max-width:80px;height:140px;background:var(--la, #F07B24);border-radius:8px 8px 0 0;"></div>
              <p style="font-weight:800;color:var(--la, #F07B24);margin:0;font-size:0.85rem;">Gasto Atual:</p>
              <p style="font-weight:900;color:var(--body-text, #0F172A);margin:0;font-size:1.1rem;">R$ {{economia_mensal}}</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `));

  // ── KPIs Strip ──
  const kpiS = sec(b, 1, { backgroundColor: "var(--fundo, #F8FAFC)", paddingTop: "32", paddingBottom: "32" });
  blocks.push(kpiS);
  const kpiC = col(b, kpiS.id, 0); blocks.push(kpiC);

  blocks.push(txt(b, kpiC.id, 0, `
    <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:14px;max-width:900px;margin:0 auto;">
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:20px;text-align:center;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:var(--cinza, #94A3B8);margin:0 0 8px;font-weight:700;">⚡ Potência</p>
        <p style="font-size:1.6rem;font-weight:900;color:var(--la, #F07B24);margin:0;">{{potencia_kwp}} kWp</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:20px;text-align:center;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:var(--cinza, #94A3B8);margin:0 0 8px;font-weight:700;">☀️ Geração/mês</p>
        <p style="font-size:1.6rem;font-weight:900;color:var(--body-text, #0F172A);margin:0;">{{geracao_mensal}} kWh</p>
      </div>
      <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:20px;text-align:center;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:var(--cinza, #94A3B8);margin:0 0 8px;font-weight:700;">⏱️ Payback</p>
        <p style="font-size:1.6rem;font-weight:900;color:var(--az, #1E3A5F);margin:0;">{{payback}} meses</p>
      </div>
      <div style="background:linear-gradient(135deg, var(--verde, #22C55E), #16A34A);border-radius:16px;padding:20px;text-align:center;">
        <p style="font-size:9px;text-transform:uppercase;letter-spacing:1.5px;color:rgba(255,255,255,0.7);margin:0 0 8px;font-weight:700;">💰 Lucro 25 anos</p>
        <p style="font-size:1.6rem;font-weight:900;color:#fff;margin:0;">R$ {{economia_25_anos}}</p>
      </div>
    </div>
  `));

  // ── TECNOLOGIA — Cards compactos ──
  const techS = sec(b, 2, { backgroundColor: "var(--card-bg, #fff)" });
  blocks.push(techS);
  const techC = col(b, techS.id, 0); blocks.push(techC);

  blocks.push(txt(b, techC.id, 0, `
    <div style="max-width:900px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:32px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">⚙️ Tecnologia</p>
        <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.6rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Componentes do Sistema</h2>
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px;">
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:24px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--la, #F07B24),#F59E0B);display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;flex-shrink:0;">☀️</div>
            <div>
              <h3 style="font-size:0.95rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Módulos Solares</h3>
              <p style="font-size:0.75rem;color:var(--cinza, #94A3B8);margin:2px 0 0;">Painéis fotovoltaicos</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:12px;border:1px solid var(--card-border, #E2E8F0);">
              <p style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 3px;font-weight:700;">Qtde</p>
              <p style="font-weight:800;color:var(--body-text, #0F172A);margin:0;font-size:0.85rem;">{{modulo_quantidade}}x</p>
            </div>
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:12px;border:1px solid var(--card-border, #E2E8F0);">
              <p style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 3px;font-weight:700;">Potência</p>
              <p style="font-weight:800;color:var(--la, #F07B24);margin:0;font-size:0.85rem;">{{modulo_potencia}}</p>
            </div>
          </div>
          <p style="font-size:0.78rem;color:var(--cinza, #64748B);margin:10px 0 0;">{{modulo_fabricante}} · {{modulo_modelo}}</p>
        </div>
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);border-radius:16px;padding:24px;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">
            <div style="width:44px;height:44px;border-radius:12px;background:linear-gradient(135deg,var(--az, #1E3A5F),#3B82F6);display:flex;align-items:center;justify-content:center;font-size:20px;color:#fff;flex-shrink:0;">🔌</div>
            <div>
              <h3 style="font-size:0.95rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Inversor Solar</h3>
              <p style="font-size:0.75rem;color:var(--cinza, #94A3B8);margin:2px 0 0;">Conversão inteligente</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:12px;border:1px solid var(--card-border, #E2E8F0);">
              <p style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 3px;font-weight:700;">Fabricante</p>
              <p style="font-weight:800;color:var(--body-text, #0F172A);margin:0;font-size:0.85rem;">{{inversor_fabricante}}</p>
            </div>
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:12px;border:1px solid var(--card-border, #E2E8F0);">
              <p style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 3px;font-weight:700;">Garantia</p>
              <p style="font-weight:800;color:var(--verde, #22C55E);margin:0;font-size:0.85rem;">{{inversor_garantia}}</p>
            </div>
          </div>
          <p style="font-size:0.78rem;color:var(--cinza, #64748B);margin:10px 0 0;">{{inversor_modelo}}</p>
        </div>
      </div>
    </div>
  `));

  // ── INVESTIMENTO — Card principal ──
  const finS = sec(b, 3, { backgroundColor: "var(--fundo, #F8FAFC)" });
  blocks.push(finS);
  const finC = col(b, finS.id, 0); blocks.push(finC);

  blocks.push(txt(b, finC.id, 0, `
    <div style="max-width:900px;margin:0 auto;">
      <div style="text-align:center;margin-bottom:32px;">
        <p style="font-size:11px;text-transform:uppercase;letter-spacing:3px;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">💰 Investimento</p>
        <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:1.6rem;font-weight:800;color:var(--body-text, #0F172A);margin:0;">Simulador de Fluxo de Caixa</h2>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(280px,1fr));gap:20px;">
        <!-- Resumo do investimento -->
        <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--cinza, #94A3B8);font-weight:700;margin:0 0 20px;">💳 RESUMO DO INVESTIMENTO</p>
          <div style="background:linear-gradient(135deg, var(--az, #0F172A), var(--az2, #1E3A5F));border-radius:16px;padding:24px;text-align:center;margin-bottom:16px;">
            <p style="font-size:9px;text-transform:uppercase;letter-spacing:2px;color:rgba(255,255,255,0.4);margin:0 0 8px;font-weight:700;">Valor Total</p>
            <p style="font-size:2.4rem;font-weight:900;color:var(--la, #F07B24);margin:0;font-family:var(--font-numbers,'Montserrat',sans-serif);">R$ {{valor_total}}</p>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div style="background:var(--fundo, #F8FAFC);border-radius:12px;padding:16px;text-align:center;border:1px solid var(--card-border, #E2E8F0);">
              <p style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;">Economia Mensal</p>
              <p style="font-weight:900;color:var(--verde, #22C55E);margin:0;font-size:1.2rem;">R$ {{economia_mensal}}</p>
            </div>
            <div style="background:var(--fundo, #F8FAFC);border-radius:12px;padding:16px;text-align:center;border:1px solid var(--card-border, #E2E8F0);">
              <p style="font-size:8px;text-transform:uppercase;letter-spacing:1px;color:var(--cinza, #94A3B8);margin:0 0 4px;font-weight:700;">Economia Anual</p>
              <p style="font-weight:900;color:var(--verde, #22C55E);margin:0;font-size:1.2rem;">R$ {{economia_anual}}</p>
            </div>
          </div>
        </div>

        <!-- Retorno projetado -->
        <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #E2E8F0);border-radius:20px;padding:28px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:2px;color:var(--cinza, #94A3B8);font-weight:700;margin:0 0 20px;">📈 RETORNO PROJETADO</p>
          <!-- Visual timeline -->
          <div style="position:relative;padding-left:28px;border-left:3px solid var(--card-border, #E2E8F0);">
            <div style="margin-bottom:24px;position:relative;">
              <div style="position:absolute;left:-34px;top:2px;width:14px;height:14px;border-radius:50%;background:var(--la, #F07B24);border:3px solid var(--card-bg, #fff);"></div>
              <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--la, #F07B24);font-weight:800;margin:0 0 4px;">Hoje</p>
              <p style="font-size:0.85rem;color:var(--body-text, #0F172A);margin:0;font-weight:700;">Investimento: R$ {{valor_total}}</p>
            </div>
            <div style="margin-bottom:24px;position:relative;">
              <div style="position:absolute;left:-34px;top:2px;width:14px;height:14px;border-radius:50%;background:var(--az, #3B82F6);border:3px solid var(--card-bg, #fff);"></div>
              <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--az, #3B82F6);font-weight:800;margin:0 0 4px;">{{payback}} meses</p>
              <p style="font-size:0.85rem;color:var(--body-text, #0F172A);margin:0;font-weight:700;">Payback completo 🎯</p>
            </div>
            <div style="position:relative;">
              <div style="position:absolute;left:-34px;top:2px;width:14px;height:14px;border-radius:50%;background:var(--verde, #22C55E);border:3px solid var(--card-bg, #fff);"></div>
              <p style="font-size:9px;text-transform:uppercase;letter-spacing:1px;color:var(--verde, #22C55E);font-weight:800;margin:0 0 4px;">25 anos</p>
              <p style="font-size:0.85rem;color:var(--body-text, #0F172A);margin:0;font-weight:700;">Lucro: R$ {{economia_25_anos}}</p>
              <p style="font-size:0.75rem;color:var(--cinza, #64748B);margin:4px 0 0;">Tudo isso no seu bolso! 🚀</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  `));

  // ── CTA ──
  const ctaS = sec(b, 4, {
    paddingTop: "56", paddingBottom: "72",
    backgroundColor: "var(--card-bg, #fff)", textAlign: "center",
  });
  blocks.push(ctaS);
  const ctaC = col(b, ctaS.id, 0); blocks.push(ctaC);

  blocks.push(txt(b, ctaC.id, 0, `
    <div style="max-width:560px;margin:0 auto;text-align:center;">
      <p style="font-size:48px;margin:0 0 16px;">🚀</p>
      <h2 style="font-family:var(--font-heading,'Montserrat',sans-serif);font-size:clamp(1.5rem,4vw,2rem);font-weight:900;color:var(--body-text, #0F172A);margin:0 0 12px;">Avançar para Fechamento</h2>
      <p style="color:var(--cinza, #64748B);margin:0 0 32px;font-size:0.95rem;line-height:1.7;">
        Aproveite esta condição exclusiva preparada por <strong style="color:var(--body-text, #0F172A);">{{consultor_nome}}</strong>.
      </p>
    </div>
  `));

  blocks.push(btn(b, ctaC.id, 1, "✅ ACEITAR PROPOSTA", {
    backgroundColor: "var(--verde, #22C55E)", color: "#fff",
    fontSize: "18", fontWeight: "900", borderRadius: "16",
    paddingTop: "20", paddingBottom: "20", paddingLeft: "56", paddingRight: "56",
    btnShadowStyle: "0 8px 30px rgba(34,197,94,0.3)",
  }));

  blocks.push(txt(b, ctaC.id, 2, `
    <div style="text-align:center;margin-top:20px;">
      <a href="https://wa.me/{{consultor_telefone_limpo}}?text=Olá! Tenho interesse na proposta de energia solar." style="display:inline-flex;align-items:center;gap:8px;padding:12px 28px;border-radius:12px;background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #E2E8F0);color:var(--body-text, #0F172A);text-decoration:none;font-size:0.85rem;font-weight:600;">
        💬 Dúvidas? Falar no WhatsApp
      </a>
    </div>
    <p style="text-align:center;margin-top:24px;font-size:11px;color:var(--cinza, #94A3B8);">
      {{empresa_nome}} · Proposta personalizada · Condição válida por tempo limitado
    </p>
  `));

  return blocks;
}
