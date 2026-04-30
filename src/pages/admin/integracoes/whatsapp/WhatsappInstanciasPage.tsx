/**
 * WhatsApp → Instâncias (alias dentro da Central de Integrações).
 * Reaproveita tabelas: wa_instances, wa_health_checks, wa_instance_consultores.
 * Reaproveita componente existente: WaInstancesManager.
 * RB-76 / DA-48 — wrapper fino, sem duplicação.
 */
import { WaInstancesManager } from "@/components/admin/WaInstancesManager";

export default function WhatsappInstanciasPage() {
  return <WaInstancesManager />;
}
