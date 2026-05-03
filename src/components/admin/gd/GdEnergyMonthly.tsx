/**
 * GdEnergyMonthly — Monthly energy view for a GD Group.
 * Shows KPI cards, allocation table, and calculate button.
 */
import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { GdGenerationSourceCard } from "./GdGenerationSourceCard";
import { GdReconciliationCard } from "./GdReconciliationCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Zap, ArrowDownUp, TrendingUp, AlertTriangle, Calculator, RefreshCw, DollarSign, Sun } from "lucide-react";
import { useGdMonthlySnapshot, useGdMonthlyAllocations, useCalculateGdMonth } from "@/hooks/useGdEnergyEngine";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatBRL } from "@/lib/formatters";

interface Props {
  groupId: string;
}

const STATUS_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  complete: { label: "Completo", variant: "default" },
  partial: { label: "Parcial", variant: "secondary" },
  missing_generation: { label: "Sem geração", variant: "destructive" },
  missing_beneficiary_invoice: { label: "Fatura faltando", variant: "outline" },
  inconsistent: { label: "Inconsistente", variant: "destructive" },
  pending: { label: "Pendente", variant: "outline" },
};

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function getCurrentPeriod() {
  const now = new Date();
  // Use Brasília time
  const brasilNow = new Date(now.toLocaleString("en-US", { timeZone: "America/Sao_Paulo" }));
  // Default to previous month (most likely has data)
  let m = brasilNow.getMonth(); // 0-indexed = previous month
  let y = brasilNow.getFullYear();
  if (m === 0) { m = 12; y--; }
  return { year: y, month: m };
}

export function GdEnergyMonthly({ groupId }: Props) {
  const { toast } = useToast();
  const { year: defaultYear, month: defaultMonth } = getCurrentPeriod();
  const [year, setYear] = useState(defaultYear);
  const [month, setMonth] = useState(defaultMonth);

  const { data: snapshot, isLoading: loadingSnap } = useGdMonthlySnapshot(groupId, year, month);
  const { data: allocations = [], isLoading: loadingAlloc } = useGdMonthlyAllocations(snapshot?.id ?? null);
  const calculate = useCalculateGdMonth();

  // UC map for display
  const allocUcIds = allocations.map((a) => a.uc_beneficiaria_id);
  const { data: ucs = [] } = useQuery({
    queryKey: ["ucs_for_gd_energy", allocUcIds],
    queryFn: async () => {
      if (allocUcIds.length === 0) return [];
      const { data } = await supabase
        .from("units_consumidoras")
        .select("id, nome, codigo_uc")
        .in("id", allocUcIds);
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
    enabled: allocUcIds.length > 0,
  });
  const ucMap = new Map(ucs.map((u: any) => [u.id, u]));

  async function handleCalculate(recalculate: boolean) {
    try {
      await calculate.mutateAsync({ gdGroupId: groupId, year, month, recalculate });
      toast({ title: recalculate ? "Recalculado com sucesso" : "Cálculo realizado" });
    } catch (err: any) {
      toast({ title: "Erro no cálculo", description: err?.message, variant: "destructive" });
    }
  }

  const statusInfo = snapshot ? STATUS_LABELS[snapshot.calculation_status] || STATUS_LABELS.pending : null;

  const years = Array.from({ length: 3 }, (_, i) => defaultYear - i);

  return (
    <div className="space-y-4">
      {/* Period selector + actions */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Sun className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Energia Mensal</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
            <SelectTrigger className="w-[130px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {MONTHS.map((m, i) => (
                <SelectItem key={i + 1} value={String(i + 1)}>{m}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="w-[80px] h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y} value={String(y)}>{y}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            size="sm"
            variant={snapshot ? "outline" : "default"}
            onClick={() => handleCalculate(!!snapshot)}
            disabled={calculate.isPending}
            className="text-xs gap-1"
          >
            {calculate.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : snapshot ? (
              <RefreshCw className="w-3.5 h-3.5" />
            ) : (
              <Calculator className="w-3.5 h-3.5" />
            )}
            {snapshot ? "Recalcular" : "Calcular Mês"}
          </Button>
        </div>
      </div>

      {/* KPI Cards */}
      {loadingSnap ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
      ) : !snapshot ? (
        <div className="text-center py-8 space-y-2 rounded-lg border border-dashed border-border">
          <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
            <Calculator className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-sm font-medium text-foreground">Ainda não há cálculo para {MONTHS[month - 1]} {year}</p>
          <p className="text-xs text-muted-foreground">Clique em "Calcular Mês" para processar</p>
        </div>
      ) : (
        <>
          {/* Generation Source + Reconciliation */}
          <GdGenerationSourceCard snapshot={snapshot} />
          <GdReconciliationCard groupId={groupId} year={year} month={month} />

          {/* Status badge */}
          <div className="flex items-center gap-2">
            <Badge variant={statusInfo?.variant || "outline"} className="text-xs">
              {statusInfo?.label || snapshot.calculation_status}
            </Badge>
            {snapshot.calculation_status !== "complete" && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <AlertTriangle className="w-3 h-3" /> Dados incompletos
              </span>
            )}
          </div>

          {/* KPIs */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
                  <Zap className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">
                    {Number(snapshot.generation_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Geração (kWh)</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
                  <ArrowDownUp className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">
                    {Number(snapshot.total_compensated_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Compensado (kWh)</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-warning/10 text-warning shrink-0">
                  <TrendingUp className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">
                    {Number(snapshot.total_surplus_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Sobra (kWh)</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
              <CardContent className="flex items-center gap-3 p-4">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-info/10 text-info shrink-0">
                  <DollarSign className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-lg font-bold text-foreground leading-none">
                    {allocations.reduceformatBRL(((s, a) => s + Number(a.estimated_savings_brl || 0), 0))}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">Economia Est.</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Allocations table */}
          {loadingAlloc ? (
            <div className="space-y-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : allocations.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma alocação calculada</p>
          ) : (
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">UC Beneficiária</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">%</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Consumo</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Alocado</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Saldo Ant.</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Compensado</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Usado Saldo</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Sobra</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Déficit</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Economia</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((a) => {
                    const uc = ucMap.get(a.uc_beneficiaria_id);
                    return (
                      <TableRow key={a.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-foreground text-sm">
                          {uc ? `${uc.codigo_uc} — ${uc.nome}` : a.uc_beneficiaria_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Number(a.allocation_percent).toFixed(1)}%
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Number(a.consumed_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Number(a.allocated_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Number(a.prior_balance_kwh || 0) > 0 ? (
                            <span className="text-info">{Number(a.prior_balance_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-success">
                          {Number(a.compensated_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Number(a.used_from_balance_kwh || 0) > 0 ? (
                            <span className="text-info">{Number(a.used_from_balance_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Number(a.surplus_kwh) > 0 ? (
                            <span className="text-warning">{Number(a.surplus_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Number(a.deficit_kwh) > 0 ? (
                            <span className="text-destructive">{Number(a.deficit_kwh).toLocaleString("pt-BR", { maximumFractionDigits: 1 })}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {a.estimated_savings_brl != null
                            ? NumberformatBRL((a.estimated_savings_brl))
                            : "—"}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
