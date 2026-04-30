/**
 * SolarMarket → Mapeamento de Funis (alias dentro da Central de Integrações).
 * Reaproveita: sm_funil_pipeline_map, sm_funis_raw, pipelines.
 * Reaproveita componente: MigracaoStep2Mapear (SSOT de mapeamento).
 *
 * NOTA: o wizard atual mostra funis + etapas + consultores na mesma página
 * (são interdependentes). Esta entrega expõe a mesma tela via alias dedicado
 * sem duplicar lógica. Split físico fica para fase futura, se solicitado.
 *
 * Regra de negócio existente preservada (não hardcodada aqui):
 * "Vendedores" é tratado pelo MigracaoStep2Mapear via FunilPapel='vendedor_source'.
 *
 * RB-76 / DA-48.
 */
import MigracaoStep2Mapear from "@/pages/admin/MigracaoStep2Mapear";

export default function SolarmarketFunisPage() {
  return <MigracaoStep2Mapear />;
}
