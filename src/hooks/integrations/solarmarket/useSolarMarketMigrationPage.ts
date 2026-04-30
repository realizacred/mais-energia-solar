/**
 * Adapter para a página /admin/integracoes/solarmarket/migracao.
 * Reaproveita useLastSolarmarketJob + useRunningSolarmarketJob.
 * RB-76 — não duplicar.
 */
import { useTenantId } from "@/hooks/useTenantId";
import { useLastSolarmarketJob } from "@/hooks/useLastSolarmarketJob";
import { useRunningSolarmarketJob } from "@/hooks/useRunningSolarmarketJob";

export function useSolarMarketMigrationPage() {
  const { data: tenantId } = useTenantId();
  const last = useLastSolarmarketJob(tenantId ?? null);
  const running = useRunningSolarmarketJob(tenantId ?? null);
  return { tenantId, last, running };
}
