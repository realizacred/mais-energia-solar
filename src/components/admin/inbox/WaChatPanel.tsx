import { useState, useRef, useEffect, useCallback, useMemo, lazy, Suspense } from "react";
import { WaProfileAvatar } from "./WaProfileAvatar";
import { supabase } from "@/integrations/supabase/client";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import { WaAISidebar } from "./WaAISidebar";
import { WaNotesPanel } from "./WaNotesPanel";
import { AnimatePresence } from "framer-motion";
import { useRealtimeNotifications, useMarcarNotificacaoLida, useRealtimeIntelligenceSubscription } from "@/hooks/useRealtimeIntelligence";
import { RealtimeIntelligenceBanner } from "@/components/admin/intelligence/RealtimeIntelligenceBanner";
import { IntelligenceBadge } from "@/components/admin/intelligence/IntelligenceBadge";
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
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
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
import { WaOrcamentosDrawer } from "./WaOrcamentosDrawer";
import { useIsMobile } from "@/hooks/use-mobile";
import { useQuery } from "@tanstack/react-query";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { formatPhoneBR } from "@/lib/formatters";
import { resolveWaDisplayName } from "@/lib/wa/resolveDisplayName";

function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
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
  onSaveContact?: () => void;
  onAccept?: () => void;
  onRelease?: () => void;
  isAccepting?: boolean;
  isReleasing?: boolean;
  currentUserId?: string;
  vendedores: { id: string; nome: string; user_id: string | null }[];
  lastReadMessageId?: string | null;
  onMarkAsRead?: (messageId: string) => void;
  isMuted?: boolean;
  isHidden?: boolean;
  onToggleMute?: () => void;
  onToggleHide?: () => void;
  prefillMessage?: string | null;
  onRetryMessage?: (msg: WaMessage) => void;
  onBack?: () => void;
  isAdmin?: boolean;
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
  onSaveContact,
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
  onRetryMessage,
  onBack,
  isAdmin,
}: WaChatPanelProps) {
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [showLeadInfo, setShowLeadInfo] = useState(false);
  const [showCRMSidebar, setShowCRMSidebar] = useState(false);
  const [showAISidebar, setShowAISidebar] = useState(false);
  const [showNotesPanel, setShowNotesPanel] = useState(false);
  const [showAppointmentModal, setShowAppointmentModal] = useState(false);
  const [showFilesPanel, setShowFilesPanel] = useState(false);
  const [showOrcamentos, setShowOrcamentos] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "image" | "video" | "audio" | "document"; caption?: string } | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [deletedMsgIds, setDeletedMsgIds] = useState<Set<string>>(new Set());
  const [forwardingMsg, setForwardingMsg] = useState<WaMessage | null>(null);
  const [showIntelBanner, setShowIntelBanner] = useState(true);
  const [showParticipants, setShowParticipants] = useState(false);

  const { data: realtimeNotifications } = useRealtimeNotifications(conversation?.tenant_id || null, true);
  const marcarNotificacaoLida = useMarcarNotificacaoLida();
  useRealtimeIntelligenceSubscription(conversation?.tenant_id || null, conversation?.lead_id || undefined);

  const currentNotification = useMemo(() => {
    if (!showIntelBanner || !conversation?.lead_id || !realtimeNotifications) return null;
    return realtimeNotifications.find(n => n.lead_id === conversation.lead_id) || null;
  }, [realtimeNotifications, conversation?.lead_id, showIntelBanner]);

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
    staleTime: 60_000,
  });

  const showAcceptBanner = !conversation?.assigned_to && !!onAccept;
  const [atBottom, setAtBottom] = useState(true);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const dragCounter = useRef(0);
  const prevMsgCountRef = useRef(0);
  const isMobileDevice = useIsMobile();

  useEffect(() => {
    if (!conversation || !currentUserId) return;
    setDeletedMsgIds(new Set());
    const loadHidden = async () => {
      try {
        const { data } = await supabase.from("wa_message_hidden" as any).select("message_id").eq("user_id", currentUserId);
        if (data && data.length > 0) setDeletedMsgIds(new Set(data.map((d: any) => d.message_id)));
      } catch {}
    };
    loadHidden();
  }, [conversation?.id, currentUserId]);

  const messagesMap = useMemo(() => {
    const map = new Map<string, WaMessage>();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  const visibleMessages = useMemo(() => messages.filter((m) => !deletedMsgIds.has(m.id)), [messages, deletedMsgIds]);

  useEffect(() => {
    if (visibleMessages.length > prevMsgCountRef.current && prevMsgCountRef.current > 0) {
      if (atBottom) virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length - 1, behavior: "smooth" });
      else setNewMsgCount(prev => prev + (visibleMessages.length - prevMsgCountRef.current));
    }
    prevMsgCountRef.current = visibleMessages.length;
  }, [visibleMessages.length, atBottom]);

  useEffect(() => {
    if (atBottom && visibleMessages.length > 0) {
      setTimeout(() => virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length - 1, behavior: "smooth" }), 80);
    }
  }, [showAcceptBanner]);

  useEffect(() => {
    if (atBottom && visibleMessages.length > 0 && onMarkAsRead) {
      onMarkAsRead(visibleMessages[visibleMessages.length - 1].id);
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
    setReplyingTo({ id: msg.id, content: msg.content, direction: msg.direction, sent_by_name: msg.sent_by_name });
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
        await supabase.from("wa_message_hidden" as any).insert({ user_id: currentUser.id, message_id: msg.id, tenant_id: tenantId });
      }
    } catch (err) { console.error(err); }
  }, []);

  const handleForward = useCallback((msg: WaMessage) => {
    setForwardingMsg(msg);
    setContextMenu(null);
  }, []);

  const handleDragEnter = useCallback((e: React.DragEvent) => { e.preventDefault(); dragCounter.current++; if (e.dataTransfer.types.includes("Files")) setIsDragging(true); }, []);
  const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); dragCounter.current--; if (dragCounter.current === 0) setIsDragging(false); }, []);
  const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); }, []);
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); dragCounter.current = 0; setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.size <= 16 * 1024 * 1024) onSendMedia(file);
  }, [onSendMedia]);

  if (!conversation) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-gradient-to-b from-muted/5 to-muted/20">
        <MessageCircle className="h-9 w-9 text-success/30 mb-5" />
        <h3 className="text-lg font-semibold text-foreground/70">Suas Conversas</h3>
        <p className="text-sm text-muted-foreground mt-1.5 max-w-xs leading-relaxed">Selecione uma conversa ao lado para começar.</p>
      </div>
    );
  }

  const assignedConsultor = vendedores.find((v) => v.user_id === conversation.assigned_to);

  const renderMessage = (idx: number) => {
    const msg = visibleMessages[idx];
    if (!msg) return null;
    return (
      <WaMessageBubble
        msg={msg} idx={idx} visibleMessages={visibleMessages} conversation={conversation} messagesMap={messagesMap}
        reactionPickerMsgId={reactionPickerMsgId} onContextMenu={handleContextMenu} onReply={handleReply}
        onReactionPickerToggle={setReactionPickerMsgId} onSendReaction={onSendReaction} onMediaPreview={setMediaPreview}
        onRetry={onRetryMessage}
      />
    );
  };

  const handleCreateLead = () => onSaveContact?.();
  const handleCreateCliente = () => onSaveContact?.();

  return (
    <div className="flex h-full flex-1 min-w-0 min-h-0 w-full max-w-full overflow-hidden">
      <div className="flex h-full flex-1 flex-col min-w-0 min-h-0 w-full max-w-full overflow-hidden">
        {/* Chat Header Compact: max 56px */}
        <div className="shrink-0 h-[56px] border-b border-border/30 bg-card shadow-xs flex items-center px-4">
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {onBack && (
              <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0 md:hidden" onClick={onBack}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}
            <WaProfileAvatar
              profilePictureUrl={conversation.profile_picture_url}
              isGroup={conversation.is_group}
              name={resolveWaDisplayName(conversation as any)}
              size="sm"
              className="bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/10 text-primary shrink-0"
            />
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-foreground truncate leading-tight">
                  {resolveWaDisplayName(conversation as any)}
                </span>
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${conversation.status === "resolved" ? "bg-destructive" : "bg-success"} animate-pulse`} />
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground leading-tight">
                {conversation.cliente_telefone && (
                  <span className="font-mono text-foreground/60">{formatPhoneBR(conversation.cliente_telefone)}</span>
                )}
                {assignedConsultor && <span className="truncate max-w-[80px]">· {assignedConsultor.nome}</span>}
                {currentNotification && (
                  <IntelligenceBadge temperamento={(currentNotification.temperamento_novo as any) || "frio"} urgenciaScore={currentNotification.urgencia_score} className="h-3.5" />
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-0.5 shrink-0 ml-4">
             <TooltipProvider delayDuration={400}>
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
                      <Button size="icon" variant="ghost" className={`h-8 w-8 relative ${unanswered > 0 ? "text-destructive" : ""}`}>
                        <Bell className="h-4 w-4" />
                        {unanswered > 0 && (
                          <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[8px] font-bold">
                            {unanswered}
                          </span>
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">{unanswered > 0 ? `${unanswered} sem resposta` : "Em dia"}</TooltipContent>
                  </Tooltip>
                );
              })()}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant={showNotesPanel ? "default" : "ghost"} className={`h-8 w-8 relative ${showNotesPanel ? "bg-warning/15 text-warning" : ""}`} onClick={() => setShowNotesPanel(!showNotesPanel)}>
                    <StickyNote className="h-4 w-4" />
                    {messages.filter(m => m.is_internal_note).length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 h-3.5 min-w-3.5 flex items-center justify-center rounded-full bg-warning text-warning-foreground text-[8px] font-bold">
                        {messages.filter(m => m.is_internal_note).length}
                      </span>
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">Notas</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant={showCRMSidebar ? "default" : "ghost"} className={`h-8 w-8 ${showCRMSidebar ? "bg-primary/10 text-primary" : ""}`} onClick={() => { setShowCRMSidebar(!showCRMSidebar); if (!showCRMSidebar) setShowAISidebar(false); }}>
                    {showCRMSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                  </Button>
                </TooltipTrigger>
                <TooltipContent className="text-[10px]">CRM</TooltipContent>
              </Tooltip>
              
              {conversation.status !== "resolved" ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onResolve}>
                      <CheckCircle2 className="h-4 w-4 text-success" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Resolver</TooltipContent>
                </Tooltip>
              ) : (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onReopen}>
                      <RefreshCw className="h-4 w-4" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent className="text-[10px]">Reabrir</TooltipContent>
                </Tooltip>
              )}

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={onOpenTransfer} className="text-xs"><ArrowRightLeft className="h-3.5 w-3.5 mr-2" /> Transferir</DropdownMenuItem>
                  <DropdownMenuItem onClick={onOpenAssign} className="text-xs"><User className="h-3.5 w-3.5 mr-2" /> Atribuir</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={onOpenTags} className="text-xs"><Tag className="h-3.5 w-3.5 mr-2" /> Etiquetas</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowAISidebar(!showAISidebar)} className="text-xs"><Sparkles className="h-3.5 w-3.5 mr-2" /> Assistente IA</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setShowOrcamentos(true)} className="text-xs"><FileText className="h-3.5 w-3.5 mr-2" /> Orçamentos</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {onToggleHide && (
                    <DropdownMenuItem onClick={onToggleHide} className="text-xs">
                      {isHidden ? <Eye className="h-3.5 w-3.5 mr-2" /> : <EyeOff className="h-3.5 w-3.5 mr-2" />}
                      {isHidden ? "Mostrar" : "Ocultar"}
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
             </TooltipProvider>
          </div>
        </div>

        <AnimatePresence>
          {currentNotification && (
            <RealtimeIntelligenceBanner
              temperamentoAnterior={currentNotification.temperamento_anterior || "frio"}
              temperamentoNovo={currentNotification.temperamento_novo || "morno"}
              urgenciaScore={currentNotification.urgencia_score}
              sugestaoResposta={currentNotification.sugestao_resposta || undefined}
              onUsarSugestao={(texto) => {
                window.dispatchEvent(new CustomEvent("wa-ai-suggestion", { detail: texto }));
                marcarNotificacaoLida.mutate(currentNotification.id);
                setShowIntelBanner(false);
              }}
              onFechar={() => { marcarNotificacaoLida.mutate(currentNotification.id); setShowIntelBanner(false); }}
            />
          )}
        </AnimatePresence>

        <div className="flex-1 min-h-0 overflow-y-auto relative bg-background min-w-0"
          onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver} onDrop={handleDrop}
        >
          {isDragging && (
            <div className="absolute inset-0 z-30 bg-primary/5 border-2 border-dashed border-primary/20 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                <Upload className="h-8 w-8 text-primary/40 mx-auto mb-2" />
                <p className="text-sm font-medium text-primary/60">Solte para enviar</p>
              </div>
            </div>
          )}

          {loading ? (
            <div className="p-4 space-y-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className={`flex ${i % 2 === 0 ? "justify-start" : "justify-end"}`}><Skeleton className="h-10 w-40 rounded-xl" /></div>
              ))}
            </div>
          ) : visibleMessages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center p-8 opacity-40"><p className="text-xs text-muted-foreground">Inicie uma conversa...</p></div>
          ) : (
            <>
              <Virtuoso
                key={conversation?.id} ref={virtuosoRef} totalCount={visibleMessages.length} itemContent={renderMessage}
                initialTopMostItemIndex={visibleMessages.length - 1} followOutput={(isAtBottom) => isAtBottom ? "smooth" : false}
                atBottomStateChange={setAtBottom} atBottomThreshold={150} alignToBottom
                startReached={() => { if (hasOlderMessages && !isLoadingMore) onLoadOlder(); }}
                className="h-full min-h-0" style={{ height: "100%" }} overscan={200}
                components={{
                  Header: () => isLoadingMore ? <div className="flex justify-center py-2"><div className="w-4 h-4 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /></div> : null,
                }}
              />
              {newMsgCount > 0 && !atBottom && (
                <button onClick={handleScrollToBottom} className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold shadow-lg animate-in fade-in">
                  {`↓ ${newMsgCount} novas`}
                </button>
              )}
            </>
          )}

          <WaMessageContextMenu contextMenu={contextMenu} onClose={() => setContextMenu(null)} onReply={handleReply} onCopy={handleCopy} onForward={handleForward} onDeleteForMe={handleDeleteForMe} onOpenReactionPicker={setReactionPickerMsgId} />
        </div>

        <div className="shrink-0">
          {showAcceptBanner && (
            <div className="px-4 py-1.5 bg-card border-t border-border/20">
              <Button size="sm" className="w-full gap-2 bg-success hover:bg-success/90 h-9" onClick={onAccept} disabled={isAccepting}>
                {isAccepting ? <><span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" /> Aceitando...</> : <><CheckCircle2 className="h-4 w-4" /> Aceitar atendimento</>}
              </Button>
            </div>
          )}
          <WaChatComposer
            onSendMessage={(content, isNote, quotedId) => { onSendMessage(content, isNote, quotedId); setTimeout(() => { virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length, behavior: "smooth" }); }, 100); }}
            onSendMedia={(file, caption) => { onSendMedia(file, caption); setTimeout(() => { virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length, behavior: "smooth" }); }, 100); }}
            onSendAudio={(file) => { onSendMedia(file); setTimeout(() => { virtuosoRef.current?.scrollToIndex({ index: visibleMessages.length, behavior: "smooth" }); }, 100); }}
            isSending={isSending} isNoteMode={isNoteMode} onNoteModeChange={setIsNoteMode} replyingTo={replyingTo} onCancelReply={() => setReplyingTo(null)} prefillMessage={prefillMessage}
            instanceId={conversation.instance_id} remoteJid={conversation.remote_jid}
            readOnly={!isAdmin && !!conversation.assigned_to && conversation.assigned_to !== currentUserId}
            readOnlyReason={!isAdmin && conversation.assigned_to && conversation.assigned_to !== currentUserId ? `Atribuído a ${assignedConsultor?.nome || "outro"}` : undefined}
          />
        </div>

        {conversation.lead_id && <WaLeadInfoCard leadId={conversation.lead_id} open={showLeadInfo} onOpenChange={setShowLeadInfo} />}
        <WaMediaPreview mediaPreview={mediaPreview} onClose={() => setMediaPreview(null)} />
        <WaForwardDialog open={!!forwardingMsg} onOpenChange={(open) => { if (!open) setForwardingMsg(null); }} message={forwardingMsg} currentConversationId={conversation.id} />
        <WaAppointmentModal open={showAppointmentModal} onOpenChange={setShowAppointmentModal} conversationId={conversation.id} leadId={conversation.lead_id || undefined} clienteNome={conversation.cliente_nome || undefined} assignedTo={conversation.assigned_to || undefined} />
      </div>

      {showAISidebar && !isMobileDevice && (
        <WaAISidebar conversation={conversation} onClose={() => setShowAISidebar(false)} onUseSuggestion={(text) => { setShowAISidebar(false); window.dispatchEvent(new CustomEvent("wa-ai-suggestion", { detail: text })); }} />
      )}
      {isMobileDevice && (
        <Sheet open={showAISidebar} onOpenChange={setShowAISidebar}>
          <SheetContent side="right" className="w-[85vw] max-w-sm p-0 flex flex-col h-full overflow-hidden">
            <SheetTitle className="sr-only">IA</SheetTitle>
            {showAISidebar && <WaAISidebar conversation={conversation} onClose={() => setShowAISidebar(false)} onUseSuggestion={(text) => { setShowAISidebar(false); window.dispatchEvent(new CustomEvent("wa-ai-suggestion", { detail: text })); }} />}
          </SheetContent>
        </Sheet>
      )}

      {showCRMSidebar && !isMobileDevice && (
        <div className="w-[320px] shrink-0 border-l border-border/30 h-full overflow-hidden bg-card/50">
          <WaCRMSidebar conversation={conversation} onClose={() => setShowCRMSidebar(false)} onOpenLinkLead={onLinkLead} onCreateLead={handleCreateLead} onCreateCliente={handleCreateCliente} />
        </div>
      )}
      {isMobileDevice && (
        <Sheet open={showCRMSidebar} onOpenChange={setShowCRMSidebar}>
            <SheetContent side="right" className="w-[85vw] max-w-sm p-0 flex flex-col h-full overflow-hidden [&>button.absolute]:hidden">
            <SheetTitle className="sr-only">CRM</SheetTitle>
            {showCRMSidebar && <WaCRMSidebar conversation={conversation} onClose={() => setShowCRMSidebar(false)} onOpenLinkLead={onLinkLead} onCreateLead={handleCreateLead} onCreateCliente={handleCreateCliente} />}
          </SheetContent>
        </Sheet>
      )}

      <WaNotesPanel open={showNotesPanel} onOpenChange={setShowNotesPanel} messages={messages} conversation={conversation} onScrollToNote={(messageId) => { const idx = visibleMessages.findIndex((m) => m.id === messageId); if (idx >= 0) virtuosoRef.current?.scrollToIndex({ index: idx, behavior: "smooth", align: "center" }); }} />
      {showParticipants && (
        <Sheet open={showParticipants} onOpenChange={setShowParticipants}>
          <SheetContent side="right" className="w-[85vw] max-w-sm p-4">
            <SheetTitle className="text-base mb-4">Participantes</SheetTitle>
            <Suspense fallback={<div className="p-4 flex justify-center"><span className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" /></div>}>
              <WaParticipants conversationId={conversation.id} tenantId={conversation.tenant_id} assignedTo={conversation.assigned_to} />
            </Suspense>
          </SheetContent>
        </Sheet>
      )}
      <WaOrcamentosDrawer open={showOrcamentos} onOpenChange={setShowOrcamentos} leadId={conversation.lead_id} clienteNome={conversation.cliente_nome} clienteTelefone={conversation.cliente_telefone} />
    </div>
  );
}