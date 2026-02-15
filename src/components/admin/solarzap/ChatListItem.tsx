import { useState, useMemo } from "react";
import {
  StickyNote, User, MessageCircle, Instagram, Phone,
  Pin, BellOff, Eye, MailOpen, AlertTriangle,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { WaConversation } from "@/hooks/useWaInbox";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

// ── Channel config ────────────────────────────────────
const CHANNEL_CFG: Record<string, { icon: typeof MessageCircle; label: string; class: string }> = {
  whatsapp:  { icon: MessageCircle, label: "WhatsApp",  class: "text-success border-success/30 bg-success/5" },
  instagram: { icon: Instagram,     label: "Instagram", class: "text-info border-info/30 bg-info/5" },
  phone:     { icon: Phone,         label: "Telefone",  class: "text-muted-foreground border-border bg-muted/30" },
};

// ── Time formatter ────────────────────────────────────
function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  try {
    const d = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    if (diffMs < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    }
    return formatDistanceToNow(d, { addSuffix: false, locale: ptBR });
  } catch {
    return "";
  }
}

// ── Badge data builder ────────────────────────────────
interface BadgeItem {
  key: string;
  label: string;
  icon?: typeof MessageCircle;
  className?: string;
}

function buildBadges(conv: WaConversation): BadgeItem[] {
  const badges: BadgeItem[] = [];
  const channel = conv.canal || "whatsapp";
  const cfg = CHANNEL_CFG[channel] || CHANNEL_CFG.whatsapp;

  if (conv.vendedor_nome) {
    badges.push({
      key: "vendor",
      label: conv.vendedor_nome,
      icon: User,
      className: "text-muted-foreground border-border bg-muted/30",
    });
  }

  if (conv.instance_name) {
    badges.push({
      key: "instance",
      label: conv.instance_name,
      className: "text-muted-foreground border-border bg-muted/30",
    });
  }

  badges.push({
    key: "channel",
    label: cfg.label,
    icon: cfg.icon,
    className: cfg.class,
  });

  if (conv.status === "pending" || (conv.status === "open" && !conv.assigned_to)) {
    badges.push({
      key: "status",
      label: conv.status === "pending" ? "Pendente" : "Aguardando",
      className: "text-warning border-warning/30 bg-warning/5",
    });
  } else if (conv.status === "resolved") {
    badges.push({
      key: "status",
      label: "Resolvido",
      className: "text-muted-foreground border-border bg-muted/30",
    });
  }

  // Tags from conversation
  if (conv.tags && conv.tags.length > 0) {
    conv.tags.forEach((t) => {
      if (t.tag) {
        badges.push({
          key: `tag-${t.tag_id}`,
          label: t.tag.name,
          className: "text-muted-foreground border-border bg-muted/30",
        });
      }
    });
  }

  return badges;
}

// ── Compact Badge component ───────────────────────────
function CompactBadge({ item }: { item: BadgeItem }) {
  const Icon = item.icon;
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-[18px] px-1.5 text-[10px] leading-none gap-0.5 font-normal shrink-0 max-w-[90px]",
        item.className,
      )}
    >
      {Icon && <Icon className="h-2.5 w-2.5 shrink-0" />}
      <span className="truncate">{item.label}</span>
    </Badge>
  );
}

// ── Main component ────────────────────────────────────
interface ChatListItemProps {
  conversation: WaConversation;
  isSelected: boolean;
  onSelect: (conv: WaConversation) => void;
  isMuted?: boolean;
  isPinned?: boolean;
}

export function ChatListItem({
  conversation: conv,
  isSelected,
  onSelect,
  isMuted = false,
  isPinned = false,
}: ChatListItemProps) {
  const [hovered, setHovered] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);

  const displayName = conv.cliente_nome || conv.lead_nome || conv.cliente_telefone || "Desconhecido";
  const isOnline = conv.status === "open" && !!conv.assigned_to;
  const hasUnread = conv.unread_count > 0;
  const isInternalNote = conv.last_message_preview?.startsWith("[Nota]") || false;
  const snippet = isInternalNote
    ? conv.last_message_preview?.replace("[Nota] ", "") || ""
    : conv.last_message_preview || "Sem mensagens";

  // Has send failure? Check last message error
  const hasSendError = conv.last_message_direction === "out" && !conv.last_message_at;

  // Build badges with overflow
  const allBadges = useMemo(() => buildBadges(conv), [conv]);
  const MAX_VISIBLE = 4;
  const BADGES_PER_ROW = 2;
  const visibleBadges = allBadges.slice(0, MAX_VISIBLE);
  const overflowBadges = allBadges.slice(MAX_VISIBLE);

  const cardContent = (
    <div
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(conv)}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(conv); } }}
      className={cn(
        "group relative w-full flex items-start gap-2.5 px-3 py-2.5 text-left cursor-pointer overflow-hidden",
        "transition-all duration-150 border-b border-border/20",
        // States
        isSelected
          ? "bg-primary/[0.06] border-l-2 border-l-primary"
          : "border-l-2 border-l-transparent hover:bg-muted/40",
        isMuted && "opacity-60",
        isPinned && !isSelected && "bg-muted/20",
      )}
    >
      {/* Pin indicator */}
      {isPinned && (
        <Pin className="absolute top-1 right-1.5 h-2.5 w-2.5 text-muted-foreground/50 rotate-45" />
      )}

      {/* ── Avatar ── */}
      <div className="relative shrink-0 mt-0.5">
        <Avatar className="h-9 w-9">
          {conv.profile_picture_url && (
            <AvatarImage src={conv.profile_picture_url} alt={displayName} />
          )}
          <AvatarFallback className="text-[10px] font-semibold bg-muted text-muted-foreground">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {/* Online dot */}
        {isOnline && (
          <span className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full bg-success ring-2 ring-card" />
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 min-w-0 space-y-0.5 overflow-hidden">
        {/* Line 1: Name + Time */}
        <div className="flex items-center justify-between gap-1.5">
          <div className="flex items-center gap-1 min-w-0">
            <TooltipProvider delayDuration={400}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <span className={cn(
                    "text-[13px] font-semibold truncate",
                    hasUnread ? "text-foreground" : "text-foreground/90",
                  )}>
                    {displayName}
                  </span>
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">{displayName}</TooltipContent>
              </Tooltip>
            </TooltipProvider>
            {isMuted && <BellOff className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
          </div>
          <span className={cn(
            "text-[10px] tabular-nums shrink-0",
            hasUnread ? "text-primary font-semibold" : "text-muted-foreground",
          )}>
            {formatTime(conv.last_message_at)}
          </span>
        </div>

        {/* Line 2: Preview + Unread */}
        <div className="flex items-center gap-1.5 min-w-0">
          {isInternalNote && <StickyNote className="h-3 w-3 shrink-0 text-warning" />}
          {hasSendError && (
            <TooltipProvider delayDuration={300}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <AlertTriangle className="h-3 w-3 shrink-0 text-destructive" />
                </TooltipTrigger>
                <TooltipContent side="top" className="text-xs">Falha no envio</TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <p className={cn(
            "text-xs truncate flex-1",
            isInternalNote
              ? "text-warning/80 italic"
              : hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground",
          )}>
            {isInternalNote ? `Nota: ${snippet}` : snippet}
          </p>
          {hasUnread && (
            <span className="h-[18px] min-w-[18px] px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none shrink-0">
              {conv.unread_count > 99 ? "99+" : conv.unread_count}
            </span>
          )}
        </div>

        {/* Lines 3-4: Badges (2 rows × 2 badges + overflow popover) */}
        {allBadges.length > 0 && (
          <div className="space-y-0.5 mt-0.5">
            {/* Row 1 */}
            <div className="flex items-center gap-1 overflow-hidden max-w-full">
              {visibleBadges.slice(0, BADGES_PER_ROW).map((b) => (
                <CompactBadge key={b.key} item={b} />
              ))}
            </div>
            {/* Row 2 (only if needed) */}
            {visibleBadges.length > BADGES_PER_ROW && (
              <div className="flex items-center gap-1 overflow-hidden max-w-full">
                {visibleBadges.slice(BADGES_PER_ROW).map((b) => (
                  <CompactBadge key={b.key} item={b} />
                ))}
                {overflowBadges.length > 0 && (
                  <Popover>
                    <PopoverTrigger asChild>
                      <button
                        onClick={(e) => e.stopPropagation()}
                        className="h-[18px] px-1.5 text-[10px] font-medium rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors shrink-0"
                      >
                        +{overflowBadges.length}
                      </button>
                    </PopoverTrigger>
                    <PopoverContent
                      side="right"
                      align="start"
                      className="w-auto max-w-[200px] p-2 space-y-1"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <p className="text-[10px] font-semibold text-muted-foreground mb-1.5">Mais detalhes</p>
                      <div className="flex flex-wrap gap-1">
                        {overflowBadges.map((b) => (
                          <CompactBadge key={b.key} item={b} />
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Hover quick actions (fade in) ── */}
      <div className={cn(
        "absolute right-2 top-2 flex items-center gap-0.5 transition-opacity duration-150",
        hovered && !contextOpen ? "opacity-100" : "opacity-0 pointer-events-none",
      )}>
        {[
          { icon: Pin, label: isPinned ? "Desafixar" : "Fixar", action: "pin" },
          { icon: MailOpen, label: "Marcar como lido", action: "read" },
          { icon: BellOff, label: isMuted ? "Ativar som" : "Silenciar", action: "mute" },
          { icon: Eye, label: "Detalhes", action: "details" },
        ].map(({ icon: Icon, label, action }) => (
          <TooltipProvider key={action} delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={(e) => { e.stopPropagation(); /* TODO: wire action */ }}
                  className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Icon className="h-3 w-3" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-[10px]">{label}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );

  // Wrap with right-click context menu
  return (
    <DropdownMenu open={contextOpen} onOpenChange={setContextOpen}>
      <DropdownMenuTrigger asChild>
        <div onContextMenu={(e) => { e.preventDefault(); setContextOpen(true); }}>
          {cardContent}
        </div>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-48">
        <DropdownMenuItem className="text-xs gap-2">
          <Pin className="h-3.5 w-3.5" />
          {isPinned ? "Desafixar conversa" : "Fixar conversa"}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs gap-2">
          <MailOpen className="h-3.5 w-3.5" />
          Marcar como {hasUnread ? "lido" : "não lido"}
        </DropdownMenuItem>
        <DropdownMenuItem className="text-xs gap-2">
          <BellOff className="h-3.5 w-3.5" />
          {isMuted ? "Ativar notificações" : "Silenciar"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="text-xs gap-2">
          <Eye className="h-3.5 w-3.5" />
          Ver detalhes do contato
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
