/**
 * GdPublicDashboard — Main GD section for the public UC portal.
 * Integrates flow explanation, KPIs, UC table, suggestions, and comparison.
 * §27: KPI pattern. §4: Table pattern. §12: Skeleton loading.
 */
import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DollarSign, Zap, TrendingUp, PieChart, BatteryCharging,
  CheckCircle2, TrendingDown, AlertTriangle, Info,
} from "lucide-react";
import {
  calculateDistributionByPercentage,
  suggestPercentageAdjustments,
  comparePercentageDistributions,
  type GdPercentageInput,
  type GdPercentageResult,
  type UcSituation,
} from "@/services/energia/gdPercentageService";
import { GdFlowExplanation } from "./GdFlowExplanation";
import { GdSuggestionCard } from "./GdSuggestionCard";
import type { PublicGdData } from "@/hooks/usePublicGdData";

const MONTHS = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

const SITUATION_CONFIG: Record<UcSituation, { label: string; colorClass: string; bgClass: string }> = {
  acima_do_ideal: { label: "Acima do ideal", colorClass: "text-warning", bgClass: "bg-warning/10 border-warning/20" },
  abaixo_do_ideal: { label: "Abaixo do ideal", colorClass: "text-destructive", bgClass: "bg-destructive/10 border-destructive/20" },
  equilibrado: { label: "Equilibrado", colorClass: "text-success", bgClass: "bg-success/10 border-success/20" },
};

interface GdPublicDashboardProps {
  gdData: PublicGdData;
  isLoading: boolean;
  brandPrimary?: string;
}

export function GdPublicDashboard({ gdData, isLoading, brandPrimary }: GdPublicDashboardProps) {
  const hasGd = gdData?.has_gd ?? false;
  const beneficiaries = gdData?.beneficiaries ?? [];
  const geradora_invoices = gdData?.geradora_invoices ?? [];
  const tarifa_kwh = gdData?.tarifa_kwh ?? 0.85;
  const uc_geradora_name = gdData?.uc_geradora_name;
  const uc_geradora_id = gdData?.uc_geradora_id;
  const categoria_gd = gdData?.categoria_gd;
  const group_name = gdData?.group_name;

  // Calculate distribution using the existing service
  const calculation = useMemo(() => {
    if (!beneficiaries.length || !geradora_invoices?.length) return null;

    const latestGenInvoice = geradora_invoices[0];
    const generationKwh = Number(latestGenInvoice?.injected_kwh || 0);
    if (generationKwh <= 0) return null;

    const participants: GdPercentageInput["participants"] = [];

    // Geradora
    participants.push({
      ucId: uc_geradora_id!,
      ucLabel: uc_geradora_name || "Geradora",
      type: "geradora",
      allocationPercent: 0, // calculated automatically
      consumedKwh: Number(latestGenInvoice?.consumed_kwh || 0),
    });

    // Beneficiaries
    beneficiaries.forEach((b) => {
      const consumed = b.latest_invoice?.consumed_kwh
        ? Number(b.latest_invoice.consumed_kwh)
        : Number(b.avg_consumed_kwh || 0);
      participants.push({
        ucId: b.uc_id,
        ucLabel: b.uc_name,
        type: "beneficiaria",
        allocationPercent: Number(b.allocation_percent),
        consumedKwh: consumed,
      });
    });

    const input: GdPercentageInput = { generationKwh, participants };
    const result = calculateDistributionByPercentage(input);
    const suggestion = suggestPercentageAdjustments(result);

    let comparison = null;
    if (suggestion) {
      const optimizedInput: GdPercentageInput = {
        generationKwh,
        participants: suggestion.adjustments.map((a) => ({
          ucId: a.ucId,
          ucLabel: a.ucLabel,
          type: a.type,
          allocationPercent: a.suggestedPercent,
          consumedKwh: result.results.find((r) => r.ucId === a.ucId)?.consumedKwh || 0,
        })),
      };
      const suggestedResult = calculateDistributionByPercentage(optimizedInput);
      comparison = comparePercentageDistributions(result, suggestedResult);
    }

    return { result, suggestion, comparison };
  }, [beneficiaries, geradora_invoices, uc_geradora_id, uc_geradora_name]);

  const latestGenInvoice = geradora_invoices?.[0];
  const refPeriod = latestGenInvoice
    ? `${MONTHS[(latestGenInvoice.ref_month || 1) - 1]}/${latestGenInvoice.ref_year}`
    : "";

  // Total savings from all UCs
  const totalSavings = useMemo(() => {
    let total = 0;
    if (latestGenInvoice?.savings_brl) total += Number(latestGenInvoice.savings_brl);
    beneficiaries.forEach((b) => {
      if (b.latest_invoice?.savings_brl) total += Number(b.latest_invoice.savings_brl);
      else if (b.latest_invoice?.compensated_kwh) total += Number(b.latest_invoice.compensated_kwh) * tarifa_kwh;
    });
    return total;
  }, [latestGenInvoice, beneficiaries, tarifa_kwh]);

  const totalCompensated = useMemo(() => {
    let total = Number(latestGenInvoice?.compensated_kwh || 0);
    beneficiaries.forEach((b) => {
      total += Number(b.latest_invoice?.compensated_kwh || 0);
    });
    return total;
  }, [latestGenInvoice, beneficiaries]);

  // Early returns AFTER all hooks
  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-48 w-full rounded-lg" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }

  if (!hasGd) return null;

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <PieChart className="w-5 h-5 text-primary" />
        <h2 className="text-base sm:text-lg font-bold text-foreground">
          Geração Distribuída
          {group_name && <span className="text-sm font-normal text-muted-foreground ml-2">— {group_name}</span>}
        </h2>
        {refPeriod && (
          <Badge variant="outline" className="ml-auto text-xs">
            Ref: {refPeriod}
          </Badge>
        )}
      </div>

      {/* 1. Flow Explanation */}
      <GdFlowExplanation
        categoriaGd={categoria_gd}
        geradoraName={uc_geradora_name}
        beneficiaryCount={beneficiaries.length}
        brandPrimary={brandPrimary}
      />

      {/* 2. KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <DollarSign className="w-3.5 h-3.5 text-primary shrink-0" />
              <span className="text-[11px] sm:text-xs text-muted-foreground">Economia no Mês</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
              R$ {totalSavings.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <Zap className="w-3.5 h-3.5 text-success shrink-0" />
              <span className="text-[11px] sm:text-xs text-muted-foreground">Energia Gerada</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
              {Number(latestGenInvoice?.injected_kwh || 0).toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              <span className="text-xs font-normal text-muted-foreground ml-1">kWh</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <BatteryCharging className="w-3.5 h-3.5 text-info shrink-0" />
              <span className="text-[11px] sm:text-xs text-muted-foreground">Compensado</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
              {totalCompensated.toLocaleString("pt-BR", { maximumFractionDigits: 0 })}
              <span className="text-xs font-normal text-muted-foreground ml-1">kWh</span>
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="p-3 sm:p-4">
            <div className="flex items-center gap-1.5 mb-1">
              <TrendingUp className="w-3.5 h-3.5 text-warning shrink-0" />
              <span className="text-[11px] sm:text-xs text-muted-foreground">Cobertura</span>
            </div>
            <p className="text-lg sm:text-xl font-bold text-foreground font-mono">
              {calculation?.result.avgCoveragePercent
                ? `${Math.min(calculation.result.avgCoveragePercent, 100).toFixed(0)}%`
                : "—"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* 3. UC Analysis Table */}
      {calculation?.result && (
        <Card>
          <CardHeader className="pb-2 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <PieChart className="w-4 h-4 text-primary" />
              Distribuição por Unidade
              <Tooltip>
                <TooltipTrigger>
                  <Info className="w-3.5 h-3.5 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs">
                  Cada unidade recebe um percentual da energia gerada. A situação indica se o percentual está adequado ao consumo real.
                </TooltipContent>
              </Tooltip>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {/* Desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Unidade</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">%</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Consumo</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Crédito</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Cobertura</TableHead>
                    <TableHead className="font-semibold text-foreground">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calculation.result.results.map((uc) => {
                    const sit = SITUATION_CONFIG[uc.situation];
                    return (
                      <TableRow key={uc.ucId} className="hover:bg-muted/30">
                        <TableCell className="text-sm">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-foreground">{uc.ucLabel}</span>
                            {uc.type === "geradora" && (
                              <Badge variant="outline" className="text-[10px] border-primary/30 text-primary">GD</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{uc.allocationPercent}%</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {uc.consumedKwh.toLocaleString("pt-BR")} kWh
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-success">
                          {uc.allocatedKwh.toLocaleString("pt-BR")} kWh
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Math.min(uc.coveragePercent, 100).toFixed(0)}%
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-[10px] ${sit.bgClass} ${sit.colorClass}`}>
                            {sit.label}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>

            {/* Mobile */}
            <div className="sm:hidden divide-y divide-border">
              {calculation.result.results.map((uc) => {
                const sit = SITUATION_CONFIG[uc.situation];
                return (
                  <div key={uc.ucId} className="p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                        {uc.ucLabel}
                        {uc.type === "geradora" && (
                          <Badge variant="outline" className="text-[9px] border-primary/30 text-primary">GD</Badge>
                        )}
                      </span>
                      <Badge variant="outline" className={`text-[10px] ${sit.bgClass} ${sit.colorClass}`}>
                        {sit.label}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Percentual</span>
                        <span className="font-mono font-medium">{uc.allocationPercent}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Consumo</span>
                        <span className="font-mono">{uc.consumedKwh.toLocaleString("pt-BR")} kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Crédito</span>
                        <span className="font-mono text-success">{uc.allocatedKwh.toLocaleString("pt-BR")} kWh</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Cobertura</span>
                        <span className="font-mono">{Math.min(uc.coveragePercent, 100).toFixed(0)}%</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 4. Suggestion + Comparison */}
      {calculation?.suggestion && calculation?.comparison && (
        <GdSuggestionCard
          suggestion={calculation.suggestion}
          comparison={calculation.comparison}
          tarifa={tarifa_kwh}
          generationKwh={calculation.result.generationKwh}
        />
      )}

      {/* Data source note */}
      <p className="text-[10px] text-muted-foreground flex items-center gap-1 px-1">
        <Info className="w-3 h-3 shrink-0" />
        Dados baseados na última fatura processada de cada unidade. Os valores de economia são estimativas calculadas com a tarifa média.
      </p>
    </div>
  );
}
