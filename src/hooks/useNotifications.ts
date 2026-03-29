import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface NotificationItem {
  id: string;
  type: "lead" | "whatsapp" | "appointment" | "sla" | "proposal_view";
  title: string;
  description: string;
  timestamp: string;
  link?: string;
}

const ADMIN_ROLES = ["admin", "gerente", "financeiro"];

export function useNotifications() {
  const { user } = useAuth();

  // Check if user is admin
  const { data: isAdmin } = useQuery({
    queryKey: ["notification-role-check", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      const { data: roles } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id);
      return (roles || []).some((r) => ADMIN_ROLES.includes(r.role));
    },
    enabled: !!user?.id,
    staleTime: 1000 * 60 * 15,
  });

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["admin-notifications", user?.id, isAdmin],
    queryFn: async () => {
      if (!user?.id || isAdmin === undefined) return [];

      const items: NotificationItem[] = [];
      const now = new Date();
      const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();

      // 1. New leads (last 24h)
      try {
        let q: any = supabase
          .from("leads")
          .select("id, nome, created_at")
          .gte("created_at", last24h)
          .order("created_at", { ascending: false })
          .limit(10);

        if (!isAdmin) {
          q = q.eq("owner_user_id", user.id);
        }

        const { data: leads } = await q;
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

      // 2. Unread WhatsApp conversations
      try {
        let q2: any = supabase
          .from("wa_conversations")
          .select("id, cliente_nome, cliente_telefone, unread_count, last_message_at")
          .gt("unread_count", 0)
          .eq("status", "open")
          .order("last_message_at", { ascending: false })
          .limit(10);

        if (!isAdmin) {
          q2 = q2.or(`assigned_to.eq.${user.id},assigned_to.is.null`);
        }

        const { data: convs } = await q2;
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
        let q3: any = supabase
          .from("appointments")
          .select("id, title, starts_at, status")
          .gte("starts_at", now.toISOString())
          .lte("starts_at", in4h)
          .in("status", ["scheduled"])
          .order("starts_at", { ascending: true })
          .limit(5);

        if (!isAdmin) {
          q3 = q3.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
        }

        const { data: appts } = await q3;
        if (appts) {
          for (const appt of appts) {
            const time = new Date(appt.starts_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" });
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

      // 4. SLA alerts
      try {
        const { data: slaAlerts } = await supabase
          .from("wa_sla_alerts" as any)
          .select("id, tipo, created_at, conversation_id")
          .eq("acknowledged", false)
          .order("created_at", { ascending: false })
          .limit(5);
        if (slaAlerts) {
          for (const alert of slaAlerts as any[]) {
            items.push({
              id: `sla-${alert.id}`,
              type: "sla",
              title: alert.tipo === "breach" ? "SLA violado" : "SLA em risco",
              description: `Conversa ${(alert.conversation_id as string).slice(0, 8)}...`,
              timestamp: alert.created_at,
              link: "/admin/whatsapp",
            });
          }
        }
      } catch {}

      // 5. Proposal views (tracked tokens opened in last 24h)
      try {
        const { data: proposalEvents } = await (supabase as any)
          .from("proposal_events")
          .select("id, proposta_id, tipo, payload, created_at")
          .eq("tipo", "proposta_visualizada")
          .gte("created_at", last24h)
          .order("created_at", { ascending: false })
          .limit(10);
        if (proposalEvents && proposalEvents.length > 0) {
          // Deduplicate: only latest per proposta_id
          const seenPropostas = new Set<string>();
          const uniqueEvents: any[] = [];
          for (const ev of proposalEvents as any[]) {
            if (seenPropostas.has(ev.proposta_id)) continue;
            seenPropostas.add(ev.proposta_id);
            uniqueEvents.push(ev);
          }

          // Batch-fetch projeto_id + cliente_nome for unique proposta_ids
          const propostaIds = uniqueEvents.map((e) => e.proposta_id);
          const { data: propostas } = await (supabase as any)
            .from("propostas_nativas")
            .select("id, projeto_id, codigo")
            .in("id", propostaIds);
          const propostaMap = new Map((propostas || []).map((p: any) => [p.id, p]));

          for (const ev of uniqueEvents) {
            const payload = typeof ev.payload === "string" ? JSON.parse(ev.payload) : ev.payload;
            const isFirst = payload?.first_view === true;
            const viewCount = payload?.view_count || 1;
            const proposta: any = propostaMap.get(ev.proposta_id);
            const projetoId = proposta?.projeto_id;
            const clienteLabel = proposta?.codigo || "Proposta";
              ? `/admin/projetos?projeto=${projetoId}&tab=propostas`
              : "/admin/projetos";
            items.push({
              id: `pv-${ev.id}`,
              type: "proposal_view",
              title: isFirst ? "Proposta aberta pela 1ª vez 👀" : `Proposta visualizada (${viewCount}x)`,
              description: `${clienteNome} — via link rastreado`,
              timestamp: ev.created_at,
              link,
            });
          }
        }
      } catch {}

      // Sort by timestamp desc
      items.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

      return items;
    },
    enabled: !!user?.id && isAdmin !== undefined,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const totalCount = notifications.length;
  const countByType = {
    lead: notifications.filter((n) => n.type === "lead").length,
    whatsapp: notifications.filter((n) => n.type === "whatsapp").length,
    appointment: notifications.filter((n) => n.type === "appointment").length,
    sla: notifications.filter((n) => n.type === "sla").length,
    proposal_view: notifications.filter((n) => n.type === "proposal_view").length,
  };

  return { notifications, totalCount, countByType, isLoading };
}
