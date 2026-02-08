import { motion } from "framer-motion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  TrendingDown,
  TrendingUp,
  Shield,
  Zap,
  Calendar,
  DollarSign,
  AlertTriangle,
  Info,
  ChevronDown,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useState } from "react";
import type { PaybackResult } from "@/hooks/usePaybackEngine";
import { PaybackFioBChart } from "./PaybackFioBChart";

interface PaybackProfessionalResultsProps {
  result: PaybackResult;
  investimento: number;
  consumoMensal: number;
  tarifaKwh: number;
}

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);

const fmtDecimal = (v: number) =>
  new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(v);

export function PaybackProfessionalResults({
  result,
  investimento,
  consumoMensal,
  tarifaKwh,
}: PaybackProfessionalResultsProps) {
  const [showDetalhes, setShowDetalhes] = useState(false);
  const { conservador, otimista, configUsada, alertas } = result;

  const contaAtual = consumoMensal * tarifaKwh;
  const contaComSolarConservador = contaAtual - conservador.economiaLiquida;
  const contaComSolarOtimista = contaAtual - otimista.economiaLiquida;

  return (
    <div className="space-y-4">
      {/* Alertas */}
      {alertas.length > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card className="border-warning/30 bg-warning/5">
            <CardContent className="p-4">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                <div className="space-y-1">
                  {alertas.map((alerta, i) => (
                    <p key={i} className="text-xs text-warning-foreground">
                      {alerta}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Dual Scenarios */}
      <div className="grid grid-cols-1 min-[500px]:grid-cols-2 gap-3">
        {/* Conservador - Padrão para propostas */}
        <motion.div
          initial={{ opacity: 0, x: -10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-secondary/30 bg-secondary/5 h-full relative overflow-hidden">
            <div className="absolute top-0 right-0">
              <Badge className="rounded-none rounded-bl-lg bg-secondary text-secondary-foreground text-[10px] px-2 py-0.5">
                <Shield className="w-3 h-3 mr-1" />
                Proposta
              </Badge>
            </div>
            <CardContent className="p-4 pt-8">
              <div className="flex items-center gap-1.5 mb-2">
                <Shield className="w-4 h-4 text-secondary" />
                <span className="text-xs font-semibold text-secondary uppercase tracking-wide">
                  Cenário Conservador
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                {fmt(conservador.economiaLiquida)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <div className="flex items-center gap-1.5 text-secondary">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-sm font-semibold">
                  Payback: {conservador.paybackAnos.toFixed(1)} anos
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                Sem isenção ICMS • Pior cenário tributário
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Otimista */}
        <motion.div
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
        >
          <Card className="border-success/30 bg-success/5 h-full">
            <CardContent className="p-4 pt-8">
              <div className="flex items-center gap-1.5 mb-2">
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-xs font-semibold text-success uppercase tracking-wide">
                  Cenário Otimista
                </span>
              </div>
              <p className="text-2xl sm:text-3xl font-bold text-foreground mb-1">
                {fmt(otimista.economiaLiquida)}
                <span className="text-sm font-normal text-muted-foreground">/mês</span>
              </p>
              <div className="flex items-center gap-1.5 text-success">
                <Calendar className="w-3.5 h-3.5" />
                <span className="text-sm font-semibold">
                  Payback: {otimista.paybackAnos.toFixed(1)} anos
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-2">
                {configUsada.isencaoScee
                  ? `Com isenção ICMS (${configUsada.percentualIsencao}%)`
                  : "Mesmo cenário - estado sem isenção SCEE"}
              </p>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Conta atual vs com solar */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="grid grid-cols-1 min-[400px]:grid-cols-3 gap-3"
      >
        <Card className="border-destructive/20 bg-destructive/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Conta Atual</p>
            <p className="text-xl font-bold text-destructive">{fmt(contaAtual)}</p>
          </CardContent>
        </Card>
        <Card className="border-secondary/20 bg-secondary/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Com Solar (conserv.)</p>
            <p className="text-xl font-bold text-secondary">
              {fmt(Math.max(0, contaComSolarConservador))}
            </p>
          </CardContent>
        </Card>
        <Card className="border-success/20 bg-success/5">
          <CardContent className="p-4 text-center">
            <p className="text-xs text-muted-foreground mb-1">Com Solar (otimista)</p>
            <p className="text-xl font-bold text-success">
              {fmt(Math.max(0, contaComSolarOtimista))}
            </p>
          </CardContent>
        </Card>
      </motion.div>

      {/* Breakdown detalhado */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <Card>
          <CardContent className="p-0">
            <button
              className="w-full flex items-center justify-between p-4 hover:bg-muted/30 transition-colors"
              onClick={() => setShowDetalhes(!showDetalhes)}
            >
              <div className="flex items-center gap-2">
                <Info className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Detalhamento do Cálculo</span>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-muted-foreground transition-transform ${
                  showDetalhes ? "rotate-180" : ""
                }`}
              />
            </button>
            {showDetalhes && (
              <div className="px-4 pb-4 border-t">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4">
                  {/* Conservador breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-secondary uppercase tracking-wide">
                      Conservador
                    </h4>
                    <DetailRow label="kWh compensado" value={`${conservador.kwhCompensado.toFixed(0)} kWh`} />
                    <DetailRow
                      label="Tarifa compensável líquida"
                      value={fmtDecimal(conservador.tarifaCompensavelLiquida)}
                      tooltip="Tarifa após desconto ICMS integral"
                    />
                    <DetailRow label="Economia bruta" value={fmt(conservador.economiaBruta)} positive />
                    {conservador.custoFioB > 0 && (
                      <DetailRow label="(−) Custo Fio B" value={`-${fmt(conservador.custoFioB)}`} negative />
                    )}
                    <DetailRow label="(−) Conta inevitável" value={`-${fmt(conservador.contaInevitavel)}`} negative />
                    <div className="border-t pt-1 mt-1">
                      <DetailRow
                        label="Economia líquida"
                        value={fmt(conservador.economiaLiquida)}
                        positive
                        bold
                      />
                    </div>
                  </div>

                  {/* Otimista breakdown */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-success uppercase tracking-wide">
                      Otimista
                    </h4>
                    <DetailRow label="kWh compensado" value={`${otimista.kwhCompensado.toFixed(0)} kWh`} />
                    <DetailRow
                      label="Tarifa compensável líquida"
                      value={fmtDecimal(otimista.tarifaCompensavelLiquida)}
                      tooltip={
                        configUsada.isencaoScee
                          ? `Com isenção SCEE de ${configUsada.percentualIsencao}%`
                          : "Sem isenção SCEE disponível"
                      }
                    />
                    <DetailRow label="Economia bruta" value={fmt(otimista.economiaBruta)} positive />
                    {otimista.custoFioB > 0 && (
                      <DetailRow label="(−) Custo Fio B" value={`-${fmt(otimista.custoFioB)}`} negative />
                    )}
                    <DetailRow label="(−) Conta inevitável" value={`-${fmt(otimista.contaInevitavel)}`} negative />
                    <div className="border-t pt-1 mt-1">
                      <DetailRow
                        label="Economia líquida"
                        value={fmt(otimista.economiaLiquida)}
                        positive
                        bold
                      />
                    </div>
                  </div>
                </div>

                {/* Config info */}
                <div className="mt-4 p-3 bg-muted/30 rounded-lg">
                  <h4 className="text-[11px] font-bold text-muted-foreground uppercase tracking-wide mb-2">
                    Parâmetros utilizados
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <span>ICMS: {configUsada.icms}%</span>
                    <span>Fio B atual: {configUsada.percentualFioBAtual.toFixed(0)}%</span>
                    <span>Custo disp.: {fmt(configUsada.custoDisponibilidade)}</span>
                    <span>Isenção SCEE: {configUsada.isencaoScee ? "Sim" : "Não"}</span>
                    <span>Taxas fixas: {fmt(configUsada.taxasFixas)}</span>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Gráfico Fio B */}
      {result.fioBImpactoAnual.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
        >
          <PaybackFioBChart data={result.fioBImpactoAnual} />
        </motion.div>
      )}

      {/* Disclaimer */}
      <p className="text-xs text-muted-foreground text-center px-4">
        * Valores estimados com base em parâmetros configuráveis. O cenário conservador é
        recomendado para propostas comerciais. Configure dados da concessionária para maior
        precisão.
      </p>
    </div>
  );
}

// ─── Helper component ────────────────────────────────────────────
function DetailRow({
  label,
  value,
  tooltip,
  positive,
  negative,
  bold,
}: {
  label: string;
  value: string;
  tooltip?: string;
  positive?: boolean;
  negative?: boolean;
  bold?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between text-xs ${bold ? "font-semibold" : ""}`}>
      <div className="flex items-center gap-1">
        <span className="text-muted-foreground">{label}</span>
        {tooltip && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="w-3 h-3 text-muted-foreground/50 cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
      <span
        className={
          positive
            ? "text-success font-medium"
            : negative
              ? "text-destructive font-medium"
              : "text-foreground"
        }
      >
        {value}
      </span>
    </div>
  );
}
