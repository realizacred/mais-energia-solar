import { useTenantPlan } from "@/hooks/useTenantPlan";
import { Clock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";

export function TrialBanner() {
  const { isTrialing, trialDaysRemaining, subscription } = useTenantPlan();

  if (!isTrialing || trialDaysRemaining <= 0) return null;

  const isUrgent = trialDaysRemaining <= 3;

  return (
    <div
      className={`flex items-center justify-between gap-3 px-4 py-2.5 text-sm font-medium rounded-lg mx-4 mt-3 ${
        isUrgent
          ? "bg-destructive/10 text-destructive border border-destructive/20"
          : "bg-warning/10 text-warning-foreground border border-warning/20"
      }`}
    >
      <div className="flex items-center gap-2">
        <Clock className="h-4 w-4 shrink-0" />
        <span>
          {isUrgent
            ? `⚠️ Seu trial expira em ${trialDaysRemaining} dia${trialDaysRemaining !== 1 ? "s" : ""}!`
            : `Trial ativo — ${trialDaysRemaining} dia${trialDaysRemaining !== 1 ? "s" : ""} restante${trialDaysRemaining !== 1 ? "s" : ""}`}
        </span>
        {subscription?.plan_name && (
          <span className="text-muted-foreground">
            (Plano {subscription.plan_name})
          </span>
        )}
      </div>
      <Button variant="outline" size="sm" className="shrink-0 gap-1.5" disabled>
        <Sparkles className="h-3.5 w-3.5" />
        Fazer upgrade
      </Button>
    </div>
  );
}
