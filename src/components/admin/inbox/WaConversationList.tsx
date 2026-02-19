import { useState, useMemo } from "react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Search,
  MessageCircle,
  User,
  Users,
  Clock,
  CheckCircle2,
  Smartphone,
  Link2,
  Tag,
  EyeOff,
  BellOff,
  Eye,
  Bell,
  Pin,
  MailOpen,
  StickyNote,
  GitBranch,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { WaConversation, WaTag } from "@/hooks/useWaInbox";
import { deriveConversationStatus, DERIVED_STATUS_CONFIG } from "./useConversationStatus";
import type { WaInstance } from "@/hooks/useWaInstances";

// ── Badge item type ────────────────────────────────────
interface BadgeItem {
  key: string;
  label: string;
  icon?: typeof MessageCircle;
  className?: string;
  style?: React.CSSProperties;
}

const MAX_VISIBLE_BADGES = 4;
const BADGES_PER_ROW = 2;

// ── Compact badge ──────────────────────────────────────
function CompactBadge({ item }: { item: BadgeItem }) {
  const Icon = item.icon;
  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div>
            <Badge
              variant="outline"
              className={cn(
                "h-[18px] px-1.5 text-[9px] leading-none gap-0.5 font-normal shrink-0 max-w-[88px] cursor-default",
                item.className,
              )}
              style={item.style}
            >
              {Icon && <Icon className="h-2.5 w-2.5 shrink-0" />}
              <span className="truncate">{item.label}</span>
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">{item.label}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// ── Status config ──────────────────────────────────────
const statusConfig: Record<string, { label: string; dotColor: string; icon: typeof MessageCircle }> = {
  open: { label: "Aberta", dotColor: "bg-success", icon: MessageCircle },
  pending: { label: "Pendente", dotColor: "bg-warning", icon: Clock },
  resolved: { label: "Resolvida", dotColor: "bg-muted-foreground", icon: CheckCircle2 },
};

interface WaConversationListProps {
  conversations: WaConversation[];
  loading: boolean;
  selectedId?: string;
  onSelect: (conv: WaConversation) => void;
  search: string;
  onSearchChange: (v: string) => void;
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  filterAssigned: string;
  onFilterAssignedChange: (v: string) => void;
  filterInstance: string;
  onFilterInstanceChange: (v: string) => void;
  filterTag: string;
  onFilterTagChange: (v: string) => void;
  vendedores: { id: string; nome: string; user_id: string | null }[];
  instances: WaInstance[];
  tags: WaTag[];
  hideAssignedFilter?: boolean;
  showGroups?: boolean;
  onShowGroupsChange?: (v: boolean) => void;
  showHidden?: boolean;
  onShowHiddenChange?: (v: boolean) => void;
  mutedIds?: Set<string>;
  hiddenIds?: Set<string>;
  followupConvIds?: Set<string>;
}

// ── Conversation Item ──────────────────────────────────
function ConversationItem({
  conv,
  isSelected,
  hasUnread,
  onSelect,
  vendedores,
  instances,
  mutedIds,
  hiddenIds,
  followupConvIds,
  crossInstanceCount,
}: {
  conv: WaConversation;
  isSelected: boolean;
  hasUnread: boolean;
  onSelect: (conv: WaConversation) => void;
  vendedores: { id: string; nome: string; user_id: string | null }[];
  instances: WaInstance[];
  mutedIds?: Set<string>;
  hiddenIds?: Set<string>;
  followupConvIds?: Set<string>;
  crossInstanceCount?: number;
}) {
  const [hovered, setHovered] = useState(false);
  const st = statusConfig[conv.status] || statusConfig.open;
  const derivedStatus = deriveConversationStatus(conv, followupConvIds);
  const derivedCfg = derivedStatus ? DERIVED_STATUS_CONFIG[derivedStatus] : null;
  const isMuted = mutedIds?.has(conv.id);
  const isHidden = hiddenIds?.has(conv.id);
  const isFollowup = followupConvIds?.has(conv.id);
  const isNote = conv.last_message_preview?.startsWith("[Nota interna]") || conv.last_message_preview?.startsWith("[Nota]");
  const displayName = conv.cliente_nome || conv.cliente_telefone || "Desconhecido";

  // Build badges
  const allBadges = useMemo(() => {
    const badges: BadgeItem[] = [];

    // Responsible
    const responsible = vendedores.find((v) => v.user_id === conv.assigned_to);
    badges.push({
      key: "assigned",
      label: responsible ? responsible.nome : "Não atribuído",
      icon: User,
      className: responsible
        ? "text-muted-foreground border-border bg-muted/30"
        : "text-warning border-warning/30 bg-warning/5",
    });

    // Instance
    if (instances.length > 1 && conv.instance_name) {
      badges.push({
        key: "instance",
        label: conv.instance_name,
        icon: Smartphone,
        className: "text-muted-foreground border-border bg-muted/30",
      });
    }

    // Cross-instance merge indicator
    if (crossInstanceCount && crossInstanceCount > 1) {
      badges.push({
        key: "cross-instance",
        label: `${crossInstanceCount} instâncias`,
        icon: GitBranch,
        className: "text-info border-info/30 bg-info/5 font-medium",
      });
    }

    // Lead origin
    if (conv.lead_nome) {
      badges.push({
        key: "lead",
        label: conv.lead_nome,
        icon: Link2,
        className: "text-primary/70 border-primary/20 bg-primary/5",
      });
    }

    // Tags
    conv.tags?.forEach((ct) => {
      if (ct.tag) {
        badges.push({
          key: `tag-${ct.tag_id}`,
          label: ct.tag.name,
          className: "border-border/50",
          style: {
            borderColor: ct.tag.color ? ct.tag.color + "60" : undefined,
            color: ct.tag.color,
            backgroundColor: ct.tag.color ? ct.tag.color + "10" : undefined,
          },
        });
      }
    });

    return badges;
  }, [conv, vendedores, instances]);

  const visibleBadges = allBadges.slice(0, MAX_VISIBLE_BADGES);
  const overflowBadges = allBadges.slice(MAX_VISIBLE_BADGES);

  return (
    <button
      onClick={() => onSelect(conv)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      aria-selected={isSelected}
      className={cn(
        "w-full text-left px-3 py-2.5 transition-all duration-150 overflow-hidden",
        "border-b border-border/20 border-l-2",
        isSelected
          ? "bg-primary/[0.06] border-l-primary"
          : "border-l-transparent hover:bg-muted/40",
        hasUnread && !isSelected && "bg-primary/[0.03]",
        isMuted && "opacity-60",
      )}
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <div className="relative shrink-0 mt-0.5">
          <div
            className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-bold",
              hasUnread
                ? "bg-primary/12 text-primary ring-2 ring-primary/20"
                : "bg-muted/60 text-muted-foreground",
            )}
          >
            {conv.profile_picture_url ? (
              <img src={conv.profile_picture_url} alt="" className="w-full h-full rounded-full object-cover" />
            ) : conv.is_group ? (
              <Users className="h-4 w-4" />
            ) : conv.cliente_nome ? (
              conv.cliente_nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
            ) : (
              <User className="h-4 w-4" />
            )}
          </div>
          <div className={cn("absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card", st.dotColor)} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 overflow-hidden">
          {/* Line 1: Name + status/unread + time */}
          <div className="flex items-center justify-between gap-1.5 mb-0.5">
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <span className={cn(
                "text-[13px] truncate",
                hasUnread ? "font-bold text-foreground" : "font-medium text-foreground/80",
              )}>
                {displayName}
              </span>
              {isMuted && <BellOff className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
              {isHidden && <EyeOff className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
              {isFollowup && <Bell className="h-3 w-3 text-warning shrink-0 animate-pulse" />}
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              {derivedCfg && derivedStatus !== "resolvida" && (
                <Badge variant="outline" className={cn("text-[9px] h-[16px] px-1.5 gap-0.5", derivedCfg.badgeClass)}>
                  <span className={cn("w-1.5 h-1.5 rounded-full", derivedCfg.dotClass)} />
                  {derivedCfg.label}
                </Badge>
              )}
              {conv.status === "resolved" && (
                <Badge variant="muted" size="sm" className="text-[9px] h-[16px] px-1.5">
                  Resolvida
                </Badge>
              )}
              {hasUnread && (
                <span className="flex items-center justify-center min-w-[18px] h-[18px] rounded-full bg-primary text-primary-foreground text-[10px] font-bold px-1 shadow-sm">
                  {conv.unread_count > 99 ? "99+" : conv.unread_count}
                </span>
              )}
              <span className={cn(
                "text-[10px] tabular-nums",
                hasUnread ? "text-primary font-semibold" : "text-muted-foreground",
              )}>
                {conv.last_message_at && formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR })}
              </span>
            </div>
          </div>

          {/* Line 2: Preview */}
          <div className="flex items-center gap-1 mb-1 min-w-0">
            {isNote && <StickyNote className="h-3 w-3 shrink-0 text-warning" />}
            <p className={cn(
              "text-xs truncate",
              isNote
                ? "text-warning/80 italic"
                : hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground",
            )}>
              {isNote ? "📝 Nota interna" : conv.last_message_preview || "Sem mensagens"}
            </p>
          </div>

          {/* Lines 3-4: Badges (2 rows × 2 badges + overflow popover) */}
          {allBadges.length > 0 && (
            <div className="space-y-0.5">
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
                          className="h-[18px] px-1.5 text-[9px] font-medium rounded-full border border-border bg-muted/50 text-muted-foreground hover:bg-muted transition-colors shrink-0"
                        >
                          +{overflowBadges.length}
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        side="right"
                        align="start"
                        className="w-auto max-w-[220px] p-2"
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
      </div>
    </button>
  );
}

// ── Cross-instance merge visual helper ─────────────────
// Computes how many different instances have a conversation for the same phone number.
// Uses normalize_br_phone logic: if telefone has 13 digits starting with 55, it's the canonical form.
function normalizeBrPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length === 12) {
    // Missing 9th digit — add it
    return digits.slice(0, 4) + "9" + digits.slice(4);
  }
  return digits;
}

function CrossInstanceWrapper({
  conversations,
  children,
}: {
  conversations: WaConversation[];
  children: (crossInstanceMap: Map<string, number>) => React.ReactNode;
}) {
  const crossInstanceMap = useMemo(() => {
    const phoneToInstances = new Map<string, Set<string>>();
    for (const conv of conversations) {
      if (conv.is_group) continue;
      const normalized = normalizeBrPhone(conv.cliente_telefone);
      if (!phoneToInstances.has(normalized)) {
        phoneToInstances.set(normalized, new Set());
      }
      phoneToInstances.get(normalized)!.add(conv.instance_id);
    }
    // Build a map from original phone → instance count (only if > 1)
    const result = new Map<string, number>();
    for (const conv of conversations) {
      if (conv.is_group) continue;
      const normalized = normalizeBrPhone(conv.cliente_telefone);
      const count = phoneToInstances.get(normalized)?.size || 1;
      if (count > 1) {
        result.set(conv.cliente_telefone, count);
      }
    }
    return result;
  }, [conversations]);

  return <>{children(crossInstanceMap)}</>;
}

// ── Main list ──────────────────────────────────────────
export function WaConversationList({
  conversations,
  loading,
  selectedId,
  onSelect,
  search,
  onSearchChange,
  filterStatus,
  onFilterStatusChange,
  filterAssigned,
  onFilterAssignedChange,
  filterInstance,
  onFilterInstanceChange,
  filterTag,
  onFilterTagChange,
  vendedores,
  instances,
  tags,
  hideAssignedFilter = false,
  showGroups = true,
  onShowGroupsChange,
  showHidden = false,
  onShowHiddenChange,
  mutedIds,
  hiddenIds,
  followupConvIds,
}: WaConversationListProps) {
  return (
    <div className="flex flex-col h-full border-r border-border/30 bg-card/50">
      {/* Search & Filters */}
      <div className="p-3 border-b border-border/30 space-y-2 bg-card">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/30 border-border/30 focus:bg-background"
          />
        </div>
        <div className="flex gap-1.5">
          <Select value={filterStatus} onValueChange={onFilterStatusChange}>
            <SelectTrigger className="h-7 text-[11px] flex-1 border-border/30">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="open">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-success" />
                  Abertas
                </span>
              </SelectItem>
              <SelectItem value="pending">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-warning" />
                  Pendentes
                </span>
              </SelectItem>
              <SelectItem value="resolved">
                <span className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                  Resolvidas
                </span>
              </SelectItem>
            </SelectContent>
          </Select>
          {!hideAssignedFilter && (
            <Select value={filterAssigned} onValueChange={onFilterAssignedChange}>
              <SelectTrigger className="h-7 text-[11px] flex-1 border-border/30">
                <SelectValue placeholder="Atribuído" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="unassigned">Sem atribuição</SelectItem>
                {vendedores.map((v) => (
                  <SelectItem key={v.id} value={v.user_id || v.id}>
                    {v.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
        {instances.length > 1 && (
          <Select value={filterInstance} onValueChange={onFilterInstanceChange}>
            <SelectTrigger className="h-7 text-[11px] border-border/30">
              <Smartphone className="h-3 w-3 mr-1.5" />
              <SelectValue placeholder="Instância" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as instâncias</SelectItem>
              {instances.map((inst) => (
                <SelectItem key={inst.id} value={inst.id}>
                  {inst.nome}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {tags.length > 0 && (
          <Select value={filterTag} onValueChange={onFilterTagChange}>
            <SelectTrigger className="h-7 text-[11px] border-border/30">
              <Tag className="h-3 w-3 mr-1.5" />
              <SelectValue placeholder="Tag" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as tags</SelectItem>
              {tags.map((tag) => (
                <SelectItem key={tag.id} value={tag.id}>
                  <span className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: tag.color }} />
                    {tag.name}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        {/* Group & Hidden toggles */}
        <div className="flex items-center gap-3 pt-0.5">
          {onShowGroupsChange && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={showGroups} onCheckedChange={onShowGroupsChange} className="h-4 w-7 [&>span]:h-3 [&>span]:w-3" />
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Users className="h-3 w-3" /> Grupos
              </span>
            </label>
          )}
          {onShowHiddenChange && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={showHidden} onCheckedChange={onShowHiddenChange} className="h-4 w-7 [&>span]:h-3 [&>span]:w-3" />
              <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                <Eye className="h-3 w-3" /> Ocultas
              </span>
            </label>
          )}
        </div>
      </div>

      {/* Conversations */}
      <ScrollArea className="flex-1">
        {loading ? (
          <div className="p-2 space-y-1">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="flex items-start gap-2.5 px-3 py-2.5">
                <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="flex justify-between">
                    <Skeleton className="h-3.5 w-24" />
                    <Skeleton className="h-3 w-10" />
                  </div>
                  <Skeleton className="h-3 w-full" />
                  <div className="flex gap-1">
                    <Skeleton className="h-[18px] w-16 rounded-full" />
                    <Skeleton className="h-[18px] w-14 rounded-full" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center px-6">
            <div className="w-14 h-14 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
              <MessageCircle className="h-7 w-7 text-muted-foreground/40" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Nenhuma conversa</p>
            <p className="text-xs text-muted-foreground/60 mt-1">Ajuste os filtros ou aguarde novas mensagens.</p>
          </div>
        ) : (
          <CrossInstanceWrapper conversations={conversations}>
            {(crossInstanceMap) => (
              <div role="listbox">
                {conversations.map((conv) => (
                  <ConversationItem
                    key={conv.id}
                    conv={conv}
                    isSelected={conv.id === selectedId}
                    hasUnread={conv.unread_count > 0}
                    onSelect={onSelect}
                    vendedores={vendedores}
                    instances={instances}
                    mutedIds={mutedIds}
                    hiddenIds={hiddenIds}
                    followupConvIds={followupConvIds}
                    crossInstanceCount={crossInstanceMap.get(conv.cliente_telefone)}
                  />
                ))}
              </div>
            )}
          </CrossInstanceWrapper>
        )}
      </ScrollArea>

      {/* Footer count */}
      <div className="p-2 border-t border-border/40 text-center">
        <p className="text-[10px] text-muted-foreground font-medium">{conversations.length} conversas</p>
      </div>
    </div>
  );
}
