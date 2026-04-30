/**
 * Adapter para /admin/integracoes/solarmarket/consultores.
 * Reaproveita useSmConsultorMappings (sm_consultor_mapping + consultores).
 * Segue DA-40 (mapeamento vem do banco, não do código).
 * RB-76 — não duplicar.
 */
import { useTenantId } from "@/hooks/useTenantId";
import { useSmConsultorMappings } from "@/hooks/useSmConsultorMapping";

export function useSolarMarketConsultoresPage() {
  const { data: tenantId } = useTenantId();
  return useSmConsultorMappings(tenantId ?? null);
}
