/**
 * Pre-built Section Templates — Ready-made sections for high-conversion proposals
 */

import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, LayoutTemplate, BarChart3, DollarSign, Zap, Shield, Phone, Star } from "lucide-react";
import type { TemplateBlock, ProposalType } from "./types";
import { generateBlockId } from "./treeUtils";

interface SectionTemplate {
  label: string;
  description: string;
  icon: React.ElementType;
  blocks: (proposalType: ProposalType) => TemplateBlock[];
}

function makeSection(proposalType: ProposalType, style: Partial<TemplateBlock["style"]> = {}): TemplateBlock {
  return {
    id: generateBlockId("section"),
    type: "section",
    content: "",
    style: {
      paddingTop: "40", paddingRight: "20", paddingBottom: "40", paddingLeft: "20",
      backgroundColor: "transparent", contentWidth: "boxed", justifyContent: "center",
      ...style,
    },
    isVisible: true,
    parentId: null,
    order: 0,
    _proposalType: proposalType,
  };
}

function makeColumn(parentId: string, proposalType: ProposalType, width: number, style: Partial<TemplateBlock["style"]> = {}): TemplateBlock {
  return {
    id: generateBlockId("column"),
    type: "column",
    content: "",
    style: { width, alignItems: "center", paddingTop: "15", paddingRight: "15", paddingBottom: "15", paddingLeft: "15", ...style },
    isVisible: true,
    parentId,
    order: 0,
    _proposalType: proposalType,
  };
}

function makeEditor(parentId: string, proposalType: ProposalType, content: string, style: Partial<TemplateBlock["style"]> = {}, order = 0): TemplateBlock {
  return {
    id: generateBlockId("editor"),
    type: "editor",
    content,
    style: {
      paddingTop: "10", paddingRight: "10", paddingBottom: "10", paddingLeft: "10",
      fontFamily: "Inter", fontSize: "16", fontWeight: "400",
      textAlign: "left", color: "#1E293B",
      ...style,
    },
    isVisible: true,
    parentId,
    order,
    _proposalType: proposalType,
  };
}

const SECTION_TEMPLATES: SectionTemplate[] = [
  {
    label: "Hero — Boas-vindas",
    description: "Título grande + nome do cliente + CTA",
    icon: Sparkles,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: "#1B3A8C", paddingTop: "60", paddingBottom: "60" });
      const col = makeColumn(sec.id, pt, 100, { alignItems: "center" });
      const title = makeEditor(col.id, pt,
        `<h1 style="font-size:48px;font-weight:900;color:#FFFFFF;font-style:italic;line-height:1.1;">TUDO COMEÇA<br/>POR <span style="color:#F07B24;">VOCÊ!</span></h1>`,
        { textAlign: "center", fontSize: "48", fontWeight: "900" }, 0);
      const subtitle = makeEditor(col.id, pt,
        `<p style="color:#FFFFFF;opacity:0.9;font-size:18px;">Olá, <strong>{{cliente_nome}}</strong>.<br/>Desenvolvemos uma engenharia exclusiva para sua residência em <strong>{{cliente_cidade}} - {{cliente_estado}}</strong>.</p>`,
        { textAlign: "center", fontSize: "18", color: "#FFFFFF" }, 1);
      const cta = makeEditor(col.id, pt,
        `<div style="margin-top:24px;"><a href="#configuracao" style="display:inline-block;background:#F07B24;color:#FFF;padding:14px 32px;border-radius:8px;font-weight:700;text-decoration:none;font-size:14px;text-transform:uppercase;letter-spacing:1px;">Configurar Meu Kit →</a></div>`,
        { textAlign: "center" }, 2);
      return [sec, col, title, subtitle, cta];
    },
  },
  {
    label: "KPIs — Métricas Destaque",
    description: "3 cards: Potência, Geração, Economia",
    icon: Zap,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: "#F8FAFC", paddingTop: "30", paddingBottom: "30" });
      const kpis = [
        { icon: "⚡", label: "POTÊNCIA DO SISTEMA", value: "{{potencia_kwp}}" },
        { icon: "☀️", label: "GERAÇÃO ESTIMADA", value: "{{geracao_media_mensal}} kWh/mês" },
        { icon: "📈", label: "ECONOMIA ANUAL", value: "R$ {{economia_anual}}" },
      ];
      const blocks: TemplateBlock[] = [sec];
      kpis.forEach((kpi, i) => {
        const col = makeColumn(sec.id, pt, 33, {
          backgroundColor: "#FFFFFF", borderRadius: "16", borderWidth: "1", borderColor: "#E2E8F0",
          paddingTop: "24", paddingBottom: "24", alignItems: "center",
        });
        col.order = i;
        col.style.boxShadow = "0 1px 3px rgba(0,0,0,0.08)";
        const iconEl = makeEditor(col.id, pt,
          `<div style="font-size:32px;text-align:center;">${kpi.icon}</div>`,
          { textAlign: "center", fontSize: "32" }, 0);
        const label = makeEditor(col.id, pt,
          `<p style="font-size:10px;font-weight:600;letter-spacing:2px;color:#94A3B8;text-transform:uppercase;margin-top:8px;">${kpi.label}</p>`,
          { textAlign: "center", fontSize: "10", color: "#94A3B8" }, 1);
        const value = makeEditor(col.id, pt,
          `<p style="font-size:24px;font-weight:700;color:#1E293B;">${kpi.value}</p>`,
          { textAlign: "center", fontSize: "24", fontWeight: "700" }, 2);
        blocks.push(col, iconEl, label, value);
      });
      return blocks;
    },
  },
  {
    label: "Comparativo de Kits",
    description: "3 colunas: Custo-benefício, Versátil, Performance",
    icon: LayoutTemplate,
    blocks: (pt) => {
      const sec = makeSection(pt, { paddingTop: "40", paddingBottom: "40" });
      const header = makeEditor(null as any, pt, "", {});
      // create a header column
      const headerCol = makeColumn(sec.id, pt, 100);
      headerCol.order = 0;
      const headerText = makeEditor(headerCol.id, pt,
        `<h2 style="font-size:28px;font-weight:800;font-style:italic;color:#1E293B;">DIMENSIONAMENTO</h2><p style="color:#64748B;font-size:14px;">Selecione o nível tecnológico do seu investimento solar.</p>`,
        { fontSize: "28", fontWeight: "800" }, 0);

      const kits = [
        { name: "Kit Essencial", tag: "CUSTO-BENEFÍCIO", tagColor: "#F07B24", highlight: true },
        { name: "Kit Híbrido", tag: "MAIS VERSÁTIL", tagColor: "#3B82F6", highlight: false },
        { name: "Kit Elite", tag: "ALTA PERFORMANCE", tagColor: "#64748B", highlight: false },
      ];
      const blocks: TemplateBlock[] = [sec, headerCol, headerText];
      kits.forEach((kit, i) => {
        const col = makeColumn(sec.id, pt, 33, {
          backgroundColor: "#FFFFFF", borderRadius: "16",
          borderWidth: kit.highlight ? "2" : "1",
          borderColor: kit.highlight ? "#1B3A8C" : "#E2E8F0",
          paddingTop: "24", paddingBottom: "24",
        });
        col.order = i + 1;
        col.style.boxShadow = kit.highlight ? "0 8px 30px rgba(27,58,140,0.12)" : "0 1px 3px rgba(0,0,0,0.08)";
        const tag = makeEditor(col.id, pt,
          `<div style="display:inline-block;background:${kit.tagColor};color:#FFF;padding:4px 12px;border-radius:20px;font-size:10px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${kit.tag}</div>`,
          { textAlign: "center" }, 0);
        const name = makeEditor(col.id, pt,
          `<h3 style="font-size:20px;font-weight:700;margin-top:16px;">${kit.name}</h3><p style="color:#F07B24;font-size:12px;font-weight:600;text-transform:uppercase;">Tecnologia Premium</p>`,
          { textAlign: "left", fontSize: "20", fontWeight: "700" }, 1);
        const specs = makeEditor(col.id, pt,
          `<div style="margin-top:16px;font-size:13px;color:#64748B;line-height:2;">
            <div>🔌 <strong>{{inversor_modelo}}</strong></div>
            <div>☀️ <strong>{{modulo_modelo}} {{modulo_potencia}}</strong></div>
            <div>🛡️ <strong>Garantia: {{inversor_garantia}}</strong></div>
          </div>`,
          { fontSize: "13" }, 2);
        const price = makeEditor(col.id, pt,
          `<div style="margin-top:20px;border-top:1px solid #E2E8F0;padding-top:16px;">
            <span style="font-size:11px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;">Investimento no Kit</span><br/>
            <span style="font-size:28px;font-weight:800;color:#1E293B;">R$ {{valor_total}}</span>
          </div>`,
          { fontSize: "28", fontWeight: "800" }, 3);
        blocks.push(col, tag, name, specs, price);
      });
      return blocks;
    },
  },
  {
    label: "Análise ROI — Payback",
    description: "Payback + gráfico de evolução financeira",
    icon: BarChart3,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: "#F8FAFC", paddingTop: "40", paddingBottom: "40" });
      const colLeft = makeColumn(sec.id, pt, 45, {
        backgroundColor: "#1B3A8C", borderRadius: "20", paddingTop: "32", paddingBottom: "32", paddingLeft: "28", paddingRight: "28",
      });
      colLeft.order = 0;
      const badge = makeEditor(colLeft.id, pt,
        `<div style="display:inline-block;border:1px solid rgba(255,255,255,0.3);padding:4px 12px;border-radius:20px;font-size:10px;color:#FFF;font-weight:600;letter-spacing:1px;text-transform:uppercase;">VISÃO DO INVESTIDOR</div>`,
        { textAlign: "left" }, 0);
      const headline = makeEditor(colLeft.id, pt,
        `<h2 style="font-size:32px;font-weight:900;color:#FFFFFF;font-style:italic;line-height:1.15;margin-top:16px;">SEU CAPITAL DE VOLTA<br/>EM TEMPO RECORDE</h2>`,
        { fontSize: "32", fontWeight: "900", color: "#FFFFFF" }, 1);
      const desc = makeEditor(colLeft.id, pt,
        `<p style="color:rgba(255,255,255,0.8);font-size:14px;margin-top:12px;">Ao escolher seu kit, você garante o menor custo por kWh gerado da região.</p>`,
        { fontSize: "14", color: "#FFFFFF" }, 2);
      const payback = makeEditor(colLeft.id, pt,
        `<div style="margin-top:24px;"><span style="font-size:56px;font-weight:900;color:#F07B24;">{{payback}}</span> <span style="font-size:18px;color:#FFFFFF;font-weight:700;">ANOS</span></div><p style="font-size:11px;color:rgba(255,255,255,0.6);text-transform:uppercase;letter-spacing:1px;font-weight:600;">Tempo estimado de payback</p>`,
        { fontSize: "56" }, 3);

      const colRight = makeColumn(sec.id, pt, 55, {
        backgroundColor: "#FFFFFF", borderRadius: "20", borderWidth: "1", borderColor: "#E2E8F0",
        paddingTop: "24", paddingBottom: "24",
      });
      colRight.order = 1;
      colRight.style.boxShadow = "0 4px 14px rgba(0,0,0,0.06)";
      const chartTitle = makeEditor(colRight.id, pt,
        `<h3 style="font-size:16px;font-weight:700;color:#1E293B;display:flex;align-items:center;gap:8px;">📈 <strong>EVOLUÇÃO FINANCEIRA</strong></h3>`,
        { fontSize: "16", fontWeight: "700" }, 0);
      const chart = makeEditor(colRight.id, pt,
        `<div data-widget="chart-analise-financeira" style="min-height:250px;"></div>`,
        {}, 1);

      return [sec, colLeft, badge, headline, desc, payback, colRight, chartTitle, chart];
    },
  },
  {
    label: "KPIs Financeiros",
    description: "4 métricas: Lucro, Valorização, Economia, Bandeira",
    icon: DollarSign,
    blocks: (pt) => {
      const sec = makeSection(pt, { paddingTop: "20", paddingBottom: "20" });
      const kpis = [
        { label: "LUCRO EM 10 ANOS", value: "R$ {{lucro_10_anos}}", color: "#1B3A8C" },
        { label: "VALORIZAÇÃO IMÓVEL", value: "+ {{valorizacao_imovel}}%", color: "#10B981" },
        { label: "ECONOMIA 25 ANOS", value: "R$ {{economia_25_anos}}", color: "#F07B24" },
        { label: "BANDEIRA TARIFÁRIA", value: "{{bandeira_tarifaria}}", color: "#1E293B" },
      ];
      const blocks: TemplateBlock[] = [sec];
      kpis.forEach((kpi, i) => {
        const col = makeColumn(sec.id, pt, 25, {
          paddingTop: "16", paddingBottom: "16", alignItems: "center",
        });
        col.order = i;
        const label = makeEditor(col.id, pt,
          `<p style="font-size:10px;font-weight:600;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;">${kpi.label}</p>`,
          { textAlign: "center", fontSize: "10" }, 0);
        const value = makeEditor(col.id, pt,
          `<p style="font-size:22px;font-weight:800;color:${kpi.color};">${kpi.value}</p>`,
          { textAlign: "center", fontSize: "22", fontWeight: "800", color: kpi.color }, 1);
        blocks.push(col, label, value);
      });
      return blocks;
    },
  },
  {
    label: "Segurança e Pós-Venda",
    description: "Seguro + Manutenção com toggles",
    icon: Shield,
    blocks: (pt) => {
      const sec = makeSection(pt, { backgroundColor: "#F1F5F9", borderRadius: "20", paddingTop: "32", paddingBottom: "32" });
      const headerCol = makeColumn(sec.id, pt, 100);
      headerCol.order = 0;
      const header = makeEditor(headerCol.id, pt,
        `<h3 style="font-size:20px;font-weight:800;font-style:italic;display:flex;align-items:center;gap:8px;">🛡️ <strong>SEGURANÇA E PÓS-VENDA</strong></h3>`,
        { fontSize: "20", fontWeight: "800" }, 0);
      const col1 = makeColumn(sec.id, pt, 50, {
        backgroundColor: "#FFFFFF", borderRadius: "12", borderWidth: "1", borderColor: "#E2E8F0",
        paddingTop: "20", paddingBottom: "20",
      });
      col1.order = 1;
      const seg = makeEditor(col1.id, pt,
        `<div><strong style="font-size:14px;">SEGURO DE RISCOS NOMINADOS</strong><p style="font-size:11px;color:#94A3B8;margin-top:4px;">Proteção total contra granizo e vendaval</p></div><div style="text-align:right;font-size:18px;font-weight:700;color:#1E293B;">R$ 350</div>`,
        {}, 0);
      const col2 = makeColumn(sec.id, pt, 50, {
        backgroundColor: "#FFFFFF", borderRadius: "12", borderWidth: "1", borderColor: "#E2E8F0",
        paddingTop: "20", paddingBottom: "20",
      });
      col2.order = 2;
      const maint = makeEditor(col2.id, pt,
        `<div><strong style="font-size:14px;">MANUTENÇÃO PREVENTIVA</strong><p style="font-size:11px;color:#94A3B8;margin-top:4px;">2 limpezas e revisão técnica anual</p></div><div style="text-align:right;font-size:18px;font-weight:700;color:#1E293B;">R$ 450</div>`,
        {}, 0);
      return [sec, headerCol, header, col1, seg, col2, maint];
    },
  },
  {
    label: "Rodapé — Contato",
    description: "Logo + cidades + telefone + site",
    icon: Phone,
    blocks: (pt) => {
      const sec = makeSection(pt, { paddingTop: "30", paddingBottom: "30", borderWidth: "1", borderColor: "#E2E8F0" });
      const colLeft = makeColumn(sec.id, pt, 60);
      colLeft.order = 0;
      const logo = makeEditor(colLeft.id, pt,
        `<h3 style="font-size:22px;font-weight:900;font-style:italic;color:#1E293B;">{{empresa_nome}}</h3><p style="font-size:11px;color:#94A3B8;margin-top:4px;">{{empresa_cidade}} - {{empresa_estado}}</p>`,
        { fontSize: "22" }, 0);
      const colRight = makeColumn(sec.id, pt, 40, { alignItems: "flex-end" });
      colRight.order = 1;
      const contact = makeEditor(colRight.id, pt,
        `<div style="text-align:right;"><p style="font-size:10px;color:#94A3B8;text-transform:uppercase;letter-spacing:1px;">Suporte Comercial</p><p style="font-size:18px;font-weight:700;color:#1E293B;">📱 {{empresa_telefone}}</p><p style="font-size:12px;color:#3B82F6;">{{empresa_site}}</p></div>`,
        { textAlign: "right" }, 0);
      return [sec, colLeft, logo, colRight, contact];
    },
  },
];

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
