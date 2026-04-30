/**
 * Adapter para /admin/integracoes/solarmarket/etapas.
 * Reaproveita useSmEtapasFunil (sm_etapa_stage_map + pipeline_stages).
 * RB-76 — não duplicar.
 */
import { useSmEtapasFunil } from "@/hooks/useSmEtapasFunil";

export function useSolarMarketEtapasPage(funilExternalId: string | null) {
  return useSmEtapasFunil(funilExternalId);
}
