import { MessageCircle, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import type { WaConversation } from "@/hooks/useWaInbox";

interface WaInboxStatsProps {
  conversations: WaConversation[];
}

export function WaInboxStats({ conversations }: WaInboxStatsProps) {
  const open = conversations.filter((c) => c.status === "open").length;
  const pending = conversations.filter((c) => c.status === "pending").length;
  const resolved = conversations.filter((c) => c.status === "resolved").length;
  const unread = conversations.filter((c) => c.unread_count > 0).length;

  const stats = [
    {
      label: "Abertas",
      value: open,
      icon: MessageCircle,
      color: "text-success",
      bg: "bg-success/10",
    },
    {
      label: "Pendentes",
      value: pending,
      icon: Clock,
      color: "text-warning",
      bg: "bg-warning/10",
    },
    {
      label: "Não lidas",
      value: unread,
      icon: AlertTriangle,
      color: "text-destructive",
      bg: "bg-destructive/10",
    },
    {
      label: "Resolvidas",
      value: resolved,
      icon: CheckCircle2,
      color: "text-muted-foreground",
      bg: "bg-muted/50",
    },
  ];

  return (
    <div className="grid grid-cols-4 gap-2">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className={`flex items-center gap-2.5 p-3 rounded-xl ${stat.bg} border border-border/20`}
        >
          <stat.icon className={`h-4 w-4 ${stat.color} shrink-0`} />
          <div className="min-w-0">
            <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
