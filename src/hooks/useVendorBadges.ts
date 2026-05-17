import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subDays, endOfDay } from "date-fns";

/**
 * Hook to fetch badge counts for the vendor sidebar.
 * RB-76: Real counts for urgent leads, overdue tasks, and pending credit docs.
 */
export function useVendorBadges() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["vendor-sidebar-badges", user?.id],
    enabled: !!user?.id,
    staleTime: 60 * 1000, // 1 minute
    queryFn: async () => {
      const now = new Date();
      const threeDaysAgo = subDays(now, 3).toISOString();

      // 1. Leads Urgentes (+3 dias sem contato, status ativo)
      const { count: urgentLeadsCount } = await supabase
        .from("leads")
        .select("*", { count: "exact", head: true })
        .eq("consultor_id", user!.id)
        .is("deleted_at", null)
        .not("status_id", "in", "('ganho', 'perdido', 'convertido')") // status terminals
        .or(`ultimo_contato.is.null,ultimo_contato.lt.${threeDaysAgo}`);

      // 2. Agenda (Tarefas vencidas ou para hoje)
      const todayEnd = endOfDay(now).toISOString();
      const { count: overdueTasksCount } = await supabase
        .from("tarefas")
        .select("*", { count: "exact", head: true })
        .eq("created_by", user!.id) 
        .neq("status", "concluida")
        .lte("data_vencimento", todayEnd);

      // 3. Crédito (Fichas aguardando documentos)
      const { count: pendingCreditCount } = await supabase
        .from("analise_credito")
        .select("*", { count: "exact", head: true })
        .eq("criado_por", user!.id)
        .eq("status", "aguardando_documentos");

      return {
        orcamentos: urgentLeadsCount || 0,
        agenda: overdueTasksCount || 0,
        credito: pendingCreditCount || 0,
      };
    },
  });
}
