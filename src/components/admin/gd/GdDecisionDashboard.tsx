/**
 * GdDecisionDashboard — Intelligent GD dashboard based on percentage allocation.
 * Shows data sources with confidence, rateio summary, analysis table,
 * optimization suggestions, and comparison.
 * §25: Uses semantic tokens. §27: KPI pattern. §4: Table pattern.
 */
import { useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  PieChart, TrendingUp, TrendingDown, AlertTriangle, CheckCircle2,
  Lightbulb, ArrowRight, BarChart3, Scale, Zap, Database, Signal, FileText,
  Gauge
} from "lucide-react";
import {
  calculateDistributionByPercentage,
  suggestPercentageAdjustments,
  generateOptimizedPercentages,
  comparePercentageDistributions,
  type GdPercentageInput,
  type GdPercentageResult,
  type GdUcInput,
  type UcSituation,
} from "@/services/energia/gdPercentageService";
import type { ResolvedDataSource, UcConsumptionData } from "@/services/energia/dataSourceResolverService";

// ─── Props ──────────────────────────────────────────────────────

interface Props {
  generationKwh: number;
  generatorUc: { ucId: string; label: string; consumedKwh: number };
  beneficiaries: Array<{
    ucId: string;
    label: string;
    allocationPercent: number;
    consumedKwh: number;
  }>;
  /** Data source resolution info (optional - for confidence display) */
  dataSources?: {
    generation: ResolvedDataSource;
    generatorConsumption: ResolvedDataSource;
    beneficiaryConsumption: UcConsumptionData[];
  } | null;
  isLoadingData?: boolean;
  onApplySuggestion?: (newPercentages: Array<{ ucId: string; percent: number }>) => void;
}

// ─── Constants ──────────────────────────────────────────────────

const SITUATION_CONFIG: Record<UcSituation, { label: string; icon: typeof TrendingUp; colorClass: string }> = {
  acima_do_ideal: { label: "Acima do ideal", icon: TrendingUp, colorClass: "text-warning" },
  abaixo_do_ideal: { label: "Abaixo do ideal", icon: TrendingDown, colorClass: "text-destructive" },
  equilibrado: { label: "Equilibrado", icon: CheckCircle2, colorClass: "text-success" },
};

const CONFIDENCE_CONFIG: Record<string, { label: string; colorClass: string; badgeClass: string }> = {
  high: { label: "Alta", colorClass: "text-success", badgeClass: "bg-success/10 text-success border-success/20" },
  medium: { label: "Média", colorClass: "text-warning", badgeClass: "bg-warning/10 text-warning border-warning/20" },
  low: { label: "Baixa", colorClass: "text-destructive", badgeClass: "bg-destructive/10 text-destructive border-destructive/20" },
};

const SOURCE_ICONS: Record<string, typeof Zap> = {
  meter: Gauge,
  monitoring: Signal,
  invoice: FileText,
  average: Database,
  estimate: AlertTriangle,
  none: AlertTriangle,
};

// ─── Component ──────────────────────────────────────────────────

export function GdDecisionDashboard({
  generationKwh,
  generatorUc,
  beneficiaries,
  dataSources,
  isLoadingData,
  onApplySuggestion,
}: Props) {
  const [showComparison, setShowComparison] = useState(false);

  // Build participants
  const participants = useMemo<GdUcInput[]>(() => {
    const bens: GdUcInput[] = beneficiaries.map((b) => ({
      ucId: b.ucId,
      ucLabel: b.label,
      type: "beneficiaria" as const,
      allocationPercent: b.allocationPercent,
      consumedKwh: b.consumedKwh,
    }));
    const totalBenPercent = bens.reduce((s, b) => s + b.allocationPercent, 0);
    return [
      {
        ucId: generatorUc.ucId,
        ucLabel: generatorUc.label,
        type: "geradora" as const,
        allocationPercent: Math.max(100 - totalBenPercent, 0),
        consumedKwh: generatorUc.consumedKwh,
      },
      ...bens,
    ];
  }, [generatorUc, beneficiaries]);

  const input: GdPercentageInput = useMemo(
    () => ({ generationKwh, participants }),
    [generationKwh, participants]
  );

  // Current distribution
  const currentResult = useMemo(() => calculateDistributionByPercentage(input), [input]);

  // Suggestions
  const suggestion = useMemo(() => suggestPercentageAdjustments(currentResult), [currentResult]);

  // Optimized distribution for comparison
  const optimizedResult = useMemo<GdPercentageResult | null>(() => {
    if (!suggestion) return null;
    const optimized = generateOptimizedPercentages(participants);
    return calculateDistributionByPercentage({ generationKwh, participants: optimized });
  }, [suggestion, participants, generationKwh]);

  // Comparison
  const comparison = useMemo(() => {
    if (!optimizedResult) return null;
    return comparePercentageDistributions(currentResult, optimizedResult);
  }, [currentResult, optimizedResult]);

  // Loading state
  if (isLoadingData) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  // No data
  if (generationKwh <= 0 && participants.every((p) => p.consumedKwh <= 0)) {
    return (
      <div className="text-center py-8 space-y-2 rounded-lg border border-dashed border-border">
        <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center mx-auto">
          <BarChart3 className="w-6 h-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground">Dados insuficientes para análise</p>
        <p className="text-xs text-muted-foreground">
          Importe contas de luz ou conecte a usina para gerar dados de geração e consumo
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* ── Card 0: Fontes de Dados ── */}
      {dataSources && (
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Database className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold text-foreground">Fontes de Dados</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <DataSourceIndicator
                label="Geração"
                source={dataSources.generation}
              />
              <DataSourceIndicator
                label="Consumo Geradora"
                source={dataSources.generatorConsumption}
              />
              {dataSources.beneficiaryConsumption.map((bc) => {
                const ben = beneficiaries.find((b) => b.ucId === bc.ucId);
                return (
                  <DataSourceIndicator
                    key={bc.ucId}
                    label={`Consumo ${ben?.label?.slice(0, 25) || bc.ucId.slice(0, 8)}`}
                    source={bc.resolved}
                  />
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Card 1: Resumo do Rateio ── */}
      <Card className="border border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <PieChart className="w-4 h-4 text-primary" />
            </div>
            <CardTitle className="text-sm font-semibold text-foreground">Resumo do Rateio</CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div>
              <p className="text-xs text-muted-foreground">Geração Total</p>
              <p className="text-lg font-bold text-foreground">{fmtKwh(generationKwh)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">% Beneficiárias</p>
              <p className="text-lg font-bold text-foreground">{currentResult.totalAllocatedPercent}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">% Geradora (retido)</p>
              <p className="text-lg font-bold text-foreground">{currentResult.generatorRetainedPercent}%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Eficiência</p>
              <p className="text-lg font-bold text-foreground">{currentResult.efficiencyPercent}%</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 2: Sugestões de Otimização ── */}
      {suggestion ? (
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-warning/10 flex items-center justify-center">
                  <Lightbulb className="w-4 h-4 text-warning" />
                </div>
                <CardTitle className="text-sm font-semibold text-foreground">Sugestões de Otimização</CardTitle>
              </div>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs"
                  onClick={() => setShowComparison((v) => !v)}
                >
                  <Scale className="w-3.5 h-3.5 mr-1" />
                  {showComparison ? "Ocultar comparação" : "Simular novo rateio"}
                </Button>
                {onApplySuggestion && (
                  <Button
                    size="sm"
                    className="text-xs"
                    onClick={() => {
                      const newPercs = suggestion.adjustments
                        .filter((a) => a.type === "beneficiaria")
                        .map((a) => ({ ucId: a.ucId, percent: a.suggestedPercent }));
                      onApplySuggestion(newPercs);
                    }}
                  >
                    Aplicar sugestão
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{suggestion.description}</p>

            {/* Insights list */}
            <div className="space-y-2">
              {currentResult.results.map((r) => {
                const cfg = SITUATION_CONFIG[r.situation];
                const Icon = cfg.icon;
                return (
                  <div key={r.ucId} className="flex items-center gap-3 text-sm">
                    <Icon className={`w-4 h-4 shrink-0 ${cfg.colorClass}`} />
                    <span className="text-foreground font-medium truncate max-w-[200px]">{r.ucLabel}</span>
                    <Badge variant="outline" className="text-xs">
                      {r.type === "geradora" ? "Geradora" : "Beneficiária"}
                    </Badge>
                    <span className={`text-xs ${cfg.colorClass}`}>{cfg.label}</span>
                    {r.situation !== "equilibrado" && (
                      <span className="text-xs text-muted-foreground ml-auto">
                        {r.differenceKwh > 0 ? "+" : ""}{fmtKwh(r.differenceKwh)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Suggested new percentages */}
            <div className="rounded-lg bg-muted/30 p-4 space-y-2">
              <p className="text-xs font-semibold text-foreground">Novo rateio sugerido:</p>
              {suggestion.adjustments.map((a) => (
                <div key={a.ucId} className="flex items-center gap-2 text-sm">
                  <span className="text-foreground truncate max-w-[180px]">{a.ucLabel}</span>
                  <span className="font-mono text-muted-foreground">{a.currentPercent}%</span>
                  <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="font-mono font-semibold text-foreground">{a.suggestedPercent}%</span>
                  {Math.abs(a.deltaPercent) > 0.5 && (
                    <span className={`text-xs ${a.deltaPercent > 0 ? "text-success" : "text-destructive"}`}>
                      ({a.deltaPercent > 0 ? "+" : ""}{a.deltaPercent}pp)
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : (
        generationKwh > 0 && (
          <Card className="border border-border bg-card shadow-sm">
            <CardContent className="flex items-center gap-3 p-5">
              <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-4 h-4 text-success" />
              </div>
              <div>
                <p className="text-sm font-medium text-foreground">Rateio equilibrado</p>
                <p className="text-xs text-muted-foreground">Os percentuais atuais estão adequados ao consumo de cada UC</p>
              </div>
            </CardContent>
          </Card>
        )
      )}

      {/* ── Card 3: Tabela de Análise ── */}
      {generationKwh > 0 && (
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-4 h-4 text-primary" />
              </div>
              <CardTitle className="text-sm font-semibold text-foreground">Análise por UC</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">UC</TableHead>
                    <TableHead className="font-semibold text-foreground">Tipo</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">% Atual</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Consumo</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Crédito</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Diferença</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Cobertura</TableHead>
                    <TableHead className="font-semibold text-foreground">Situação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {currentResult.results.map((r) => {
                    const cfg = SITUATION_CONFIG[r.situation];
                    const Icon = cfg.icon;
                    return (
                      <TableRow key={r.ucId} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-medium text-foreground text-sm truncate max-w-[200px]">
                          {r.ucLabel}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {r.type === "geradora" ? "GD" : "Ben."}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">{r.allocationPercent}%</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtKwh(r.consumedKwh)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">{fmtKwh(r.allocatedKwh)}</TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          <span className={r.differenceKwh >= 0 ? "text-success" : "text-destructive"}>
                            {r.differenceKwh > 0 ? "+" : ""}{fmtKwh(r.differenceKwh)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm">
                          {Math.min(r.coveragePercent, 999)}%
                        </TableCell>
                        <TableCell>
                          <div className={`flex items-center gap-1 text-xs ${cfg.colorClass}`}>
                            <Icon className="w-3.5 h-3.5" />
                            {cfg.label}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── Card 4: Comparação Atual vs Sugerido ── */}
      {showComparison && comparison && optimizedResult && (
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-info/10 flex items-center justify-center">
                <Scale className="w-4 h-4 text-info" />
              </div>
              <CardTitle className="text-sm font-semibold text-foreground">Atual vs Sugerido</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <div className="rounded-lg border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Métrica</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Atual</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Sugerido</TableHead>
                    <TableHead className="font-semibold text-foreground text-center">Resultado</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {comparison.map((c) => (
                    <TableRow key={c.metricLabel} className="hover:bg-muted/30 transition-colors">
                      <TableCell className="font-medium text-foreground text-sm">{c.metricLabel}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-muted-foreground">{c.currentValue}</TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold text-foreground">{c.suggestedValue}</TableCell>
                      <TableCell className="text-center">
                        {c.improved ? (
                          <Badge className="text-xs bg-success/10 text-success border-success/20">
                            <TrendingUp className="w-3 h-3 mr-1" /> Melhor
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">Igual</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── Sub-Components ─────────────────────────────────────────────

function DataSourceIndicator({ label, source }: { label: string; source: ResolvedDataSource }) {
  const conf = CONFIDENCE_CONFIG[source.confidence] || CONFIDENCE_CONFIG.low;
  const SourceIcon = SOURCE_ICONS[source.source] || AlertTriangle;

  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <SourceIcon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-muted-foreground truncate">{label}</p>
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">
            {source.value > 0 ? fmtKwh(source.value) + " kWh" : "—"}
          </span>
          <Badge variant="outline" className={`text-[10px] ${conf.badgeClass}`}>
            {conf.label}
          </Badge>
        </div>
        <p className="text-[10px] text-muted-foreground truncate">{source.label}</p>
      </div>
    </div>
  );
}

// ─── Formatters ─────────────────────────────────────────────────

function fmtKwh(v: number): string {
  return v.toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}
