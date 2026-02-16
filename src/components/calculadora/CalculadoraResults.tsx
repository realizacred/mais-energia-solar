import { useMemo, useState } from "react";
import { getPublicUrl } from "@/lib/getPublicUrl";
import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Sun,
  TrendingDown,
  Leaf,
  Calendar,
  DollarSign,
  Zap,
  Share2,
  Check,
  TreePine,
  Info,
  MessageCircle,
} from "lucide-react";
import type { PaybackResult } from "@/hooks/usePaybackEngine";
import { PaybackProfessionalResults } from "@/components/payback/PaybackProfessionalResults";
import { EconomiaAcumuladaChart } from "./EconomiaAcumuladaChart";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";

interface CalculadoraResultsProps {
  consumoMensal: number;
  tarifaKwh: number;
  config: {
    custo_por_kwp: number;
    geracao_mensal_por_kwp: number;
    kg_co2_por_kwh: number;
    percentual_economia: number;
    fator_perdas_percentual?: number;
  };
  paybackResult?: PaybackResult | null;
  reajusteAnualTarifa?: number;
  degradacaoAnualPainel?: number;
  geracaoRegional?: number; // kWh/kWp from irradiation table
  custoKwpAjustado?: number; // from cost range table
}

function AnimatedCurrency({ value, className }: { value: number; className?: string }) {
  const animated = useAnimatedCounter(value, 1800);
  return (
    <span className={className}>
      {new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      }).format(animated)}
    </span>
  );
}

function AnimatedNumber({ value, suffix = "", decimals = 1, className }: { value: number; suffix?: string; decimals?: number; className?: string }) {
  const animated = useAnimatedCounter(value, 1800);
  return (
    <span className={className}>{animated.toFixed(decimals)}{suffix}</span>
  );
}

export function CalculadoraResults({
  consumoMensal,
  tarifaKwh,
  config,
  paybackResult,
  reajusteAnualTarifa = 5,
  degradacaoAnualPainel = 0.8,
  geracaoRegional,
  custoKwpAjustado,
}: CalculadoraResultsProps) {
  const [copied, setCopied] = useState(false);

  const geracaoPorKwp = geracaoRegional || config.geracao_mensal_por_kwp;
  const custoKwp = custoKwpAjustado || config.custo_por_kwp;
  const fatorPerdas = 1 - (config.fator_perdas_percentual || 15) / 100;

  const kWp = consumoMensal / (geracaoPorKwp * fatorPerdas);
  const economiaMensal = consumoMensal * tarifaKwh * (config.percentual_economia / 100);
  const economiaAnual = economiaMensal * 12;
  const investimentoTotal = kWp * custoKwp;
  const co2Anual = (consumoMensal * config.kg_co2_por_kwh * 12) / 1000;
  const contaAtual = consumoMensal * tarifaKwh;
  const contaComSolar = contaAtual - economiaMensal;
  const arvoresEquivalentes = Math.round(co2Anual * 1000 / 22);

  // Projeção COMPOSTA 25 anos
  const economia25AnosComposta = useMemo(() => {
    let total = 0;
    const reajuste = 1 + reajusteAnualTarifa / 100;
    const degradacao = 1 - degradacaoAnualPainel / 100;
    for (let ano = 1; ano <= 25; ano++) {
      const fatorTarifa = Math.pow(reajuste, ano - 1);
      const fatorDeg = Math.pow(degradacao, ano - 1);
      total += economiaMensal * fatorTarifa * fatorDeg * 12;
    }
    return total;
  }, [economiaMensal, reajusteAnualTarifa, degradacaoAnualPainel]);

  const percentEconomia = contaAtual > 0 ? (economiaMensal / contaAtual) * 100 : 0;

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  const handleShare = async () => {
    const text = `☀️ Simulei minha economia com energia solar!\n\n💰 Economia mensal estimada: ${fmt(economiaMensal)}\n📊 Investimento estimado: ${fmt(investimentoTotal)}\n🌱 ${co2Anual.toFixed(1)} ton CO₂/ano evitados\n💵 Economia estimada em 25 anos: ${fmt(economia25AnosComposta)}\n\nSimule a sua: ${getPublicUrl()}/calculadora`;

    if (navigator.share) {
      try {
        await navigator.share({ title: "Minha Simulação Solar", text });
        return;
      } catch {}
    }

    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Professional payback results available
  if (paybackResult) {
    return (
      <div className="space-y-4">
        {/* Hero card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="bg-primary text-primary-foreground overflow-hidden shadow-md">
            <CardContent className="p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-primary-foreground/80 text-sm font-medium">
                    Investimento Estimado
                  </p>
                  <AnimatedCurrency value={investimentoTotal} className="text-3xl font-bold mt-1 tracking-tight block" />
                  <div className="flex items-center gap-3 mt-2 text-primary-foreground/90 flex-wrap">
                    <span className="flex items-center gap-1 text-sm">
                      <Sun className="w-4 h-4" />
                      <AnimatedNumber value={kWp} suffix=" kWp" />
                    </span>
                    <span className="flex items-center gap-1 text-sm">
                      <Leaf className="w-4 h-4" />
                      <AnimatedNumber value={co2Anual} suffix=" ton CO₂/ano" />
                    </span>
                  </div>
                </div>
                <div className="w-12 h-12 bg-primary-foreground/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <TrendingDown className="w-6 h-6" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Before/After Comparison */}
        <BeforeAfterComparison contaAtual={contaAtual} contaComSolar={contaComSolar} economiaMensal={economiaMensal} />

        {/* Dashboard Stats Grid */}
        <StatsGrid kWp={kWp} co2Anual={co2Anual} economiaMensal={economiaMensal} economiaAnual={economiaMensal * 12} arvoresEquivalentes={arvoresEquivalentes} />

        {/* 25 year savings — COMPOSTA */}
        <Savings25Years economia25Anos={economia25AnosComposta} arvoresEquivalentes={arvoresEquivalentes} />

        {/* Gráfico de projeção financeira */}
        <EconomiaAcumuladaChart
          investimento={investimentoTotal}
          economiaMensalAno1={economiaMensal}
          reajusteAnualTarifa={reajusteAnualTarifa}
          degradacaoAnualPainel={degradacaoAnualPainel}
        />

        {/* Professional payback results */}
        <PaybackProfessionalResults
          result={paybackResult}
          investimento={investimentoTotal}
          consumoMensal={consumoMensal}
          tarifaKwh={tarifaKwh}
        />

        {/* WhatsApp CTA */}
        <WhatsAppCTA economiaMensal={economiaMensal} />

        {/* Share button */}
        <ShareButton onShare={handleShare} copied={copied} />

        {/* DISCLAIMER OBRIGATÓRIO */}
        <Disclaimer fatorPerdas={config.fator_perdas_percentual || 15} geracaoRegional={!!geracaoRegional} />
      </div>
    );
  }

  // Fallback: simple results
  const payback = economiaAnual > 0 ? investimentoTotal / economiaAnual : 0;

  const stats = [
    { icon: Sun, label: "Potência Estimada", value: kWp, suffix: " kWp", accent: "text-secondary" },
    { icon: Calendar, label: "Retorno Estimado", value: payback, suffix: " anos", accent: "text-primary" },
    { icon: Leaf, label: "Redução de CO₂", value: co2Anual, suffix: " ton/ano", accent: "text-success" },
  ];

  return (
    <div className="space-y-4">
      {/* Hero savings card */}
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
        <Card className="bg-primary text-primary-foreground overflow-hidden shadow-md">
          <CardContent className="p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-primary-foreground/80 text-sm font-medium">Sua Economia Mensal Estimada</p>
                <AnimatedCurrency value={economiaMensal} className="text-3xl font-bold mt-1 tracking-tight block" />
                <div className="flex items-center gap-2 mt-2 text-primary-foreground/90">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-semibold"><AnimatedCurrency value={economiaAnual} /> por ano</span>
                </div>
              </div>
              <div className="w-12 h-12 bg-primary-foreground/15 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <TrendingDown className="w-6 h-6" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Before/After Comparison */}
      <BeforeAfterComparison contaAtual={contaAtual} contaComSolar={contaComSolar} economiaMensal={economiaMensal} />

      {/* Stats grid */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-3">
        {stats.map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.05 }}>
            <Card className="h-full">
              <CardContent className="p-4">
                <div className={`flex items-center gap-1.5 ${stat.accent} mb-2`}>
                  <stat.icon className="w-4 h-4" />
                  <span className="text-xs font-medium leading-tight">{stat.label}</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  <AnimatedNumber value={stat.value} suffix={stat.suffix} />
                </p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* 25 year savings */}
      <Savings25Years economia25Anos={economia25AnosComposta} arvoresEquivalentes={arvoresEquivalentes} />

      {/* WhatsApp CTA */}
      <WhatsAppCTA economiaMensal={economiaMensal} />

      {/* Share button */}
      <ShareButton onShare={handleShare} copied={copied} />

      {/* DISCLAIMER OBRIGATÓRIO */}
      <Disclaimer fatorPerdas={config.fator_perdas_percentual || 15} geracaoRegional={!!geracaoRegional} />
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function BeforeAfterComparison({ contaAtual, contaComSolar, economiaMensal }: { contaAtual: number; contaComSolar: number; economiaMensal: number }) {
  const percentEconomia = contaAtual > 0 ? (economiaMensal / contaAtual) * 100 : 0;

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x divide-border">
            <div className="p-4 text-center bg-destructive/5">
              <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Sem Solar</p>
              <AnimatedCurrency value={contaAtual} className="text-2xl font-bold text-destructive" />
              <p className="text-xs text-muted-foreground mt-1">/mês</p>
            </div>
            <div className="p-4 text-center bg-success/5 relative">
              <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Com Solar</p>
              <AnimatedCurrency value={contaComSolar} className="text-2xl font-bold text-success" />
              <p className="text-xs text-muted-foreground mt-1">/mês</p>
              <div className="absolute -top-1 -right-1">
                <span className="inline-flex items-center gap-1 bg-success text-white text-[10px] font-bold px-2 py-0.5 rounded-bl-lg rounded-tr-lg">
                  -{Math.round(percentEconomia)}%
                </span>
              </div>
            </div>
          </div>
          <div className="px-4 pb-3 pt-2">
            <div className="w-full bg-destructive/10 rounded-full h-2.5 overflow-hidden">
              <motion.div
                className="bg-gradient-to-r from-success to-success/70 h-full rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: `${percentEconomia}%` }}
                transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground mt-1.5">
              Economia estimada de <span className="font-semibold text-success">{Math.round(percentEconomia)}%</span> na conta de luz
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Savings25Years({ economia25Anos, arvoresEquivalentes }: { economia25Anos: number; arvoresEquivalentes: number }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Economia Estimada em 25 anos
              </p>
              <AnimatedCurrency value={economia25Anos} className="text-2xl sm:text-3xl font-bold text-primary block" />
            </div>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
            <TreePine className="w-4 h-4 text-success" />
            <span>
              Equivalente a plantar <span className="font-semibold text-success">{arvoresEquivalentes}</span> árvores
            </span>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function StatsGrid({ kWp, co2Anual, economiaMensal, economiaAnual, arvoresEquivalentes }: {
  kWp: number; co2Anual: number; economiaMensal: number; economiaAnual: number; arvoresEquivalentes: number;
}) {
  const items = [
    { icon: Sun, label: "Potência", value: kWp.toFixed(1), suffix: "kWp", accent: "text-secondary" },
    { icon: DollarSign, label: "Economia Mensal", value: null, currency: economiaMensal, accent: "text-success" },
    { icon: Calendar, label: "Economia Anual", value: null, currency: economiaAnual, accent: "text-primary" },
    { icon: Leaf, label: "CO₂ Evitado", value: co2Anual.toFixed(1), suffix: "ton/ano", accent: "text-success" },
    { icon: TreePine, label: "Árvores Equiv.", value: String(arvoresEquivalentes), suffix: "árvores", accent: "text-success" },
    { icon: Zap, label: "Geração Mensal", value: (kWp * 130).toFixed(0), suffix: "kWh/mês", accent: "text-secondary" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {items.map((item, i) => (
          <Card key={item.label} className="h-full">
            <CardContent className="p-3">
              <div className={`flex items-center gap-1.5 ${item.accent} mb-1.5`}>
                <item.icon className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium text-muted-foreground">{item.label}</span>
              </div>
              {item.currency != null ? (
                <AnimatedCurrency value={item.currency} className="text-lg font-bold text-foreground" />
              ) : (
                <p className="text-lg font-bold text-foreground tracking-tight">
                  {item.value} <span className="text-xs font-medium text-muted-foreground">{item.suffix}</span>
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </motion.div>
  );
}

function WhatsAppCTA({ economiaMensal }: { economiaMensal: number }) {
  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(v);

  const message = encodeURIComponent(
    `Olá! Fiz uma simulação e minha economia seria de ${fmt(economiaMensal)}/mês. Gostaria de saber mais sobre energia solar.`
  );

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
      <a href={`https://wa.me/?text=${message}`} target="_blank" rel="noopener noreferrer">
        <Button
          size="lg"
          className="w-full h-14 text-base gap-2.5 bg-success hover:bg-success/90 text-white shadow-lg"
        >
          <MessageCircle className="w-5 h-5" />
          📲 Receber Estudo Detalhado no WhatsApp
        </Button>
      </a>
    </motion.div>
  );
}

function ShareButton({ onShare, copied }: { onShare: () => void; copied: boolean }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex justify-center">
      <Button variant="outline" onClick={onShare} className="gap-2 text-sm">
        {copied ? (
          <><Check className="w-4 h-4 text-success" /> Copiado!</>
        ) : (
          <><Share2 className="w-4 h-4" /> Compartilhar Resultado</>
        )}
      </Button>
    </motion.div>
  );
}

function Disclaimer({ fatorPerdas, geracaoRegional }: { fatorPerdas: number; geracaoRegional: boolean }) {
  return (
    <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg border border-border">
      <Info className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
      <p className="text-[11px] text-muted-foreground leading-relaxed">
        <strong>Importante:</strong> Todos os valores apresentados são{" "}
        <strong>estimativas</strong> baseadas em médias do mercado brasileiro
        {geracaoRegional ? " com irradiação regional" : ""}.
        Considera perdas do sistema de {fatorPerdas}%, degradação anual dos painéis e reajuste tarifário.
        O orçamento final pode variar conforme vistoria técnica, equipamentos selecionados e condições locais.
        Esta simulação não constitui proposta comercial vinculante.
      </p>
    </div>
  );
}
