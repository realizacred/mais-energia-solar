/**
 * Adapter para a página /admin/integracoes/whatsapp/follow-up.
 * Reaproveita useWaFollowupPending (fila pendente). Outras seções usam
 * useFollowupRules / useFollowupQueueStats vindos de useWaFollowup.
 * RB-76 — não duplicar.
 */
import { useWaFollowupPending } from "@/hooks/useWaFollowupPending";

export function useWhatsappFollowupPage() {
  return useWaFollowupPending();
}
