/**
 * SolarMarket → Migração (alias dentro da Central de Integrações).
 * Reaproveita componente: MigracaoSolarmarket (wizard SSOT).
 * RB-76 / DA-48 — wrapper fino, sem duplicação.
 */
import MigracaoSolarmarket from "@/pages/admin/MigracaoSolarmarket";

export default function SolarmarketMigracaoPage() {
  return <MigracaoSolarmarket />;
}
