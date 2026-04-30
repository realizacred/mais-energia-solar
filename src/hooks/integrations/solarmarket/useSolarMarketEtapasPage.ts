/**
 * Adapter para /admin/integracoes/solarmarket/etapas.
 * Reaproveita useSmEtapasFunil (sm_etapa_stage_map + pipeline_stages).
 * Recebe tenantId + funil para filtrar; valida cedo (fail-fast).
 * RB-76 — não duplicar.
 */
import { useTenantId } from "@/hooks/useTenantId";
import { useSmEtapasFunil } from "@/hooks/useSmEtapasFunil";

export function useSolarMarketEtapasPage(smFunilName: string | null) {
  const { data: tenantId } = useTenantId();
  return useSmEtapasFunil(tenantId ?? null, smFunilName);
}
