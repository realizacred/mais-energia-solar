import { useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { Bell, UserPlus, MessageCircle, Calendar, AlertTriangle, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
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
  proposal_view: { icon: Eye, color: "text-warning", bg: "bg-warning/10" },
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
            <Badge className="text-[10px] h-5 bg-primary text-primary-foreground">
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
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <Bell className="h-8 w-8 text-muted-foreground/30 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma notificação</p>
            <p className="text-xs text-muted-foreground/60 mt-0.5">Você está em dia!</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-[400px] overflow-y-auto scroll-smooth">
              <div className="py-1">
                {notifications.map((item) => {
                  const config = TYPE_CONFIG[item.type];
                  const Icon = config.icon;
                  const timeAgo = item.timestamp
                    ? formatDistanceToNow(new Date(item.timestamp), { addSuffix: true, locale: ptBR })
                    : "";

                  return (
                    <Button
                      key={item.id}
                      variant="ghost"
                      className="w-full flex items-start gap-2.5 px-3 py-2 h-auto justify-start text-left rounded-none"
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
                    </Button>
                  );
                })}
              </div>
            </ScrollArea>
            <Separator />
            <div className="p-1">
              <Button variant="ghost" className="w-full text-primary text-xs h-8" onClick={() => navigate("/admin/notificacoes")}>
                Ver todas as notificações
              </Button>
            </div>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
