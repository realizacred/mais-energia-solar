/**
 * Pre-built Section Templates — GDASH-quality high-conversion proposal sections
 * White/light theme, professional cards, clean typography, premium layout
 */

import { Button } from "@/components/ui/button";
import { Sparkles, LayoutTemplate, BarChart3, DollarSign, Zap, Shield, Phone, CreditCard, Navigation } from "lucide-react";
import type { TemplateBlock, ProposalType } from "./types";
import { generateBlockId } from "./treeUtils";

interface SectionTemplate {
  label: string;
  description: string;
  icon: React.ElementType;
  blocks: (proposalType: ProposalType) => TemplateBlock[];
}

/* ── Helpers ─────────────────────────────────────────────── */

const BLUE = "#1B3A8C";
const ORANGE = "#F07B24";
const DARK = "#1E293B";
const GRAY = "#64748B";
const LIGHT_GRAY = "#94A3B8";
const BORDER = "#E2E8F0";
const BG_LIGHT = "#F8FAFC";
const WHITE = "#FFFFFF";

function makeSection(pt: ProposalType, style: Partial<TemplateBlock["style"]> = {}): TemplateBlock {
  return {
    id: generateBlockId("section"),
    type: "section",
    content: "",
    style: {
      paddingTop: "48", paddingRight: "24", paddingBottom: "48", paddingLeft: "24",
      backgroundColor: WHITE, contentWidth: "boxed", justifyContent: "center",
      ...style,
    },
    isVisible: true,
    parentId: null,
    order: 0,
    _proposalType: pt,
  };
}

function makeCol(parentId: string, pt: ProposalType, width: number, style: Partial<TemplateBlock["style"]> = {}, order = 0): TemplateBlock {
  return {
    id: generateBlockId("column"),
    type: "column",
    content: "",
    style: { width, alignItems: "stretch", paddingTop: "16", paddingRight: "16", paddingBottom: "16", paddingLeft: "16", ...style },
    isVisible: true,
    parentId,
    order,
    _proposalType: pt,
  };
}

function makeText(parentId: string, pt: ProposalType, html: string, style: Partial<TemplateBlock["style"]> = {}, order = 0): TemplateBlock {
  return {
    id: generateBlockId("editor"),
    type: "editor",
    content: html,
    style: {
      paddingTop: "4", paddingRight: "4", paddingBottom: "4", paddingLeft: "4",
      fontFamily: "Inter", fontSize: "16", fontWeight: "400",
      textAlign: "left", color: DARK,
      ...style,
    },
    isVisible: true,
    parentId,
    order,
    _proposalType: pt,
  };
}

function makeDivider(parentId: string, pt: ProposalType, order = 0): TemplateBlock {
  return {
    id: generateBlockId("divider"),
    type: "divider",
    content: "",
    style: { paddingTop: "8", paddingBottom: "8" },
    isVisible: true,
    parentId,
    order,
    _proposalType: pt,
  };
}

/* ── Icon SVG inline helpers (small, crisp) ────────────── */

const iconCircle = (emoji: string, bg = BLUE) =>
  `<div style="width:48px;height:48px;border-radius:12px;background:${bg};display:flex;align-items:center;justify-content:center;font-size:22px;margin:0 auto 8px;">${emoji}</div>`;

const sectionLabel = (text: string) =>
  `<p style="font-size:11px;font-weight:700;letter-spacing:2.5px;color:${ORANGE};text-transform:uppercase;margin-bottom:6px;">${text}</p>`;

const sectionTitle = (text: string) =>
  `<h2 style="font-size:28px;font-weight:800;color:${DARK};line-height:1.2;">${text}</h2>`;

/* ═══════════════════════════════════════════════════════════ */

const SECTION_TEMPLATES: SectionTemplate[] = [
  /* ─── 1. HERO — PROPOSTA DE ALTA CONVERSÃO ─────────────── */
  {
    label: "Hero — Alta Conversão",
    description: "Título impactante + nome do cliente + KPIs + CTA",
    icon: Sparkles,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: WHITE, paddingTop: "60", paddingBottom: "20" });
      const col = makeCol(sec.id, pt, 100, { alignItems: "center" }, 0);

      const badge = makeText(col.id, pt,
        `<div style="display:inline-flex;align-items:center;gap:6px;border:1px solid ${BORDER};padding:8px 20px;border-radius:100px;font-size:12px;font-weight:600;color:${GRAY};background:${WHITE};box-shadow:0 1px 3px rgba(0,0,0,0.04);">✨ PROPOSTA DE ALTA CONVERSÃO</div>`,
        { textAlign: "center" }, 0);

      const title = makeText(col.id, pt,
        `<h1 style="font-size:52px;font-weight:900;color:${DARK};font-style:italic;line-height:1.05;margin-top:28px;">TUDO COMEÇA<br/>POR <span style="color:${ORANGE};">VOCÊ!</span></h1>`,
        { textAlign: "center", fontSize: "52", fontWeight: "900" }, 1);

      const subtitle = makeText(col.id, pt,
        `<p style="color:${GRAY};font-size:16px;margin-top:12px;max-width:520px;margin-left:auto;margin-right:auto;">Olá, <strong style="color:${DARK};">{{cliente_nome}}</strong>.<br/>O futuro da sua energia em <strong style="color:${DARK};">{{cliente_cidade}} - {{cliente_estado}}</strong> foi modelado com precisão pela <strong style="color:${DARK};">{{empresa_nome}}</strong>.</p>`,
        { textAlign: "center", fontSize: "16", color: GRAY }, 2);

      // KPI row
      const kpiRow = makeCol(sec.id, pt, 100, { alignItems: "center", paddingTop: "32", paddingBottom: "0" }, 1);

      const kpis = [
        { emoji: "⚡", label: "POTÊNCIA", value: "{{potencia_kwp}} kWp" },
        { emoji: "📈", label: "ECONOMIA", value: "{{economia_percentual}}%" },
        { emoji: "☀️", label: "GERAÇÃO", value: "{{geracao_media_mensal}} kWh" },
      ];

      const kpiHtml = kpis.map(k =>
        `<div style="text-align:center;flex:1;min-width:120px;">
          <div style="width:44px;height:44px;border-radius:50%;background:${BG_LIGHT};border:1px solid ${BORDER};display:flex;align-items:center;justify-content:center;font-size:20px;margin:0 auto 10px;">${k.emoji}</div>
          <p style="font-size:10px;font-weight:700;letter-spacing:2px;color:${LIGHT_GRAY};text-transform:uppercase;">${k.label}</p>
          <p style="font-size:22px;font-weight:800;color:${DARK};margin-top:2px;">${k.value}</p>
        </div>`
      ).join("");

      const kpiBlock = makeText(kpiRow.id, pt,
        `<div style="display:flex;justify-content:center;gap:48px;flex-wrap:wrap;">${kpiHtml}</div>`,
        { textAlign: "center" }, 0);

      // Scroll indicator
      const scroll = makeText(kpiRow.id, pt,
        `<div style="text-align:center;margin-top:32px;color:${LIGHT_GRAY};font-size:24px;animation:bounce 2s infinite;">↓</div>`,
        { textAlign: "center" }, 1);

      return [sec, col, badge, title, subtitle, kpiRow, kpiBlock, scroll];
    },
  },

  /* ─── 2. DETALHES TÉCNICOS ─────────────────────────────── */
  {
    label: "Detalhes Técnicos",
    description: "4 cards: Módulos, Inversor, Geração, Localização",
    icon: Zap,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: BG_LIGHT, paddingTop: "48", paddingBottom: "48" });
      const headerCol = makeCol(sec.id, pt, 100, { alignItems: "center" }, 0);
      const header = makeText(headerCol.id, pt,
        `${sectionLabel("SEU SISTEMA")}${sectionTitle("Detalhes Técnicos")}`,
        { textAlign: "center" }, 0);

      const cards = [
        { title: "Módulos", lines: `{{modulo_quantidade}}x<br/><span style="color:${GRAY};font-size:13px;">{{modulo_fabricante}}<br/>{{modulo_modelo}}</span>` },
        { title: "Inversor", lines: `{{inversor_fabricante}}<br/><span style="color:${GRAY};font-size:13px;">{{inversor_modelo}}</span>` },
        { title: "Geração Mensal", lines: `<span style="font-size:24px;font-weight:700;">{{geracao_media_mensal}}</span><br/><span style="color:${GRAY};font-size:13px;">kWh/mês estimado</span>` },
        { title: "Localização", lines: `{{cliente_cidade}}<br/><span style="color:${GRAY};font-size:13px;">{{cliente_estado}}</span>` },
      ];

      const blocks: TemplateBlock[] = [sec, headerCol, header];

      cards.forEach((card, i) => {
        const col = makeCol(sec.id, pt, 50, {
          backgroundColor: WHITE, borderRadius: "16", borderWidth: "1", borderColor: BORDER,
          paddingTop: "24", paddingBottom: "24", paddingLeft: "24", paddingRight: "24",
          alignItems: "flex-start",
        }, i + 1);
        col.style.boxShadow = "0 1px 3px rgba(0,0,0,0.04)";

        const label = makeText(col.id, pt,
          `<p style="font-size:11px;font-weight:600;letter-spacing:1.5px;color:${LIGHT_GRAY};text-transform:uppercase;margin-bottom:8px;">${card.title}</p>`,
          { fontSize: "11" }, 0);
        const value = makeText(col.id, pt,
          `<p style="font-size:16px;font-weight:600;color:${DARK};line-height:1.5;">${card.lines}</p>`,
          { fontSize: "16", fontWeight: "600" }, 1);
        blocks.push(col, label, value);
      });

      return blocks;
    },
  },

  /* ─── 3. BENEFÍCIOS — POR QUE INVESTIR ────────────────── */
  {
    label: "Benefícios — ROI",
    description: "4 cards: Economia, Payback, Longo prazo, CO₂",
    icon: BarChart3,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: WHITE, paddingTop: "48", paddingBottom: "48" });
      const headerCol = makeCol(sec.id, pt, 100, { alignItems: "center" }, 0);
      const header = makeText(headerCol.id, pt,
        `${sectionLabel("BENEFÍCIOS")}${sectionTitle("Por que investir em energia solar?")}`,
        { textAlign: "center" }, 0);

      const items = [
        {
          value: "R$ {{economia_anual}}",
          label: "Economia por ano",
          desc: "Reduza drasticamente sua conta de energia elétrica.",
          accent: ORANGE,
        },
        {
          value: "{{payback}} anos",
          label: "Retorno do Investimento",
          desc: "Após o payback, toda a economia é lucro direto.",
          accent: BLUE,
        },
        {
          value: "R$ {{economia_25_anos}}",
          label: "Economia em 25 anos",
          desc: "Retorno extraordinário na vida útil do sistema.",
          accent: ORANGE,
        },
        {
          value: "{{co2_evitado_ton_ano}} ton",
          label: "CO₂ evitado por ano",
          desc: "Contribua para um planeta mais sustentável.",
          accent: "#10B981",
        },
      ];

      const blocks: TemplateBlock[] = [sec, headerCol, header];

      items.forEach((item, i) => {
        const col = makeCol(sec.id, pt, 50, {
          backgroundColor: BG_LIGHT, borderRadius: "16", borderWidth: "1", borderColor: BORDER,
          paddingTop: "28", paddingBottom: "28", paddingLeft: "24", paddingRight: "24",
          alignItems: "flex-start",
        }, i + 1);

        const valueEl = makeText(col.id, pt,
          `<p style="font-size:24px;font-weight:800;color:${DARK};">${item.value}</p>`,
          { fontSize: "24", fontWeight: "800" }, 0);
        const labelEl = makeText(col.id, pt,
          `<p style="font-size:12px;font-weight:700;color:${item.accent};text-transform:uppercase;letter-spacing:0.5px;margin-top:4px;">${item.label}</p>`,
          { fontSize: "12", color: item.accent }, 1);
        const descEl = makeText(col.id, pt,
          `<p style="font-size:13px;color:${GRAY};margin-top:8px;line-height:1.5;">${item.desc}</p>`,
          { fontSize: "13", color: GRAY }, 2);

        blocks.push(col, valueEl, labelEl, descEl);
      });

      return blocks;
    },
  },

  /* ─── 4. COMPARATIVO DE KITS ───────────────────────────── */
  {
    label: "Comparativo de Kits",
    description: "3 kits lado a lado com specs e preço",
    icon: LayoutTemplate,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: WHITE, paddingTop: "48", paddingBottom: "48" });
      const headerCol = makeCol(sec.id, pt, 100, { alignItems: "flex-start" }, 0);
      const header = makeText(headerCol.id, pt,
        `<h2 style="font-size:28px;font-weight:900;font-style:italic;color:${DARK};line-height:1.2;">A CONFIGURAÇÃO PERFEITA</h2>
         <p style="color:${GRAY};font-size:14px;margin-top:4px;">Compare os níveis de engenharia para o seu projeto.</p>`,
        { fontSize: "28", fontWeight: "900" }, 0);

      const kits = [
        { name: "Kit Essencial", tier: "ENGENHARIA PREMIUM TIER 1", tag: "CUSTO-BENEFÍCIO", tagBg: ORANGE, highlight: true },
        { name: "Kit Híbrido", tier: "ENGENHARIA PREMIUM TIER 1", tag: "SUSTENTABILIDADE", tagBg: LIGHT_GRAY, highlight: false },
        { name: "Kit Elite", tier: "ENGENHARIA PREMIUM TIER 1", tag: "ALTA PERFORMANCE", tagBg: LIGHT_GRAY, highlight: false },
      ];

      const blocks: TemplateBlock[] = [sec, headerCol, header];

      kits.forEach((kit, i) => {
        const col = makeCol(sec.id, pt, 33, {
          backgroundColor: WHITE, borderRadius: "20",
          borderWidth: kit.highlight ? "2" : "1",
          borderColor: kit.highlight ? BLUE : BORDER,
          paddingTop: "0", paddingBottom: "28", paddingLeft: "0", paddingRight: "0",
          alignItems: "stretch",
        }, i + 1);
        col.style.boxShadow = kit.highlight ? "0 8px 30px rgba(27,58,140,0.10)" : "0 1px 4px rgba(0,0,0,0.06)";

        // Tag badge
        const tag = makeText(col.id, pt,
          `<div style="text-align:center;padding-top:16px;"><span style="display:inline-block;background:${kit.tagBg};color:${WHITE};padding:5px 16px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:1.2px;text-transform:uppercase;">${kit.tag}</span></div>`,
          { textAlign: "center" }, 0);

        // Icon + Name
        const nameEl = makeText(col.id, pt,
          `<div style="padding:20px 24px 0;">
            ${kit.highlight ? `<div style="width:48px;height:48px;border-radius:14px;background:${BLUE};display:flex;align-items:center;justify-content:center;font-size:22px;color:${WHITE};margin-bottom:12px;">⚡</div>` : `<div style="width:48px;height:48px;border-radius:14px;background:${BG_LIGHT};border:1px solid ${BORDER};display:flex;align-items:center;justify-content:center;font-size:18px;color:${GRAY};margin-bottom:12px;">⚡</div>`}
            <h3 style="font-size:18px;font-weight:800;font-style:italic;color:${DARK};">${kit.name.toUpperCase()}</h3>
            <p style="font-size:11px;font-weight:600;color:${GRAY};text-transform:uppercase;letter-spacing:0.5px;margin-top:2px;">${kit.tier}</p>
          </div>`,
          { fontSize: "18" }, 1);

        // Specs list
        const specs = makeText(col.id, pt,
          `<div style="padding:20px 24px 0;font-size:13px;color:${GRAY};">
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid ${BORDER};">
              <span style="color:${LIGHT_GRAY};">🔌</span>
              <div><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${LIGHT_GRAY};">Inversor</span><br/><strong style="color:${DARK};">{{inversor_modelo}}</strong></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid ${BORDER};">
              <span style="color:${LIGHT_GRAY};">☀️</span>
              <div><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${LIGHT_GRAY};">Módulos</span><br/><strong style="color:${DARK};">{{modulo_fabricante}} {{modulo_potencia}}</strong></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid ${BORDER};">
              <span style="color:${LIGHT_GRAY};">📊</span>
              <div><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${LIGHT_GRAY};">Eficiência</span><br/><strong style="color:${DARK};">{{modulo_eficiencia}}%</strong></div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px 0;">
              <span style="color:${LIGHT_GRAY};">🛡️</span>
              <div><span style="font-size:10px;text-transform:uppercase;letter-spacing:1px;color:${LIGHT_GRAY};">Garantia</span><br/><strong style="color:${DARK};">{{inversor_garantia}}</strong></div>
            </div>
          </div>`,
          { fontSize: "13" }, 2);

        // Price
        const price = makeText(col.id, pt,
          `<div style="padding:20px 24px 0;border-top:1px solid ${BORDER};margin-top:8px;">
            <p style="font-size:10px;font-weight:600;color:${LIGHT_GRAY};text-transform:uppercase;letter-spacing:1.5px;">TOTAL DO KIT</p>
            <p style="font-size:28px;font-weight:800;color:${DARK};margin-top:4px;">R$ {{valor_total}}${kit.highlight ? ` <span style="color:${BLUE};font-size:18px;">✓</span>` : ""}</p>
          </div>`,
          { fontSize: "28", fontWeight: "800" }, 3);

        blocks.push(col, tag, nameEl, specs, price);
      });

      return blocks;
    },
  },

  /* ─── 5. INVESTIMENTO — PAYBACK & GRÁFICO ──────────────── */
  {
    label: "Investimento — Payback",
    description: "Payback + Economia 10a + Gráfico de fluxo",
    icon: DollarSign,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: BG_LIGHT, paddingTop: "48", paddingBottom: "48" });

      const headerCol = makeCol(sec.id, pt, 100, { alignItems: "center" }, 0);
      const header = makeText(headerCol.id, pt,
        `${sectionLabel("INVESTIMENTO")}${sectionTitle("Seu dinheiro de volta.")}
         <p style="color:${GRAY};font-size:14px;margin-top:8px;max-width:480px;">Este não é um custo, é um ativo. Seu kit solar acelera a sua independência financeira.</p>`,
        { textAlign: "center" }, 0);

      // Left — KPIs
      const colLeft = makeCol(sec.id, pt, 45, {
        backgroundColor: WHITE, borderRadius: "20", borderWidth: "1", borderColor: BORDER,
        paddingTop: "32", paddingBottom: "32", paddingLeft: "28", paddingRight: "28",
        alignItems: "flex-start",
      }, 1);
      colLeft.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";

      const paybackKpi = makeText(colLeft.id, pt,
        `<div style="display:flex;align-items:center;gap:12px;">
          <div style="width:44px;height:44px;border-radius:12px;background:#E8F5E9;display:flex;align-items:center;justify-content:center;font-size:20px;">📈</div>
          <div>
            <p style="font-size:10px;font-weight:700;letter-spacing:2px;color:${LIGHT_GRAY};text-transform:uppercase;">Payback Médio</p>
            <p style="font-size:36px;font-weight:900;color:${DARK};line-height:1;">{{payback}} <span style="font-size:16px;font-weight:700;">ANOS</span></p>
          </div>
        </div>`,
        {}, 0);

      const subKpis = makeText(colLeft.id, pt,
        `<div style="display:flex;gap:24px;margin-top:24px;padding-top:20px;border-top:1px solid ${BORDER};">
          <div>
            <p style="font-size:10px;font-weight:600;color:${LIGHT_GRAY};text-transform:uppercase;letter-spacing:1px;">ECONOMIA 10A</p>
            <p style="font-size:22px;font-weight:800;color:${ORANGE};">R$ {{economia_10_anos}}</p>
          </div>
          <div>
            <p style="font-size:10px;font-weight:600;color:${LIGHT_GRAY};text-transform:uppercase;letter-spacing:1px;">VALORIZAÇÃO</p>
            <p style="font-size:22px;font-weight:800;color:#10B981;">+ {{valorizacao_imovel}}%</p>
          </div>
        </div>`,
        {}, 1);

      // Right — Chart placeholder
      const colRight = makeCol(sec.id, pt, 55, {
        backgroundColor: WHITE, borderRadius: "20", borderWidth: "1", borderColor: BORDER,
        paddingTop: "24", paddingBottom: "24", paddingLeft: "24", paddingRight: "24",
      }, 2);
      colRight.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";

      const chartTitle = makeText(colRight.id, pt,
        `<div style="display:flex;align-items:center;gap:8px;margin-bottom:12px;">
          <span style="font-size:16px;">📊</span>
          <strong style="font-size:14px;font-weight:700;color:${DARK};letter-spacing:0.5px;">FLUXO ACUMULADO</strong>
        </div>`,
        { fontSize: "14", fontWeight: "700" }, 0);

      const chart = makeText(colRight.id, pt,
        `<div data-widget="chart-fluxo-acumulado" style="min-height:220px;background:${BG_LIGHT};border-radius:12px;display:flex;align-items:center;justify-content:center;color:${LIGHT_GRAY};font-size:13px;">Gráfico de fluxo acumulado</div>`,
        {}, 1);

      return [sec, headerCol, header, colLeft, paybackKpi, subKpis, colRight, chartTitle, chart];
    },
  },

  /* ─── 6. VALOR DO SISTEMA ──────────────────────────────── */
  {
    label: "Valor do Sistema",
    description: "Investimento total + formas de pagamento",
    icon: CreditCard,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: WHITE, paddingTop: "48", paddingBottom: "48" });
      const headerCol = makeCol(sec.id, pt, 100, { alignItems: "center" }, 0);
      const header = makeText(headerCol.id, pt,
        `${sectionLabel("INVESTIMENTO")}${sectionTitle("Valor do Sistema")}`,
        { textAlign: "center" }, 0);

      // Investment card
      const investCol = makeCol(sec.id, pt, 50, {
        backgroundColor: BG_LIGHT, borderRadius: "20",
        paddingTop: "32", paddingBottom: "32", paddingLeft: "28", paddingRight: "28",
        alignItems: "center",
      }, 1);

      const investValue = makeText(investCol.id, pt,
        `<p style="font-size:11px;font-weight:600;color:${LIGHT_GRAY};text-transform:uppercase;letter-spacing:2px;">Investimento Total</p>
         <p style="font-size:44px;font-weight:900;color:${DARK};margin-top:8px;">R$ {{valor_total}}</p>
         <p style="font-size:13px;color:${GRAY};margin-top:8px;">ou até <strong>{{parcelas_max}}x</strong> no cartão</p>`,
        { textAlign: "center", fontSize: "44" }, 0);

      // Payment methods
      const payCol = makeCol(sec.id, pt, 50, {
        paddingTop: "8", paddingBottom: "8",
        alignItems: "stretch",
      }, 2);

      const methods = [
        { icon: "💰", name: "À VISTA (PIX)", desc: "Desconto especial" },
        { icon: "🏦", name: "FINANCIAMENTO", desc: "Taxas a partir de 0,99%" },
        { icon: "💳", name: "CARTÃO 12X", desc: "Sem juros" },
        { icon: "📋", name: "ENTRADA + PARC.", desc: "Condição personalizada" },
      ];

      const payHtml = methods.map(m =>
        `<div style="display:flex;align-items:center;gap:14px;padding:14px 18px;background:${BG_LIGHT};border:1px solid ${BORDER};border-radius:14px;margin-bottom:8px;">
          <div style="width:40px;height:40px;border-radius:10px;background:${WHITE};border:1px solid ${BORDER};display:flex;align-items:center;justify-content:center;font-size:18px;">${m.icon}</div>
          <div>
            <p style="font-size:12px;font-weight:700;color:${DARK};text-transform:uppercase;letter-spacing:0.5px;">${m.name}</p>
            <p style="font-size:11px;color:${GRAY};">${m.desc}</p>
          </div>
        </div>`
      ).join("");

      const payBlock = makeText(payCol.id, pt, payHtml, {}, 0);

      return [sec, headerCol, header, investCol, investValue, payCol, payBlock];
    },
  },

  /* ─── 7. PROTEÇÃO TOTAL ────────────────────────────────── */
  {
    label: "Proteção e Pós-Venda",
    description: "Seguro + Manutenção com preços",
    icon: Shield,
    blocks: (pt) => {
      const sec = makeSection(pt, {
        backgroundColor: DARK, borderRadius: "24", paddingTop: "40", paddingBottom: "40",
        marginLeft: "16", marginRight: "16",
      });

      const headerCol = makeCol(sec.id, pt, 40, { alignItems: "flex-start" }, 0);
      const header = makeText(headerCol.id, pt,
        `<h3 style="font-size:24px;font-weight:900;font-style:italic;color:${WHITE};line-height:1.2;">PROTEÇÃO<br/>TOTAL</h3>
         <p style="font-size:13px;color:rgba(255,255,255,0.6);margin-top:10px;line-height:1.5;">Adicione camadas extras de segurança ao seu investimento.</p>`,
        { fontSize: "24", color: WHITE }, 0);

      const servicesCol = makeCol(sec.id, pt, 60, { alignItems: "stretch" }, 1);
      const services = [
        { icon: "🛡️", name: "SEGURO SOLAR", price: "R$ {{seguro_valor}}" },
        { icon: "🔧", name: "MANUTENÇÃO PREVENTIVA", price: "R$ {{manutencao_valor}}" },
      ];

      const servHtml = services.map(s =>
        `<div style="display:flex;align-items:center;justify-content:space-between;padding:18px 22px;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.12);border-radius:16px;margin-bottom:10px;">
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="width:40px;height:40px;border-radius:10px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:18px;">${s.icon}</div>
            <div>
              <p style="font-size:12px;font-weight:700;color:${WHITE};text-transform:uppercase;letter-spacing:1px;">${s.name}</p>
              <p style="font-size:18px;font-weight:700;color:${WHITE};margin-top:2px;">${s.price}</p>
            </div>
          </div>
          <div style="width:36px;height:20px;border-radius:10px;background:rgba(255,255,255,0.2);"></div>
        </div>`
      ).join("");

      const servBlock = makeText(servicesCol.id, pt, servHtml, {}, 0);

      return [sec, headerCol, header, servicesCol, servBlock];
    },
  },

  /* ─── 8. CTA FINAL ─────────────────────────────────────── */
  {
    label: "CTA Final — Aceite",
    description: "Chamada final + botão de aceite",
    icon: Sparkles,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: WHITE, paddingTop: "60", paddingBottom: "60" });
      const col = makeCol(sec.id, pt, 100, { alignItems: "center" }, 0);

      const badge = makeText(col.id, pt,
        `<div style="display:inline-block;background:#E8F5E9;color:#10B981;padding:6px 16px;border-radius:20px;font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">SETUP CONCLUÍDO</div>`,
        { textAlign: "center" }, 0);

      const title = makeText(col.id, pt,
        `<h2 style="font-size:44px;font-weight:900;font-style:italic;color:${DARK};line-height:1.1;margin-top:20px;">PRONTO PARA A<br/>SUA <span style="color:${ORANGE};">LIBERDADE?</span></h2>`,
        { textAlign: "center", fontSize: "44" }, 1);

      const subtitle = makeText(col.id, pt,
        `<p style="font-size:15px;color:${GRAY};margin-top:12px;max-width:440px;margin-left:auto;margin-right:auto;">Aceite esta proposta e inicie sua jornada rumo à independência energética.</p>`,
        { textAlign: "center", color: GRAY }, 2);

      const cta = makeText(col.id, pt,
        `<div style="margin-top:28px;"><a href="#aceitar" style="display:inline-block;background:${ORANGE};color:${WHITE};padding:16px 48px;border-radius:12px;font-weight:800;text-decoration:none;font-size:15px;text-transform:uppercase;letter-spacing:1.5px;box-shadow:0 4px 16px rgba(240,123,36,0.3);">ACEITAR PROPOSTA →</a></div>`,
        { textAlign: "center" }, 3);

      const validity = makeText(col.id, pt,
        `<p style="font-size:12px;color:${LIGHT_GRAY};margin-top:16px;">Proposta válida até <strong>{{proposta_valido_ate}}</strong></p>`,
        { textAlign: "center", fontSize: "12" }, 4);

      return [sec, col, badge, title, subtitle, cta, validity];
    },
  },

  /* ─── 9. RODAPÉ ────────────────────────────────────────── */
  {
    label: "Rodapé — Contato",
    description: "Empresa + telefone + site",
    icon: Phone,
    blocks: (pt) => {
      const sec = makeSection(pt, {
        backgroundColor: BG_LIGHT, paddingTop: "28", paddingBottom: "28",
        borderWidth: "1", borderColor: BORDER,
      });
      const colLeft = makeCol(sec.id, pt, 60, { alignItems: "flex-start" }, 0);
      const logo = makeText(colLeft.id, pt,
        `<h3 style="font-size:20px;font-weight:900;font-style:italic;color:${DARK};">{{empresa_nome}}</h3>
         <p style="font-size:12px;color:${GRAY};margin-top:4px;">{{empresa_cidade}} - {{empresa_estado}}</p>`,
        { fontSize: "20" }, 0);

      const colRight = makeCol(sec.id, pt, 40, { alignItems: "flex-end" }, 1);
      const contact = makeText(colRight.id, pt,
        `<div style="text-align:right;">
          <p style="font-size:10px;font-weight:600;color:${LIGHT_GRAY};text-transform:uppercase;letter-spacing:1.5px;">Suporte Comercial</p>
          <p style="font-size:18px;font-weight:700;color:${DARK};margin-top:4px;">📱 {{empresa_telefone}}</p>
          <p style="font-size:12px;color:${BLUE};margin-top:2px;">{{empresa_email}}</p>
        </div>`,
        { textAlign: "right" }, 0);

      return [sec, colLeft, logo, colRight, contact];
    },
  },
];

/**
 * Generate a complete default template with all premium sections.
 * Used by "Restaurar Padrão" and when editor opens empty.
 */
export function generateDefaultTemplate(proposalType: ProposalType): TemplateBlock[] {
  const allBlocks: TemplateBlock[] = [];
  let sectionOrder = 0;

  for (const tpl of SECTION_TEMPLATES) {
    const blocks = tpl.blocks(proposalType);
    // Update root section order
    for (const block of blocks) {
      if (block.parentId === null) {
        block.order = sectionOrder++;
      }
    }
    allBlocks.push(...blocks);
  }

  return allBlocks;
}

/* ═══════════════════════════════════════════════════════════ */

interface SectionTemplatesProps {
  proposalType: ProposalType;
  onInsertBlocks: (blocks: TemplateBlock[]) => void;
}

export function SectionTemplates({ proposalType, onInsertBlocks }: SectionTemplatesProps) {
  return (
    <div className="space-y-1.5">
      {SECTION_TEMPLATES.map((tpl, i) => (
        <button
          key={i}
          onClick={() => onInsertBlocks(tpl.blocks(proposalType))}
          className="w-full flex items-start gap-3 p-3 rounded-lg border border-border/50 bg-background hover:border-primary/40 hover:bg-primary/5 transition-all text-left group"
        >
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
            <tpl.icon className="h-4 w-4 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">{tpl.label}</p>
            <p className="text-[10px] text-muted-foreground leading-tight mt-0.5">{tpl.description}</p>
          </div>
        </button>
      ))}
    </div>
  );
}
