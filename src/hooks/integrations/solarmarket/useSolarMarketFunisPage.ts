/**
 * Adapter para /admin/integracoes/solarmarket/funis.
 * Reaproveita useSmFunisStaging (sm_funis_raw + sm_funil_pipeline_map).
 * RB-76 — não duplicar.
 */
import { useTenantId } from "@/hooks/useTenantId";
import { useSmFunisStaging } from "@/hooks/useSmFunisStaging";

export function useSolarMarketFunisPage() {
  const { data: tenantId } = useTenantId();
  return useSmFunisStaging(tenantId ?? "");
}
