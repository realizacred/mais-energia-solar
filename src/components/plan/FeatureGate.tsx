/**
 * FeatureGate — Renders children only if feature is accessible.
 * Shows blocked state otherwise. Uses useFeatureAccess (SSOT).
 */
import { useFeatureAccess } from "@/hooks/useFeatureAccess";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Lock } from "lucide-react";

interface FeatureGateProps {
  featureKey: string;
  children: React.ReactNode;
  /** Optional fallback when blocked (default: elegant locked state) */
  fallback?: React.ReactNode;
}

export function FeatureGate({ featureKey, children, fallback }: FeatureGateProps) {
  const { hasAccess, isLoading, reason } = useFeatureAccess(featureKey);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full rounded-lg" />
      </div>
    );
  }

  if (!hasAccess) {
    if (fallback) return <>{fallback}</>;
    return (
      <EmptyState
        icon={Lock}
        title="Recurso não disponível"
        description={reason ?? "Este recurso não está incluído no seu plano atual. Entre em contato para fazer upgrade."}
      />
    );
  }

  return <>{children}</>;
}
