import { motion } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Sun,
  TrendingDown,
  Leaf,
  Calendar,
  DollarSign,
  Zap,
} from "lucide-react";
import type { PaybackResult } from "@/hooks/usePaybackEngine";
import { PaybackProfessionalResults } from "@/components/payback/PaybackProfessionalResults";

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

export function CalculadoraResults({
  consumoMensal,
  tarifaKwh,
  config,
  paybackResult,
}: CalculadoraResultsProps) {
  const kWp = consumoMensal / config.geracao_mensal_por_kwp;
  const economiaMensal =
    consumoMensal * tarifaKwh * (config.percentual_economia / 100);
  const economiaAnual = economiaMensal * 12;
  const investimentoTotal = kWp * config.custo_por_kwp;
  const co2Anual = (consumoMensal * config.kg_co2_por_kwh * 12) / 1000;

  const fmt = (v: number) =>
    new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(v);

  // If professional payback result is available, show it
  if (paybackResult) {
    return (
      <div className="space-y-4">
        {/* Hero card with investment */}
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
                  <p className="text-3xl sm:text-4xl font-bold mt-1 tracking-tight">
                    {fmt(investimentoTotal)}
                  </p>
                  <div className="flex items-center gap-3 mt-3 text-white/90 flex-wrap">
                    <span className="flex items-center gap-1 text-sm">
                      <Sun className="w-4 h-4" />
                      {kWp.toFixed(1)} kWp
                    </span>
                    <span className="flex items-center gap-1 text-sm">
                      <Leaf className="w-4 h-4" />
                      {co2Anual.toFixed(1)} ton CO₂/ano
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

        {/* Professional payback results */}
        <PaybackProfessionalResults
          result={paybackResult}
          investimento={investimentoTotal}
          consumoMensal={consumoMensal}
          tarifaKwh={tarifaKwh}
        />
      </div>
    );
  }

  // Fallback: simple results (when no payback engine data)
  const payback = economiaAnual > 0 ? investimentoTotal / economiaAnual : 0;

  const stats = [
    {
      icon: Sun,
      label: "Potência do Sistema",
      value: `${kWp.toFixed(1)} kWp`,
      accent: "secondary" as const,
    },
    {
      icon: DollarSign,
      label: "Investimento Estimado",
      value: fmt(investimentoTotal),
      accent: "secondary" as const,
    },
    {
      icon: Calendar,
      label: "Retorno do Investimento",
      value: `${payback.toFixed(1)} anos`,
      accent: "primary" as const,
    },
    {
      icon: Leaf,
      label: "Redução de CO₂",
      value: `${co2Anual.toFixed(1)} ton/ano`,
      accent: "success" as const,
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
                <p className="text-3xl sm:text-4xl md:text-5xl font-bold mt-1 tracking-tight">
                  {fmt(economiaMensal)}
                </p>
                <div className="flex items-center gap-2 mt-3 text-white/90">
                  <DollarSign className="w-4 h-4" />
                  <span className="font-semibold">
                    {fmt(economiaAnual)} por ano
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

      {/* Current bill vs new bill */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-1 min-[400px]:grid-cols-2 gap-3"
      >
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Conta Atual</p>
            <p className="text-xl font-bold text-destructive">
              {fmt(consumoMensal * tarifaKwh)}
            </p>
          </CardContent>
        </Card>
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">
              Com Energia Solar
            </p>
            <p className="text-xl font-bold text-success">
              {fmt(consumoMensal * tarifaKwh - economiaMensal)}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Stats grid */}
      <div className="grid grid-cols-1 min-[400px]:grid-cols-2 sm:grid-cols-3 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.05 }}
          >
            <Card className="h-full">
              <CardContent className="p-4">
                <div className={`flex items-center gap-1.5 text-${stat.accent} mb-2`}>
                  <stat.icon className="w-4 h-4" />
                  <span className="text-xs font-medium leading-tight">
                    {stat.label}
                  </span>
                </div>
                <p className="text-xl font-bold text-foreground">{stat.value}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center px-4">
        * Valores estimados com base em médias do mercado brasileiro. O
        orçamento final pode variar.
      </p>
    </div>
  );
}
