import { MessageCircle, Clock, CheckCircle2, AlertTriangle, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WaConversation } from "@/hooks/useWaInbox";

interface WaInboxStatsProps {
  /** When provided, stats are computed from this list (already filtered). */
  conversations?: WaConversation[];
  /** Compact mode for mobile */
  compact?: boolean;
}

export function WaInboxStats({ conversations, compact = false }: WaInboxStatsProps) {
  // If conversations are provided, compute stats locally (aligned with list filters)
  const localStats = conversations
    ? {
        open: conversations.filter((c) => c.status === "open").length,
        pending: conversations.filter((c) => c.status === "pending").length,
        resolved: conversations.filter((c) => c.status === "resolved").length,
        unread: conversations.filter((c) => c.unread_count > 0).length,
      }
    : null;

  // Fallback: fetch globally if no conversations prop (shouldn't happen, but safe)
  const { data: fetchedStats } = useQuery({
    queryKey: ["wa-inbox-stats-global"],
    queryFn: async () => {
      const { data: convs, error } = await supabase
        .from("wa_conversations")
        .select("status, unread_count");
      if (error) throw error;
      const all = convs || [];
      return {
        open: all.filter((c) => c.status === "open").length,
        pending: all.filter((c) => c.status === "pending").length,
        resolved: all.filter((c) => c.status === "resolved").length,
        unread: all.filter((c) => c.unread_count > 0).length,
      };
    },
    enabled: !conversations,
    staleTime: 15 * 1000,
    refetchInterval: 30 * 1000,
  });

  const stats = localStats || fetchedStats;

  // Load satisfaction stats
  const { data: satisfactionData } = useQuery({
    queryKey: ["wa-satisfaction-stats"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_satisfaction_ratings")
        .select("rating")
        .not("rating", "is", null);

      if (!data || data.length === 0) return { avg: 0, count: 0 };

      const total = data.reduce((sum, r) => sum + (r.rating || 0), 0);
      return {
        avg: Math.round((total / data.length) * 10) / 10,
        count: data.length,
      };
    },
    staleTime: 60 * 1000,
  });

  const statItems = [
    {
      label: "Abertas",
      value: stats?.open ?? 0,
      icon: MessageCircle,
      color: "text-success",
      bg: "bg-success/10",
      tooltip: "Conversas em andamento",
    },
    {
      label: "Pendentes",
      value: stats?.pending ?? 0,
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
      tooltip: "Aguardando atribuição",
    },
    {
      label: "Não lidas",
      value: stats?.unread ?? 0,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      tooltip: "Mensagens não lidas",
    },
    {
      label: "Resolvidas",
      value: stats?.resolved ?? 0,
      icon: CheckCircle2,
      color: "text-muted-foreground",
      bg: "bg-muted/50",
      tooltip: "Atendimentos finalizados",
    },
    {
      label: "Satisfação",
      value: satisfactionData?.avg ? `${satisfactionData.avg}` : "—",
      icon: Star,
      color: "text-amber-500",
      bg: "bg-amber-500/10",
      tooltip: satisfactionData?.count
        ? `${satisfactionData.count} avaliações recebidas`
        : "Nenhuma avaliação ainda",
    },
  ];

  if (compact) {
    return (
      <div className="flex items-center gap-1.5 overflow-x-auto px-3 py-2 no-scrollbar">
        {statItems.map((stat) => (
          <div
            key={stat.label}
            className={`flex items-center gap-1 px-2 py-1 rounded-lg ${stat.bg} border border-border/20 shrink-0`}
          >
            <stat.icon className={`h-3 w-3 ${stat.color}`} />
            <span className="text-xs font-bold text-foreground">{stat.value}</span>
            <span className="text-[9px] text-muted-foreground">{stat.label}</span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-5 gap-2">
      {statItems.map((stat) => (
        <Tooltip key={stat.label}>
          <TooltipTrigger asChild>
            <div
              className={`flex items-center gap-2.5 p-3 rounded-xl ${stat.bg} border border-border/20 cursor-default`}
            >
              <stat.icon className={`h-4 w-4 ${stat.color} shrink-0`} />
              <div className="min-w-0">
                <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </div>
          </TooltipTrigger>
          <TooltipContent className="text-xs">{stat.tooltip}</TooltipContent>
        </Tooltip>
      ))}
    </div>
  );
}
