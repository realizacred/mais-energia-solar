import React, { useMemo } from "react";
import { CalendarDays, Wrench, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { PlantPerformanceRatio } from "@/services/monitoring/monitorFinancialService";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface MaintenanceItem {
  plantId: string;
  plantName: string;
  reason: string;
  urgency: "high" | "medium" | "low";
  prPercent: number;
  suggestedAction: string;
}

interface Props {
  prData: PlantPerformanceRatio[];
  plants: Array<{
    id: string;
    name: string;
    installed_power_kwp: number | null;
    health?: { last_seen_at: string | null; updated_at: string };
  }>;
}

const URGENCY_CONFIG = {
  high: { label: "Urgente", variant: "destructive" as const, icon: AlertTriangle, color: "text-destructive" },
  medium: { label: "Atenção", variant: "default" as const, icon: Clock, color: "text-warning" },
  low: { label: "Preventiva", variant: "secondary" as const, icon: CheckCircle2, color: "text-success" },
};

/**
 * Analyzes plant performance to suggest maintenance actions.
 * Low PR indicates dirty panels, shading, or equipment issues.
 */
function analyzeMaintenanceNeeds(
  prData: PlantPerformanceRatio[],
  plants: Props["plants"]
): MaintenanceItem[] {
  const items: MaintenanceItem[] = [];

  prData.forEach((pr) => {
    // Skip plants with no generation data (actual_month_kwh = 0 means no readings, not low PR)
    if (pr.actual_month_kwh <= 0) return;

    if (pr.pr_percent < 50) {
      items.push({
        plantId: pr.plant_id,
        plantName: pr.plant_name,
        reason: `PR muito baixo (${pr.pr_percent}%)`,
        urgency: "high",
        prPercent: pr.pr_percent,
        suggestedAction: "Verificar inversores, sujeira nos painéis e sombreamento",
      });
    } else if (pr.pr_percent < 70) {
      items.push({
        plantId: pr.plant_id,
        plantName: pr.plant_name,
        reason: `PR abaixo do ideal (${pr.pr_percent}%)`,
        urgency: "medium",
        prPercent: pr.pr_percent,
        suggestedAction: "Agendar limpeza dos painéis solares",
      });
    }
  });

  // Check for plants that haven't been seen recently (>7 days)
  const now = Date.now();
  plants.forEach((p) => {
    const lastSeen = p.health?.last_seen_at;
    if (lastSeen) {
      const diff = now - new Date(lastSeen).getTime();
      const daysDiff = diff / (1000 * 60 * 60 * 24);
      if (daysDiff > 7) {
        // Avoid duplicates
        if (!items.some((i) => i.plantId === p.id)) {
          items.push({
            plantId: p.id,
            plantName: p.name,
            reason: `Sem comunicação há ${Math.floor(daysDiff)} dias`,
            urgency: "high",
            prPercent: 0,
            suggestedAction: "Verificar conexão do datalogger e acesso à internet",
          });
        }
      }
    }
  });

  // Add preventive maintenance for plants with decent PR (>= 70) but no recent cleaning
  const plantsWithGoodPR = prData.filter(
    (pr) => pr.pr_percent >= 70 && pr.pr_percent < 85
  );
  plantsWithGoodPR.forEach((pr) => {
    if (!items.some((i) => i.plantId === pr.plant_id)) {
      items.push({
        plantId: pr.plant_id,
        plantName: pr.plant_name,
        reason: `PR ${pr.pr_percent}% — limpeza preventiva recomendada`,
        urgency: "low",
        prPercent: pr.pr_percent,
        suggestedAction: "Limpeza preventiva para manter eficiência ideal",
      });
    }
  });

  return items.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.urgency] - order[b.urgency];
  });
}

export function MaintenanceCalendar({ prData, plants }: Props) {
  const items = useMemo(() => analyzeMaintenanceNeeds(prData, plants), [prData, plants]);

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center">
        <CheckCircle2 className="h-8 w-8 text-success mb-2" />
        <p className="text-sm font-medium text-foreground">Tudo em dia!</p>
        <p className="text-xs text-muted-foreground mt-1">
          Nenhuma manutenção necessária no momento.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-destructive" />
          {items.filter((i) => i.urgency === "high").length} urgente(s)
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-warning" />
          {items.filter((i) => i.urgency === "medium").length} atenção
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-full bg-success" />
          {items.filter((i) => i.urgency === "low").length} preventiva(s)
        </span>
      </div>

      {/* Items */}
      <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
        {items.map((item) => {
          const config = URGENCY_CONFIG[item.urgency];
          const UrgencyIcon = config.icon;

          return (
            <div
              key={`${item.plantId}-${item.urgency}`}
              className="flex items-start gap-3 p-3 rounded-lg border border-border/60 bg-card/50 hover:bg-card transition-colors"
            >
              <div className={cn("mt-0.5 shrink-0", config.color)}>
                <UrgencyIcon className="h-4 w-4" />
              </div>
              <div className="flex-1 min-w-0 space-y-1">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-foreground truncate">{item.plantName}</p>
                  <Badge variant={config.variant} className="text-2xs shrink-0">
                    {config.label}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{item.reason}</p>
                <p className="text-xs text-foreground/70 flex items-center gap-1">
                  <Wrench className="h-3 w-3" />
                  {item.suggestedAction}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
