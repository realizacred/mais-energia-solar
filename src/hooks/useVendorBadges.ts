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

      // Use native count logic to avoid deep type instantiation issues
      const { count: urgentLeadsCount } = await supabase
        .rpc("get_vendor_urgent_leads_count", { p_user_id: currentUserId, p_three_days_ago: threeDaysAgo });

      const { count: overdueTasksCount } = await supabase
        .rpc("get_vendor_overdue_tasks_count", { p_user_id: currentUserId, p_today_end: todayEnd });

      const { count: pendingCreditCount } = await supabase
        .rpc("get_vendor_pending_credit_count", { p_user_id: currentUserId });

      const { count: unreadChatsCount } = await supabase
        .rpc("get_vendor_unread_chats_count", { 
          p_user_id: currentUserId, 
          p_tenant_id: profile.tenant_id,
          p_last_24h: last24h
        });

      return {
        orcamentos: urgentLeadsCount || 0,
        agenda: overdueTasksCount || 0,
        credito: pendingCreditCount || 0,
        whatsapp: unreadChatsCount || 0
      };
    },
  });
}
