/**
 * ProposalDadosView.tsx
 *
 * Landing Page de Alta Conversão — visual summary of proposal data.
 * §DS-02 cards, RB-01 semantic colors, RB-20 responsive grids, RB-21 shadows.
 * Framer Motion for staggered entrance (BP-01).
 * SSOT: Uses normalizeProposalSnapshot for safe data access.
 * DA-37: Financial data consumed from canonical motors.
 */

import { normalizeProposalSnapshot } from "@/domain/proposal/normalizeProposalSnapshot";
import { formatBRL, formatBRLCompact } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { motion } from "framer-motion";
import {
  Sun, DollarSign, Zap, Clock, TrendingUp, Battery,
  Building2, Gauge, ArrowDownRight, Percent, PanelTop, PlugZap,
  Wallet, CreditCard, Receipt, Leaf, ShieldCheck, BarChart3,
  ChevronDown,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface ProposalDadosViewProps {
  snapshot: Record<string, unknown> | null;
  valorTotal?: number;
  geracaoMensal?: number;
  economiaMensal?: number;
}

// ─── Animation variants ─────────────────────────────────
const container = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08 } },
};

const item = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 240, damping: 22 } },
};

const fadeUp = {
  hidden: { opacity: 0, y: 32 },
  show: { opacity: 1, y: 0, transition: { type: "spring" as const, stiffness: 200, damping: 26, delay: 0.1 } },
};

// ─── Hero KPI card (big number) ─────────────────────────
function HeroKpi({
  icon: Icon,
  label,
  value,
  sub,
  accent = "primary",
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  accent?: "primary" | "success" | "warning" | "info";
}) {
  const colorMap = {
    primary: { border: "border-l-primary", bg: "bg-primary/10", text: "text-primary", glow: "shadow-primary/5" },
    success: { border: "border-l-success", bg: "bg-success/10", text: "text-success", glow: "shadow-success/5" },
    warning: { border: "border-l-warning", bg: "bg-warning/10", text: "text-warning", glow: "shadow-warning/5" },
    info: { border: "border-l-info", bg: "bg-info/10", text: "text-info", glow: "shadow-info/5" },
  };
  const c = colorMap[accent];
  return (
    <motion.div variants={item}>
      <Card className={`bg-card border-border shadow-sm hover:shadow-lg transition-all duration-300 border-l-[3px] ${c.border} group`}>
        <CardContent className="p-5 flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${c.bg} shrink-0 group-hover:scale-110 transition-transform duration-300`}>
            <Icon className={`w-5 h-5 ${c.text}`} />
          </div>
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground uppercase tracking-wider font-medium">{label}</p>
            <p className="text-2xl font-bold tracking-tight text-foreground leading-none mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-1.5">{sub}</p>}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Data row for detail sections ───────────────────────
function DataRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2">
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
function SectionCard({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <motion.div variants={item}>
      <Card className="bg-card border-border shadow-sm hover:shadow-lg transition-all duration-300 h-full">
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

// ─── Comparison Bar (A Dor vs A Solução) ────────────────
function ComparisonBar({
  labelA,
  labelB,
  valueA,
  valueB,
}: {
  labelA: string;
  labelB: string;
  valueA: number;
  valueB: number;
}) {
  const maxVal = Math.max(valueA, valueB, 1);
  const pctA = (valueA / maxVal) * 100;
  const pctB = (valueB / maxVal) * 100;

  return (
    <div className="space-y-3">
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-muted-foreground">{labelA}</span>
          <span className="text-sm font-bold text-muted-foreground">{formatBRL(valueA)}</span>
        </div>
        <div className="h-3 rounded-full bg-muted/40 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-muted-foreground/30"
            initial={{ width: 0 }}
            animate={{ width: `${pctA}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.3 }}
          />
        </div>
      </div>
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs font-medium text-primary">{labelB}</span>
          <span className="text-sm font-bold text-primary">{formatBRL(valueB)}</span>
        </div>
        <div className="h-3 rounded-full bg-primary/10 overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${pctB}%` }}
            transition={{ duration: 0.8, ease: "easeOut", delay: 0.5 }}
          />
        </div>
      </div>
    </div>
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

  // Economia total estimada (25 anos)
  const economiaAnual = economiaMensalVal * 12;
  const economiaTotal25 = economiaAnual * 25;

  // Custo SEM solar vs COM solar (mensal estimado)
  const custoSemSolar = consumoMensal > 0 && tarifaDist > 0
    ? consumoMensal * tarifaDist
    : economiaMensalVal > 0 ? economiaMensalVal * 2 : 0;
  const custoComSolar = custoSemSolar - economiaMensalVal;

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-8 mt-3"
    >
      {/* ═══ HERO SECTION — O Impacto ═══ */}
      <motion.div variants={fadeUp}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-background to-background border border-border p-6 sm:p-8">
          {/* Decorative circles */}
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-primary/5 blur-2xl" />
          <div className="absolute -bottom-8 -left-8 w-32 h-32 rounded-full bg-success/5 blur-2xl" />

          <div className="relative z-10 text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-success/10 border border-success/20">
              <Leaf className="w-3.5 h-3.5 text-success" />
              <span className="text-xs font-medium text-success">Economia estimada em 25 anos</span>
            </div>

            <motion.p
              className="text-5xl sm:text-6xl font-extrabold tracking-tight text-foreground leading-none"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
            >
              {economiaTotal25 > 0 ? formatBRLCompact(economiaTotal25) : formatBRL(economiaTotal25)}
            </motion.p>

            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              {economiaMensalVal > 0
                ? `Economia de ${formatBRL(economiaMensalVal)}/mês com retorno em ${paybackDisplay}`
                : "Solicite uma simulação personalizada para ver sua economia"}
            </p>
          </div>
        </div>
      </motion.div>

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

      {/* ═══ COMPARISON — A Dor vs A Solução ═══ */}
      {custoSemSolar > 0 && (
        <motion.div variants={item}>
          <Card className="bg-card border-border shadow-sm hover:shadow-lg transition-all duration-300">
            <CardContent className="p-6">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <BarChart3 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-foreground">Comparativo Mensal</h3>
                  <p className="text-xs text-muted-foreground">Sua conta de energia antes e depois da solar</p>
                </div>
              </div>

              <ComparisonBar
                labelA="Sem Solar"
                labelB="Com Solar"
                valueA={custoSemSolar}
                valueB={custoComSolar > 0 ? custoComSolar : 0}
              />

              {economiaMensalVal > 0 && (
                <div className="mt-4 pt-4 border-t border-border flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-4 h-4 text-success" />
                    <span className="text-xs font-medium text-muted-foreground">Economia mensal</span>
                  </div>
                  <span className="text-lg font-bold text-success">{formatBRL(economiaMensalVal)}</span>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* ═══ DETAIL SECTIONS — Bento Grid (Desktop) / Accordion (Mobile) ═══ */}
      {/* Desktop: grid */}
      <div className="hidden sm:grid sm:grid-cols-2 gap-4">
        <SectionCard title="Sistema" icon={PanelTop}>
          <DataRow icon={Building2} label="Telhado" value={telhado} />
          <DataRow icon={Gauge} label="Estrutura" value={estrutura} />
          <DataRow icon={PanelTop} label="Módulo" value={moduloDesc} />
          <DataRow icon={Battery} label="Qtd Módulos" value={String(qtdModulos || "—")} />
          <DataRow icon={PlugZap} label="Inversor" value={inversorDesc} />
          <DataRow icon={Battery} label="Qtd Inversores" value={String(qtdInversores || "—")} />
          <DataRow icon={Clock} label="Garantia" value={String(garantia)} />
        </SectionCard>

        <SectionCard title="Financeiro" icon={DollarSign}>
          <DataRow icon={Receipt} label="Custo Equipamento" value={custoEquip > 0 ? formatBRL(custoEquip) : "—"} />
          <DataRow icon={Receipt} label="Custo Instalação" value={custoInstalacao > 0 ? formatBRL(custoInstalacao) : "—"} />
          <DataRow icon={ArrowDownRight} label="Desconto" value={desconto > 0 ? `${desconto}%` : "—"} />
          <DataRow icon={Percent} label="TIR" value={tir > 0 ? `${tir.toFixed(2).replace(".", ",")}%` : "—"} />
          <DataRow icon={DollarSign} label="VPL" value={vpl > 0 ? formatBRL(vpl) : "—"} />
          <DataRow icon={Clock} label="Payback" value={paybackDisplay} />
        </SectionCard>

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

      {/* Mobile: Accordion */}
      <div className="sm:hidden">
        <Accordion type="multiple" className="space-y-2">
          <AccordionItem value="sistema" className="border border-border rounded-lg overflow-hidden bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <PanelTop className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Sistema</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <DataRow icon={Building2} label="Telhado" value={telhado} />
              <DataRow icon={Gauge} label="Estrutura" value={estrutura} />
              <DataRow icon={PanelTop} label="Módulo" value={moduloDesc} />
              <DataRow icon={Battery} label="Qtd Módulos" value={String(qtdModulos || "—")} />
              <DataRow icon={PlugZap} label="Inversor" value={inversorDesc} />
              <DataRow icon={Battery} label="Qtd Inversores" value={String(qtdInversores || "—")} />
              <DataRow icon={Clock} label="Garantia" value={String(garantia)} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="financeiro" className="border border-border rounded-lg overflow-hidden bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Financeiro</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <DataRow icon={Receipt} label="Custo Equipamento" value={custoEquip > 0 ? formatBRL(custoEquip) : "—"} />
              <DataRow icon={Receipt} label="Custo Instalação" value={custoInstalacao > 0 ? formatBRL(custoInstalacao) : "—"} />
              <DataRow icon={ArrowDownRight} label="Desconto" value={desconto > 0 ? `${desconto}%` : "—"} />
              <DataRow icon={Percent} label="TIR" value={tir > 0 ? `${tir.toFixed(2).replace(".", ",")}%` : "—"} />
              <DataRow icon={DollarSign} label="VPL" value={vpl > 0 ? formatBRL(vpl) : "—"} />
              <DataRow icon={Clock} label="Payback" value={paybackDisplay} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="energia" className="border border-border rounded-lg overflow-hidden bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Energia</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
              <DataRow icon={Gauge} label="Consumo Mensal" value={consumoMensal > 0 ? `${consumoMensal.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} kWh` : "—"} />
              <DataRow icon={Sun} label="Geração Anual" value={geracaoAnual > 0 ? `${geracaoAnual.toLocaleString("pt-BR", { minimumFractionDigits: 0 })} kWh` : "—"} />
              <DataRow icon={Percent} label="Economia %" value={economiaPct > 0 ? `${economiaPct.toFixed(2).replace(".", ",")}%` : "—"} />
              <DataRow icon={DollarSign} label="Tarifa" value={tarifaDist > 0 ? `R$ ${tarifaDist.toLocaleString("pt-BR", { minimumFractionDigits: 4 })}` : "—"} />
              <DataRow icon={DollarSign} label="Custo Disponibilidade" value={custoDisp > 0 ? formatBRL(custoDisp) : "—"} />
            </AccordionContent>
          </AccordionItem>

          <AccordionItem value="pagamento" className="border border-border rounded-lg overflow-hidden bg-card">
            <AccordionTrigger className="px-4 py-3 hover:no-underline">
              <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Pagamento</span>
              </div>
            </AccordionTrigger>
            <AccordionContent className="px-4 pb-3">
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
            </AccordionContent>
          </AccordionItem>
        </Accordion>
      </div>
    </motion.div>
  );
}
