import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface NotificationItem {
  id: string;
  type: "lead" | "whatsapp" | "appointment" | "sla";
  title: string;
  description: string;
  timestamp: string;
  link?: string;
}

export function useNotifications() {
  const { user } = useAuth();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["admin-notifications", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];

      const items: NotificationItem[] = [];
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // 1. New leads (last 24h)
      try {
        const { data: leads } = await supabase
          .from("leads")
          .select("id, nome, created_at")
          .gte("created_at", last24h)
          .order("created_at", { ascending: false })
          .limit(10);
        if (leads) {
          for (const lead of leads) {
            items.push({
              id: `lead-${lead.id}`,
              type: "lead",
              title: "Novo Lead",
              description: lead.nome || "Lead sem nome",
              timestamp: lead.created_at,
              link: "/admin/leads",
            });
          }
        }
      } catch {}

      // 2. Unread WhatsApp conversations (assigned to me or unassigned)
      try {
        const { data: convs } = await supabase
          .from("wa_conversations")
          .select("id, cliente_nome, cliente_telefone, unread_count, last_message_at")
          .gt("unread_count", 0)
          .eq("status", "open")
          .order("last_message_at", { ascending: false })
          .limit(10);
        if (convs) {
          for (const conv of convs) {
            items.push({
              id: `wa-${conv.id}`,
              type: "whatsapp",
              title: `${conv.unread_count} msg não lida${conv.unread_count > 1 ? "s" : ""}`,
              description: conv.cliente_nome || conv.cliente_telefone || "Contato",
              timestamp: conv.last_message_at || "",
              link: "/admin/whatsapp",
            });
          }
        }
      } catch {}

      // 3. Upcoming appointments (next 4 hours)
      try {
        const in4h = new Date(now.getTime() + 4 * 60 * 60 * 1000).toISOString();
        const { data: appts } = await supabase
          .from("appointments")
          .select("id, title, starts_at, status")
          .gte("starts_at", now.toISOString())
          .lte("starts_at", in4h)
          .in("status", ["scheduled", "confirmed"])
          .order("starts_at", { ascending: true })
          .limit(5);
        if (appts) {
          for (const appt of appts) {
            const time = new Date(appt.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
            items.push({
              id: `appt-${appt.id}`,
              type: "appointment",
              title: `Às ${time}`,
              description: appt.title,
              timestamp: appt.starts_at,
              link: "/admin/agenda",
            });
          }
        }
      } catch {}

      // 4. SLA alerts (active, not acknowledged)
      try {
        const { data: slaAlerts } = await supabase
          .from("wa_sla_alerts" as any)
          .select("id, alert_type, created_at, conversation_id")
          .eq("acknowledged", false)
          .order("created_at", { ascending: false })
          .limit(5);
        if (slaAlerts) {
          for (const alert of slaAlerts as any[]) {
            items.push({
              id: `sla-${alert.id}`,
              type: "sla",
              title: alert.alert_type === "breach" ? "SLA violado" : "SLA em risco",
              description: `Conversa ${(alert.conversation_id as string).slice(0, 8)}...`,
              timestamp: alert.created_at,
              link: "/admin/whatsapp",
            });
          }
        }
      } catch {}

      // Sort by timestamp desc
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return items;
    },
    enabled: !!user?.id,
    staleTime: 30_000, // refresh every 30s
    refetchInterval: 60_000, // auto-refetch every 60s
  });

  const totalCount = notifications.length;
  const countByType = {
    lead: notifications.filter((n) => n.type === "lead").length,
    whatsapp: notifications.filter((n) => n.type === "whatsapp").length,
    appointment: notifications.filter((n) => n.type === "appointment").length,
    sla: notifications.filter((n) => n.type === "sla").length,
  };

  return { notifications, totalCount, countByType, isLoading };
}
