/**
 * SolarMarket → Mapeamento de Etapas (alias dentro da Central de Integrações).
 * Reaproveita: sm_etapa_stage_map, pipeline_stages.
 * Reaproveita componente: MigracaoStep2Mapear (SSOT de mapeamento).
 * RB-76 / DA-48 — wrapper fino, sem duplicação.
 */
import MigracaoStep2Mapear from "@/pages/admin/MigracaoStep2Mapear";

export default function SolarmarketEtapasPage() {
  return <MigracaoStep2Mapear />;
}
