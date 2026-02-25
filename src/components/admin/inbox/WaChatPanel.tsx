import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { WaProfileAvatar } from "./WaProfileAvatar";
import { supabase } from "@/integrations/supabase/client";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { WaAISidebar } from "./WaAISidebar";
import { WaNotesPanel } from "./WaNotesPanel";
import {
  Sparkles,
  StickyNote,
  User,
  Users,
  CheckCircle2,
  ArrowRightLeft,
  Tag,
  MoreVertical,
  Link2,
  RefreshCw,
  Smartphone,
  Upload,
  MessageCircle,
  BellOff,
  Bell,
  EyeOff,
  Eye,
  PanelRightOpen,
  PanelRightClose,
  CalendarPlus,
  UserMinus,
  MessageSquarePlus,
  UserPlus,
  Phone,
  FileText,
  Image as ImageIcon,
  Download,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Sheet,
  SheetContent,
  SheetTitle,
} from "@/components/ui/sheet";
import type { WaConversation, WaMessage } from "@/hooks/useWaInbox";
import { deriveConversationStatus, DERIVED_STATUS_CONFIG } from "./useConversationStatus";
import { WaChatComposer } from "./WaChatComposer";
import { WaLeadInfoCard } from "./WaLeadInfoCard";
import { WaCRMSidebar } from "./WaCRMSidebar";
import { WaForwardDialog } from "./WaForwardDialog";
import { WaMediaPreview } from "./WaMediaPreview";
import { WaMessageContextMenu, type ContextMenuState } from "./WaMessageContextMenu";
import { WaMessageBubble } from "./WaMessageBubble";
import { WaAppointmentModal } from "./WaAppointmentModal";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    // 55 + DD + 9XXXX-XXXX
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `(${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return phone;
}
// WaInternalThread removed — replaced by dedicated internal chat system
const WaParticipants = lazy(() => import("./WaParticipants").then(m => ({ default: m.WaParticipants })));

interface ReplyingTo {
  id: string;
  content: string | null;
  direction: "in" | "out";
  sent_by_name?: string | null;
}

interface WaChatPanelProps {
  conversation: WaConversation | null;
  messages: WaMessage[];
  loading: boolean;
  isSending: boolean;
  initialLoadDone: boolean;
  isLoadingMore: boolean;
  hasOlderMessages: boolean;
  onLoadOlder: () => void;
  onSendMessage: (content: string, isNote?: boolean, quotedMessageId?: string) => void;
  onSendMedia: (file: File, caption?: string) => void;
  onSendReaction: (messageId: string, reaction: string) => void;
  onResolve: () => void;
  onReopen: () => void;
  onOpenTransfer: () => void;
  onOpenTags: () => void;
  onOpenAssign: () => void;
  onLinkLead: () => void;
  onAccept?: () => void;
  onRelease?: () => void;
  isAccepting?: boolean;
  isReleasing?: boolean;
  currentUserId?: string;
  vendedores: { id: string; nome: string; user_id: string | null }[]; // TODO: rename to consultores
  lastReadMessageId?: string | null;
  onMarkAsRead?: (messageId: string) => void;
  isMuted?: boolean;
  isHidden?: boolean;
  onToggleMute?: () => void;
  onToggleHide?: () => void;
  prefillMessage?: string | null;
}

export function WaChatPanel({
  conversation,
  messages,
  loading,
  isSending,
  initialLoadDone,
  isLoadingMore,
  hasOlderMessages,
  onLoadOlder,
  onSendMessage,
  onSendMedia,
  onSendReaction,
  onResolve,
  onReopen,
  onOpenTransfer,
  onOpenTags,
  onOpenAssign,
  onLinkLead,
  onAccept,
  onRelease,
  isAccepting,
  isReleasing,
  currentUserId,
  vendedores,
  lastReadMessageId,
  onMarkAsRead,
  isMuted,
  isHidden,
  onToggleMute,
  onToggleHide,
  prefillMessage,
}: WaChatPanelProps) {
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [showLeadInfo, setShowLeadInfo] = useState(false);
  const [showCRMSidebar, setShowCRMSidebar] = useState(false);
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "image" | "video" | "audio" | "document"; caption?: string } | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deletedMsgIds, setDeletedMsgIds] = useState<Set<string>>(new Set());
  const [forwardingMsg, setForwardingMsg] = useState<WaMessage | null>(null);
  
  const [showParticipants, setShowParticipants] = useState(false);

  // Fetch participant count for badge indicator
  const { data: participantCount = 0 } = useQuery({
    queryKey: ["wa-participants-count", conversation?.id],
    queryFn: async () => {
      if (!conversation) return 0;
      const { count, error } = await supabase
        .from("wa_conversation_participants")
        .select("id", { count: "exact", head: true })
        .eq("conversation_id", conversation.id)
        .eq("is_active", true);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!conversation?.id,
    staleTime: 60_000, // cache 1min — participant count rarely changes
  });
  const [atBottom, setAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const dragCounter = useRef(0);
  const prevMsgCountRef = useRef(0);
  const isMobileDevice = useIsMobile();

  // Load hidden messages from DB on conversation change
  useEffect(() => {
    if (!conversation || !currentUserId) return;
    setDeletedMsgIds(new Set());
    const loadHidden = async () => {
      try {
        const { data } = await supabase
          .from("wa_message_hidden" as any)
          .select("message_id")
          .eq("user_id", currentUserId);
        if (data && data.length > 0) {
          setDeletedMsgIds(new Set(data.map((d: any) => d.message_id)));
        }
      } catch {}
    };
    loadHidden();
  }, [conversation?.id, currentUserId]);

  // Build a map for quoted message lookup
  const messagesMap = useMemo(() => {
    const map = new Map<string, WaMessage>();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  // Filter out deleted-for-me messages
  const visibleMessages = useMemo(
    () => messages.filter((m) => !deletedMsgIds.has(m.id)),
    [messages, deletedMsgIds]
  );

  // Track new messages for "new messages" banner
  useEffect(() => {
    if (visibleMessages.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
      if (atBottom) {
        virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length - 1, behavior: "smooth" });
      } else {
        setNewMsgCount(prev => prev + (visibleMessages.length - prevMsgCountRef.current));
      }
    }
    prevMsgCountRef.current = visibleMessages.length;
  }, [visibleMessages.length, atBottom]);

  // Mark as read when at bottom and messages exist
  useEffect(() => {
    if (atBottom && visibleMessages.length > 0 && onMarkAsRead) {
      const lastMsg = visibleMessages[visibleMessages.length - 1];
      onMarkAsRead(lastMsg.id);
    }
  }, [atBottom, visibleMessages.length, onMarkAsRead]);

  const handleScrollToBottom = useCallback(() => {
    setNewMsgCount(0);
    virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length - 1, behavior: "smooth" });
  }, [visibleMessages.length]);

  const handleContextMenu = useCallback((e: React.MouseEvent, msg: WaMessage) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, message: msg });
  }, []);

  const handleReply = useCallback((msg: WaMessage) => {
    setReplyingTo({
      id: msg.id,
      content: msg.content,
      direction: msg.direction,
      sent_by_name: msg.sent_by_name,
    });
    setContextMenu(null);
  }, []);

  const handleCopy = useCallback((msg: WaMessage) => {
    if (msg.content) navigator.clipboard.writeText(msg.content);
    setContextMenu(null);
  }, []);

  const handleDeleteForMe = useCallback(async (msg: WaMessage) => {
    setDeletedMsgIds((prev) => new Set(prev).add(msg.id));
    setContextMenu(null);
    try {
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      if (currentUser) {
        const { getCurrentTenantId } = await import("@/lib/storagePaths");
        const tenantId = await getCurrentTenantId();
        await supabase.from("wa_message_hidden" as any).insert({
          user_id: currentUser.id,
          message_id: msg.id,
          tenant_id: tenantId,
        });
      }
    } catch (err) {
      console.error("Failed to persist hidden message:", err);
    }
  }, []);

  const handleForward = useCallback((msg: WaMessage) => {
    setForwardingMsg(msg);
    setContextMenu(null);
  }, []);

  // Drag & drop handlers
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes("Files")) setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) setIsDragging(false);
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.size <= 16 * 1024 * 1024) {
      onSendMedia(file);
    }
  }, [onSendMedia]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-muted/5 to-muted/20">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-success/15 to-success/5 border border-success/10 flex items-center justify-center mb-5 shadow-lg shadow-success/5">
          <MessageCircle className="h-9 w-9 text-success/60" />
        </div>
        <h3 className="text-lg font-semibold text-foreground/70">Suas Conversas</h3>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">
          Selecione uma conversa ao lado para começar a conversar.
        </p>
      </div>
    );
  }

  const assignedConsultor = vendedores.find((v) => v.user_id === conversation.assigned_to);

  const renderMessage = (idx: number) => {
    const msg = visibleMessages[idx];
    if (!msg) return null;

    return (
      <WaMessageBubble
        msg={msg}
        idx={idx}
        visibleMessages={visibleMessages}
        conversation={conversation}
        messagesMap={messagesMap}
        reactionPickerMsgId={reactionPickerMsgId}
        onContextMenu={handleContextMenu}
        onReply={handleReply}
        onReactionPickerToggle={setReactionPickerMsgId}
        onSendReaction={onSendReaction}
        onMediaPreview={setMediaPreview}
      />
    );
  };

  // CRM Sidebar content (shared between desktop panel and mobile sheet)
  const crmSidebarContent = showCRMSidebar && (
    <WaCRMSidebar
      conversation={conversation}
      onClose={() => setShowCRMSidebar(false)}
    />
  );

  return (
    <div className="flex-1 flex min-w-0 w-full max-w-full overflow-x-hidden">
      <div className="flex-1 flex flex-col min-w-0 w-full max-w-full">
        {/* Chat Header */}
        <div className="border-b border-border/30 bg-card shadow-xs">
          {/* Row 1: Avatar + Name + Action icons */}
          <div className="px-3 pt-2 pb-1.5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <WaProfileAvatar
                profilePictureUrl={conversation.profile_picture_url}
                isGroup={conversation.is_group}
                name={conversation.cliente_nome}
                size="sm"
                className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 text-primary"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-foreground truncate">
                    {conversation.cliente_nome || formatPhone(conversation.cliente_telefone)}
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className={`w-2 h-2 rounded-full shrink-0 ${conversation.status === "resolved" ? "bg-destructive" : "bg-success"} animate-[pulse_3s_ease-in-out_infinite]`} />
                    </TooltipTrigger>
                    <TooltipContent>{conversation.status === "resolved" ? "Offline" : "Online"}</TooltipContent>
                  </Tooltip>
                  {participantCount > 0 && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => setShowParticipants(true)}
                          className="flex items-center gap-0.5 shrink-0 text-info hover:text-info/80 transition-colors"
                        >
                          <Users className="h-3 w-3" />
                          <span className="text-[10px] font-medium">+{participantCount}</span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>{participantCount} participante{participantCount > 1 ? "s" : ""} no co-atendimento</TooltipContent>
                    </Tooltip>
                  )}
                </div>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  {assignedConsultor && <span className="truncate max-w-[80px]">{assignedConsultor.nome}</span>}
                  {conversation.lead_id && (
                    <button onClick={() => setShowLeadInfo(true)} className="text-primary/70 hover:text-primary transition-colors truncate max-w-[70px]">
                      {assignedConsultor ? " · " : ""}{conversation.lead_nome || "Lead"}
                    </button>
                  )}
                </div>
              </div>
            </div>
            {/* Top action icons */}
            <div className="flex items-center gap-0.5 shrink-0">
              {!conversation.assigned_to && onAccept && (
                <Button
                  size="sm"
                  className="h-7 gap-1 bg-success hover:bg-success/90 text-white text-xs px-2.5"
                  onClick={onAccept}
                  disabled={isAccepting}
                >
                  {isAccepting ? (
                    <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  ) : (
                    <><CheckCircle2 className="h-3.5 w-3.5" /> Aceitar</>
                  )}
                </Button>
              )}

              {/* Bell: unanswered incoming messages */}
              {(() => {
                const unanswered = (() => {
                  let count = 0;
                  for (let i = visibleMessages.length - 1; i >= 0; i--) {
                    if (visibleMessages[i].direction === "out" && !visibleMessages[i].is_internal_note) break;
                    if (visibleMessages[i].direction === "in") count++;
                  }
                  return count;
                })();
                return (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        size="icon"
                        variant="ghost"
                        className={`h-7 w-7 relative ${unanswered > 0 ? "text-destructive" : ""}`}
                      >
                        <Bell className="h-3.5 w-3.5" />
                        {unanswered > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">
                            {unanswered}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{unanswered > 0 ? `${unanswered} sem resposta` : "Tudo respondido"}</TooltipContent>
                  </Tooltip>
                );
              })()}
              {/* Quick access icons — most used actions outside dropdown */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={showNotesPanel ? "default" : "ghost"}
                    className={`h-7 w-7 relative ${showNotesPanel ? "bg-warning/15 text-warning" : ""}`}
                    onClick={() => setShowNotesPanel(!showNotesPanel)}
                  >
                    <StickyNote className="h-3.5 w-3.5" />
                    {messages.filter(m => m.is_internal_note).length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[8px] font-bold">
                        {messages.filter(m => m.is_internal_note).length}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Notas</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={showAISidebar ? "default" : "ghost"}
                    className={`h-7 w-7 ${showAISidebar ? "bg-accent/20 text-accent-foreground" : ""}`}
                    onClick={() => { setShowAISidebar(!showAISidebar); if (!showAISidebar) setShowCRMSidebar(false); }}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>IA</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    size="icon"
                    variant={showCRMSidebar ? "default" : "ghost"}
                    className={`h-7 w-7 ${showCRMSidebar ? "bg-primary/10 text-primary" : ""}`}
                    onClick={() => { setShowCRMSidebar(!showCRMSidebar); if (!showCRMSidebar) setShowAISidebar(false); }}
                  >
                    {showCRMSidebar ? <PanelRightClose className="h-3.5 w-3.5" /> : <PanelRightOpen className="h-3.5 w-3.5" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>CRM</TooltipContent>
              </Tooltip>

              {conversation.status !== "resolved" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onResolve}>
                      <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Resolver</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={onReopen}>
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Reabrir</TooltipContent>
                </Tooltip>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-7 w-7">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-52">
                  <DropdownMenuItem onClick={onOpenTransfer}>
                    <ArrowRightLeft className="h-4 w-4 mr-2" />
                    Transferir
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenAssign}>
                    <User className="h-4 w-4 mr-2" />
                    Atribuir
                  </DropdownMenuItem>
                  {conversation.assigned_to === currentUserId && onRelease && (
                    <DropdownMenuItem onClick={onRelease} disabled={isReleasing}>
                      <UserMinus className="h-4 w-4 mr-2" />
                      Liberar atendimento
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={onOpenTags}>
                    <Tag className="h-4 w-4 mr-2" />
                    Tags
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onLinkLead}>
                    <Link2 className="h-4 w-4 mr-2" />
                    {conversation.lead_id ? "Alterar Lead" : "Vincular Lead"}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAppointmentModal(true)}>
                    <CalendarPlus className="h-4 w-4 mr-2" />
                    Agendar Compromisso
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowParticipants(!showParticipants)}>
                    <UserPlus className="h-4 w-4 mr-2" />
                    Participantes
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {onToggleHide && (
                    <DropdownMenuItem onClick={onToggleHide}>
                      {isHidden ? <Eye className="h-4 w-4 mr-2" /> : <EyeOff className="h-4 w-4 mr-2" />}
                      {isHidden ? "Mostrar conversa" : "Ocultar conversa"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          {/* Row 2: Phone + WhatsApp labeled buttons */}
          {conversation.cliente_telefone && (
            <div className="px-3 pb-2 flex items-center gap-2">
              <a
                href={(() => {
                  const digits = conversation.cliente_telefone.replace(/\D/g, "");
                  // Remove country code 55 to get local number
                  const local = digits.startsWith("55") ? digits.substring(2) : digits;
                  // Add carrier prefix 015 (Vivo) for long-distance calls
                  const ddd = local.substring(0, 2);
                  const numero = local.substring(2);
                  return `tel:015${ddd}${numero}`;
                })()}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-info/10 text-info text-[11px] font-medium hover:bg-info/20 transition-colors hover-scale"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone className="h-3.5 w-3.5" />
                Telefone
              </a>
              <div className="w-px h-4 bg-border/50" />
              <a
                href={`https://wa.me/${conversation.cliente_telefone.replace(/\D/g, "")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10 text-success text-[11px] font-medium hover:bg-success/20 transition-colors hover-scale"
                onClick={(e) => e.stopPropagation()}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                WhatsApp
              </a>
            </div>
          )}
        </div>

        {/* Files Panel */}
        {showFilesPanel && (
          <div className="border-b border-border/30 bg-muted/5 animate-fade-in overflow-y-auto max-h-[40vh]">
            <div className="p-3">
              {(() => {
                const mediaMessages = visibleMessages.filter(m => m.media_url);
                const received = mediaMessages.filter(m => m.direction === "in");
                const sent = mediaMessages.filter(m => m.direction === "out");
                const renderFile = (msg: typeof mediaMessages[0]) => (
                  <a
                    key={msg.id}
                    href={msg.media_url!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 p-2 rounded-lg bg-card border border-border/40 hover:bg-accent/50 transition-colors group"
                  >
                    {msg.media_mime_type?.startsWith("image") ? (
                      <div className="h-10 w-10 rounded bg-info/10 flex items-center justify-center shrink-0">
                        <ImageIcon className="h-4 w-4 text-info" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded bg-warning/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-warning" />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[11px] font-medium text-foreground truncate">
                        {msg.content?.slice(0, 30) || msg.media_mime_type || "Arquivo"}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {new Date(msg.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <Download className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </a>
                );
                return (
                  <div className="space-y-3">
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Download className="h-3 w-3" /> Recebidos ({received.length})
                      </p>
                      {received.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground/60 pl-1">Nenhum arquivo recebido</p>
                      ) : (
                        <div className="space-y-1">{received.map(renderFile)}</div>
                      )}
                    </div>
                    <div className="h-px bg-border/40" />
                    <div>
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 flex items-center gap-1">
                        <Upload className="h-3 w-3" /> Enviados ({sent.length})
                      </p>
                      {sent.length === 0 ? (
                        <p className="text-[10px] text-muted-foreground/60 pl-1">Nenhum arquivo enviado</p>
                      ) : (
                        <div className="space-y-1">{sent.map(renderFile)}</div>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        )}

        {/* Messages with virtualization */}
        <div
          className="flex-1 relative bg-gradient-to-b from-muted/5 via-transparent to-muted/10 min-w-0 overflow-x-hidden"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          onTouchStart={(e) => {
            const t = e.currentTarget;
            (t as any)._swLX = e.touches[0].clientX;
            (t as any)._swLY = e.touches[0].clientY;
          }}
          onTouchEnd={(e) => {
            const t = e.currentTarget;
            const sx = (t as any)._swLX;
            const sy = (t as any)._swLY;
            if (sx == null) return;
            const dx = e.changedTouches[0].clientX - sx;
            const dy = Math.abs(e.changedTouches[0].clientY - sy);
            if (dx < -80 && dy < 60) {
              setShowFilesPanel(true);
            }
            (t as any)._swLX = null;
            (t as any)._swLY = null;
          }}
        >
          {/* Drag overlay */}
          {isDragging && (
            <div className="absolute inset-0 z-30 bg-primary/10 border-2 border-dashed border-primary/40 rounded-lg flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Upload className="h-8 w-8 text-primary/60 mx-auto mb-2" />
                <p className="text-sm font-medium text-primary/80">Solte o arquivo aqui</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-4 space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}>
                  <Skeleton className="h-12 w-48 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
            </div>
          ) : (
            <>
              <Virtuoso
                key={conversation?.id}
                ref={virtuosoRef}
                totalCount={visibleMessages.length}
                itemContent={renderMessage}
                initialTopMostItemIndex={visibleMessages.length - 1}
                followOutput={(isAtBottom) => isAtBottom ? "smooth" : false}
                atBottomStateChange={setAtBottom}
                atBottomThreshold={150}
                alignToBottom
                startReached={() => {
                  if (hasOlderMessages && !isLoadingMore) onLoadOlder();
                }}
                className="h-full"
                style={{ height: "100%" }}
                overscan={200}
                increaseViewportBy={{ top: 400, bottom: 200 }}
                components={{
                  Header: () => isLoadingMore ? (
                    <div className="flex justify-center py-3">
                      <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                  ) : null,
                }}
              />
              {newMsgCount > 0 && !atBottom && (
                <button
                  onClick={handleScrollToBottom}
                  className="absolute bottom-20 left-1/2 -translate-x-1/2 z-20 px-4 py-2 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg hover:bg-primary/90 transition-colors animate-in slide-in-from-bottom-2"
                >
                  {`↓ ${newMsgCount} nova${newMsgCount > 1 ? "s" : ""} mensage${newMsgCount > 1 ? "ns" : "m"}`}
                </button>
              )}
            </>
          )}

          {/* Context menu */}
          <WaMessageContextMenu
            contextMenu={contextMenu}
            onClose={() => setContextMenu(null)}
            onReply={handleReply}
            onCopy={handleCopy}
            onForward={handleForward}
            onDeleteForMe={handleDeleteForMe}
            onOpenReactionPicker={setReactionPickerMsgId}
          />
        </div>

        {/* Composer */}
        <WaChatComposer
          onSendMessage={(content, isNote, quotedId) => {
            onSendMessage(content, isNote, quotedId);
            // Scroll to bottom after sending
            setTimeout(() => {
              virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length, behavior: "smooth" });
            }, 100);
          }}
          onSendMedia={(file, caption) => {
            onSendMedia(file, caption);
            setTimeout(() => {
              virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length, behavior: "smooth" });
            }, 100);
          }}
          isSending={isSending}
          isNoteMode={isNoteMode}
          onNoteModeChange={setIsNoteMode}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
          prefillMessage={prefillMessage}
        />

        {/* Accept button below composer — only for unassigned conversations */}
        {!conversation.assigned_to && onAccept && (
          <div className="px-3 pb-3 pt-1 border-t border-border/20 bg-card">
            <Button
              size="sm"
              className="w-full gap-2 bg-success hover:bg-success/90 text-white font-medium py-2.5"
              onClick={onAccept}
              disabled={isAccepting}
            >
              {isAccepting ? (
                <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" /> Aceitando...</>
              ) : (
                <><CheckCircle2 className="h-4 w-4" /> Aceitar atendimento</>
              )}
            </Button>
          </div>
        )}

        {/* Lead Info Card */}
        {conversation.lead_id && (
          <WaLeadInfoCard
            leadId={conversation.lead_id}
            open={showLeadInfo}
            onOpenChange={setShowLeadInfo}
          />
        )}

        {/* Media Preview Modal */}
        <WaMediaPreview mediaPreview={mediaPreview} onClose={() => setMediaPreview(null)} />

        {/* Forward Dialog */}
        <WaForwardDialog
          open={!!forwardingMsg}
          onOpenChange={(open) => { if (!open) setForwardingMsg(null); }}
          message={forwardingMsg}
          currentConversationId={conversation.id}
        />

        {/* Appointment Modal */}
        <WaAppointmentModal
          open={showAppointmentModal}
          onOpenChange={setShowAppointmentModal}
          conversationId={conversation.id}
          leadId={conversation.lead_id || undefined}
          clienteNome={conversation.cliente_nome || undefined}
          assignedTo={conversation.assigned_to || undefined}
        />
      </div>

      {/* AI Sidebar — Desktop: inline panel, Mobile: Sheet */}
      {showAISidebar && !isMobileDevice && (
        <WaAISidebar
          conversation={conversation}
          onClose={() => setShowAISidebar(false)}
          onUseSuggestion={(text) => {
            setShowAISidebar(false);
            // Trigger prefill via a custom event the composer can listen to
            window.dispatchEvent(new CustomEvent("wa-ai-suggestion", { detail: text }));
          }}
        />
      )}
      {isMobileDevice && (
        <Sheet open={showAISidebar} onOpenChange={setShowAISidebar}>
          <SheetContent side="right" className="w-[85vw] max-w-sm p-0">
            <SheetTitle className="sr-only">Assistente IA</SheetTitle>
            {showAISidebar && (
              <WaAISidebar
                conversation={conversation}
                onClose={() => setShowAISidebar(false)}
                onUseSuggestion={(text) => {
                  setShowAISidebar(false);
                  window.dispatchEvent(new CustomEvent("wa-ai-suggestion", { detail: text }));
                }}
              />
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* CRM Sidebar — Desktop: inline panel, Mobile: Sheet */}
      {showCRMSidebar && !isMobileDevice && (
        <WaCRMSidebar
          conversation={conversation}
          onClose={() => setShowCRMSidebar(false)}
        />
      )}
      {isMobileDevice && (
        <Sheet open={showCRMSidebar} onOpenChange={setShowCRMSidebar}>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-0 [&>button.absolute]:hidden">
            <SheetTitle className="sr-only">Dados Comerciais</SheetTitle>
            {showCRMSidebar && (
              <WaCRMSidebar
                conversation={conversation}
                onClose={() => setShowCRMSidebar(false)}
              />
            )}
          </SheetContent>
        </Sheet>
      )}

      {/* Notes Panel */}
      <WaNotesPanel
        open={showNotesPanel}
        onOpenChange={setShowNotesPanel}
        messages={messages}
        conversation={conversation}
        onScrollToNote={(messageId) => {
          const idx = visibleMessages.findIndex((m) => m.id === messageId);
          if (idx >= 0) {
            virtuosoRef.current?.scrollToIndex({ index: idx, behavior: "smooth", align: "center" });
          }
        }}
      />


      {/* Participants Sidebar */}
      {showParticipants && (
        <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
          <SheetContent side="right" className="w-[85vw] max-w-sm p-4">
            <SheetTitle className="text-base mb-4">Participantes da conversa</SheetTitle>
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
              <WaParticipants conversationId={conversation.id} tenantId={conversation.tenant_id} assignedTo={conversation.assigned_to} />
            </Suspense>
          </SheetContent>
        </Sheet>
      )}
    </div>
  );
}
