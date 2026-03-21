/**
 * ClientEnergyAlerts — Simplified alert display for client portal.
 * Shows only warning/critical unresolved alerts for their units.
 */
import React from "react";
import { AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { useClientEnergyAlerts } from "@/hooks/useEnergyAlerts";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const ALERT_TYPE_LABELS: Record<string, string> = {
  no_generation: "Sem geração",
  missing_invoice: "Fatura ausente",
  allocation_mismatch: "Rateio irregular",
  meter_offline: "Medidor offline",
  reconciliation_critical: "Divergência detectada",
};

interface Props {
  unitIds: string[];
}

export function ClientEnergyAlerts({ unitIds }: Props) {
  const { data: alerts = [], isLoading } = useClientEnergyAlerts(unitIds);

  if (isLoading) return null;

  if (alerts.length === 0) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-success/10 border border-success/20">
        <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
        <span className="text-sm font-medium text-success">Nenhum alerta ativo</span>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className={`flex items-start gap-3 p-3 rounded-lg border ${
            alert.severity === "critical"
              ? "border-destructive/25 bg-destructive/5"
              : "border-warning/25 bg-warning/5"
          }`}
        >
          <AlertTriangle className={`w-4 h-4 mt-0.5 shrink-0 ${
            alert.severity === "critical" ? "text-destructive" : "text-warning"
          }`} />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{alert.title}</p>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">
                {ALERT_TYPE_LABELS[alert.alert_type] || alert.alert_type}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(alert.created_at), { addSuffix: true, locale: ptBR })}
              </span>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
