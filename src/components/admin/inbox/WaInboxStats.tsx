import { MessageCircle, Clock, CheckCircle2, AlertTriangle, Star } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WaConversation } from "@/hooks/useWaInbox";

interface WaInboxStatsProps {
  conversations: WaConversation[];
}

export function WaInboxStats({ conversations }: WaInboxStatsProps) {
  const open = conversations.filter((c) => c.status === "open").length;
  const pending = conversations.filter((c) => c.status === "pending").length;
  const resolved = conversations.filter((c) => c.status === "resolved").length;
  const unread = conversations.filter((c) => c.unread_count > 0).length;

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

  const stats = [
    {
      label: "Abertas",
      value: open,
      icon: MessageCircle,
      color: "text-success",
      bg: "bg-success/10",
      tooltip: "Conversas em andamento",
    },
    {
      label: "Pendentes",
      value: pending,
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
      tooltip: "Aguardando atribuição",
    },
    {
      label: "Não lidas",
      value: unread,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
      tooltip: "Mensagens não lidas",
    },
    {
      label: "Resolvidas",
      value: resolved,
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

  return (
    <div className="grid grid-cols-5 gap-2">
      {stats.map((stat) => (
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
