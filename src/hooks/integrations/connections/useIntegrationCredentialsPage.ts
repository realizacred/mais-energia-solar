/**
 * useIntegrationCredentialsPage — Adapter fino (RB-76).
 * Reaproveita: integration_connections via listConnections().
 * SEGURANÇA: NUNCA expõe tokens/credentials — apenas status.
 */
import { useQuery } from "@tanstack/react-query";
import { listConnections } from "@/services/integrations/integrationService";

export interface CredentialRow {
  id: string;
  provider_id: string;
  status: string;
  last_sync_at: string | null;
  sync_error: string | null;
  created_at: string;
  updated_at: string;
}

export function useIntegrationCredentialsPage() {
  return useQuery({
    queryKey: ["integrations", "connections", "credentials"],
    queryFn: async (): Promise<CredentialRow[]> => {
      const conns = await listConnections();
      // Sanitiza: remove credentials/tokens antes de retornar ao componente.
      return conns.map((c) => ({
        id: c.id,
        provider_id: c.provider_id,
        status: c.status,
        last_sync_at: c.last_sync_at,
        sync_error: c.sync_error,
        created_at: c.created_at,
        updated_at: c.updated_at,
      }));
    },
    staleTime: 1000 * 60 * 5,
  });
}
