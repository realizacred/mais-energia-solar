import { Activity, CheckCircle2, AlertTriangle, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { PreventiveHeatmapRow, PreventiveStatus } from "@/hooks/usePreventiveHeatmap";

interface Props {
  rows: PreventiveHeatmapRow[];
}

const statusMeta: Record<
  PreventiveStatus,
  { label: string; icon: typeof CheckCircle2; badgeClass: string; barClass: string; borderClass: string }
> = {
  saudavel: {
    label: "Saudável",
    icon: CheckCircle2,
    badgeClass: "bg-success/10 text-success border-success/30",
    barClass: "[&>div]:bg-success",
    borderClass: "border-l-success",
  },
  atencao: {
    label: "Atenção",
    icon: AlertTriangle,
    badgeClass: "bg-warning/10 text-warning border-warning/30",
    barClass: "[&>div]:bg-warning",
    borderClass: "border-l-warning",
  },
  critico: {
    label: "Crítico",
    icon: ShieldAlert,
    badgeClass: "bg-destructive/10 text-destructive border-destructive/30",
    barClass: "[&>div]:bg-destructive",
    borderClass: "border-l-destructive",
  },
};

export function PreventiveHeatmap({ rows }: Props) {
  const ordered = ["comercial", "pos_venda", "engenharia", "financeiro"]
    .map((d) => rows.find((r) => r.dominio === d))
    .filter(Boolean) as PreventiveHeatmapRow[];

  return (
    <Card className="border border-border bg-card shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Activity className="h-4 w-4 text-primary" />
          </div>
          Saúde Operacional
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {ordered.length === 0 && (
            <p className="text-sm text-muted-foreground col-span-full">
              Sem dados operacionais ainda.
            </p>
          )}
          {ordered.map((r) => {
            const meta = statusMeta[r.status];
            const Icon = meta.icon;
            return (
              <Tooltip key={r.dominio}>
                <TooltipTrigger asChild>
                  <div
                    className={cn(
                      "rounded-lg border border-border border-l-[3px] bg-card p-4 transition-all hover:shadow-md hover:-translate-y-0.5 cursor-default",
                      meta.borderClass
                    )}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                        {r.dominio_label}
                      </span>
                      <Badge variant="outline" className={cn("gap-1", meta.badgeClass)}>
                        <Icon className="h-3 w-3" />
                        {meta.label}
                      </Badge>
                    </div>
                    <div className="flex items-baseline justify-between mb-2 tabular-nums">
                      <span className="text-2xl font-bold text-foreground">{r.criticos}</span>
                      <span className="text-xs text-muted-foreground">de {r.total}</span>
                    </div>
                    <Progress value={r.criticos_pct} className={cn("h-1.5", meta.barClass)} />
                    <p className="text-[11px] text-muted-foreground mt-2 tabular-nums">
                      {r.criticos_pct}% críticos
                    </p>
                  </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">
                  {r.criticos} item(ns) crítico(s) em {r.total} monitorado(s) no domínio {r.dominio_label}.
                </TooltipContent>
              </Tooltip>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
