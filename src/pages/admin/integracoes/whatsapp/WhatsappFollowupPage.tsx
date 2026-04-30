/**
 * WhatsApp → Follow-up (alias dentro da Central de Integrações).
 * Reaproveita tabelas: wa_followup_rules, wa_followup_queue, wa_followup_logs,
 *   wa_cadences, wa_cadence_steps, wa_cadence_enrollments, wa_cadence_executions.
 * Reaproveita componente existente: WaFollowupRulesManager.
 * RB-76 / DA-48 — wrapper fino, sem duplicação.
 */
import { WaFollowupRulesManager } from "@/components/admin/WaFollowupRulesManager";

export default function WhatsappFollowupPage() {
  return <WaFollowupRulesManager />;
}
