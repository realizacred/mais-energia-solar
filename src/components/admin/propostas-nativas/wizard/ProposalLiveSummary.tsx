import React from "react";
import { useSolarCalculation } from "./hooks/useSolarCalculation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { 
  Zap, 
  Sun, 
  AreaChart, 
  Clock, 
  TrendingUp, 
  AlertTriangle, 
  Coins, 
  Maximize,
  Box
} from "lucide-react";
import { formatNumberBR } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export function ProposalLiveSummary() {
  const {
    consumoTotal,
    potenciaSugeridaKwp,
    geracaoMensalEstimada,
    offset,
    totalModulos,
    totalPotenciaInversores,
    areaEstimada,
    precoFinal,
    economiaMensal,
    paybackAnos,
    roiPercent,
    alertas
  } = useSolarCalculation();

  const metrics = [
    {
      label: "Consumo",
      value: `${formatNumberBR(consumoTotal)} kWh`,
      icon: Zap,
      color: "text-blue-500",
      bg: "bg-blue-500/10"
    },
    {
      label: "Geração",
      value: `${formatNumberBR(geracaoMensalEstimada)} kWh`,
      subValue: `${formatNumberBR(offset)}% offset`,
      icon: Sun,
      color: "text-yellow-500",
      bg: "bg-yellow-500/10"
    },
    {
      label: "Potência",
      value: `${formatNumberBR(potenciaSugeridaKwp)} kWp`,
      subValue: "Sugerida",
      icon: TrendingUp,
      color: "text-emerald-500",
      bg: "bg-emerald-500/10"
    },
    {
      label: "Investimento",
      value: precoFinal > 0 ? `R$ ${formatNumberBR(precoFinal)}` : "—",
      subValue: `Economia R$ ${formatNumberBR(economiaMensal)}/mês`,
      icon: Coins,
      color: "text-purple-500",
      bg: "bg-purple-500/10"
    }
  ];

  return (
    <Card className="border-primary/10 bg-card/50 backdrop-blur-xl shadow-2xl overflow-hidden sticky top-8">
      <CardHeader className="bg-primary/[0.03] py-4 px-5 border-b border-primary/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary flex items-center gap-2">
            <AreaChart className="h-3.5 w-3.5" />
            Cockpit Técnico
          </CardTitle>
          {alertas.length > 0 && (
            <Badge variant="destructive" className="animate-pulse px-1.5 py-0 text-[9px] uppercase font-black">
              {alertas.length} Alerta{alertas.length > 1 ? "s" : ""}
            </Badge>
          )}
        </div>
      </CardHeader>
      
      <CardContent className="p-5 space-y-6">
        {/* Main Grid */}
        <div className="grid grid-cols-2 gap-4">
          {metrics.map((m, i) => (
            <div key={i} className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <div className={cn("p-1 rounded-md", m.bg)}>
                  <m.icon className={cn("h-3 w-3", m.color)} />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {m.label}
                </span>
              </div>
              <div>
                <div className="text-sm font-black tracking-tight text-foreground">
                  {m.value}
                </div>
                {m.subValue && (
                  <div className="text-[9px] font-medium text-muted-foreground">
                    {m.subValue}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        <Separator className="bg-primary/5" />

        {/* Secondary Metrics */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Box className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Equipamento</span>
            </div>
            <span className="text-xs font-bold text-foreground">
              {totalModulos} Mód. / {totalPotenciaInversores} kW
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Maximize className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Área Estimada</span>
            </div>
            <span className="text-xs font-bold text-foreground">
              {formatNumberBR(areaEstimada)} m²
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Payback</span>
            </div>
            <span className="text-xs font-bold text-foreground">
              {paybackAnos > 0 ? `${paybackAnos.toFixed(1)} anos` : "—"}
            </span>
          </div>
        </div>

        {/* Alerts Section */}
        {alertas.length > 0 && (
          <div className="pt-2">
            <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-2">
              <div className="flex items-center gap-2 text-destructive font-bold text-[9px] uppercase">
                <AlertTriangle className="h-3 w-3" />
                Engenharia
              </div>
              <ul className="space-y-1">
                {alertas.map((a, i) => (
                  <li key={i} className="text-[10px] text-destructive/80 font-medium leading-tight">
                    • {a}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* ROI / Performance Badge */}
        <div className="pt-2">
          <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between overflow-hidden relative group transition-all hover:bg-emerald-500/10">
            <div className="relative z-10">
              <p className="text-[9px] font-black uppercase tracking-widest text-emerald-600/70 mb-1">Retorno (TIR)</p>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-black text-emerald-600 tracking-tighter">
                  {roiPercent > 0 ? roiPercent.toFixed(1) : "—"}
                </span>
                <span className="text-sm font-bold text-emerald-600/70">%</span>
              </div>
            </div>
            <TrendingUp className="h-12 w-12 text-emerald-500/10 absolute -right-2 -bottom-2 group-hover:scale-110 transition-transform" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
