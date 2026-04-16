/**
 * ProposalDadosView.tsx
 *
 * Premium Bento Grid — visual summary of proposal data.
 * §DS-02 cards, RB-01 semantic colors, RB-20 responsive grids.
 * Framer Motion for staggered entrance (BP-01).
 * SSOT: Uses normalizeProposalSnapshot for safe data access.
 */

import { normalizeProposalSnapshot } from "@/domain/proposal/normalizeProposalSnapshot";
import { formatBRL } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Sun, DollarSign, Zap, Clock, TrendingUp, Battery,
  Building2, Gauge, ArrowDownRight, Percent, PanelTop, PlugZap,
  Wallet, CreditCard, Receipt,
} from "lucide-react";

interface ProposalDadosViewProps {
  snapshot: Record<string, unknown> | null;
  valorTotal?: number;
  geracaoMensal?: number;
  economiaMensal?: number;
}

// ─── Animation variants ─────────────────────────────────
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.07 } },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 260, damping: 24 } },
};

// ─── Hero KPI card (big number) ─────────────────────────
function HeroKpi({
  icon: Icon,
  label,
  value,
  sub,
  accent = "primary",
}: {
  icon: any;
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "success" | "warning" | "info";
}) {
  const colorMap = {
    primary: { border: "border-l-primary", bg: "bg-primary/10", text: "text-primary" },
    success: { border: "border-l-success", bg: "bg-success/10", text: "text-success" },
    warning: { border: "border-l-warning", bg: "bg-warning/10", text: "text-warning" },
    info: { border: "border-l-info", bg: "bg-info/10", text: "text-info" },
  };
  const c = colorMap[accent];
  return (
    <motion.div variants={item}>
      <Card className={`bg-card border-border shadow-sm hover:shadow-md transition-shadow border-l-[3px] ${c.border}`}>
        <CardContent className="p-5 flex items-start gap-4">
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${c.bg} shrink-0`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground leading-none mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Data row for detail sections ───────────────────────
function DataRow({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="shrink-0 w-7 h-7 rounded-lg bg-muted/50 flex items-center justify-center">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0 flex items-baseline justify-between gap-2">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <p className="text-sm font-semibold text-foreground whitespace-nowrap">{value || "—"}</p>
      </div>
    </div>
  );
}

// ─── Section card ───────────────────────────────────────
function SectionCard({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <motion.div variants={item}>
      <Card className="bg-card border-border shadow-sm hover:shadow-md transition-shadow h-full">
        <CardContent className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="w-4 h-4 text-primary" />
            </div>
            <h3 className="text-base font-semibold text-foreground">{title}</h3>
          </div>
          <div className="space-y-0.5">{children}</div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export function ProposalDadosView({
  snapshot,
  valorTotal,
  geracaoMensal,
  economiaMensal,
}: ProposalDadosViewProps) {
  const norm = normalizeProposalSnapshot(snapshot);
  const raw = (snapshot || {}) as Record<string, any>;

  const precoFinal = valorTotal ?? norm.itens.reduce((s, i) => s + i.quantidade * i.preco_unitario, 0);
  const geracaoMensalKwh = geracaoMensal ?? norm.geracaoMensalEstimada;
  const geracaoAnual = raw.geracao_anual ? Number(raw.geracao_anual) : (geracaoMensalKwh * 12);

  // Financial
  const custoEquip = norm.custoKit || norm.venda.custo_kit || 0;
  const custoInstalacao = norm.venda.custo_instalacao || 0;
  const desconto = norm.venda.desconto_percentual || 0;
  const tir = norm.tir || raw.tir || 0;
  const vpl = norm.vpl || raw.vpl || 0;
  const paybackMeses = norm.paybackMeses || raw.payback_meses || raw.paybackMeses || 0;

  // Energy
  const consumoMensal = norm.consumoTotal || raw.consumo_mensal || 0;
  const economiaPct = raw.economia_mensal_percent || raw.economiaPct || 0;
  const tarifaDist = raw.tarifa_distribuidora || raw.locTarifaDistribuidora || 0;
  const custoDisp = raw.custo_disponibilidade || raw.custoDemanda || 0;
  const sobredim = norm.premissas.sobredimensionamento || raw.sobredimensionamento || 0;
  const perdaEfic = norm.premissas.perda_eficiencia_anual || 0;
  const inflacaoEnergetica = norm.premissas.inflacao_energetica || 0;

  // Payback
  const paybackDisplay = (() => {
    if (!paybackMeses || paybackMeses <= 0) return "—";
    const anos = Math.floor(paybackMeses / 12);
    const meses = Math.round(paybackMeses % 12);
    if (anos === 0) return `${meses} meses`;
    if (meses === 0) return `${anos} anos`;
    return `${anos}a ${meses}m`;
  })();

  // System
  const telhado = norm.locTipoTelhado || "—";
  const estrutura = raw.estrutura || raw.locEstrutura || "—";
  const moduloItem = norm.itens.find(i => i.categoria === "modulo" || i.categoria === "modulos");
  const inversorItem = norm.itens.find(i => i.categoria === "inversor" || i.categoria === "inversores");
  const moduloDesc = moduloItem ? `${moduloItem.fabricante} ${moduloItem.modelo}`.trim() || moduloItem.descricao : "—";
  const inversorDesc = inversorItem ? `${inversorItem.fabricante} ${inversorItem.modelo}`.trim() || inversorItem.descricao : "—";
  const qtdModulos = moduloItem?.quantidade || raw.panel_quantity || 0;
  const qtdInversores = inversorItem?.quantidade || raw.inverter_quantity || 0;
  const garantia = raw.garantia || raw.warranty || "—";

  // Pagamento
  const pagOpcoes = norm.pagamentoOpcoes;

  const economiaMensalVal = economiaMensal ?? 0;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-4 mt-3"
    >
      {/* ═══ HERO KPIs — Bento Grid ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <HeroKpi
          icon={DollarSign}
          label="Investimento"
          value={formatBRL(precoFinal)}
          accent="primary"
        />
        <HeroKpi
          icon={TrendingUp}
          label="Economia Mensal"
          value={economiaMensalVal > 0 ? formatBRL(economiaMensalVal) : "—"}
          sub={economiaPct > 0 ? `${economiaPct.toFixed(1).replace(".", ",")}% de redução` : undefined}
          accent="success"
        />
        <HeroKpi
          icon={Clock}
          label="Payback"
          value={paybackDisplay}
          sub={paybackMeses > 0 ? `${paybackMeses} meses` : undefined}
          accent="warning"
        />
        <HeroKpi
          icon={Sun}
          label="Geração Mensal"
          value={geracaoMensalKwh > 0 ? `${geracaoMensalKwh.toLocaleString("pt-BR", { maximumFractionDigits: 0 })} kWh` : "—"}
          sub={geracaoAnual > 0 ? `${(geracaoAnual / 1000).toFixed(1).replace(".", ",")} MWh/ano` : undefined}
          accent="info"
        />
      </div>

      {/* ═══ DETAIL SECTIONS — Bento Grid 2×2 ═══ */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Sistema */}
        <SectionCard title="Sistema" icon={PanelTop}>
          <DataRow icon={Building2} label="Telhado" value={telhado} />
          <DataRow icon={Gauge} label="Estrutura" value={estrutura} />
          <DataRow icon={PanelTop} label="Módulo" value={moduloDesc} />
          <DataRow icon={Battery} label="Qtd Módulos" value={String(qtdModulos || "—")} />
          <DataRow icon={PlugZap} label="Inversor" value={inversorDesc} />
          <DataRow icon={Battery} label="Qtd Inversores" value={String(qtdInversores || "—")} />
          <DataRow icon={Clock} label="Garantia" value={String(garantia)} />
        </SectionCard>

        {/* Financeiro */}
        <SectionCard title="Financeiro" icon={DollarSign}>
          <DataRow icon={Receipt} label="Custo Equipamento" value={custoEquip > 0 ? formatBRL(custoEquip) : "—"} />
          <DataRow icon={Receipt} label="Custo Instalação" value={custoInstalacao > 0 ? formatBRL(custoInstalacao) : "—"} />
          <DataRow icon={ArrowDownRight} label="Desconto" value={desconto > 0 ? `${desconto}%` : "—"} />
          <DataRow icon={Percent} label="TIR" value={tir > 0 ? `${tir.toFixed(2).replace(".", ",")}%` : "—"} />
          <DataRow icon={DollarSign} label="VPL" value={vpl > 0 ? formatBRL(vpl) : "—"} />
          <DataRow icon={Clock} label="Payback" value={paybackDisplay} />
        </SectionCard>

        {/* Energia */}
        <SectionCard title="Energia" icon={Zap}>
          <DataRow icon={Gauge} label="Consumo Mensal" value={consumoMensal > 0 ? `${consumoMensal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} kWh` : "—"} />
          <DataRow icon={Sun} label="Geração Anual" value={geracaoAnual > 0 ? `${geracaoAnual.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} kWh` : "—"} />
          <DataRow icon={Percent} label="Economia %" value={economiaPct > 0 ? `${economiaPct.toFixed(2).replace(".", ",")}%` : "—"} />
          <DataRow icon={DollarSign} label="Tarifa" value={tarifaDist > 0 ? `R$ ${tarifaDist.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}` : "—"} />
          <DataRow icon={DollarSign} label="Custo Disponibilidade" value={custoDisp > 0 ? formatBRL(custoDisp) : "—"} />
          <DataRow icon={TrendingUp} label="Sobredimensionamento" value={sobredim > 0 ? `${sobredim.toFixed(2).replace(".", ",")}%` : "—"} />
          <DataRow icon={ArrowDownRight} label="Perda/Ano" value={perdaEfic > 0 ? `${perdaEfic.toFixed(2).replace(".", ",")}%` : "—"} />
          <DataRow icon={TrendingUp} label="Inflação Energética" value={inflacaoEnergetica > 0 ? `${inflacaoEnergetica.toFixed(2).replace(".", ",")}%` : "—"} />
        </SectionCard>

        {/* Pagamento */}
        <SectionCard title="Pagamento" icon={Wallet}>
          {pagOpcoes.length > 0 ? (
            pagOpcoes.map((p, i) => {
              const isAVista = p.tipo === "a_vista" || /vista|avista/i.test(p.nome);
              return (
                <div key={p.id || i} className="py-2 border-b border-border/50 last:border-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CreditCard className="h-3.5 w-3.5 text-primary" />
                    <p className="text-xs font-semibold text-primary">{p.nome || (isAVista ? "À vista" : `Opção ${i + 1}`)}</p>
                  </div>
                  <p className="text-lg font-bold text-foreground tracking-tight">
                    {isAVista
                      ? formatBRL(precoFinal)
                      : p.num_parcelas > 0
                        ? `${p.num_parcelas}x de ${formatBRL(p.valor_parcela)}`
                        : formatBRL(precoFinal)
                    }
                  </p>
                  {!isAVista && p.entrada > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">Entrada: {formatBRL(p.entrada)}</p>
                  )}
                </div>
              );
            })
          ) : (
            <p className="text-sm text-muted-foreground py-3">Sem opções de financiamento</p>
          )}
        </SectionCard>
      </div>
    </motion.div>
  );
}
