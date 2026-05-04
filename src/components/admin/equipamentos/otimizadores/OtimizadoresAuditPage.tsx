/**
 * Wrapper fino — auditoria de otimizadores.
 * Reaproveita: EquipmentAuditPage genérica.
 */
import { EquipmentAuditPage } from "../shared/EquipmentAuditPage";

export function OtimizadoresAuditPage() {
  return (
    <EquipmentAuditPage
      config={{
        equipmentType: "otimizador",
        tableName: "otimizadores_catalogo",
        title: "Auditoria de Otimizadores",
        description: "Revise garantias, datasheets e specs do catálogo de otimizadores",
        warrantyColumn: "garantia_anos",
        capacityColumn: { key: "potencia_wp", label: "Pot. (Wp)", suffix: " W" },
        extraColumns: [
          { key: "eficiencia_percent", label: "Efic.", suffix: "%" },
          { key: "tensao_saida_v", label: "Vout", suffix: " V" },
        ],
      }}
    />
  );
}
