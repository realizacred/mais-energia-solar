import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { subDays, endOfDay } from "date-fns";

export function useVendorBadges() {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["vendor-sidebar-badges", user?.id],
    enabled: !!user?.id,
    staleTime: 60000,
    queryFn: async () => {
      const currentUserId = user!.id;
      
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", currentUserId)
        .single();

      if (!profile?.tenant_id) return { orcamentos: 0, agenda: 0, credito: 0, whatsapp: 0 };

      const now = new Date();
      const threeDaysAgo = subDays(now, 3).toISOString();
      const last24h = subDays(now, 1).toISOString();
      const todayEnd = endOfDay(now).toISOString();

      // Inline queries using non-generic Supabase client to bypass complex type instantiation
      const urgentLeads = await (supabase as any)
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("consultor_id", currentUserId)
        .is("deleted_at", null)
        .not("status_id", "in", "('ganho', 'perdido', 'convertido')")
        .or(`ultimo_contato.is.null,ultimo_contato.lt.${threeDaysAgo}`);

      const overdueTasks = await (supabase as any)
        .from("tarefas")
        .select("id", { count: "exact", head: true })
        .eq("created_by", currentUserId) 
        .neq("status", "concluida")
        .lte("data_vencimento", todayEnd);

      const pendingCredit = await (supabase as any)
        .from("analise_credito")
        .select("id", { count: "exact", head: true })
        .eq("criado_por", currentUserId)
        .eq("status", "aguardando_documentos");

      const unreadChats = await (supabase as any)
        .from("wa_conversations")
        .select("id", { count: "exact", head: true })
        .eq("assigned_to", currentUserId)
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "aberta")
        .eq("ultima_mensagem_de", "cliente")
        .gt("ultima_mensagem_at", last24h);

      return {
        orcamentos: urgentLeads.count || 0,
        agenda: overdueTasks.count || 0,
        credito: pendingCredit.count || 0,
        whatsapp: unreadChats.count || 0
      };
    },
  });
}
