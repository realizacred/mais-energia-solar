/**
 * Default rich template blocks for the Visual Proposal Builder.
 * 
 * 3 strategic templates aligned with the sales funnel:
 *   1. CONSULTIVO (Venda Assistida) — detailed, trust-building, for bigger deals
 *   2. FECHAMENTO RÁPIDO (WhatsApp) — high-impact, fast decision, urgency CTAs
 *   3. ESCALA AUTOMÁTICA (Leads) — educational, value-building, self-service
 * 
 * All templates use CSS variables from landingThemes.ts for theme compatibility.
 * Uses {{variable}} format from variablesCatalog.
 * Página pública — exceção RB-02 documentada.
 */

import type { TemplateBlock, ProposalType } from "./types";

function uid(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

export type TemplateStyle = "consultivo" | "fechamento" | "escala";

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
    default:
      return createConsultivoBlocks(proposalType);
  }
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 1 — CONSULTIVO (Venda Assistida)
// Foco: explicação detalhada, confiança, comparações antes/depois
// Ideal para: vendedor presencial, projetos maiores, clientes indecisos
// ═══════════════════════════════════════════════════════════════

function createConsultivoBlocks(proposalType: ProposalType): TemplateBlock[] {
  const heroSec = uid(), heroCol = uid();
  const benefSec = uid(), benefCol = uid();
  const techSec = uid(), techCol1 = uid(), techCol2 = uid();
  const finSec = uid(), finCol = uid();
  const ctaSec = uid(), ctaCol = uid();

  const base: Pick<TemplateBlock, "_proposalType" | "isVisible"> = {
    _proposalType: proposalType,
    isVisible: true,
  };

  return [
    // ═══ HERO — Saudação + Métricas Principais ═══
    {
      ...base, id: heroSec, type: "section", content: "", parentId: null, order: 0,
      style: {
        paddingTop: "72", paddingBottom: "72", paddingLeft: "24", paddingRight: "24",
        useGradient: true, gradientStart: "var(--az, #1B3A8C)", gradientEnd: "var(--az2, #0D2460)",
        staticGradientAngle: 135, contentWidth: "boxed", textAlign: "center",
      },
    },
    {
      ...base, id: heroCol, type: "column", content: "", parentId: heroSec, order: 0,
      style: { width: 100, paddingTop: "0", paddingBottom: "0" },
    },
    {
      ...base, id: uid(), type: "editor", parentId: heroCol, order: 0, style: { textAlign: "center" },
      content: `
        <div style="max-width:680px;margin:0 auto;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:var(--hero-muted, rgba(255,255,255,0.5));margin:0 0 16px;font-weight:700;">
            ☀️ Proposta Personalizada
          </p>
          <h1 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:2.4rem;font-weight:800;color:var(--hero-text, #fff);margin:0 0 16px;line-height:1.15;letter-spacing:-0.02em;">
            Olá, {{cliente.nome}}!
          </h1>
          <p style="font-size:1.1rem;color:var(--hero-muted, rgba(255,255,255,0.6));margin:0 0 40px;line-height:1.6;">
            Preparamos uma solução sob medida de energia solar para você em <strong style="color:var(--la, #F07B24);">{{cliente.cidade}}/{{cliente.estado}}</strong>.
          </p>
        </div>
      `,
    },
    {
      ...base, id: uid(), type: "editor", parentId: heroCol, order: 1, style: {},
      content: `
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;max-width:720px;margin:0 auto;">
          <div style="background:var(--hero-overlay, rgba(255,255,255,0.07));border:1px solid var(--hero-overlay-border, rgba(255,255,255,0.12));border-radius:16px;padding:24px 32px;min-width:180px;text-align:center;flex:1;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:var(--hero-muted, rgba(255,255,255,0.5));margin:0 0 8px;font-weight:600;">⚡ Potência</p>
            <p style="font-size:2rem;font-weight:800;color:var(--hero-metrics-text, #F07B24);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">{{potencia_kwp}} kWp</p>
          </div>
          <div style="background:var(--hero-overlay, rgba(255,255,255,0.07));border:1px solid var(--hero-overlay-border, rgba(255,255,255,0.12));border-radius:16px;padding:24px 32px;min-width:180px;text-align:center;flex:1;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:var(--hero-muted, rgba(255,255,255,0.5));margin:0 0 8px;font-weight:600;">💰 Economia Mensal</p>
            <p style="font-size:2rem;font-weight:800;color:var(--verde, #16A34A);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">R$ {{economia_mensal}}</p>
          </div>
          <div style="background:var(--hero-overlay, rgba(255,255,255,0.07));border:1px solid var(--hero-overlay-border, rgba(255,255,255,0.12));border-radius:16px;padding:24px 32px;min-width:180px;text-align:center;flex:1;">
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.12em;color:var(--hero-muted, rgba(255,255,255,0.5));margin:0 0 8px;font-weight:600;">🔋 Geração Mensal</p>
            <p style="font-size:2rem;font-weight:800;color:var(--hero-metrics-text, #F07B24);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">{{geracao_mensal}} kWh</p>
          </div>
        </div>
      `,
    },

    // ═══ BENEFÍCIOS — Antes vs Depois ═══
    {
      ...base, id: benefSec, type: "section", content: "", parentId: null, order: 1,
      style: {
        paddingTop: "56", paddingBottom: "56", paddingLeft: "24", paddingRight: "24",
        backgroundColor: "var(--fundo, #F0F4FA)", contentWidth: "boxed",
      },
    },
    {
      ...base, id: benefCol, type: "column", content: "", parentId: benefSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: benefCol, order: 0, style: {},
      content: `
        <div style="text-align:center;margin-bottom:36px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">Por que energia solar?</p>
          <h2 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1.6rem;font-weight:800;color:var(--body-text, #1e293b);margin:0;">Antes vs Depois da Energia Solar</h2>
        </div>
      `,
    },
    {
      ...base, id: uid(), type: "editor", parentId: benefCol, order: 1, style: {},
      content: `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;max-width:800px;margin:0 auto;">
          <div style="background:var(--card-bg, #fff);border:2px solid var(--negative, #ef4444);border-radius:16px;padding:28px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:4px;background:var(--negative, #ef4444);"></div>
            <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.15em;color:var(--negative, #ef4444);font-weight:800;margin:0 0 20px;">❌ Sem Solar</p>
            <div style="space-y:16px;">
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <span style="font-size:20px;">💸</span>
                <div>
                  <p style="font-size:11px;color:var(--cinza, #64748B);margin:0;text-transform:uppercase;letter-spacing:0.05em;">Conta de Luz</p>
                  <p style="font-weight:700;color:var(--negative, #ef4444);margin:0;font-size:1.1rem;">R$ {{economia_mensal}}/mês</p>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <span style="font-size:20px;">📈</span>
                <div>
                  <p style="font-size:11px;color:var(--cinza, #64748B);margin:0;text-transform:uppercase;letter-spacing:0.05em;">Gasto em 25 anos</p>
                  <p style="font-weight:700;color:var(--negative, #ef4444);margin:0;font-size:1.1rem;">R$ {{economia_25_anos}}+</p>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-size:20px;">🌍</span>
                <div>
                  <p style="font-size:11px;color:var(--cinza, #64748B);margin:0;text-transform:uppercase;letter-spacing:0.05em;">Impacto Ambiental</p>
                  <p style="font-weight:700;color:var(--cinza, #64748B);margin:0;font-size:0.95rem;">{{co2_evitado_ton_ano}} ton CO₂/ano</p>
                </div>
              </div>
            </div>
          </div>
          <div style="background:var(--card-bg, #fff);border:2px solid var(--verde, #16A34A);border-radius:16px;padding:28px;position:relative;overflow:hidden;">
            <div style="position:absolute;top:0;left:0;right:0;height:4px;background:var(--verde, #16A34A);"></div>
            <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.15em;color:var(--verde, #16A34A);font-weight:800;margin:0 0 20px;">✅ Com Solar</p>
            <div>
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <span style="font-size:20px;">☀️</span>
                <div>
                  <p style="font-size:11px;color:var(--cinza, #64748B);margin:0;text-transform:uppercase;letter-spacing:0.05em;">Conta de Luz</p>
                  <p style="font-weight:700;color:var(--verde, #16A34A);margin:0;font-size:1.1rem;">Economia de {{economia_percentual}}%</p>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;">
                <span style="font-size:20px;">💰</span>
                <div>
                  <p style="font-size:11px;color:var(--cinza, #64748B);margin:0;text-transform:uppercase;letter-spacing:0.05em;">Economia em 25 anos</p>
                  <p style="font-weight:700;color:var(--verde, #16A34A);margin:0;font-size:1.1rem;">R$ {{economia_25_anos}}</p>
                </div>
              </div>
              <div style="display:flex;align-items:center;gap:12px;">
                <span style="font-size:20px;">🌱</span>
                <div>
                  <p style="font-size:11px;color:var(--cinza, #64748B);margin:0;text-transform:uppercase;letter-spacing:0.05em;">Impacto Ambiental</p>
                  <p style="font-weight:700;color:var(--verde, #16A34A);margin:0;font-size:0.95rem;">Zero emissões</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `,
    },

    // ═══ TECNOLOGIA — Detalhes do Sistema ═══
    {
      ...base, id: techSec, type: "section", content: "", parentId: null, order: 2,
      style: {
        paddingTop: "56", paddingBottom: "56", paddingLeft: "24", paddingRight: "24",
        backgroundColor: "var(--card-bg, #ffffff)", contentWidth: "boxed",
      },
    },
    {
      ...base, id: uid(), type: "editor", parentId: techSec, order: 0, style: {},
      content: `
        <div style="text-align:center;margin-bottom:36px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">⚙️ Configuração Técnica</p>
          <h2 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1.6rem;font-weight:800;color:var(--body-text, #1e293b);margin:0;">Componentes do Seu Sistema</h2>
          <p style="color:var(--cinza, #64748B);font-size:0.9rem;margin:8px 0 0;max-width:500px;margin-left:auto;margin-right:auto;">Equipamentos de alta performance com garantia estendida de fábrica.</p>
        </div>
      `,
    },
    {
      ...base, id: techCol1, type: "column", content: "", parentId: techSec, order: 1,
      style: { width: 50, paddingRight: "10" },
    },
    {
      ...base, id: uid(), type: "editor", parentId: techCol1, order: 0, style: {},
      content: `
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:28px;height:100%;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <div style="width:42px;height:42px;border-radius:12px;background:rgba(240,123,36,0.1);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">⚡</div>
            <div>
              <h3 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1.05rem;font-weight:700;color:var(--body-text, #1e293b);margin:0;">Módulos Solares</h3>
              <p style="font-size:11px;color:var(--cinza, #64748B);margin:2px 0 0;">Painéis fotovoltaicos de última geração</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza, #64748B);margin:0 0 4px;font-weight:600;">Fabricante</p>
              <p style="font-weight:700;color:var(--body-text, #1e293b);margin:0;font-size:0.9rem;">{{modulo_fabricante}}</p>
            </div>
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza, #64748B);margin:0 0 4px;font-weight:600;">Modelo</p>
              <p style="font-weight:700;color:var(--body-text, #1e293b);margin:0;font-size:0.9rem;">{{modulo_modelo}}</p>
            </div>
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza, #64748B);margin:0 0 4px;font-weight:600;">Quantidade</p>
              <p style="font-weight:700;color:var(--body-text, #1e293b);margin:0;font-size:0.9rem;">{{modulo_quantidade}} painéis</p>
            </div>
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza, #64748B);margin:0 0 4px;font-weight:600;">Potência</p>
              <p style="font-weight:700;color:var(--la, #F07B24);margin:0;font-size:0.9rem;">{{modulo_potencia}}</p>
            </div>
          </div>
        </div>
      `,
    },
    {
      ...base, id: techCol2, type: "column", content: "", parentId: techSec, order: 2,
      style: { width: 50, paddingLeft: "10" },
    },
    {
      ...base, id: uid(), type: "editor", parentId: techCol2, order: 0, style: {},
      content: `
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:28px;height:100%;">
          <div style="display:flex;align-items:center;gap:12px;margin-bottom:20px;">
            <div style="width:42px;height:42px;border-radius:12px;background:rgba(240,123,36,0.1);display:flex;align-items:center;justify-content:center;font-size:20px;flex-shrink:0;">🔌</div>
            <div>
              <h3 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1.05rem;font-weight:700;color:var(--body-text, #1e293b);margin:0;">Inversor Solar</h3>
              <p style="font-size:11px;color:var(--cinza, #64748B);margin:2px 0 0;">Conversão inteligente de energia</p>
            </div>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza, #64748B);margin:0 0 4px;font-weight:600;">Fabricante</p>
              <p style="font-weight:700;color:var(--body-text, #1e293b);margin:0;font-size:0.9rem;">{{inversor_fabricante}}</p>
            </div>
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza, #64748B);margin:0 0 4px;font-weight:600;">Modelo</p>
              <p style="font-weight:700;color:var(--body-text, #1e293b);margin:0;font-size:0.9rem;">{{inversor_modelo}}</p>
            </div>
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;grid-column:1/-1;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza, #64748B);margin:0 0 4px;font-weight:600;">🛡️ Garantia</p>
              <p style="font-weight:700;color:var(--verde, #16A34A);margin:0;font-size:0.9rem;">{{inversor_garantia}}</p>
            </div>
          </div>
        </div>
      `,
    },

    // ═══ ANÁLISE FINANCEIRA ═══
    {
      ...base, id: finSec, type: "section", content: "", parentId: null, order: 3,
      style: {
        paddingTop: "56", paddingBottom: "56", paddingLeft: "24", paddingRight: "24",
        backgroundColor: "var(--fundo, #F0F4FA)", contentWidth: "boxed",
      },
    },
    {
      ...base, id: finCol, type: "column", content: "", parentId: finSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: finCol, order: 0, style: {},
      content: `
        <div style="text-align:center;margin-bottom:36px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">📊 Análise Financeira</p>
          <h2 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1.6rem;font-weight:800;color:var(--body-text, #1e293b);margin:0;">Retorno do Seu Investimento</h2>
        </div>
      `,
    },
    {
      ...base, id: uid(), type: "editor", parentId: finCol, order: 1, style: {},
      content: `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-bottom:24px;">
          <div style="background:linear-gradient(135deg, var(--az, #1B3A8C), var(--az2, #0D2460));border-radius:16px;padding:28px;text-align:center;">
            <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.5);margin:0 0 8px;font-weight:600;">Investimento</p>
            <p style="font-size:2rem;font-weight:800;color:var(--la, #F07B24);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">R$ {{valor_total}}</p>
          </div>
          <div style="background:linear-gradient(135deg, var(--verde, #16A34A), #15803d);border-radius:16px;padding:28px;text-align:center;">
            <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.6);margin:0 0 8px;font-weight:600;">Economia Anual</p>
            <p style="font-size:2rem;font-weight:800;color:#fff;margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">R$ {{economia_anual}}</p>
          </div>
          <div style="background:linear-gradient(135deg, var(--az, #1B3A8C), var(--az2, #0D2460));border-radius:16px;padding:28px;text-align:center;">
            <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:rgba(255,255,255,0.5);margin:0 0 8px;font-weight:600;">Payback</p>
            <p style="font-size:2rem;font-weight:800;color:var(--la, #F07B24);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">{{payback}} meses</p>
          </div>
        </div>
      `,
    },
    {
      ...base, id: uid(), type: "editor", parentId: finCol, order: 2, style: {},
      content: `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;">
          <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:12px;padding:20px;text-align:center;">
            <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza, #64748B);margin:0 0 6px;font-weight:600;">Geração Mensal</p>
            <p style="font-weight:700;color:var(--body-text, #1e293b);font-size:1.2rem;margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">{{geracao_mensal}} kWh</p>
          </div>
          <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:12px;padding:20px;text-align:center;">
            <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza, #64748B);margin:0 0 6px;font-weight:600;">Economia 25 Anos</p>
            <p style="font-weight:700;color:var(--verde, #16A34A);font-size:1.2rem;margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">R$ {{economia_25_anos}}</p>
          </div>
          <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:12px;padding:20px;text-align:center;">
            <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.08em;color:var(--cinza, #64748B);margin:0 0 6px;font-weight:600;">CO₂ Evitado/Ano</p>
            <p style="font-weight:700;color:var(--verde, #16A34A);font-size:1.2rem;margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">{{co2_evitado_ton_ano}} ton</p>
          </div>
        </div>
      `,
    },

    // ═══ CTA — Aceitar Proposta ═══
    {
      ...base, id: ctaSec, type: "section", content: "", parentId: null, order: 4,
      style: {
        paddingTop: "60", paddingBottom: "72", paddingLeft: "24", paddingRight: "24",
        useGradient: true, gradientStart: "var(--az, #0D2460)", gradientEnd: "var(--az2, #1B3A8C)",
        staticGradientAngle: 135, contentWidth: "boxed", textAlign: "center",
      },
    },
    {
      ...base, id: ctaCol, type: "column", content: "", parentId: ctaSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: ctaCol, order: 0, style: {},
      content: `
        <div style="text-align:center;max-width:600px;margin:0 auto;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:rgba(255,255,255,0.5);font-weight:700;margin:0 0 12px;">🚀 Próximo Passo</p>
          <h2 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1.8rem;font-weight:800;color:#fff;margin:0 0 16px;">Pronto para economizar?</h2>
          <p style="color:rgba(255,255,255,0.65);margin:0 0 32px;font-size:1rem;line-height:1.6;">
            Fale com <strong style="color:var(--la, #F07B24);">{{consultor_nome}}</strong> e dê o primeiro passo na sua transição energética.
          </p>
        </div>
      `,
    },
    {
      ...base, id: uid(), type: "button", content: "✅ Aceitar Proposta", parentId: ctaCol, order: 1,
      style: {
        textAlign: "center", backgroundColor: "var(--verde, #16A34A)", color: "#fff",
        borderRadius: "14", fontSize: "18", fontWeight: "800",
        paddingTop: "18", paddingBottom: "18", paddingLeft: "48", paddingRight: "48",
      },
    },
    {
      ...base, id: uid(), type: "editor", parentId: ctaCol, order: 2, style: {},
      content: `
        <p style="text-align:center;margin-top:20px;font-size:12px;color:rgba(255,255,255,0.35);">
          {{empresa_nome}} · Proposta personalizada · Condição válida por tempo limitado
        </p>
      `,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 2 — FECHAMENTO RÁPIDO (WhatsApp)
// Foco: decisão rápida, alto impacto visual, urgência
// Ideal para: envio direto ao cliente via WhatsApp
// ═══════════════════════════════════════════════════════════════

function createFechamentoBlocks(proposalType: ProposalType): TemplateBlock[] {
  const heroSec = uid(), heroCol = uid();
  const numSec = uid(), numCol = uid();
  const techSec = uid(), techCol = uid();
  const ctaSec = uid(), ctaCol = uid();

  const base: Pick<TemplateBlock, "_proposalType" | "isVisible"> = {
    _proposalType: proposalType,
    isVisible: true,
  };

  return [
    // ═══ HERO — Impacto Máximo ═══
    {
      ...base, id: heroSec, type: "section", content: "", parentId: null, order: 0,
      style: {
        paddingTop: "80", paddingBottom: "80", paddingLeft: "24", paddingRight: "24",
        useGradient: true, gradientStart: "var(--az, #1B3A8C)", gradientEnd: "var(--az2, #0D2460)",
        staticGradientAngle: 135, contentWidth: "boxed", textAlign: "center",
      },
    },
    {
      ...base, id: heroCol, type: "column", content: "", parentId: heroSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: heroCol, order: 0, style: {},
      content: `
        <div style="max-width:600px;margin:0 auto;">
          <div style="display:inline-block;background:var(--la, #F07B24);color:#fff;padding:6px 16px;border-radius:100px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.15em;margin-bottom:20px;">
            ⚡ Proposta Exclusiva
          </div>
          <h1 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:2.8rem;font-weight:900;color:var(--hero-text, #fff);margin:0 0 12px;line-height:1.1;letter-spacing:-0.03em;">
            {{cliente.nome}}, sua economia começa agora!
          </h1>
          <p style="font-size:1rem;color:var(--hero-muted, rgba(255,255,255,0.6));margin:0 0 36px;">
            Sistema de {{potencia_kwp}} kWp para {{cliente.cidade}}/{{cliente.estado}}
          </p>

          <div style="background:var(--hero-overlay, rgba(255,255,255,0.08));border:1px solid var(--hero-overlay-border, rgba(255,255,255,0.15));border-radius:20px;padding:32px;max-width:400px;margin:0 auto;">
            <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.12em;color:var(--hero-muted, rgba(255,255,255,0.5));margin:0 0 8px;font-weight:600;">Sua economia mensal</p>
            <p style="font-size:3.5rem;font-weight:900;color:var(--verde, #16A34A);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);line-height:1;">R$ {{economia_mensal}}</p>
            <p style="font-size:12px;color:var(--hero-muted, rgba(255,255,255,0.4));margin:8px 0 0;">por mês na sua conta de luz</p>
          </div>
        </div>
      `,
    },

    // ═══ NÚMEROS-CHAVE — 3 KPIs Grandes ═══
    {
      ...base, id: numSec, type: "section", content: "", parentId: null, order: 1,
      style: {
        paddingTop: "48", paddingBottom: "48", paddingLeft: "24", paddingRight: "24",
        backgroundColor: "var(--fundo, #F0F4FA)", contentWidth: "boxed",
      },
    },
    {
      ...base, id: numCol, type: "column", content: "", parentId: numSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: numCol, order: 0, style: {},
      content: `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;">
          <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:28px;text-align:center;">
            <p style="font-size:28px;margin:0 0 8px;">💰</p>
            <p style="font-size:1.8rem;font-weight:800;color:var(--la, #F07B24);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">R$ {{valor_total}}</p>
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--cinza, #64748B);margin:8px 0 0;font-weight:600;">Investimento Total</p>
          </div>
          <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:28px;text-align:center;">
            <p style="font-size:28px;margin:0 0 8px;">⏱️</p>
            <p style="font-size:1.8rem;font-weight:800;color:var(--az, #1B3A8C);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">{{payback}} meses</p>
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--cinza, #64748B);margin:8px 0 0;font-weight:600;">Payback</p>
          </div>
          <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:28px;text-align:center;">
            <p style="font-size:28px;margin:0 0 8px;">📈</p>
            <p style="font-size:1.8rem;font-weight:800;color:var(--verde, #16A34A);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">R$ {{economia_anual}}</p>
            <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.1em;color:var(--cinza, #64748B);margin:8px 0 0;font-weight:600;">Economia Anual</p>
          </div>
        </div>
      `,
    },

    // ═══ TECH SPECS — Compacto ═══
    {
      ...base, id: techSec, type: "section", content: "", parentId: null, order: 2,
      style: {
        paddingTop: "40", paddingBottom: "40", paddingLeft: "24", paddingRight: "24",
        backgroundColor: "var(--card-bg, #fff)", contentWidth: "boxed",
      },
    },
    {
      ...base, id: techCol, type: "column", content: "", parentId: techSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: techCol, order: 0, style: {},
      content: `
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:28px;">
          <h3 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1rem;font-weight:700;color:var(--body-text, #1e293b);margin:0 0 20px;text-align:center;">⚙️ Seu Sistema Solar</h3>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:12px;">
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;color:var(--cinza, #64748B);margin:0 0 3px;font-weight:600;">Módulos</p>
              <p style="font-weight:700;color:var(--body-text, #1e293b);margin:0;font-size:0.85rem;">{{modulo_quantidade}}x {{modulo_fabricante}} {{modulo_potencia}}</p>
            </div>
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;color:var(--cinza, #64748B);margin:0 0 3px;font-weight:600;">Inversor</p>
              <p style="font-weight:700;color:var(--body-text, #1e293b);margin:0;font-size:0.85rem;">{{inversor_fabricante}} {{inversor_modelo}}</p>
            </div>
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;color:var(--cinza, #64748B);margin:0 0 3px;font-weight:600;">Geração Mensal</p>
              <p style="font-weight:700;color:var(--la, #F07B24);margin:0;font-size:0.85rem;">{{geracao_mensal}} kWh/mês</p>
            </div>
            <div style="background:var(--card-bg, #fff);border-radius:10px;padding:14px;border:1px solid var(--card-border, #e2e8f0);">
              <p style="font-size:10px;text-transform:uppercase;color:var(--cinza, #64748B);margin:0 0 3px;font-weight:600;">Garantia</p>
              <p style="font-weight:700;color:var(--verde, #16A34A);margin:0;font-size:0.85rem;">{{inversor_garantia}}</p>
            </div>
          </div>
        </div>
      `,
    },

    // ═══ CTA — Fechamento com Urgência ═══
    {
      ...base, id: ctaSec, type: "section", content: "", parentId: null, order: 3,
      style: {
        paddingTop: "60", paddingBottom: "80", paddingLeft: "24", paddingRight: "24",
        useGradient: true, gradientStart: "var(--az, #0D2460)", gradientEnd: "var(--az2, #1B3A8C)",
        staticGradientAngle: 135, contentWidth: "boxed", textAlign: "center",
      },
    },
    {
      ...base, id: ctaCol, type: "column", content: "", parentId: ctaSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: ctaCol, order: 0, style: {},
      content: `
        <div style="max-width:520px;margin:0 auto;text-align:center;">
          <div style="display:inline-block;background:rgba(239,68,68,0.15);color:#ef4444;padding:6px 16px;border-radius:100px;font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:0.12em;margin-bottom:20px;">
            ⏰ Condição válida por tempo limitado
          </div>
          <h2 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:2rem;font-weight:900;color:#fff;margin:0 0 12px;line-height:1.15;">
            Pronto para começar a economizar?
          </h2>
          <p style="color:rgba(255,255,255,0.6);margin:0 0 36px;font-size:0.95rem;">
            Clique abaixo e garanta essa condição exclusiva.
          </p>
        </div>
      `,
    },
    {
      ...base, id: uid(), type: "button", content: "🚀 ACEITAR PROPOSTA", parentId: ctaCol, order: 1,
      style: {
        textAlign: "center", backgroundColor: "var(--verde, #16A34A)", color: "#fff",
        borderRadius: "16", fontSize: "20", fontWeight: "900",
        paddingTop: "22", paddingBottom: "22", paddingLeft: "56", paddingRight: "56",
      },
    },
    {
      ...base, id: uid(), type: "editor", parentId: ctaCol, order: 2, style: {},
      content: `
        <div style="text-align:center;margin-top:24px;">
          <p style="font-size:12px;color:rgba(255,255,255,0.3);margin:0 0 4px;">
            🔒 Dados protegidos · {{empresa_nome}}
          </p>
          <p style="font-size:11px;color:rgba(255,255,255,0.25);margin:0;">
            Consultor: {{consultor_nome}}
          </p>
        </div>
      `,
    },
  ];
}

// ═══════════════════════════════════════════════════════════════
// TEMPLATE 3 — ESCALA AUTOMÁTICA (Leads)
// Foco: educação, construção de valor, simulação, captura
// Ideal para: leads frios, tráfego, funciona sem vendedor
// ═══════════════════════════════════════════════════════════════

function createEscalaBlocks(proposalType: ProposalType): TemplateBlock[] {
  const heroSec = uid(), heroCol = uid();
  const eduSec = uid(), eduCol = uid();
  const sisSec = uid(), sisCol1 = uid(), sisCol2 = uid();
  const valSec = uid(), valCol = uid();
  const ctaSec = uid(), ctaCol = uid();

  const base: Pick<TemplateBlock, "_proposalType" | "isVisible"> = {
    _proposalType: proposalType,
    isVisible: true,
  };

  return [
    // ═══ HERO — Educativo + Acolhedor ═══
    {
      ...base, id: heroSec, type: "section", content: "", parentId: null, order: 0,
      style: {
        paddingTop: "72", paddingBottom: "72", paddingLeft: "24", paddingRight: "24",
        useGradient: true, gradientStart: "var(--az, #1B3A8C)", gradientEnd: "var(--az2, #0D2460)",
        staticGradientAngle: 135, contentWidth: "boxed", textAlign: "center",
      },
    },
    {
      ...base, id: heroCol, type: "column", content: "", parentId: heroSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: heroCol, order: 0, style: {},
      content: `
        <div style="max-width:640px;margin:0 auto;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.2em;color:var(--hero-muted, rgba(255,255,255,0.5));margin:0 0 16px;font-weight:700;">
            ☀️ Simulação Personalizada
          </p>
          <h1 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:2.2rem;font-weight:800;color:var(--hero-text, #fff);margin:0 0 16px;line-height:1.2;">
            Descubra quanto você pode economizar com energia solar
          </h1>
          <p style="font-size:1.05rem;color:var(--hero-muted, rgba(255,255,255,0.6));margin:0 0 36px;line-height:1.6;">
            Olá, <strong style="color:var(--la, #F07B24);">{{cliente.nome}}</strong>! Fizemos uma simulação exclusiva para {{cliente.cidade}}/{{cliente.estado}}.
          </p>

          <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:16px;">
            <div style="background:var(--hero-overlay, rgba(255,255,255,0.07));border:1px solid var(--hero-overlay-border, rgba(255,255,255,0.12));border-radius:16px;padding:20px 28px;min-width:160px;text-align:center;">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--hero-muted, rgba(255,255,255,0.5));margin:0 0 6px;">Economia/mês</p>
              <p style="font-size:1.8rem;font-weight:800;color:var(--verde, #16A34A);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">R$ {{economia_mensal}}</p>
            </div>
            <div style="background:var(--hero-overlay, rgba(255,255,255,0.07));border:1px solid var(--hero-overlay-border, rgba(255,255,255,0.12));border-radius:16px;padding:20px 28px;min-width:160px;text-align:center;">
              <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:var(--hero-muted, rgba(255,255,255,0.5));margin:0 0 6px;">Potência</p>
              <p style="font-size:1.8rem;font-weight:800;color:var(--hero-metrics-text, #F07B24);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">{{potencia_kwp}} kWp</p>
            </div>
          </div>
        </div>
      `,
    },

    // ═══ EDUCAÇÃO — Como funciona ═══
    {
      ...base, id: eduSec, type: "section", content: "", parentId: null, order: 1,
      style: {
        paddingTop: "56", paddingBottom: "56", paddingLeft: "24", paddingRight: "24",
        backgroundColor: "var(--fundo, #F0F4FA)", contentWidth: "boxed",
      },
    },
    {
      ...base, id: eduCol, type: "column", content: "", parentId: eduSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: eduCol, order: 0, style: {},
      content: `
        <div style="text-align:center;margin-bottom:36px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">💡 Entenda</p>
          <h2 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1.6rem;font-weight:800;color:var(--body-text, #1e293b);margin:0;">Como Funciona a Energia Solar</h2>
        </div>
      `,
    },
    {
      ...base, id: uid(), type: "editor", parentId: eduCol, order: 1, style: {},
      content: `
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px;max-width:800px;margin:0 auto;">
          <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:28px;text-align:center;">
            <div style="width:56px;height:56px;border-radius:16px;background:rgba(240,123,36,0.1);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;">☀️</div>
            <h4 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:0.9rem;font-weight:700;color:var(--body-text, #1e293b);margin:0 0 8px;">1. Captação</h4>
            <p style="font-size:0.8rem;color:var(--cinza, #64748B);margin:0;line-height:1.5;">Os painéis solares captam a luz do sol e convertem em eletricidade limpa.</p>
          </div>
          <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:28px;text-align:center;">
            <div style="width:56px;height:56px;border-radius:16px;background:rgba(240,123,36,0.1);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;">⚡</div>
            <h4 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:0.9rem;font-weight:700;color:var(--body-text, #1e293b);margin:0 0 8px;">2. Conversão</h4>
            <p style="font-size:0.8rem;color:var(--cinza, #64748B);margin:0;line-height:1.5;">O inversor transforma a energia em corrente alternada para uso na sua casa.</p>
          </div>
          <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:28px;text-align:center;">
            <div style="width:56px;height:56px;border-radius:16px;background:rgba(22,163,74,0.1);display:flex;align-items:center;justify-content:center;font-size:28px;margin:0 auto 16px;">💰</div>
            <h4 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:0.9rem;font-weight:700;color:var(--body-text, #1e293b);margin:0 0 8px;">3. Economia</h4>
            <p style="font-size:0.8rem;color:var(--cinza, #64748B);margin:0;line-height:1.5;">A energia gerada abate da sua conta de luz. O excedente vira créditos!</p>
          </div>
        </div>
      `,
    },

    // ═══ SEU SISTEMA — Visão simplificada ═══
    {
      ...base, id: sisSec, type: "section", content: "", parentId: null, order: 2,
      style: {
        paddingTop: "56", paddingBottom: "56", paddingLeft: "24", paddingRight: "24",
        backgroundColor: "var(--card-bg, #fff)", contentWidth: "boxed",
      },
    },
    {
      ...base, id: uid(), type: "editor", parentId: sisSec, order: 0, style: {},
      content: `
        <div style="text-align:center;margin-bottom:32px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">🔧 Seu Sistema</p>
          <h2 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1.6rem;font-weight:800;color:var(--body-text, #1e293b);margin:0;">O que está incluso</h2>
        </div>
      `,
    },
    {
      ...base, id: sisCol1, type: "column", content: "", parentId: sisSec, order: 1,
      style: { width: 50, paddingRight: "10" },
    },
    {
      ...base, id: uid(), type: "editor", parentId: sisCol1, order: 0, style: {},
      content: `
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:24px;">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:var(--la, #F07B24);font-weight:700;margin:0 0 16px;">⚡ Painéis Solares</p>
          <p style="font-weight:700;color:var(--body-text, #1e293b);margin:0 0 4px;font-size:1rem;">{{modulo_quantidade}}x {{modulo_fabricante}}</p>
          <p style="color:var(--cinza, #64748B);margin:0;font-size:0.85rem;">Modelo {{modulo_modelo}} · {{modulo_potencia}} por painel</p>
        </div>
      `,
    },
    {
      ...base, id: sisCol2, type: "column", content: "", parentId: sisSec, order: 2,
      style: { width: 50, paddingLeft: "10" },
    },
    {
      ...base, id: uid(), type: "editor", parentId: sisCol2, order: 0, style: {},
      content: `
        <div style="background:var(--fundo, #F8FAFC);border:1px solid var(--card-border, #e2e8f0);border-radius:16px;padding:24px;">
          <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.1em;color:var(--la, #F07B24);font-weight:700;margin:0 0 16px;">🔌 Inversor</p>
          <p style="font-weight:700;color:var(--body-text, #1e293b);margin:0 0 4px;font-size:1rem;">{{inversor_fabricante}} {{inversor_modelo}}</p>
          <p style="color:var(--cinza, #64748B);margin:0;font-size:0.85rem;">Garantia: {{inversor_garantia}}</p>
        </div>
      `,
    },

    // ═══ VALOR — Construção progressiva ═══
    {
      ...base, id: valSec, type: "section", content: "", parentId: null, order: 3,
      style: {
        paddingTop: "56", paddingBottom: "56", paddingLeft: "24", paddingRight: "24",
        backgroundColor: "var(--fundo, #F0F4FA)", contentWidth: "boxed",
      },
    },
    {
      ...base, id: valCol, type: "column", content: "", parentId: valSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: valCol, order: 0, style: {},
      content: `
        <div style="text-align:center;margin-bottom:32px;">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:0.15em;color:var(--la, #F07B24);font-weight:700;margin:0 0 8px;">💰 Investimento Inteligente</p>
          <h2 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1.6rem;font-weight:800;color:var(--body-text, #1e293b);margin:0;">Quanto você vai economizar</h2>
        </div>
      `,
    },
    {
      ...base, id: uid(), type: "editor", parentId: valCol, order: 1, style: {},
      content: `
        <div style="max-width:700px;margin:0 auto;">
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:20px;">
            <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:14px;padding:24px;text-align:center;">
              <p style="font-size:10px;text-transform:uppercase;color:var(--cinza, #64748B);margin:0 0 6px;font-weight:600;">Economia Mensal</p>
              <p style="font-size:1.6rem;font-weight:800;color:var(--verde, #16A34A);margin:0;font-family:var(--font-numbers);">R$ {{economia_mensal}}</p>
            </div>
            <div style="background:var(--card-bg, #fff);border:1px solid var(--card-border, #e2e8f0);border-radius:14px;padding:24px;text-align:center;">
              <p style="font-size:10px;text-transform:uppercase;color:var(--cinza, #64748B);margin:0 0 6px;font-weight:600;">Economia Anual</p>
              <p style="font-size:1.6rem;font-weight:800;color:var(--verde, #16A34A);margin:0;font-family:var(--font-numbers);">R$ {{economia_anual}}</p>
            </div>
          </div>
          <div style="background:linear-gradient(135deg, var(--az, #1B3A8C), var(--az2, #0D2460));border-radius:16px;padding:28px;text-align:center;">
            <p style="font-size:10px;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.5);margin:0 0 8px;font-weight:600;">Economia em 25 anos</p>
            <p style="font-size:2.2rem;font-weight:900;color:var(--la, #F07B24);margin:0;font-family:var(--font-numbers, 'Montserrat', sans-serif);">R$ {{economia_25_anos}}</p>
            <p style="font-size:12px;color:rgba(255,255,255,0.4);margin:8px 0 0;">com payback em apenas {{payback}} meses</p>
          </div>
        </div>
      `,
    },

    // ═══ CTA — Falar com Consultor ═══
    {
      ...base, id: ctaSec, type: "section", content: "", parentId: null, order: 4,
      style: {
        paddingTop: "60", paddingBottom: "72", paddingLeft: "24", paddingRight: "24",
        backgroundColor: "var(--card-bg, #fff)", contentWidth: "boxed", textAlign: "center",
      },
    },
    {
      ...base, id: ctaCol, type: "column", content: "", parentId: ctaSec, order: 0,
      style: { width: 100 },
    },
    {
      ...base, id: uid(), type: "editor", parentId: ctaCol, order: 0, style: {},
      content: `
        <div style="max-width:520px;margin:0 auto;text-align:center;">
          <p style="font-size:40px;margin:0 0 16px;">🤝</p>
          <h2 style="font-family:var(--font-heading, 'Montserrat', sans-serif);font-size:1.6rem;font-weight:800;color:var(--body-text, #1e293b);margin:0 0 12px;">Gostou da simulação?</h2>
          <p style="color:var(--cinza, #64748B);margin:0 0 32px;font-size:0.95rem;line-height:1.6;">
            Fale com um especialista da <strong style="color:var(--body-text, #1e293b);">{{empresa_nome}}</strong> e tire todas as suas dúvidas sem compromisso.
          </p>
        </div>
      `,
    },
    {
      ...base, id: uid(), type: "button", content: "💬 Falar com Consultor", parentId: ctaCol, order: 1,
      style: {
        textAlign: "center", backgroundColor: "var(--la, #F07B24)", color: "#fff",
        borderRadius: "14", fontSize: "16", fontWeight: "700",
        paddingTop: "16", paddingBottom: "16", paddingLeft: "40", paddingRight: "40",
      },
    },
    {
      ...base, id: uid(), type: "editor", parentId: ctaCol, order: 2, style: {},
      content: `
        <div style="text-align:center;margin-top:24px;">
          <p style="font-size:12px;color:var(--cinza, #64748B);margin:0 0 4px;">
            Consultor responsável: <strong>{{consultor_nome}}</strong>
          </p>
          <p style="font-size:11px;color:var(--cinza, #64748B);margin:0;opacity:0.6;">
            {{empresa_nome}} · Simulação sem compromisso
          </p>
        </div>
      `,
    },
  ];
}
