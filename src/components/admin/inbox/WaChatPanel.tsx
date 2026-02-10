import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Virtuoso, VirtuosoHandle } from "react-virtuoso";
import {
  StickyNote,
  User,
  Users,
  CheckCircle2,
  ArrowRightLeft,
  Tag,
  MoreVertical,
  Phone,
  Link2,
  RefreshCw,
  Smartphone,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  X,
  Download,
  Maximize2,
  ZoomIn,
  ZoomOut,
  Reply,
  Copy,
  Trash2,
  PanelRightOpen,
  PanelRightClose,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WaConversation, WaMessage } from "@/hooks/useWaInbox";
import { WaChatComposer } from "./WaChatComposer";
import { WaLeadInfoCard } from "./WaLeadInfoCard";
import { WaCRMSidebar } from "./WaCRMSidebar";

const MESSAGE_STATUS_CONFIG: Record<string, { icon: typeof Check; className: string; label: string }> = {
  pending: { icon: Clock, className: "text-primary-foreground/40", label: "Enviando..." },
  sent: { icon: Check, className: "text-primary-foreground/60", label: "Enviado" },
  delivered: { icon: CheckCheck, className: "text-primary-foreground/60", label: "Entregue" },
  read: { icon: CheckCheck, className: "text-blue-400", label: "Lido" },
  failed: { icon: AlertCircle, className: "text-red-400", label: "Falhou" },
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface ReplyingTo {
  id: string;
  content: string | null;
  direction: "in" | "out";
  sent_by_name?: string | null;
}

interface ContextMenuState {
  x: number;
  y: number;
  message: WaMessage;
}

interface WaChatPanelProps {
  conversation: WaConversation | null;
  messages: WaMessage[];
  loading: boolean;
  isSending: boolean;
  onSendMessage: (content: string, isNote?: boolean, quotedMessageId?: string) => void;
  onSendMedia: (file: File, caption?: string) => void;
  onSendReaction: (messageId: string, reaction: string) => void;
  onResolve: () => void;
  onReopen: () => void;
  onOpenTransfer: () => void;
  onOpenTags: () => void;
  onOpenAssign: () => void;
  onLinkLead: () => void;
  vendedores: { id: string; nome: string; user_id: string | null }[];
}

export function WaChatPanel({
  conversation,
  messages,
  loading,
  isSending,
  onSendMessage,
  onSendMedia,
  onSendReaction,
  onResolve,
  onReopen,
  onOpenTransfer,
  onOpenTags,
  onOpenAssign,
  onLinkLead,
  vendedores,
}: WaChatPanelProps) {
  const [isNoteMode, setIsNoteMode] = useState(false);
  const [showLeadInfo, setShowLeadInfo] = useState(false);
  const [showCRMSidebar, setShowCRMSidebar] = useState(false);
  const [mediaPreview, setMediaPreview] = useState<{ url: string; type: "image" | "video" | "audio" | "document"; caption?: string } | null>(null);
  const [reactionPickerMsgId, setReactionPickerMsgId] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<ReplyingTo | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const dragCounter = useRef(0);

  // Build a map for quoted message lookup
  const messagesMap = useMemo(() => {
    const map = new Map<string, WaMessage>();
    messages.forEach((m) => map.set(m.id, m));
    return map;
  }, [messages]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        virtuosoRef.current?.scrollToIndex({ index: messages.length - 1, behavior: "smooth" });
      }, 100);
    }
  }, [messages.length]);

  // Close context menu on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu]);

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
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8 bg-muted/10">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Phone className="h-8 w-8 text-primary/50" />
        </div>
        <h3 className="text-lg font-semibold text-foreground/70">Central WhatsApp</h3>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Selecione uma conversa para visualizar as mensagens e interagir.
        </p>
      </div>
    );
  }

  const assignedVendedor = vendedores.find((v) => v.user_id === conversation.assigned_to);

  const renderMessage = (idx: number) => {
    const msg = messages[idx];
    if (!msg) return null;

    const isOut = msg.direction === "out";
    const isNote = msg.is_internal_note;
    const showDate = idx === 0 ||
      format(new Date(messages[idx - 1].created_at), "yyyy-MM-dd") !== format(new Date(msg.created_at), "yyyy-MM-dd");

    const statusCfg = isOut && msg.status ? MESSAGE_STATUS_CONFIG[msg.status] || null : null;
    const quotedMsg = msg.quoted_message_id ? messagesMap.get(msg.quoted_message_id) : null;

    return (
      <div>
        {showDate && (
          <div className="flex justify-center my-3">
            <Badge variant="secondary" className="text-[10px] px-3 py-0.5 bg-muted/70">
              {format(new Date(msg.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
            </Badge>
          </div>
        )}

        <div
          className={`flex ${isOut ? "justify-end" : "justify-start"} mb-1 group/msg relative`}
          onContextMenu={(e) => handleContextMenu(e, msg)}
        >
          {/* Hover actions */}
          {!isNote && (
            <div className={`absolute ${isOut ? "left-0 -translate-x-full" : "right-0 translate-x-full"} top-1/2 -translate-y-1/2 px-1 opacity-0 group-hover/msg:opacity-100 transition-opacity z-10 flex items-center gap-0.5`}>
              <button
                onClick={() => handleReply(msg)}
                className="p-1 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                title="Responder"
              >
                <Reply className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setReactionPickerMsgId(reactionPickerMsgId === msg.id ? null : msg.id)}
                className="p-1 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
                title="Reagir"
              >
                <span className="text-sm">😀</span>
              </button>
            </div>
          )}

          {/* Quick reaction picker */}
          {reactionPickerMsgId === msg.id && (
            <div
              className={`absolute ${isOut ? "right-0" : "left-0"} -top-10 z-20 flex items-center gap-0.5 bg-card border border-border rounded-full px-2 py-1 shadow-lg`}
            >
              {QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  onClick={() => {
                    onSendReaction(msg.id, emoji);
                    setReactionPickerMsgId(null);
                  }}
                  className="text-lg hover:scale-125 transition-transform p-0.5"
                >
                  {emoji}
                </button>
              ))}
            </div>
          )}

          <div
            className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
              isNote
                ? "bg-warning/10 border border-warning/30 text-foreground italic"
                : isOut
                ? "bg-primary text-primary-foreground rounded-br-md"
                : "bg-muted rounded-bl-md text-foreground"
            }`}
          >
            {/* Quoted message */}
            {quotedMsg && (
              <div className={`mb-1.5 p-1.5 rounded-lg border-l-2 text-[11px] ${
                isOut ? "bg-primary-foreground/10 border-primary-foreground/40" : "bg-background/60 border-primary/40"
              }`}>
                <p className={`font-semibold text-[10px] ${isOut ? "text-primary-foreground/70" : "text-primary/80"}`}>
                  {quotedMsg.direction === "out" ? (quotedMsg.sent_by_name || "Você") : conversation.cliente_nome || "Cliente"}
                </p>
                <p className={`truncate ${isOut ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                  {quotedMsg.content || (quotedMsg.message_type !== "text" ? `[${quotedMsg.message_type}]` : "")}
                </p>
              </div>
            )}

            {/* Participant name for group incoming messages */}
            {!isOut && !isNote && msg.participant_name && conversation.is_group && (
              <p className="text-[10px] font-semibold text-primary/80 mb-0.5">
                {msg.participant_name}
              </p>
            )}
            {/* Attendant name for outgoing messages */}
            {isOut && msg.sent_by_name && !isNote && (
              <p className="text-[10px] font-semibold text-primary-foreground/70 mb-0.5">
                {msg.sent_by_name}
              </p>
            )}
            {isNote && (
              <div className="flex items-center gap-1 mb-1 text-[10px] text-warning font-medium">
                <StickyNote className="h-3 w-3" />
                Nota interna{msg.sent_by_name ? ` · ${msg.sent_by_name}` : ""}
              </div>
            )}
            {(msg.message_type === "image") && msg.media_url && (
              <div
                className="cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setMediaPreview({ url: msg.media_url!, type: "image", caption: msg.content || undefined })}
              >
                <img src={msg.media_url} alt="Imagem" className="rounded-lg mb-1 max-w-full max-h-48 object-cover" />
              </div>
            )}
            {msg.message_type === "image" && msg.content && (
              <p className="whitespace-pre-wrap break-words text-xs mt-1">{renderFormattedText(msg.content)}</p>
            )}
            {msg.message_type === "video" && (
              msg.media_url ? (
                <div
                  className="cursor-pointer hover:opacity-90 transition-opacity block mb-1"
                  onClick={() => setMediaPreview({ url: msg.media_url!, type: "video", caption: msg.content || undefined })}
                >
                  <div className="relative rounded-lg overflow-hidden max-w-full max-h-48 bg-black/10 flex items-center justify-center">
                    <video src={msg.media_url} className="rounded-lg max-w-full max-h-48 object-cover" preload="metadata" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-10 h-10 rounded-full bg-black/50 flex items-center justify-center">
                        <span className="text-white text-lg ml-0.5">▶</span>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-xs opacity-80">
                  <span>🎬</span> Vídeo
                </div>
              )
            )}
            {msg.message_type === "audio" && (
              msg.media_url ? (
                <audio controls preload="metadata" className="max-w-[240px] h-10">
                  <source src={msg.media_url} type={msg.media_mime_type || "audio/ogg"} />
                  Seu navegador não suporta áudio.
                </audio>
              ) : (
                <div className="flex items-center gap-2 text-xs opacity-80">
                  <span>🎵</span> Mensagem de áudio (mídia indisponível)
                </div>
              )
            )}
            {msg.message_type === "document" && (
              <div
                className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => msg.media_url && setMediaPreview({ url: msg.media_url, type: "document", caption: msg.content || undefined })}
              >
                <span>📄</span> {msg.content || "Documento"}
              </div>
            )}
            {msg.message_type === "sticker" && (
              msg.media_url ? (
                <div
                  className="cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setMediaPreview({ url: msg.media_url!, type: "image" })}
                >
                  <img src={msg.media_url} alt="Sticker" className="max-w-[150px] max-h-[150px] object-contain" />
                </div>
              ) : (
                <div className="text-2xl">🏷️</div>
              )
            )}
            {msg.message_type === "location" && (
              <div className="flex items-center gap-2 text-xs opacity-80">
                <span>📍</span> Localização
              </div>
            )}
            {(msg.message_type === "text" || !["audio", "document", "sticker", "location", "image", "video"].includes(msg.message_type)) && msg.content && (
              <p className="whitespace-pre-wrap break-words">{renderFormattedText(msg.content)}</p>
            )}
            {msg.message_type === "video" && msg.content && (
              <p className="whitespace-pre-wrap break-words text-xs mt-1">{renderFormattedText(msg.content)}</p>
            )}
            <div className={`flex items-center gap-1 mt-1 ${isNote ? "text-warning/70" : isOut ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
              <span className="text-[10px]">{format(new Date(msg.created_at), "HH:mm")}</span>
              {statusCfg && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <statusCfg.icon className={`h-3.5 w-3.5 ${statusCfg.className}`} />
                  </TooltipTrigger>
                  <TooltipContent side="left" className="text-[10px] px-2 py-1">
                    {statusCfg.label}
                  </TooltipContent>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex-1 flex min-w-0">
      <div className="flex-1 flex flex-col min-w-0">
        {/* Chat Header */}
        <div className="px-4 py-3 border-b border-border/40 bg-card/50 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary overflow-hidden">
              {conversation.profile_picture_url ? (
                <img src={conversation.profile_picture_url} alt="" className="w-full h-full object-cover" />
              ) : conversation.is_group ? (
                <Users className="h-4 w-4" />
              ) : conversation.cliente_nome ? (
                conversation.cliente_nome.split(" ").slice(0, 2).map((n) => n[0]).join("").toUpperCase()
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-semibold text-foreground truncate">
                {conversation.cliente_nome || conversation.cliente_telefone}
              </h3>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{conversation.cliente_telefone}</span>
                {conversation.instance_name && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-0.5">
                      <Smartphone className="h-3 w-3" />
                      {conversation.instance_name}
                    </span>
                  </>
                )}
                {assignedVendedor && (
                  <>
                    <span>·</span>
                    <span className="flex items-center gap-1">
                      <User className="h-3 w-3" />
                      {assignedVendedor.nome}
                    </span>
                  </>
                )}
                {conversation.lead_id && (
                  <>
                    <span>·</span>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 cursor-pointer hover:bg-primary/10 transition-colors gap-0.5"
                          onClick={() => setShowLeadInfo(true)}
                        >
                          <Link2 className="h-2.5 w-2.5" />
                          {conversation.lead_nome || "Lead vinculado"}
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        <p>Clique para ver detalhes do lead</p>
                      </TooltipContent>
                    </Tooltip>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {/* CRM Sidebar toggle */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  size="icon"
                  variant={showCRMSidebar ? "default" : "ghost"}
                  className={`h-8 w-8 ${showCRMSidebar ? "bg-primary/10 text-primary" : ""}`}
                  onClick={() => setShowCRMSidebar(!showCRMSidebar)}
                >
                  {showCRMSidebar ? <PanelRightClose className="h-4 w-4" /> : <PanelRightOpen className="h-4 w-4" />}
                </Button>
              </TooltipTrigger>
              <TooltipContent>Dados Comerciais</TooltipContent>
            </Tooltip>

            {conversation.status !== "resolved" ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onResolve}>
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Resolver</TooltipContent>
              </Tooltip>
            ) : (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onReopen}>
                    <RefreshCw className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Reabrir</TooltipContent>
              </Tooltip>
            )}

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onOpenTransfer}>
                  <ArrowRightLeft className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Transferir</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8" onClick={onOpenTags}>
                  <Tag className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Tags</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={onOpenAssign}>
                  <User className="h-4 w-4 mr-2" />
                  Atribuir
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onLinkLead}>
                  <Link2 className="h-4 w-4 mr-2" />
                  {conversation.lead_id ? "Alterar Lead" : "Vincular Lead"}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                {conversation.status === "resolved" ? (
                  <DropdownMenuItem onClick={onReopen}>
                    <RefreshCw className="h-4 w-4 mr-2" />
                    Reabrir Conversa
                  </DropdownMenuItem>
                ) : (
                  <DropdownMenuItem onClick={onResolve}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Resolver Conversa
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Messages with virtualization */}
        <div
          className="flex-1 relative"
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
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
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full text-center">
              <p className="text-sm text-muted-foreground">Nenhuma mensagem ainda.</p>
            </div>
          ) : (
            <Virtuoso
              ref={virtuosoRef}
              totalCount={messages.length}
              itemContent={renderMessage}
              initialTopMostItemIndex={messages.length - 1}
              followOutput="smooth"
              className="h-full"
              style={{ height: "100%" }}
              overscan={200}
              increaseViewportBy={{ top: 200, bottom: 200 }}
              itemSize={() => undefined as any}
            />
          )}

          {/* Context menu */}
          {contextMenu && (
            <div
              className="fixed z-50 bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[180px] animate-in fade-in-0 zoom-in-95"
              style={{ top: contextMenu.y, left: contextMenu.x }}
              onClick={(e) => e.stopPropagation()}
            >
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                onClick={() => handleReply(contextMenu.message)}
              >
                <Reply className="h-4 w-4 text-muted-foreground" />
                Responder
              </button>
              <button
                className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                onClick={() => {
                  setReactionPickerMsgId(contextMenu.message.id);
                  setContextMenu(null);
                }}
              >
                <span className="text-base">😀</span>
                Reagir
              </button>
              {contextMenu.message.content && (
                <button
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
                  onClick={() => handleCopy(contextMenu.message)}
                >
                  <Copy className="h-4 w-4 text-muted-foreground" />
                  Copiar
                </button>
              )}
            </div>
          )}
        </div>

        {/* Composer */}
        <WaChatComposer
          onSendMessage={onSendMessage}
          onSendMedia={onSendMedia}
          isSending={isSending}
          isNoteMode={isNoteMode}
          onNoteModeChange={setIsNoteMode}
          replyingTo={replyingTo}
          onCancelReply={() => setReplyingTo(null)}
        />

        {/* Lead Info Card */}
        {conversation.lead_id && (
          <WaLeadInfoCard
            leadId={conversation.lead_id}
            open={showLeadInfo}
            onOpenChange={setShowLeadInfo}
          />
        )}

        {/* Media Preview Modal */}
        <MediaPreviewModal mediaPreview={mediaPreview} onClose={() => setMediaPreview(null)} />
      </div>

      {/* CRM Sidebar */}
      {showCRMSidebar && (
        <WaCRMSidebar
          conversation={conversation}
          onClose={() => setShowCRMSidebar(false)}
        />
      )}
    </div>
  );
}

// ── Media Preview Modal with Zoom ──
function MediaPreviewModal({ mediaPreview, onClose }: { mediaPreview: { url: string; type: string; caption?: string } | null; onClose: () => void }) {
  const [zoom, setZoom] = useState(1);
  const isImage = mediaPreview?.type === "image";
  const isVideo = mediaPreview?.type === "video";
  const isAudio = mediaPreview?.type === "audio";
  const isDocument = mediaPreview?.type === "document";
  const canZoom = isImage || isDocument;
  const isPdf = mediaPreview?.url?.toLowerCase().includes(".pdf");

  const handleZoomIn = () => setZoom((p) => Math.min(p + 0.25, 3));
  const handleZoomOut = () => setZoom((p) => Math.max(p - 0.25, 0.5));

  return (
    <Dialog open={!!mediaPreview} onOpenChange={(open) => { if (!open) { setZoom(1); onClose(); } }}>
      <DialogContent className="sm:max-w-3xl max-h-[90vh] p-0 overflow-hidden bg-black/95 border-none">
        <DialogTitle className="sr-only">Visualizar mídia</DialogTitle>
        <div className="relative flex flex-col items-center justify-center min-h-[300px]">
          {/* Top bar */}
          <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-black/70 to-transparent">
            <span className="text-white/80 text-sm font-medium">
              {isImage ? "Imagem" : isVideo ? "Vídeo" : isAudio ? "Áudio" : "Documento"}
            </span>
            <div className="flex items-center gap-1">
              {canZoom && (
                <>
                  <button onClick={handleZoomOut} disabled={zoom <= 0.5} className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30">
                    <ZoomOut className="h-5 w-5 text-white/80" />
                  </button>
                  <span className="text-white/70 text-xs min-w-[40px] text-center">{Math.round(zoom * 100)}%</span>
                  <button onClick={handleZoomIn} disabled={zoom >= 3} className="p-2 rounded-full hover:bg-white/10 transition-colors disabled:opacity-30">
                    <ZoomIn className="h-5 w-5 text-white/80" />
                  </button>
                </>
              )}
              <a href={mediaPreview?.url} download target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <Download className="h-5 w-5 text-white/80" />
              </a>
              <a href={mediaPreview?.url} target="_blank" rel="noopener noreferrer" className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <Maximize2 className="h-5 w-5 text-white/80" />
              </a>
              <button onClick={() => { setZoom(1); onClose(); }} className="p-2 rounded-full hover:bg-white/10 transition-colors">
                <X className="h-5 w-5 text-white/80" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="flex items-center justify-center w-full p-4 pt-14 pb-4 overflow-auto">
            {isImage && (
              <img
                src={mediaPreview!.url}
                alt="Preview"
                className="max-w-full max-h-[70vh] object-contain rounded-lg transition-transform duration-200"
                style={{ transform: `scale(${zoom})` }}
              />
            )}
            {isVideo && (
              <video src={mediaPreview!.url} controls autoPlay className="max-w-full max-h-[70vh] rounded-lg" />
            )}
            {isAudio && (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center">
                  <span className="text-3xl">🎵</span>
                </div>
                <audio controls autoPlay className="w-80">
                  <source src={mediaPreview!.url} />
                </audio>
              </div>
            )}
            {isDocument && isPdf && (
              <div className="w-full h-[70vh] overflow-auto">
                <iframe
                  src={mediaPreview!.url}
                  className="border-0 origin-top-left transition-transform duration-200"
                  style={{ width: `${100 / zoom}%`, height: `${100 / zoom}%`, minHeight: "500px", transform: `scale(${zoom})`, transformOrigin: "top left" }}
                  title="Documento"
                />
              </div>
            )}
            {isDocument && !isPdf && (
              <div className="flex flex-col items-center gap-4 py-12">
                <div className="w-20 h-20 rounded-2xl bg-primary/20 flex items-center justify-center">
                  <span className="text-3xl">📄</span>
                </div>
                <p className="text-white/80 text-sm">{mediaPreview!.caption || "Documento"}</p>
                <a href={mediaPreview!.url} download target="_blank" rel="noopener noreferrer">
                  <Button variant="secondary" className="gap-2">
                    <Download className="h-4 w-4" />
                    Baixar documento
                  </Button>
                </a>
              </div>
            )}
          </div>

          {/* Caption */}
          {mediaPreview?.caption && !isDocument && (
            <div className="w-full px-6 pb-4">
              <p className="text-white/80 text-sm text-center">{mediaPreview.caption}</p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Render WhatsApp formatted text with clickable links ──
function renderFormattedText(text: string): React.ReactNode {
  const urlRegex = /(https?:\/\/[^\s<]+)/g;
  const urlParts = text.split(urlRegex);
  
  return (
    <>
      {urlParts.map((part, i) => {
        if (urlRegex.test(part)) {
          urlRegex.lastIndex = 0;
          return (
            <a
              key={i}
              href={part}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 hover:opacity-80 break-all"
              onClick={(e) => e.stopPropagation()}
            >
              {part}
            </a>
          );
        }
        return <span key={i}>{applyWhatsAppFormatting(part)}</span>;
      })}
    </>
  );
}

function applyWhatsAppFormatting(text: string): React.ReactNode {
  const parts: React.ReactNode[] = [];
  let remaining = text;
  let key = 0;

  const patterns = [
    { regex: /\*([^*]+)\*/, tag: "strong" },
    { regex: /_([^_]+)_/, tag: "em" },
    { regex: /~([^~]+)~/, tag: "s" },
  ];

  while (remaining.length > 0) {
    let earliestMatch: { index: number; length: number; content: string; tag: string } | null = null;

    for (const { regex, tag } of patterns) {
      const match = remaining.match(regex);
      if (match && match.index !== undefined) {
        if (!earliestMatch || match.index < earliestMatch.index) {
          earliestMatch = {
            index: match.index,
            length: match[0].length,
            content: match[1],
            tag,
          };
        }
      }
    }

    if (earliestMatch) {
      if (earliestMatch.index > 0) {
        parts.push(remaining.substring(0, earliestMatch.index));
      }
      const Tag = earliestMatch.tag as any;
      parts.push(<Tag key={key++}>{earliestMatch.content}</Tag>);
      remaining = remaining.substring(earliestMatch.index + earliestMatch.length);
    } else {
      parts.push(remaining);
      break;
    }
  }

  return <>{parts}</>;
}
