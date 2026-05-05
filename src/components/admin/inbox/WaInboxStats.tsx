import { MessageCircle, Clock, CheckCircle2, AlertTriangle, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WaConversation } from "@/hooks/useWaInbox";

type KpiKey = "open" | "pending" | "unread" | "resolved";

interface WaInboxStatsProps {
  /** When provided, stats are computed from this list (already filtered). */
  conversations?: WaConversation[];
  /** Compact mode for mobile */
  compact?: boolean;
  /** Click handler — receives the KPI key. When provided, KPIs become interactive. */
  onSelect?: (key: KpiKey) => void;
  /** Currently active KPI (highlights it) */
  activeKey?: KpiKey | null;
}

export function WaInboxStats({ conversations, compact = false, onSelect, activeKey = null }: WaInboxStatsProps) {
  const localStats = conversations
    ? {
        open: conversations.filter((c) => c.status === "open").length,
        pending: conversations.filter((c) => c.status === "pending").length,
        resolved: conversations.filter((c) => c.status === "resolved").length,
        unread: conversations.filter((c) => c.unread_count > 0).length,
      }
    : null;

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

  const statItems: Array<{
    key: KpiKey | null;
    label: string;
    value: number | string;
    icon: typeof MessageCircle;
    color: string;
    bg: string;
    borderColor: string;
    tooltip: string;
  }> = [
    {
      key: "open",
      label: "Abertas",
      value: stats?.open ?? 0,
      icon: MessageCircle,
      color: "text-success",
      bg: "bg-success/10",
      borderColor: "border-l-success",
      tooltip: "Conversas em andamento",
    },
    {
      key: "pending",
      label: "Pendentes",
      value: stats?.pending ?? 0,
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
      borderColor: "border-l-warning",
      tooltip: "Aguardando atribuição",
    },
    {
      key: "unread",
      label: "Não lidas",
      value: stats?.unread ?? 0,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      borderColor: "border-l-destructive",
      tooltip: "Mensagens não lidas",
    },
    {
      key: "resolved",
      label: "Resolvidas",
      value: stats?.resolved ?? 0,
      icon: CheckCircle2,
      color: "text-muted-foreground",
      bg: "bg-muted/50",
      borderColor: "border-l-success",
      tooltip: "Atendimentos finalizados",
    },
    {
      key: null,
      label: "Satisfação",
      value: satisfactionData?.avg ? `${satisfactionData.avg}` : "—",
      icon: Star,
      color: "text-warning",
      bg: "bg-warning/10",
      borderColor: "border-l-warning",
      tooltip: satisfactionData?.count
        ? `${satisfactionData.count} avaliações recebidas`
        : "Nenhuma avaliação ainda",
    },
  ];

  const handleClick = (key: KpiKey | null) => {
    if (!onSelect || !key) return;
    onSelect(key);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-2 overflow-x-auto px-3 py-2.5 no-scrollbar bg-card/80 border-b border-border/30 select-none touch-action-manipulation">
        {statItems.map((stat) => {
          const isActive = activeKey && stat.key === activeKey;
          const interactive = !!onSelect && !!stat.key;
          return (
            <button
              type="button"
              key={stat.label}
              onClick={() => handleClick(stat.key)}
              disabled={!interactive}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full ${stat.bg} border ${
                isActive ? "border-primary ring-1 ring-primary/40" : "border-border/20"
              } shrink-0 min-h-[32px] ${interactive ? "cursor-pointer hover:brightness-95" : "cursor-default"}`}
              aria-pressed={!!isActive}
            >
              <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              <span className="text-sm font-bold text-foreground leading-none">{stat.value}</span>
              <span className="text-[10px] text-muted-foreground leading-none">{stat.label}</span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
      {statItems.map((stat) => {
        const isActive = activeKey && stat.key === activeKey;
        const interactive = !!onSelect && !!stat.key;
        return (
          <Tooltip key={stat.label}>
            <TooltipTrigger asChild>
              <button
                type="button"
                onClick={() => handleClick(stat.key)}
                disabled={!interactive}
                className={`flex items-center gap-2.5 p-3 rounded-xl bg-card border border-border/20 border-l-[3px] ${stat.borderColor} shadow-sm text-left ${
                  interactive ? "cursor-pointer hover:bg-accent/30 transition-colors" : "cursor-default"
                } ${isActive ? "ring-1 ring-primary/50 bg-accent/40" : ""}`}
                aria-pressed={!!isActive}
              >
                <stat.icon className={`h-4 w-4 ${stat.color} shrink-0`} />
                <div className="min-w-0">
                  <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                </div>
              </button>
            </TooltipTrigger>
            <TooltipContent className="text-xs">{stat.tooltip}</TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
