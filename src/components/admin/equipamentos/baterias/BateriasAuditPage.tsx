/**
 * Wrapper fino — auditoria de baterias.
 * Reaproveita: EquipmentAuditPage genérica.
 */
import { EquipmentAuditPage } from "../shared/EquipmentAuditPage";

export function BateriasAuditPage() {
  return (
    <EquipmentAuditPage
      config={{
        equipmentType: "bateria",
        tableName: "baterias",
        title: "Auditoria de Baterias",
        description: "Revise garantias, datasheets e specs do catálogo de baterias",
        warrantyColumn: "garantia_anos",
        capacityColumn: { key: "energia_kwh", label: "kWh", suffix: " kWh" },
        extraColumns: [
          { key: "tipo_bateria", label: "Tipo", align: "left" },
          { key: "tensao_nominal_v", label: "Tensão", suffix: " V" },
        ],
      }}
    />
  );
}
