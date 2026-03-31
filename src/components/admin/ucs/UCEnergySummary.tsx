/**
 * UCEnergySummary — Energy summary block for UC detail page.
 * Shows GD allocation info if UC is beneficiary or generator.
 */
import { useState } from "react";
import { formatDecimalBR } from "@/lib/formatters";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Zap, ArrowDownUp, TrendingUp, Sun, DollarSign, Users } from "lucide-react";
import { useUcEnergiaResumo } from "@/hooks/useGdEnergyEngine";

interface Props {
  ucId: string;
}

function getCurrentPeriod() {
  const now = new Date();
  const brasilNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  let m = brasilNow.getMonth();
  let y = brasilNow.getFullYear();
  if (m === 0) { m = 12; y--; }
  return { year: y, month: m };
}

const MONTHS = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];

export function UCEnergySummary({ ucId }: Props) {
  const { year, month } = getCurrentPeriod();
  const { data, isLoading } = useUcEnergiaResumo(ucId, year, month);

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <Skeleton className="h-5 w-40" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  const { asBeneficiary, asGeradora, creditBalances } = data;
  const hasData = asBeneficiary || asGeradora;

  if (!hasData && creditBalances.length === 0) return null;

  return (
    <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
            <Zap className="w-4 h-4 text-warning" />
          </div>
          <CardTitle className="text-sm font-semibold">Energia GD — {MONTHS[month - 1]}/{year}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* As Beneficiary */}
        {asBeneficiary && (
          <div className="space-y-3">
            <Badge className="text-xs bg-info/10 text-info border-info/20">
              <Users className="w-3 h-3 mr-1" /> Beneficiária
            </Badge>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownUp className="w-3 h-3" /> Consumo</p>
                <p className="text-sm font-bold font-mono">{formatDecimalBR(Number(asBeneficiary.consumed_kwh || 0), 1)} kWh</p>
              </div>
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Crédito Recebido</p>
                <p className="text-sm font-bold font-mono">{formatDecimalBR(Number(asBeneficiary.allocated_kwh || 0), 1)} kWh</p>
              </div>
              <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><Sun className="w-3 h-3" /> Compensado</p>
                <p className="text-sm font-bold font-mono text-success">{formatDecimalBR(Number(asBeneficiary.compensated_kwh || 0), 1)} kWh</p>
              </div>
              {Number(asBeneficiary.used_from_balance_kwh || 0) > 0 && (
                <div className="rounded-lg border border-info/20 bg-info/5 p-3">
                  <p className="text-xs text-muted-foreground">Usado do Saldo</p>
                  <p className="text-sm font-bold font-mono text-info">{formatDecimalBR(Number(asBeneficiary.used_from_balance_kwh), 1)} kWh</p>
                </div>
              )}
              <div className="rounded-lg border border-warning/20 bg-warning/5 p-3">
                <p className="text-xs text-muted-foreground flex items-center gap-1"><DollarSign className="w-3 h-3" /> Economia Est.</p>
                <p className="text-sm font-bold font-mono">
                  {asBeneficiary.estimated_savings_brl != null
                    ? Number(asBeneficiary.estimated_savings_brl).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })
                    : "—"}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* As Generator */}
        {asGeradora && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Badge className="text-xs bg-success/10 text-success border-success/20">
                <Sun className="w-3 h-3 mr-1" /> Geradora
              </Badge>
              <span className="text-xs text-muted-foreground font-medium">Grupo: {asGeradora.group.nome}</span>
            </div>
            {asGeradora.snapshot ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-success/20 bg-success/5 p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><Sun className="w-3 h-3" /> Geração</p>
                  <p className="text-sm font-bold font-mono">{formatDecimalBR(Number(asGeradora.snapshot.generation_kwh || 0), 1)} kWh</p>
                </div>
                <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><TrendingUp className="w-3 h-3" /> Distribuído</p>
                  <p className="text-sm font-bold font-mono">{formatDecimalBR(Number(asGeradora.snapshot.total_allocated_kwh || 0), 1)} kWh</p>
                </div>
                <div className="rounded-lg border border-info/20 bg-info/5 p-3">
                  <p className="text-xs text-muted-foreground flex items-center gap-1"><ArrowDownUp className="w-3 h-3" /> Compensado</p>
                  <p className="text-sm font-bold font-mono text-success">{formatDecimalBR(Number(asGeradora.snapshot.total_compensated_kwh || 0), 1)} kWh</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground italic">Sem cálculo para este mês</p>
            )}
          </div>
        )}

        {/* Credit Balance */}
        {creditBalances.length > 0 && (
          <div className="rounded-lg bg-success/5 border border-success/20 p-3 flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-xs font-medium text-muted-foreground">Saldo de Crédito Acumulado</p>
              <p className="text-lg font-bold font-mono text-success">
                {creditBalances.reduce((s: number, b: any) => s + Number(b.balance_kwh), 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh
              </p>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
