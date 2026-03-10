import React from "react";
import {
  Activity, Moon, WifiOff, AlertTriangle, Zap,
  BatteryCharging, BarChart3, DollarSign, TrendingUp, Leaf,
} from "lucide-react";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { cn } from "@/lib/utils";
import { formatBRL } from "@/lib/formatters/index";

interface OperationalSummaryProps {
  onlinePerc: number;
  alertCount: number;
  currentPowerKw: number;
  energyTodayKwh: number;
  standbyCount: number;
  offlineCount: number;
  avgPR: number | null;
  financials: any;
}

export function OperationalSummary({ onlinePerc, alertCount, currentPowerKw, energyTodayKwh, standbyCount, offlineCount, avgPR, financials }: OperationalSummaryProps) {
  const rows = [
    { label: "Disponibilidade", value: `${onlinePerc}%`, icon: Activity, color: onlinePerc >= 90 ? "text-success" : onlinePerc >= 70 ? "text-warning" : "text-destructive" },
    { label: "Standby", value: String(standbyCount), icon: Moon, color: "text-warning" },
    { label: "Offline", value: String(offlineCount), icon: WifiOff, color: offlineCount > 0 ? "text-destructive" : "text-muted-foreground" },
    { label: "Alertas ativos", value: String(alertCount), icon: AlertTriangle, color: alertCount > 0 ? "text-destructive" : "text-success" },
    { label: "Potência ativa", value: currentPowerKw > 0 ? `${(currentPowerKw).toFixed(0)} kW` : "—", icon: Zap, color: "text-primary" },
    { label: "Energia acumulada hoje", value: `${energyTodayKwh.toFixed(0)} kWh`, icon: BatteryCharging, color: "text-secondary" },
    ...(avgPR !== null ? [{ label: "Performance Ratio", value: `${avgPR}%`, icon: BarChart3, color: avgPR >= 75 ? "text-success" : avgPR >= 60 ? "text-warning" : "text-destructive" }] : []),
    ...(financials ? [
      { label: "Economia hoje", value: formatBRL(financials.savings_today_brl), icon: DollarSign, color: "text-success" },
      { label: "Economia mês", value: formatBRL(financials.savings_month_brl), icon: TrendingUp, color: "text-info" },
      { label: "CO₂ evitado", value: `${financials.co2_avoided_month_kg.toFixed(0)} kg`, icon: Leaf, color: "text-success" },
    ] : []),
  ];

  return (
    <SectionCard title="Resumo Operacional" icon={BarChart3}>
      <div className="space-y-0 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
            <div className="flex items-center gap-2.5 text-sm text-muted-foreground">
              <row.icon className={cn("h-3.5 w-3.5", row.color)} />
              <span>{row.label}</span>
            </div>
            <span className={cn("text-sm font-semibold", row.color)}>{row.value}</span>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}
