/**
 * Wrapper fino — auditoria de módulos fotovoltaicos.
 * Reaproveita: EquipmentAuditPage genérica.
 */
import { EquipmentAuditPage } from "../shared/EquipmentAuditPage";

export function ModulosAuditPage() {
  return (
    <EquipmentAuditPage
      config={{
        equipmentType: "modulo",
        tableName: "modulos_solares",
        title: "Auditoria de Módulos Fotovoltaicos",
        description: "Revise garantias de produto, datasheets e specs do catálogo de módulos",
        warrantyColumn: "garantia_produto_anos",
        capacityColumn: { key: "potencia_wp", label: "Pot. (Wp)", suffix: " W" },
        extraColumns: [
          { key: "eficiencia_percent", label: "Efic.", suffix: "%" },
          { key: "tipo_celula", label: "Tipo célula", align: "left" },
        ],
      }}
    />
  );
}
