/**
 * Adapter para a página /admin/integracoes/whatsapp/ia-resolucao.
 * Reaproveita useWaResolutionEvents (eventos pós-resolução).
 * RB-76 — não duplicar.
 */
import { useWaResolutionEvents } from "@/hooks/useWaResolutionEvents";

export function useWhatsappIaResolutionPage() {
  return useWaResolutionEvents();
}
