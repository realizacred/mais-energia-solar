/**
 * PlanStatusBadge — Compact badge for the admin header showing plan + status.
 * Reads from useTenantPlan (no new queries). AGENTS RB-76.
 */
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { useTenantPlan } from "@/hooks/useTenantPlan";

const STATUS_COPY: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  trialing: { label: "Trial", variant: "secondary" },
  active: { label: "Ativo", variant: "default" },
  past_due: { label: "Em atraso", variant: "destructive" },
  suspended: { label: "Suspenso", variant: "destructive" },
  canceled: { label: "Cancelado", variant: "outline" },
  expired: { label: "Expirado", variant: "outline" },
};

export function PlanStatusBadge() {
  const { subscription, isTrialing, trialDaysRemaining } = useTenantPlan();
  if (!subscription) return null;

  const status = subscription.status as string;
  const meta = STATUS_COPY[status] ?? { label: status, variant: "outline" as const };
  const planName = subscription.plan_name || "Plano";
  const suffix = isTrialing && trialDaysRemaining > 0 ? ` · ${trialDaysRemaining}d` : "";

  return (
    <Link
      to="/admin/planos"
      className="hidden lg:inline-flex"
      title={`Plano ${planName} — ${meta.label}`}
    >
      <Badge variant={meta.variant} className="gap-1.5 cursor-pointer">
        <span className="font-medium">{planName}</span>
        <span className="opacity-80">· {meta.label}{suffix}</span>
      </Badge>
    </Link>
  );
}
