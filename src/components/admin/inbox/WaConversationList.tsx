import { useState, useMemo } from "react";
import { WaProfileAvatar } from "./WaProfileAvatar";
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
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { WaConversation, WaTag } from "@/hooks/useWaInbox";
import { toCanonicalPhoneDigits } from "@/utils/phone/toCanonicalPhoneDigits";
import { deriveConversationStatus, DERIVED_STATUS_CONFIG } from "./useConversationStatus";
import type { WaInstance } from "@/hooks/useWaInstances";

// ── Urgency style by time since last message ──────────
function getUrgencyStyle(lastMessageAt: string | null, status: string): { background: string } {
  if (status === "resolved") return { background: "hsl(var(--muted-foreground) / 0.4)" };
  if (!lastMessageAt) return { background: "hsl(var(--warning))" };
  const hoursAgo = (Date.now() - new Date(lastMessageAt).getTime()) / 1000 / 60 / 60;
  if (hoursAgo < 1) return { background: "hsl(var(--success))" };
  if (hoursAgo < 6) return { background: "hsl(var(--warning))" };
  return { background: "hsl(var(--destructive))" };
}

function getUrgencyLabel(lastMessageAt: string | null, status: string): string {
  if (status === "resolved") return "Conversa resolvida";
  if (!lastMessageAt) return "Sem mensagens";
  const hoursAgo = (Date.now() - new Date(lastMessageAt).getTime()) / 1000 / 60 / 60;
  if (hoursAgo < 1) return "✅ Em dia — respondido há menos de 1 hora";
  if (hoursAgo < 6) return "⚠️ Atenção — sem resposta há mais de 1 hora";
  return "🔴 Urgente — sem resposta há mais de 6 horas";
}

function getHoursAgo(lastMessageAt: string | null): number | null {
  if (!lastMessageAt) return null;
  return (Date.now() - new Date(lastMessageAt).getTime()) / 1000 / 60 / 60;
}
// ── Display name helper ────────────────────────────────
// Precedência: clientes.nome > leads.nome > cliente_nome (se ≠ profile_name da instância) > telefone
function formatWaDisplayName(conv: {
  cliente_nome?: string | null;
  cliente_telefone?: string | null;
  remote_jid?: string | null;
  cliente_nome_real?: string | null;
  lead_nome?: string | null;
  instance_profile_name?: string | null;
  is_group?: boolean;
}): string {
  if (conv.cliente_nome_real?.trim()) return conv.cliente_nome_real.trim();
  if (conv.lead_nome?.trim()) return conv.lead_nome.trim();

  const raw = conv.cliente_nome?.trim();
  const profileName = conv.instance_profile_name?.trim().toLowerCase();
  // Bloqueia o nome da empresa vazando como nome do contato (apenas em conversas 1:1)
  if (raw && (conv.is_group || !profileName || raw.toLowerCase() !== profileName)) {
    return raw;
  }

  const rawPhone = conv.cliente_telefone || conv.remote_jid || "";
  const cleanPhone = rawPhone
    .replace(/@lid$/, "")
    .replace(/@s\.whatsapp\.net$/, "")
    .replace(/@g\.us$/, "")
    .trim();

  if (!cleanPhone) return "Contato desconhecido";

  if (/^\d+$/.test(cleanPhone)) {
    const digits = cleanPhone.replace(/^55/, "");
    if (digits.length === 11) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
      return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `+${cleanPhone}`;
  }

  return cleanPhone;
}

// ── Message preview helper ─────────────────────────────
function getMessagePreview(type: string | null | undefined, body: string | null | undefined): string {
  if (type === "image") return "📷 Imagem";
  if (type === "video") return "🎥 Vídeo";
  if (type === "audio" || type === "ptt") return "🎵 Áudio";
  if (type === "document") return "📄 Documento";
  if (type === "sticker") return "🎭 Figurinha";
  if (type === "location") return "📍 Localização";
  return body || "";
}

function normalizeConversationPreview(preview: string | null | undefined): string {
  const value = preview?.trim();
  if (!value) return "Sem mensagens";

  const legacyMap: Record<string, string> = {
    "[text]": "Mensagem",
    "[image]": "📷 Imagem",
    "[video]": "🎥 Vídeo",
    "[audio]": "🎵 Áudio",
    "[document]": "📄 Documento",
    "[sticker]": "🎭 Figurinha",
    "[location]": "📍 Localização",
    "[contact]": "👤 Contato",
    "[reaction]": "👍 Reação",
  };

  return legacyMap[value] || value;
}

// ── Status badge ───────────────────────────────────────
function StatusBadge({ status, assigned }: { status: string; assigned: string | null }) {
  if (status === "resolved") {
    return (
      <Badge variant="outline" className="text-[9px] h-[16px] px-1.5 bg-muted/50 text-muted-foreground border-border">
        Resolvida
      </Badge>
    );
  }
  if (status === "pending") {
    return (
      <Badge variant="outline" className="text-[9px] h-[16px] px-1.5 bg-warning/10 text-warning border-warning/20">
        Pendente
      </Badge>
    );
  }
  if (!assigned) {
    return (
      <Badge variant="outline" className="text-[9px] h-[16px] px-1.5 bg-info/10 text-info border-info/20">
        Novo
      </Badge>
    );
  }
  return null;
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
  pinnedIds?: Set<string>;
  onContextMenuConv?: (e: React.MouseEvent, conv: WaConversation) => void;
}

// ── Conversation Item (redesigned) ─────────────────────
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
  isPinned,
  onContextMenu,
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
  isPinned?: boolean;
  onContextMenu?: (e: React.MouseEvent, conv: WaConversation) => void;
}) {
  const st = statusConfig[conv.status] || statusConfig.open;
  const isMuted = mutedIds?.has(conv.id);
  const isHidden = hiddenIds?.has(conv.id);
  const isFollowup = followupConvIds?.has(conv.id);
  const isNote = conv.last_message_preview?.startsWith("[Nota interna]") || conv.last_message_preview?.startsWith("[Nota]");
  const displayName = formatWaDisplayName(conv);

  const responsible = vendedores.find((v) => v.user_id === conv.assigned_to);

  // Urgency bar (inline style for reliable rendering)
  const urgencyStyle = getUrgencyStyle(conv.last_message_at, conv.status);
  const urgencyLabel = getUrgencyLabel(conv.last_message_at, conv.status);
  const hoursAgo = getHoursAgo(conv.last_message_at);
  const isUrgent = hoursAgo !== null && hoursAgo > 6 && conv.status !== "resolved";

  const preview = isNote
    ? "📝 Nota interna"
    : normalizeConversationPreview(conv.last_message_preview);

  return (
    // RB-03-exception: chat micro-interaction — conversation card with onContextMenu and complex layout
    <button
      onClick={() => onSelect(conv)}
      onContextMenu={(e) => {
        if (onContextMenu) {
          e.preventDefault();
          onContextMenu(e, conv);
        } else {
          e.preventDefault();
        }
      }}
      aria-selected={isSelected}
      className={cn(
        "relative w-full text-left flex gap-2 items-stretch p-[10px_12px] bg-card",
        "border border-border rounded-xl cursor-pointer",
        "hover:bg-muted/50 transition-colors overflow-hidden",
        "mb-1",
        isSelected && "bg-primary/[0.06] ring-1 ring-primary/20",
        hasUnread && !isSelected && "bg-primary/[0.03]",
        isMuted && "opacity-60",
        isPinned && "ring-1 ring-warning/30",
      )}
    >
      {/* Left urgency bar with tooltip */}
      <TooltipProvider delayDuration={600}>
        <Tooltip>
          <TooltipTrigger asChild>
            <div
              style={{
                ...urgencyStyle,
                position: "absolute",
                left: 0,
                top: 0,
                bottom: 0,
                width: "3px",
                borderRadius: "10px 0 0 10px",
              }}
            />
          </TooltipTrigger>
          <TooltipContent side="right">
            <p>{urgencyLabel}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      {/* Avatar */}
      <div className="relative ml-1.5 shrink-0 self-center">
        <WaProfileAvatar
          profilePictureUrl={conv.profile_picture_url}
          isGroup={conv.is_group}
          name={displayName}
          size="md"
          colorByName
        />
        {conv.status === "open" && (
          <div className="absolute bottom-0.5 right-0.5 w-2.5 h-2.5 rounded-full bg-success border-2 border-card" />
        )}
      </div>

      {/* Body */}
      <div className="flex-1 min-w-0 flex flex-col gap-[3px] pl-1.5">
        {/* Line 1 — name + time */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex items-center gap-1 min-w-0 flex-1">
            <span className={cn(
              "text-[13.5px] truncate",
              hasUnread ? "font-bold text-foreground" : "font-medium text-foreground",
            )}>
              {displayName}
            </span>
            {isPinned && <Pin className="h-3 w-3 text-warning shrink-0" />}
            {isMuted && <BellOff className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
            {isHidden && <EyeOff className="h-3 w-3 text-muted-foreground/50 shrink-0" />}
            {isFollowup && <Bell className="h-3 w-3 text-warning shrink-0 animate-pulse" />}
          </div>
          <span className={cn(
            "text-[11px] shrink-0",
            isUrgent ? "text-destructive font-medium" : "text-muted-foreground",
          )}>
            {conv.last_message_at && formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: false, locale: ptBR })}
            {isUrgent && " ⚠"}
          </span>
        </div>

        {/* Line 2 — preview + status badge */}
        <div className="flex justify-between items-center gap-2">
          <span className={cn(
            "text-[12px] truncate flex-1",
            isNote ? "text-warning/80 italic" : hasUnread ? "text-foreground/80 font-medium" : "text-muted-foreground",
          )}>
            {preview || "Sem mensagens"}
          </span>
          <StatusBadge status={conv.status} assigned={conv.assigned_to} />
        </div>

        {/* Line 3 — tags + badges */}
        <div className="flex justify-between items-center gap-2">
          <div className="flex gap-1 overflow-hidden">
            {responsible && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border truncate max-w-[80px]">
                {responsible.nome}
              </span>
            )}
            {instances.length > 1 && conv.instance_name && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border truncate max-w-[70px]">
                {conv.instance_name}
              </span>
            )}
            {conv.tags?.slice(0, 2).map((ct) => (
              <span
                key={ct.tag_id}
                className="text-[10px] px-1.5 py-0.5 rounded border truncate max-w-[70px]"
                style={{
                  backgroundColor: ct.tag?.color ? `${ct.tag.color}20` : undefined,
                  borderColor: ct.tag?.color ? `${ct.tag.color}40` : undefined,
                  color: ct.tag?.color || undefined,
                }}
              >
                {ct.tag?.name || "Tag"}
              </span>
            ))}
            {(conv.tags?.length || 0) > 2 && (
              <span className="text-[10px] text-muted-foreground px-1 py-0.5">
                +{(conv.tags?.length || 0) - 2}
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {crossInstanceCount && crossInstanceCount > 1 && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded border border-border">
                {crossInstanceCount} inst.
              </span>
            )}
            {hasUnread && (
              <span className="text-[10px] font-medium text-destructive-foreground bg-destructive min-w-[18px] h-[18px] rounded-full flex items-center justify-center px-1">
                {conv.unread_count > 99 ? "99+" : conv.unread_count}
              </span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}

// ── Cross-instance merge visual helper ─────────────────
function normalizeBrPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("55") && digits.length === 12) {
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
  pinnedIds,
  onContextMenuConv,
}: WaConversationListProps) {
  // Lista única ordenada por última mensagem (já vem ordenada do hook).

  // ── Dedup por contato (telefone canônico) ─────────────
  // Evita exibir o mesmo contato repetido quando há múltiplas conversas
  // (instâncias diferentes ou variações de JID com/sem 9º dígito).
  const [mergeDuplicates, setMergeDuplicates] = useState<boolean>(() => {
    if (typeof window === "undefined") return true;
    return window.localStorage.getItem("wa-inbox-merge-duplicates") !== "0";
  });
  const handleMergeChange = (v: boolean) => {
    setMergeDuplicates(v);
    if (typeof window !== "undefined") {
      window.localStorage.setItem("wa-inbox-merge-duplicates", v ? "1" : "0");
    }
  };

  const { displayedConversations, duplicateCountByConvId } = useMemo(() => {
    const dupCount = new Map<string, number>();
    if (!mergeDuplicates) {
      return { displayedConversations: conversations, duplicateCountByConvId: dupCount };
    }
    const buckets = new Map<string, WaConversation[]>();
    const passthrough: WaConversation[] = [];
    for (const c of conversations) {
      if (c.is_group) {
        passthrough.push(c);
        continue;
      }
      const canonical = toCanonicalPhoneDigits(c.cliente_telefone || c.remote_jid || "");
      const key = canonical || `__raw:${(c.cliente_telefone || c.remote_jid || c.id).trim()}`;
      const arr = buckets.get(key);
      if (arr) arr.push(c);
      else buckets.set(key, [c]);
    }
    const winners: WaConversation[] = [];
    for (const arr of buckets.values()) {
      arr.sort((a, b) => {
        const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
        const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
        return tb - ta;
      });
      const winner = arr[0];
      // Soma unread_count de todas as duplicatas no vencedor para não perder badge
      const totalUnread = arr.reduce((s, c) => s + (c.unread_count || 0), 0);
      winners.push({ ...winner, unread_count: totalUnread });
      if (arr.length > 1) dupCount.set(winner.id, arr.length);
    }
    const merged = [...winners, ...passthrough].sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const tb = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return tb - ta;
    });
    return { displayedConversations: merged, duplicateCountByConvId: dupCount };
  }, [conversations, mergeDuplicates]);

  return (
    <div className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-r border-border/30 bg-card/50">
      {/* Search & Filters */}
      <div className="shrink-0 p-3 border-b border-border/30 space-y-2 bg-card overflow-visible">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar conversa..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 text-sm bg-muted/30 border-border/30 focus:bg-background"
          />
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
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
        <div className="flex flex-wrap items-center gap-2">
          {onShowGroupsChange && (
            <label className="flex items-center gap-1.5 cursor-pointer">
              <Switch checked={showGroups} onCheckedChange={onShowGroupsChange} className="h-4 w-7 [&>span]:!h-3 [&>span]:!w-3 [&>span[data-state=checked]]:!translate-x-3 [&>span[data-state=unchecked]]:!translate-x-0.5" />
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
          <label
            className="flex items-center gap-1.5 cursor-pointer"
            title="Exibe cada conversa do mesmo contato separadamente (sem agrupar duplicatas por telefone)."
          >
            <Switch
              checked={!mergeDuplicates}
              onCheckedChange={(v) => handleMergeChange(!v)}
              className="h-4 w-7 [&>span]:h-3 [&>span]:w-3"
            />
            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
              <GitBranch className="h-3 w-3" /> Ver separadas
            </span>
          </label>
        </div>

      {/* Conversations */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <div className="h-full min-h-0 overflow-y-auto wa-conversation-list p-1.5">
          {loading ? (
            <div className="space-y-1.5">
              {Array.from({ length: 8 }).map((_, i) => (
                <div key={i} className="flex items-center gap-2.5 p-[10px_12px] border border-border rounded-xl">
                  <Skeleton className="h-10 w-10 rounded-full shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="flex justify-between">
                      <Skeleton className="h-3.5 w-24" />
                      <Skeleton className="h-3 w-10" />
                    </div>
                    <Skeleton className="h-3 w-full" />
                    <div className="flex gap-1">
                      <Skeleton className="h-4 w-16 rounded" />
                      <Skeleton className="h-4 w-14 rounded" />
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
                      isPinned={pinnedIds?.has(conv.id)}
                      onContextMenu={onContextMenuConv}
                    />
                  ))}
                </div>
              )}
            </CrossInstanceWrapper>
          )}
        </div>
      </div>

      {/* Footer count */}
      <div className="shrink-0 p-2 border-t border-border/40 text-center">
        <p className="text-[10px] text-muted-foreground font-medium">{conversations.length} conversas</p>
      </div>
    </div>
  );
}
