/**
 * SolarMarket → Mapeamento de Consultores (alias dentro da Central de Integrações).
 * Reaproveita: sm_consultor_mapping, consultores.
 * Reaproveita componente: MigracaoStep2Mapear (SSOT — sub-bloco EtapasToConsultores).
 * Segue DA-40 (mapeamento vem do banco, não do código).
 * RB-76 / DA-48.
 */
import MigracaoStep2Mapear from "@/pages/admin/MigracaoStep2Mapear";

export default function SolarmarketConsultoresPage() {
  return <MigracaoStep2Mapear />;
}
