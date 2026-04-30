/**
 * Adapter para a página /admin/integracoes/whatsapp/auto-respostas.
 * Reaproveita useAutoReplyConfigData (com fallback legado para
 * whatsapp_automation_config). RB-76 — não duplicar.
 */
import { useAutoReplyConfigData } from "@/hooks/useAutoReplyConfig";
import { useTenantId } from "@/hooks/useTenantId";

export function useWhatsappAutoRepliesPage() {
  const { data: tenantId } = useTenantId();
  return useAutoReplyConfigData(tenantId ?? "");
}
