/**
 * useTenantId — Hook compartilhado para obter tenant_id do usuário atual.
 * §16: Queries só em hooks. §23: staleTime obrigatório.
 */
import { useQuery } from "@tanstack/react-query";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

export function useTenantId() {
  return useQuery({
    queryKey: ["current-tenant-id"],
    queryFn: async () => {
      const { tenantId } = await getCurrentTenantId();
      return tenantId;
    },
    staleTime: 1000 * 60 * 15,
  });
}
