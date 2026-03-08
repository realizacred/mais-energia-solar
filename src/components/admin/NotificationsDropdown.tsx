import { useNavigate } from "react-router-dom";
import { Bell, UserPlus, MessageCircle, Calendar, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import { useNotifications, type NotificationItem } from "@/hooks/useNotifications";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const TYPE_CONFIG: Record<NotificationItem["type"], { icon: typeof Bell; color: string; bg: string }> = {
  lead: { icon: UserPlus, color: "text-primary", bg: "bg-primary/10" },
  whatsapp: { icon: MessageCircle, color: "text-success", bg: "bg-success/10" },
  appointment: { icon: Calendar, color: "text-info", bg: "bg-info/10" },
  sla: { icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/10" },
};

export function NotificationsDropdown() {
  const { notifications, totalCount, isLoading } = useNotifications();
  const navigate = useNavigate();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="h-8 w-8 relative text-muted-foreground hover:text-foreground rounded-md">
          <Bell className="h-4 w-4" />
          {totalCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold px-1">
              {totalCount > 99 ? "99+" : totalCount}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="text-xs font-semibold flex items-center justify-between">
          Notificações
          {totalCount > 0 && (
            <Badge variant="secondary" className="text-[10px] h-5">
              {totalCount}
            </Badge>
          )}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {isLoading ? (
          <div className="py-6 text-center">
            <p className="text-xs text-muted-foreground">Carregando...</p>
          </div>
        ) : notifications.length === 0 ? (
          <div className="py-6 text-center">
            <Bell className="h-5 w-5 text-muted-foreground/40 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">Nenhuma notificação</p>
          </div>
        ) : (
          <ScrollArea className="max-h-80">
            <div className="py-1">
              {notifications.map((item) => {
                const config = TYPE_CONFIG[item.type];
                const Icon = config.icon;
                const timeAgo = item.timestamp
                  ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: ptBR })
                  : "";

                return (
                  <button
                    key={item.id}
                    className="w-full flex items-start gap-2.5 px-3 py-2 hover:bg-accent/50 transition-colors text-left"
                    onClick={() => {
                      if (item.link) navigate(item.link);
                    }}
                  >
                    <div className={`h-7 w-7 rounded-full ${config.bg} flex items-center justify-center shrink-0 mt-0.5`}>
                      <Icon className={`h-3.5 w-3.5 ${config.color}`} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{item.title}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">{timeAgo}</p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
