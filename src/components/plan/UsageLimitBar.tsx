import { Progress } from "@/components/ui/progress";
import { useUsageLimit } from "@/hooks/useUsageLimits";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";

const METRIC_LABELS: Record<string, string> = {
  max_ai_insights_month: "Insights IA / mês",
  max_reports_pdf_month: "Relatórios PDF / mês",
  max_automations: "Automações",
  max_performance_alerts: "Alertas de performance / mês",
  max_leads_month: "Leads / mês",
  max_wa_messages_month: "Mensagens WhatsApp / mês",
  max_proposals_month: "Propostas / mês",
  max_users: "Usuários",
  max_storage_mb: "Armazenamento (MB)",
};

interface UsageLimitBarProps {
  metricKey: string;
  label?: string;
  showWarning?: boolean;
}

export function UsageLimitBar({ metricKey, label, showWarning = true }: UsageLimitBarProps) {
  const { current, limit, percentage, isNearLimit, isAtLimit, isLoading, isUnlimited } = useUsageLimit(metricKey);

  if (isLoading) {
    return <Skeleton className="h-10 w-full" />;
  }

  if (isUnlimited) return null;

  const displayLabel = label || METRIC_LABELS[metricKey] || metricKey;

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{displayLabel}</span>
        <span className={`font-medium ${isAtLimit ? "text-destructive" : isNearLimit ? "text-warning" : "text-foreground"}`}>
          {current} / {limit}
        </span>
      </div>
      <Progress
        value={percentage}
        className={`h-2 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-warning" : ""}`}
      />
      {showWarning && isNearLimit && !isAtLimit && (
        <p className="flex items-center gap-1 text-xs text-warning">
          <AlertTriangle className="w-3 h-3" />
          Próximo do limite ({percentage}%)
        </p>
      )}
      {showWarning && isAtLimit && (
        <p className="flex items-center gap-1 text-xs text-destructive">
          <AlertTriangle className="w-3 h-3" />
          Limite atingido
        </p>
      )}
    </div>
  );
}
