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
  Copy,
  Check,
  TreePine,
} from "lucide-react";
import type { PaybackResult } from "@/hooks/usePaybackEngine";
import { PaybackProfessionalResults } from "@/components/payback/PaybackProfessionalResults";
import { useAnimatedCounter } from "@/hooks/useAnimatedCounter";
import { useState } from "react";

interface CalculadoraResultsProps {
  consumoMensal: number;
  tarifaKwh: number;
  config: {
    custo_por_kwp: number;
    geracao_mensal_por_kwp: number;
    kg_co2_por_kwh: number;
    percentual_economia: number;
  };
  paybackResult?: PaybackResult | null;
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
}: CalculadoraResultsProps) {
  const [copied, setCopied] = useState(false);

  const kWp = consumoMensal / config.geracao_mensal_por_kwp;
  const economiaMensal = consumoMensal * tarifaKwh * (config.percentual_economia / 100);
  const economiaAnual = economiaMensal * 12;
  const investimentoTotal = kWp * config.custo_por_kwp;
  const co2Anual = (consumoMensal * config.kg_co2_por_kwh * 12) / 1000;
  const economia25Anos = economiaAnual * 25;
  const contaAtual = consumoMensal * tarifaKwh;
  const contaComSolar = contaAtual - economiaMensal;
  const arvoresEquivalentes = Math.round(co2Anual * 1000 / 22); // ~22kg CO2 per tree/year

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  const handleShare = async () => {
    const text = `☀️ Simulei minha economia com energia solar!\n\n💰 Economia mensal: ${fmt(economiaMensal)}\n📊 Investimento: ${fmt(investimentoTotal)}\n🌱 ${co2Anual.toFixed(1)} ton CO₂/ano evitados\n💵 Economia em 25 anos: ${fmt(economia25Anos)}\n\nSimule a sua: ${window.location.origin}/calculadora`;

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

  // If professional payback result is available, show enhanced version
  if (paybackResult) {
    return (
      <div className="space-y-4">
        {/* Hero card with animated investment */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
        >
          <Card className="gradient-solar text-white overflow-hidden shadow-lg">
            <CardContent className="p-6">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-white/80 text-sm font-medium">
                    Investimento Estimado
                  </p>
                  <AnimatedCurrency value={investimentoTotal} className="text-3xl sm:text-4xl font-bold mt-1 tracking-tight block" />
                  <div className="flex items-center gap-3 mt-3 text-white/90 flex-wrap">
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
                <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                  <TrendingDown className="w-7 h-7" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Before/After Comparison */}
        <BeforeAfterComparison contaAtual={contaAtual} contaComSolar={contaComSolar} economiaMensal={economiaMensal} />

        {/* 25 year savings */}
        <Savings25Years economia25Anos={economia25Anos} arvoresEquivalentes={arvoresEquivalentes} />

        {/* Professional payback results */}
        <PaybackProfessionalResults
          result={paybackResult}
          investimento={investimentoTotal}
          consumoMensal={consumoMensal}
          tarifaKwh={tarifaKwh}
        />

        {/* Share button */}
        <ShareButton onShare={handleShare} copied={copied} />
      </div>
    );
  }

  // Fallback: enhanced simple results
  const payback = economiaAnual > 0 ? investimentoTotal / economiaAnual : 0;

  const stats = [
    {
      icon: Sun,
      label: "Potência do Sistema",
      value: kWp,
      suffix: " kWp",
      accent: "text-secondary",
    },
    {
      icon: Calendar,
      label: "Retorno do Investimento",
      value: payback,
      suffix: " anos",
      accent: "text-primary",
    },
    {
      icon: Leaf,
      label: "Redução de CO₂",
      value: co2Anual,
      suffix: " ton/ano",
      accent: "text-success",
    },
  ];

  return (
    <div className="space-y-4">
      {/* Hero savings card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
      >
        <Card className="gradient-solar text-white overflow-hidden shadow-lg">
          <CardContent className="p-6">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-white/80 text-sm font-medium">
                  Sua Economia Mensal Estimada
                </p>
                <AnimatedCurrency value={economiaMensal} className="text-3xl sm:text-4xl md:text-5xl font-bold mt-1 tracking-tight block" />
                <div className="flex items-center gap-2 mt-3 text-white/90">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-semibold">
                    <AnimatedCurrency value={economiaAnual} /> por ano
                  </span>
                </div>
              </div>
              <div className="w-14 h-14 bg-white/15 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                <TrendingDown className="w-7 h-7" />
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
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <Card className="h-full">
              <CardContent className="p-4">
                <div className={`flex items-center gap-1.5 ${stat.accent} mb-2`}>
                  <stat.icon className="w-4 h-4" />
                  <span className="text-xs font-medium leading-tight">
                    {stat.label}
                  </span>
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
      <Savings25Years economia25Anos={economia25Anos} arvoresEquivalentes={arvoresEquivalentes} />

      {/* Share button */}
      <ShareButton onShare={handleShare} copied={copied} />

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center px-4">
        * Valores estimados com base em médias do mercado brasileiro. O
        orçamento final pode variar.
      </p>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────

function BeforeAfterComparison({ contaAtual, contaComSolar, economiaMensal }: { contaAtual: number; contaComSolar: number; economiaMensal: number }) {
  const percentEconomia = contaAtual > 0 ? (economiaMensal / contaAtual) * 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
    >
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="grid grid-cols-2 divide-x divide-border">
            {/* Before */}
            <div className="p-4 text-center bg-destructive/5">
              <p className="text-xs text-muted-foreground mb-1 font-medium uppercase tracking-wider">Sem Solar</p>
              <AnimatedCurrency value={contaAtual} className="text-2xl font-bold text-destructive" />
              <p className="text-xs text-muted-foreground mt-1">/mês</p>
            </div>
            {/* After */}
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
          {/* Progress bar */}
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
              Economia de <span className="font-semibold text-success">{Math.round(percentEconomia)}%</span> na conta de luz
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function Savings25Years({ economia25Anos, arvoresEquivalentes }: { economia25Anos: number; arvoresEquivalentes: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
        <CardContent className="p-5">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <div className="flex-1">
              <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">
                Economia em 25 anos
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

function ShareButton({ onShare, copied }: { onShare: () => void; copied: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 0.4 }}
      className="flex justify-center"
    >
      <Button
        variant="outline"
        onClick={onShare}
        className="gap-2 text-sm"
      >
        {copied ? (
          <>
            <Check className="w-4 h-4 text-success" />
            Copiado!
          </>
        ) : (
          <>
            <Share2 className="w-4 h-4" />
            Compartilhar Resultado
          </>
        )}
      </Button>
    </motion.div>
  );
}
