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
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return { orcamentos: 0, agenda: 0, credito: 0, whatsapp: 0 };

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", user.id)
        .single();

      if (!profile?.tenant_id) return { orcamentos: 0, agenda: 0, credito: 0, whatsapp: 0 };

      const now = new Date();
      const threeDaysAgo = subDays(now, 3).toISOString();
      const last24h = subDays(now, 1).toISOString();

      const [urgentLeads, overdueTasks, pendingCredit, unreadChats] = await Promise.all([
        // 1. Leads Urgentes
        supabase
          .from("leads")
          .select("*", { count: "exact", head: true })
          .eq("consultor_id", user.id)
          .is("deleted_at", null)
          .not("status_id", "in", "('ganho', 'perdido', 'convertido')")
          .or(`ultimo_contato.is.null,ultimo_contato.lt.${threeDaysAgo}`),

        // 2. Agenda
        (supabase as any)
          .from("tarefas")
          .select("*", { count: "exact", head: true })
          .eq("created_by", user.id) 
          .neq("status", "concluida")
          .lte("data_vencimento", endOfDay(now).toISOString()),

        // 3. Crédito
        supabase
          .from("analise_credito")
          .select("*", { count: "exact", head: true })
          .eq("criado_por", user.id)
          .eq("status", "aguardando_documentos"),

        // 4. WhatsApp (não respondidas)
        supabase
          .from("wa_conversations")
          .select("*", { count: "exact", head: true })
          .eq("assigned_to", user.id)
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "aberta")
          .eq("ultima_mensagem_de", "cliente")
          .gt("ultima_mensagem_at", last24h)
      ]);

      return {
        orcamentos: urgentLeads.count || 0,
        agenda: overdueTasks.count || 0,
        credito: pendingCredit.count || 0,
        whatsapp: unreadChats.count || 0
      };
    },
  });
}
