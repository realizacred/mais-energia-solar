import React from "react";
import { AlertTriangle, CheckCircle2, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface PriorityAlertBlockProps {
  alerts: Array<{ id: string; title: string; severity: string; plant_id: string }>;
  onViewAlerts: () => void;
}

export function PriorityAlertBlock({ alerts, onViewAlerts }: PriorityAlertBlockProps) {
  const criticals = alerts.filter((a) => a.severity === "critical");
  const hasCritical = criticals.length > 0;

  if (!hasCritical && alerts.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-success/20 bg-success/5 px-5 py-4">
        <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
        <p className="text-sm font-medium text-foreground">Sistema operando dentro da normalidade</p>
      </div>
    );
  }

  const topAlert = criticals[0] || alerts[0];

  return (
    <div className={cn(
      "flex items-center justify-between gap-4 rounded-2xl border px-5 py-4",
      hasCritical
        ? "border-destructive/25 bg-gradient-to-r from-destructive/5 via-destructive/3 to-transparent"
        : "border-warning/25 bg-gradient-to-r from-warning/5 via-warning/3 to-transparent"
    )}>
      <div className="flex items-center gap-3 min-w-0">
        <div className={cn(
          "h-9 w-9 rounded-full flex items-center justify-center shrink-0",
          hasCritical ? "bg-destructive/10" : "bg-warning/10"
        )}>
          <AlertTriangle className={cn("h-4 w-4", hasCritical ? "text-destructive" : "text-warning")} />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{topAlert.title}</p>
          <p className="text-xs text-muted-foreground">
            {alerts.length === 1 ? "1 alerta ativo" : `${alerts.length} alertas ativos`}
          </p>
        </div>
      </div>
      <Button variant="ghost" size="sm" onClick={onViewAlerts} className="shrink-0 gap-1">
        Ver detalhes <ChevronRight className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
