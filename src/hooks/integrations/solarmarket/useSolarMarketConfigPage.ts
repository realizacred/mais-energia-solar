/**
 * Adapter para /admin/integracoes/solarmarket/configuracoes.
 * Reaproveita useSolarmarketConfig (lê solarmarket_migration_config).
 * RB-76 — não duplicar tabela nem hook.
 */
import { useSolarmarketConfig } from "@/hooks/useSolarmarketConfig";

export function useSolarMarketConfigPage() {
  return useSolarmarketConfig();
}
