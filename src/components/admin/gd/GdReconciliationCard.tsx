/**
 * GdReconciliationCard — Shows source comparison for a GD group month.
 * §27: KPI card pattern. §1: semantic colors only.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { GitCompareArrows, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { useGdReconciliation, type GdReconciliationRecord } from "@/hooks/useGdReconciliation";

interface Props {
  groupId: string;
  year: number;
  month: number;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive"; icon: React.ElementType; color: string }> = {
  ok: { label: "OK", variant: "default", icon: CheckCircle2, color: "text-success" },
  warning: { label: "Atenção", variant: "secondary", icon: AlertTriangle, color: "text-warning" },
  critical: { label: "Crítico", variant: "destructive", icon: XCircle, color: "text-destructive" },
};

const SOURCE_LABELS: Record<string, string> = {
  meter: "Medidor",
  monitoring: "Monitoramento",
  invoice: "Fatura",
  missing: "Sem dados",
};

function formatKwh(val: number | null): string {
  if (val === null || val === undefined) return "—";
  return Number(val).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
}

export function GdReconciliationCard({ groupId, year, month }: Props) {
  const { data: rec, isLoading } = useGdReconciliation(groupId, year, month);

  if (isLoading) {
    return <Skeleton className="h-32 w-full rounded-lg" />;
  }

  if (!rec) return null;

  const statusCfg = STATUS_CONFIG[rec.status] || STATUS_CONFIG.ok;
  const StatusIcon = statusCfg.icon;

  const sources = [
    { label: "Medidor", kwh: rec.meter_kwh, selected: rec.selected_source === "meter" },
    { label: "Monitoramento", kwh: rec.monitoring_kwh, selected: rec.selected_source === "monitoring" },
    { label: "Fatura", kwh: rec.invoice_kwh, selected: rec.selected_source === "invoice" },
  ];

  const hasMultipleSources = sources.filter((s) => s.kwh !== null && Number(s.kwh) > 0).length >= 2;

  return (
    <Card className="border-border bg-card shadow-sm">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 text-primary shrink-0">
              <GitCompareArrows className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-foreground">Reconciliação de Fontes</p>
              <p className="text-xs text-muted-foreground">
                Fonte: {SOURCE_LABELS[rec.selected_source] || rec.selected_source}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {hasMultipleSources && (
              <span className="text-xs font-mono text-muted-foreground">
                Δ {Number(rec.diff_percent).toFixed(1)}%
              </span>
            )}
            <Badge variant={statusCfg.variant} className="text-xs gap-1">
              <StatusIcon className="w-3 h-3" />
              {statusCfg.label}
            </Badge>
          </div>
        </div>

        {hasMultipleSources && (
          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground text-xs">Fonte</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-right">kWh</TableHead>
                  <TableHead className="font-semibold text-foreground text-xs text-center">Usada</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sources.filter((s) => s.kwh !== null && Number(s.kwh) > 0).map((s) => (
                  <TableRow key={s.label} className="hover:bg-muted/30 transition-colors">
                    <TableCell className="text-sm text-foreground">{s.label}</TableCell>
                    <TableCell className="text-right font-mono text-sm">{formatKwh(s.kwh)}</TableCell>
                    <TableCell className="text-center">
                      {s.selected ? (
                        <CheckCircle2 className="w-4 h-4 text-success inline-block" />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}

        {rec.notes && (
          <p className="text-xs text-muted-foreground">{rec.notes}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Simple badge for client-side view.
 */
export function ReconciliationStatusBadge({ status }: { status: "ok" | "warning" | "critical" }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.ok;
  const Icon = cfg.icon;
  return (
    <Badge variant={cfg.variant} className="text-xs gap-1">
      <Icon className="w-3 h-3" />
      {cfg.label}
    </Badge>
  );
}
