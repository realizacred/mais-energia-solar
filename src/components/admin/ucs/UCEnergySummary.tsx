/**
 * UCEnergySummary — Energy summary block for UC detail page.
 * Shows GD allocation info if UC is beneficiary or generator.
 */
import { useState } from "react";
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
          <div className="grid grid-cols-2 gap-3">
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
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          <CardTitle className="text-sm">Energia GD — {MONTHS[month - 1]}/{year}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* As Beneficiary */}
        {asBeneficiary && (
          <div className="space-y-3">
            <Badge variant="outline" className="text-xs">
              <Users className="w-3 h-3 mr-1" /> Beneficiária
            </Badge>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Consumo</p>
                <p className="text-sm font-bold font-mono">{Number(asBeneficiary.consumed_kwh || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Crédito Recebido</p>
                <p className="text-sm font-bold font-mono">{Number(asBeneficiary.allocated_kwh || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Compensado</p>
                <p className="text-sm font-bold font-mono text-success">{Number(asBeneficiary.compensated_kwh || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh</p>
              </div>
              <div className="rounded-lg border border-border p-3">
                <p className="text-xs text-muted-foreground">Economia Est.</p>
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
              <Badge variant="outline" className="text-xs">
                <Sun className="w-3 h-3 mr-1" /> Geradora
              </Badge>
              <span className="text-xs text-muted-foreground">Grupo: {asGeradora.group.nome}</span>
            </div>
            {asGeradora.snapshot ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Geração</p>
                  <p className="text-sm font-bold font-mono">{Number(asGeradora.snapshot.generation_kwh || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Distribuído</p>
                  <p className="text-sm font-bold font-mono">{Number(asGeradora.snapshot.total_allocated_kwh || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh</p>
                </div>
                <div className="rounded-lg border border-border p-3">
                  <p className="text-xs text-muted-foreground">Compensado</p>
                  <p className="text-sm font-bold font-mono text-success">{Number(asGeradora.snapshot.total_compensated_kwh || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh</p>
                </div>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Sem cálculo para este mês</p>
            )}
          </div>
        )}

        {/* Credit Balance */}
        {creditBalances.length > 0 && (
          <div className="rounded-lg bg-muted/30 p-3">
            <p className="text-xs font-medium text-muted-foreground mb-1">Saldo de Crédito Acumulado</p>
            <p className="text-sm font-bold font-mono">
              {creditBalances.reduce((s: number, b: any) => s + Number(b.balance_kwh), 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} kWh
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
