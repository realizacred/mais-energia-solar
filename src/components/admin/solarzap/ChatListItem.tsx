import { StickyNote, User, Link, Smartphone, MessageCircle, Instagram, Phone } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { WaConversation } from "@/hooks/useWaInbox";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

const CHANNEL_ICON: Record<string, typeof MessageCircle> = {
  whatsapp: MessageCircle,
  instagram: Instagram,
  phone: Phone,
};

const CHANNEL_LABEL: Record<string, string> = {
  whatsapp: "WhatsApp",
  instagram: "Instagram",
  phone: "Telefone",
};

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    // If today, show HH:mm
    if (diffMs < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return formatDistanceToNow(d, { addSuffix: false, locale: ptBR });
  } catch {
    return "";
  }
}

interface ChatListItemProps {
  conversation: WaConversation;
  isSelected: boolean;
  onSelect: (conv: WaConversation) => void;
}

export function ChatListItem({ conversation: conv, isSelected, onSelect }: ChatListItemProps) {
  const channel = conv.canal || "whatsapp";
  const ChannelIcon = CHANNEL_ICON[channel] || MessageCircle;
  const displayName = conv.cliente_nome || conv.lead_nome || conv.cliente_telefone || "Desconhecido";
  const isOnline = conv.status === "open" && !!conv.assigned_to;

  // Detect internal note in preview
  const isInternalNote = conv.last_message_preview?.startsWith("[Nota]") || false;
  const snippet = isInternalNote
    ? conv.last_message_preview?.replace("[Nota] ", "") || ""
    : conv.last_message_preview || "Sem mensagens";

  // Status label
  const statusLabel = conv.status === "open"
    ? (conv.assigned_to ? null : "Aguardando...")
    : conv.status === "resolved" ? "Resolvido" : conv.status === "pending" ? "Pendente" : null;

  return (
    <button
      onClick={() => onSelect(conv)}
      className={cn(
        "w-full flex items-start gap-3 p-3 text-left transition-colors duration-150 border-b border-border/30",
        isSelected
          ? "bg-primary/5 border-l-2 border-l-primary"
          : "hover:bg-muted/50 border-l-2 border-l-transparent"
      )}
    >
      {/* Avatar with status indicator */}
      <div className="relative shrink-0">
        <Avatar className="h-10 w-10">
          {conv.profile_picture_url && (
            <AvatarImage src={conv.profile_picture_url} alt={displayName} />
          )}
          <AvatarFallback className="text-xs font-medium bg-muted">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {isOnline && (
          <span className="absolute -bottom-0 -right-0 h-2.5 w-2.5 rounded-full bg-success ring-2 ring-background" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {/* Line 1: Name + Time */}
        <div className="flex items-center justify-between gap-2">
          <span className="text-sm font-semibold text-foreground truncate">{displayName}</span>
          <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
            {formatTime(conv.last_message_at)}
          </span>
        </div>

        {/* Line 2: Snippet */}
        <div className="flex items-center gap-1 mt-0.5 min-w-0">
          {isInternalNote && (
            <StickyNote className="h-3 w-3 shrink-0 text-warning" />
          )}
          <p className={cn(
            "text-xs truncate",
            isInternalNote ? "text-warning/80 italic" : "text-muted-foreground"
          )}>
            {isInternalNote ? `Nota interna: ${snippet}` : snippet}
          </p>
          {conv.unread_count > 0 && (
            <Badge className="h-4 min-w-4 px-1 text-[9px] bg-primary text-primary-foreground ml-auto shrink-0">
              {conv.unread_count}
            </Badge>
          )}
        </div>

        {/* Line 3: Metadata badges */}
        <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
          {/* Assigned to */}
          {conv.vendedor_nome && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 font-normal">
              <User className="h-3 w-3" />
              <span className="truncate max-w-[70px]">{conv.vendedor_nome}</span>
            </Badge>
          )}

          {/* Origin */}
          {conv.lead_nome && conv.lead_nome !== displayName && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] gap-1 font-normal text-warning border-warning/30 bg-warning/5">
              <Link className="h-3 w-3" />
              <span className="truncate max-w-[60px]">Origem: {conv.lead_nome}</span>
            </Badge>
          )}

          {/* Channel */}
          <Badge variant="outline" className={cn(
            "h-5 px-1.5 text-[10px] gap-1 font-normal",
            channel === "whatsapp" ? "text-success border-success/30 bg-success/5" :
            channel === "instagram" ? "text-info border-info/30 bg-info/5" : ""
          )}>
            <ChannelIcon className="h-3 w-3" />
            {CHANNEL_LABEL[channel] || channel}
          </Badge>

          {/* Status */}
          {statusLabel && (
            <Badge variant="outline" className="h-5 px-1.5 text-[10px] font-normal text-destructive border-destructive/30 bg-destructive/5 ml-auto">
              {statusLabel}
            </Badge>
          )}
        </div>
      </div>
    </button>
  );
}
