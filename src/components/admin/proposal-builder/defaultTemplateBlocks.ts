/**
 * Default rich template blocks for the Visual Proposal Builder.
 * 
 * Creates a professional solar proposal landing page with:
 * - Hero section with client greeting + key metrics
 * - System details section
 * - Financial analysis section  
 * - CTA / acceptance section
 * 
 * Uses {{variable}} format from variablesCatalog.
 * Página pública — exceção RB-02 documentada.
 */

import type { TemplateBlock, ProposalType } from "./types";

function uid(): string {
  return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2, 10);
}

export function createDefaultTemplateBlocks(proposalType: ProposalType = "grid"): TemplateBlock[] {
  // IDs
  const heroSec = uid();
  const heroCol = uid();
  const techSec = uid();
  const techCol1 = uid();
  const techCol2 = uid();
  const finSec = uid();
  const finCol = uid();
  const ctaSec = uid();
  const ctaCol = uid();

  const base: Pick<TemplateBlock, "_proposalType" | "isVisible"> = {
    _proposalType: proposalType,
    isVisible: true,
  };

  return [
    // ═══ HERO SECTION ═══
    {
      ...base,
      id: heroSec,
      type: "section",
      content: "",
      parentId: null,
      order: 0,
      style: {
        paddingTop: "60",
        paddingBottom: "60",
        paddingLeft: "24",
        paddingRight: "24",
        useGradient: true,
        gradientStart: "#1B3A8C",
        gradientEnd: "#0D2460",
        staticGradientAngle: 135,
        contentWidth: "boxed",
        textAlign: "center",
      },
    },
    {
      ...base,
      id: heroCol,
      type: "column",
      content: "",
      parentId: heroSec,
      order: 0,
      style: { width: 100, paddingTop: "0", paddingBottom: "0" },
    },
    {
      ...base,
      id: uid(),
      type: "editor",
      content: `
        <p style="font-size:12px;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.6);margin:0 0 8px;">
          Proposta Comercial Personalizada
        </p>
        <h1 style="font-family:'Montserrat',sans-serif;font-size:2.2rem;font-weight:800;color:#fff;margin:0 0 12px;line-height:1.2;">
          Olá, {{cliente.nome}}! ☀️
        </h1>
        <p style="font-size:1.05rem;color:rgba(255,255,255,0.75);margin:0 0 32px;max-width:600px;margin-left:auto;margin-right:auto;">
          Preparamos uma solução sob medida de energia solar para você em <strong style="color:#F07B24;">{{cliente.cidade}}/{{cliente.estado}}</strong>.
        </p>
      `,
      parentId: heroCol,
      order: 0,
      style: { textAlign: "center" },
    },
    {
      ...base,
      id: uid(),
      type: "editor",
      content: `
        <div style="display:flex;flex-wrap:wrap;justify-content:center;gap:20px;margin-top:8px;">
          <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:20px 28px;min-width:160px;text-align:center;">
            <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.5);margin:0 0 4px;">Potência</p>
            <p style="font-size:1.6rem;font-weight:800;color:#F07B24;margin:0;font-family:'Montserrat',sans-serif;">{{potencia_kwp}} kWp</p>
          </div>
          <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:20px 28px;min-width:160px;text-align:center;">
            <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.5);margin:0 0 4px;">Economia Mensal</p>
            <p style="font-size:1.6rem;font-weight:800;color:#F07B24;margin:0;font-family:'Montserrat',sans-serif;">R$ {{economia_mensal}}</p>
          </div>
          <div style="background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:14px;padding:20px 28px;min-width:160px;text-align:center;">
            <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.5);margin:0 0 4px;">Investimento</p>
            <p style="font-size:1.6rem;font-weight:800;color:#F07B24;margin:0;font-family:'Montserrat',sans-serif;">R$ {{valor_total}}</p>
          </div>
        </div>
      `,
      parentId: heroCol,
      order: 1,
      style: {},
    },

    // ═══ TECHNOLOGY SECTION ═══
    {
      ...base,
      id: techSec,
      type: "section",
      content: "",
      parentId: null,
      order: 1,
      style: {
        paddingTop: "48",
        paddingBottom: "48",
        paddingLeft: "24",
        paddingRight: "24",
        backgroundColor: "#F8FAFC",
        contentWidth: "boxed",
      },
    },
    {
      ...base,
      id: uid(),
      type: "editor",
      content: `
        <div style="text-align:center;margin-bottom:32px;">
          <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;color:#F07B24;font-weight:700;margin:0 0 6px;">Tecnologia</p>
          <h2 style="font-family:'Montserrat',sans-serif;font-size:1.5rem;font-weight:800;color:#1e293b;margin:0;">Componentes do Sistema</h2>
        </div>
      `,
      parentId: techSec,
      order: 0,
      style: {},
    },
    {
      ...base,
      id: techCol1,
      type: "column",
      content: "",
      parentId: techSec,
      order: 1,
      style: { width: 50, paddingRight: "12" },
    },
    {
      ...base,
      id: uid(),
      type: "editor",
      content: `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(240,123,36,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;">⚡</div>
            <h3 style="font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:700;color:#1e293b;margin:0;">Módulos Solares</h3>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="background:#f8fafc;border-radius:10px;padding:12px;">
              <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin:0 0 2px;">Fabricante</p>
              <p style="font-weight:700;color:#1e293b;margin:0;font-size:0.9rem;">{{modulo_fabricante}}</p>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px;">
              <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin:0 0 2px;">Modelo</p>
              <p style="font-weight:700;color:#1e293b;margin:0;font-size:0.9rem;">{{modulo_modelo}}</p>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px;">
              <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin:0 0 2px;">Quantidade</p>
              <p style="font-weight:700;color:#1e293b;margin:0;font-size:0.9rem;">{{modulo_quantidade}} unidades</p>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px;">
              <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin:0 0 2px;">Potência</p>
              <p style="font-weight:700;color:#1e293b;margin:0;font-size:0.9rem;">{{modulo_potencia}}</p>
            </div>
          </div>
        </div>
      `,
      parentId: techCol1,
      order: 0,
      style: {},
    },
    {
      ...base,
      id: techCol2,
      type: "column",
      content: "",
      parentId: techSec,
      order: 2,
      style: { width: 50, paddingLeft: "12" },
    },
    {
      ...base,
      id: uid(),
      type: "editor",
      content: `
        <div style="background:#fff;border:1px solid #e2e8f0;border-radius:14px;padding:24px;box-shadow:0 1px 3px rgba(0,0,0,0.04);">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:16px;">
            <div style="width:36px;height:36px;border-radius:10px;background:rgba(240,123,36,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;">🔌</div>
            <h3 style="font-family:'Montserrat',sans-serif;font-size:1rem;font-weight:700;color:#1e293b;margin:0;">Inversor</h3>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;">
            <div style="background:#f8fafc;border-radius:10px;padding:12px;">
              <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin:0 0 2px;">Fabricante</p>
              <p style="font-weight:700;color:#1e293b;margin:0;font-size:0.9rem;">{{inversor_fabricante}}</p>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px;">
              <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin:0 0 2px;">Modelo</p>
              <p style="font-weight:700;color:#1e293b;margin:0;font-size:0.9rem;">{{inversor_modelo}}</p>
            </div>
            <div style="background:#f8fafc;border-radius:10px;padding:12px;grid-column:1/-1;">
              <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin:0 0 2px;">Garantia</p>
              <p style="font-weight:700;color:#1e293b;margin:0;font-size:0.9rem;">{{inversor_garantia}}</p>
            </div>
          </div>
        </div>
      `,
      parentId: techCol2,
      order: 0,
      style: {},
    },

    // ═══ FINANCIAL SECTION ═══
    {
      ...base,
      id: finSec,
      type: "section",
      content: "",
      parentId: null,
      order: 2,
      style: {
        paddingTop: "48",
        paddingBottom: "48",
        paddingLeft: "24",
        paddingRight: "24",
        backgroundColor: "#FFFFFF",
        contentWidth: "boxed",
      },
    },
    {
      ...base,
      id: finCol,
      type: "column",
      content: "",
      parentId: finSec,
      order: 0,
      style: { width: 100 },
    },
    {
      ...base,
      id: uid(),
      type: "editor",
      content: `
        <div style="text-align:center;margin-bottom:32px;">
          <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;color:#F07B24;font-weight:700;margin:0 0 6px;">Análise Financeira</p>
          <h2 style="font-family:'Montserrat',sans-serif;font-size:1.5rem;font-weight:800;color:#1e293b;margin:0;">Retorno do Investimento</h2>
        </div>
      `,
      parentId: finCol,
      order: 0,
      style: {},
    },
    {
      ...base,
      id: uid(),
      type: "editor",
      content: `
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:16px;">
          <div style="background:linear-gradient(135deg,#1B3A8C,#0D2460);border-radius:14px;padding:24px;text-align:center;">
            <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.5);margin:0 0 6px;">Investimento Total</p>
            <p style="font-size:1.8rem;font-weight:800;color:#F07B24;margin:0;font-family:'Montserrat',sans-serif;">R$ {{valor_total}}</p>
          </div>
          <div style="background:linear-gradient(135deg,#16A34A,#15803d);border-radius:14px;padding:24px;text-align:center;">
            <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.6);margin:0 0 6px;">Economia Anual</p>
            <p style="font-size:1.8rem;font-weight:800;color:#fff;margin:0;font-family:'Montserrat',sans-serif;">R$ {{economia_anual}}</p>
          </div>
          <div style="background:linear-gradient(135deg,#1B3A8C,#0D2460);border-radius:14px;padding:24px;text-align:center;">
            <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.1em;color:rgba(255,255,255,0.5);margin:0 0 6px;">Payback</p>
            <p style="font-size:1.8rem;font-weight:800;color:#F07B24;margin:0;font-family:'Montserrat',sans-serif;">{{payback}} meses</p>
          </div>
        </div>
      `,
      parentId: finCol,
      order: 1,
      style: {},
    },
    {
      ...base,
      id: uid(),
      type: "editor",
      content: `
        <div style="margin-top:24px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;">
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
            <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin:0 0 4px;">Geração Mensal</p>
            <p style="font-weight:700;color:#1e293b;font-size:1.1rem;margin:0;">{{geracao_mensal}} kWh</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
            <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin:0 0 4px;">Economia em 25 anos</p>
            <p style="font-weight:700;color:#1e293b;font-size:1.1rem;margin:0;">R$ {{economia_25_anos}}</p>
          </div>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;text-align:center;">
            <p style="font-size:0.65rem;text-transform:uppercase;letter-spacing:0.08em;color:#64748B;margin:0 0 4px;">CO₂ Evitado/Ano</p>
            <p style="font-weight:700;color:#16A34A;font-size:1.1rem;margin:0;">{{co2_evitado_ton_ano}} toneladas</p>
          </div>
        </div>
      `,
      parentId: finCol,
      order: 2,
      style: {},
    },

    // ═══ CTA SECTION ═══
    {
      ...base,
      id: ctaSec,
      type: "section",
      content: "",
      parentId: null,
      order: 3,
      style: {
        paddingTop: "48",
        paddingBottom: "60",
        paddingLeft: "24",
        paddingRight: "24",
        useGradient: true,
        gradientStart: "#0D2460",
        gradientEnd: "#1B3A8C",
        staticGradientAngle: 135,
        contentWidth: "boxed",
        textAlign: "center",
      },
    },
    {
      ...base,
      id: ctaCol,
      type: "column",
      content: "",
      parentId: ctaSec,
      order: 0,
      style: { width: 100 },
    },
    {
      ...base,
      id: uid(),
      type: "editor",
      content: `
        <div style="text-align:center;max-width:600px;margin:0 auto;">
          <p style="font-size:0.7rem;text-transform:uppercase;letter-spacing:0.15em;color:rgba(255,255,255,0.5);font-weight:700;margin:0 0 8px;">Próximo Passo</p>
          <h2 style="font-family:'Montserrat',sans-serif;font-size:1.5rem;font-weight:800;color:#fff;margin:0 0 12px;">Pronto para economizar?</h2>
          <p style="color:rgba(255,255,255,0.7);margin:0 0 28px;font-size:0.95rem;">
            Entre em contato com seu consultor <strong style="color:#F07B24;">{{consultor_nome}}</strong> para dar o próximo passo na sua transição energética.
          </p>
        </div>
      `,
      parentId: ctaCol,
      order: 0,
      style: {},
    },
    {
      ...base,
      id: uid(),
      type: "button",
      content: "Aceitar Proposta ✅",
      parentId: ctaCol,
      order: 1,
      style: {
        textAlign: "center",
        backgroundColor: "#16A34A",
        color: "#fff",
        borderRadius: "12",
        fontSize: "16",
        fontWeight: "700",
        paddingTop: "14",
        paddingBottom: "14",
        paddingLeft: "32",
        paddingRight: "32",
      },
    },
    {
      ...base,
      id: uid(),
      type: "editor",
      content: `
        <p style="text-align:center;margin-top:20px;font-size:0.75rem;color:rgba(255,255,255,0.4);">
          {{empresa_nome}} · Proposta válida por tempo limitado
        </p>
      `,
      parentId: ctaCol,
      order: 2,
      style: {},
    },
  ];
}
