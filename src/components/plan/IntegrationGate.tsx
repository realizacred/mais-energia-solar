/**
 * IntegrationGate — Renders children only if an integration is enabled for the tenant.
 * Uses the integrations table + tenant connection status.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { Plug } from "lucide-react";

const STALE_TIME = 1000 * 60 * 5;

interface IntegrationGateProps {
  integrationKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

function useIntegrationAccess(integrationKey: string) {
  return useQuery({
    queryKey: ["integration-gate", integrationKey],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("integration_connections")
        .select("id, status")
        .eq("provider_id", integrationKey)
        .eq("status", "active")
        .limit(1);
      if (error) throw error;
      return (data?.length ?? 0) > 0;
    },
    staleTime: STALE_TIME,
  });
}

export function IntegrationGate({ integrationKey, children, fallback }: IntegrationGateProps) {
  const { data: hasAccess, isLoading } = useIntegrationAccess(integrationKey);

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
        icon={Plug}
        title="Integração não configurada"
        description="Esta integração precisa ser configurada antes de utilizar este recurso. Acesse as configurações de integrações."
      />
    );
  }

  return <>{children}</>;
}
