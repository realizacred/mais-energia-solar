/**
 * useIntegrationProvidersPage — Adapter fino (RB-76 / DA-48).
 * Reaproveita: integration_providers via listProviders().
 */
import { useQuery } from "@tanstack/react-query";
import { listProviders } from "@/services/integrations/integrationService";

export function useIntegrationProvidersPage() {
  return useQuery({
    queryKey: ["integrations", "connections", "providers"],
    queryFn: () => listProviders(),
    staleTime: 1000 * 60 * 5,
  });
}
