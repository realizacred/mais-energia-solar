import React from "react";
import type { MonitorEvent } from "@/services/monitoring/monitorTypes";
import { StatusBadge } from "@/components/ui/status-badge";
import { Button } from "@/components/ui/button";
import { Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Props {
  alerts: MonitorEvent[];
  onViewPlant: (plantId: string) => void;
}

const SEVERITY_MAP: Record<string, string> = {
  critical: "Crítico",
  warn: "Alerta",
  info: "Info",
};

const SEVERITY_DOT: Record<string, string> = {
  critical: "bg-destructive",
  warn: "bg-warning",
  info: "bg-info",
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
    <div className="space-y-1.5">
      {alerts.map((alert) => (
        <div
          key={alert.id}
          className="flex items-center justify-between gap-3 p-3 rounded-lg border border-border/50 bg-card hover:shadow-sm transition-all group"
        >
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <div className={cn("h-2 w-2 rounded-full shrink-0", SEVERITY_DOT[alert.severity] || "bg-muted-foreground")} />
            <div className="min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{alert.title}</p>
              <p className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(alert.starts_at), { addSuffix: true, locale: ptBR })}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => onViewPlant(alert.plant_id)}
            className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
          >
            <Eye className="h-3.5 w-3.5" />
          </Button>
        </div>
      ))}
    </div>
  );
}
