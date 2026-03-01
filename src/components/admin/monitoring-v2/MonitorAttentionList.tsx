import React from "react";
import type { MonitorEvent } from "@/services/monitoring/monitorTypes";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Props {
  alerts: MonitorEvent[];
  onViewPlant: (plantId: string) => void;
}

const SEVERITY_MAP: Record<string, string> = {
  critical: "Crítico",
  warn: "Alerta",
  info: "Info",
};

export function MonitorAttentionList({ alerts, onViewPlant }: Props) {
  if (alerts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground py-4 text-center">
        Nenhum alerta aberto no momento 🎉
      </p>
    );
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border bg-card hover:bg-muted/30 transition-colors"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <StatusBadge
              status={SEVERITY_MAP[alert.severity] || alert.severity}
              size="sm"
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
              <p className="text-2xs text-muted-foreground">
                {formatDistanceToNow(new Date(alert.starts_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onViewPlant(alert.plant_id)}>
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
