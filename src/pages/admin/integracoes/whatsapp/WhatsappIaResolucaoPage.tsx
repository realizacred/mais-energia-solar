/**
 * WhatsApp → IA e Resolução (alias dentro da Central de Integrações).
 * Reaproveita tabelas: wa_ai_settings, wa_conversation_resolution_suggestions,
 *   wa_conversation_resolution_events, wa_conversation_resolution_logs.
 * Reaproveita componente existente: WaSaudePage (que já contém KPIs de
 *   eventos pós-resolução, sugestões IA e ações aceitar/rejeitar).
 * RB-76 / DA-48 — wrapper fino, sem duplicação.
 */
import WaSaudePage from "@/pages/admin/WaSaudePage";

export default function WhatsappIaResolucaoPage() {
  return <WaSaudePage />;
}
