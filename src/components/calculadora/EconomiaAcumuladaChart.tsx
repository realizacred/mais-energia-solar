import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { TrendingUp, Calendar } from "lucide-react";
import { motion } from "framer-motion";

interface EconomiaAcumuladaChartProps {
  investimento: number;
  economiaMensalAno1: number;
  reajusteAnualTarifa: number; // ex: 5 (%)
  degradacaoAnualPainel: number; // ex: 0.8 (%)
  vidaUtil?: number; // default 25
}

interface AnoData {
  ano: number;
  economiaAcumulada: number;
  investimento: number;
  economiaMensalMedia: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

export function EconomiaAcumuladaChart({
  investimento,
  economiaMensalAno1,
  reajusteAnualTarifa,
  degradacaoAnualPainel,
  vidaUtil = 25,
}: EconomiaAcumuladaChartProps) {
  const { dados, paybackAno, roi, tirAnual, economia25Anos } = useMemo(() => {
    const data: AnoData[] = [];
    let acumulado = 0;
    let payback = 0;
    const reajuste = 1 + reajusteAnualTarifa / 100;
    const degradacao = 1 - degradacaoAnualPainel / 100;

    for (let ano = 1; ano <= vidaUtil; ano++) {
      // Economia do ano: aplica reajuste tarifário (composto) e degradação do painel
      const fatorTarifa = Math.pow(reajuste, ano - 1);
      const fatorDegradacao = Math.pow(degradacao, ano - 1);
      const economiaMensalAno = economiaMensalAno1 * fatorTarifa * fatorDegradacao;
      const economiaAnual = economiaMensalAno * 12;
      acumulado += economiaAnual;

      if (payback === 0 && acumulado >= investimento) {
        payback = ano;
      }

      data.push({
        ano,
        economiaAcumulada: Math.round(acumulado),
        investimento,
        economiaMensalMedia: Math.round(economiaMensalAno),
      });
    }

    const totalEconomia = acumulado;
    const roiCalc = ((totalEconomia - investimento) / investimento) * 100;

    // TIR simplificada (Newton-Raphson)
    let tir = 0.1; // initial guess 10%
    for (let iter = 0; iter < 50; iter++) {
      let npv = -investimento;
      let dnpv = 0;
      for (let ano = 1; ano <= vidaUtil; ano++) {
        const fatorTarifa = Math.pow(reajuste, ano - 1);
        const fatorDegradacao = Math.pow(degradacao, ano - 1);
        const fluxo = economiaMensalAno1 * fatorTarifa * fatorDegradacao * 12;
        const desconto = Math.pow(1 + tir, ano);
        npv += fluxo / desconto;
        dnpv -= (ano * fluxo) / (desconto * (1 + tir));
      }
      if (Math.abs(dnpv) < 1e-10) break;
      tir = tir - npv / dnpv;
      if (Math.abs(npv) < 1) break;
    }

    return {
      dados: data,
      paybackAno: payback,
      roi: roiCalc,
      tirAnual: tir * 100,
      economia25Anos: totalEconomia,
    };
  }, [investimento, economiaMensalAno1, reajusteAnualTarifa, degradacaoAnualPainel, vidaUtil]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
    >
      <Card>
        <CardContent className="p-4 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Projeção Financeira — {vidaUtil} Anos
              </h3>
            </div>
            <Badge variant="outline" className="text-[10px]">
              Composta
            </Badge>
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            <div className="text-center p-2 bg-primary/5 rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Economia Total</p>
              <p className="text-sm sm:text-base font-bold text-primary">{fmt(economia25Anos)}</p>
            </div>
            <div className="text-center p-2 bg-success/5 rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">ROI</p>
              <p className="text-sm sm:text-base font-bold text-success">{roi.toFixed(0)}%</p>
            </div>
            <div className="text-center p-2 bg-secondary/5 rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">TIR Anual</p>
              <p className="text-sm sm:text-base font-bold text-secondary">{tirAnual.toFixed(1)}%</p>
            </div>
            <div className="text-center p-2 bg-muted rounded-lg">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Payback</p>
              <p className="text-sm sm:text-base font-bold text-foreground">
                {paybackAno > 0 ? `${paybackAno} anos` : "—"}
              </p>
            </div>
          </div>

          {/* Chart */}
          <div className="h-48 sm:h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dados} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorEconomia" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis
                  dataKey="ano"
                  tick={{ fontSize: 10 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v) => `${v}º`}
                />
                <YAxis
                  tick={{ fontSize: 10 }}
                  className="fill-muted-foreground"
                  tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
                  width={40}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "8px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number, name: string) => [
                    fmt(value),
                    name === "economiaAcumulada" ? "Economia Acumulada" : "Investimento",
                  ]}
                  labelFormatter={(label) => `Ano ${label}`}
                />
                <ReferenceLine
                  y={investimento}
                  stroke="hsl(var(--destructive))"
                  strokeDasharray="5 5"
                  label={{
                    value: `Investimento: ${fmt(investimento)}`,
                    position: "insideTopRight",
                    fontSize: 10,
                    fill: "hsl(var(--destructive))",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="economiaAcumulada"
                  stroke="hsl(var(--primary))"
                  fill="url(#colorEconomia)"
                  strokeWidth={2}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <p className="text-[10px] text-muted-foreground text-center mt-2">
            Projeção com reajuste tarifário de {reajusteAnualTarifa}%/ano e degradação de {degradacaoAnualPainel}%/ano
          </p>
        </CardContent>
      </Card>
    </motion.div>
  );
}
