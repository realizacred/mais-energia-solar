/**
 * GdSuggestionCard — Optimization suggestion + before/after comparison.
 * Uses simple language for client portal.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Lightbulb, ArrowRight, TrendingUp, TrendingDown, CheckCircle2,
} from "lucide-react";
import type { OptimizationSuggestion, PercentageComparison } from "@/services/energia/gdPercentageService";

interface GdSuggestionCardProps {
  suggestion: OptimizationSuggestion;
  comparison: PercentageComparison[];
  tarifa: number;
  generationKwh: number;
}

export function GdSuggestionCard({ suggestion, comparison, tarifa, generationKwh }: GdSuggestionCardProps) {
  const meaningfulAdjustments = suggestion.adjustments.filter(
    (a) => Math.abs(a.deltaPercent) > 2
  );

  if (meaningfulAdjustments.length === 0) return null;

  return (
    <div className="space-y-3">
      {/* Suggestion Card */}
      <Card className="border-l-[3px] border-l-primary bg-primary/[0.02]">
        <CardHeader className="pb-2 px-4 sm:px-5">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lightbulb className="w-4 h-4 text-primary" />
            </div>
            Oportunidade de Economia
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 sm:px-5 pb-4 space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Identificamos que o percentual de distribuição pode ser ajustado para melhor
            aproveitar a energia gerada pela usina solar. Com os ajustes sugeridos, a{" "}
            <span className="font-medium text-foreground">
              eficiência pode chegar a {suggestion.projectedEfficiency.toFixed(0)}%
            </span>{" "}
            e a cobertura média a{" "}
            <span className="font-medium text-foreground">
              {Math.min(suggestion.projectedAvgCoverage, 100).toFixed(0)}%
            </span>.
          </p>

          {/* Adjustment suggestions */}
          <div className="space-y-1.5">
            <p className="text-[11px] font-semibold text-foreground uppercase tracking-wider">
              Ajustes sugeridos
            </p>
            {meaningfulAdjustments.map((adj) => (
              <div
                key={adj.ucId}
                className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 border border-border/50"
              >
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-foreground truncate block">
                    {adj.ucLabel}
                  </span>
                  {adj.type === "geradora" && (
                    <Badge variant="outline" className="text-[9px] border-primary/30 text-primary mt-0.5">
                      Geradora
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="font-mono text-xs text-muted-foreground">{adj.currentPercent}%</span>
                  <ArrowRight className="w-3 h-3 text-primary" />
                  <span className="font-mono text-xs font-semibold text-primary">{adj.suggestedPercent}%</span>
                  {adj.deltaPercent > 0 ? (
                    <TrendingUp className="w-3 h-3 text-success" />
                  ) : (
                    <TrendingDown className="w-3 h-3 text-warning" />
                  )}
                </div>
              </div>
            ))}
          </div>

          <p className="text-[10px] text-muted-foreground italic">
            * Sugestão baseada no consumo proporcional de cada unidade. Consulte seu gestor de energia para aplicar as alterações.
          </p>
        </CardContent>
      </Card>

      {/* Comparison Card */}
      <Card>
        <CardHeader className="pb-2 px-4">
          <CardTitle className="text-sm flex items-center gap-2 text-foreground">
            <CheckCircle2 className="w-4 h-4 text-success" />
            Comparação: Atual vs Otimizado
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Métrica</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Atual</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Otimizado</TableHead>
                  <TableHead className="w-[50px]" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {comparison.map((row) => (
                  <TableRow key={row.metricLabel} className="hover:bg-muted/30">
                    <TableCell className="text-sm font-medium text-foreground">{row.metricLabel}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-muted-foreground">
                      {row.currentValue}
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm font-medium text-foreground">
                      {row.suggestedValue}
                    </TableCell>
                    <TableCell>
                      {row.improved ? (
                        <TrendingUp className="w-4 h-4 text-success" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
