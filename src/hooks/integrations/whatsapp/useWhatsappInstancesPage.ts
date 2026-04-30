/**
 * Adapter para a página /admin/integracoes/whatsapp/instancias.
 * Reaproveita o hook existente useWaHealthInstances (queryKey "wa-health-instances",
 * staleTime 60s, refetch 60s). RB-76 — não duplicar.
 */
import { useWaHealthInstances } from "@/hooks/useWaHealthInstances";

export function useWhatsappInstancesPage() {
  return useWaHealthInstances();
}
