import { useUpsellAlerts } from "@/hooks/useUpsellAlerts";
import { AlertTriangle, TrendingUp, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

const METRIC_LABELS: Record<string, string> = {
  max_ai_insights_month: "Insights IA",
  max_reports_pdf_month: "Relatórios PDF",
  max_automations: "Automações",
  max_performance_alerts: "Alertas de Performance",
  max_leads_month: "Leads",
  max_wa_messages_month: "Mensagens WhatsApp",
  max_proposals_month: "Propostas",
  max_users: "Usuários",
};

export function UpsellBanner() {
  const { data: alerts = [] } = useUpsellAlerts();

  if (alerts.length === 0) return null;

  const blocked = alerts.filter((a) => a.status === "blocked");
  const warnings = alerts.filter((a) => a.status === "warning");

  const isBlocked = blocked.length > 0;
  const topAlert = isBlocked ? blocked[0] : warnings[0];
  if (!topAlert) return null;

  const featureLabel = METRIC_LABELS[topAlert.metric_key] || topAlert.metric_key;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mx-4 mt-3 ${
        isBlocked
          ? "bg-destructive/10 text-destructive border border-destructive/20"
          : "bg-warning/10 text-warning-foreground border border-warning/20"
      }`}
    >
      <div className="flex items-center gap-2 flex-1 min-w-0">
        {isBlocked ? (
          <AlertTriangle className="h-4 w-4 shrink-0" />
        ) : (
          <TrendingUp className="h-4 w-4 shrink-0" />
        )}
        <span className="truncate">
          {isBlocked
            ? `🚫 Limite atingido em ${featureLabel} (${topAlert.current_value}/${topAlert.limit_value})`
            : `⚠️ ${topAlert.percentage}% utilizado em ${featureLabel} (${topAlert.current_value}/${topAlert.limit_value})`}
        </span>
        {alerts.length > 1 && (
          <Badge variant="outline" className="text-xs shrink-0">
            +{alerts.length - 1}
          </Badge>
        )}
      </div>
      <Button
        variant="outline"
        size="sm"
        className="shrink-0 gap-1.5"
        onClick={() => {
          // Open WhatsApp or contact page
          window.open(
            `https://wa.me/?text=${encodeURIComponent("Olá! Gostaria de fazer upgrade do meu plano.")}`,
            "_blank",
          );
        }}
      >
        <Zap className="h-3.5 w-3.5" />
        Fazer upgrade
      </Button>
    </div>
  );
}
