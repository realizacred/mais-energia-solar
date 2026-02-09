import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Send,
  StickyNote,
  Loader2,
  User,
  CheckCircle2,
  ArrowRightLeft,
  Tag,
  MoreVertical,
  Phone,
  Link2,
  X,
  RefreshCw,
  Smartphone,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WaConversation, WaMessage } from "@/hooks/useWaInbox";

const MESSAGE_STATUS_ICON: Record<string, typeof Check> = {
  pending: Clock,
  sent: Check,
  delivered: CheckCheck,
  read: CheckCheck,
  failed: AlertCircle,
};

interface WaChatPanelProps {
  conversation: WaConversation | null;
  messages: WaMessage[];
  loading: boolean;
  isSending: boolean;
  onSendMessage: (content: string, isNote?: boolean) => void;
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
  onResolve,
  onReopen,
  onOpenTransfer,
  onOpenTags,
  onOpenAssign,
  onLinkLead,
  vendedores,
}: WaChatPanelProps) {
  const [inputValue, setInputValue] = useState("");
  const [isNoteMode, setIsNoteMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation?.id]);

  const handleSend = () => {
    if (!inputValue.trim()) return;
    onSendMessage(inputValue.trim(), isNoteMode);
    setInputValue("");
    setIsNoteMode(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

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

  return (
    <div className="flex-1 flex flex-col min-w-0">
      {/* Chat Header */}
      <div className="px-4 py-3 border-b border-border/40 bg-card/50 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0 text-xs font-bold text-primary overflow-hidden">
            {conversation.profile_picture_url ? (
              <img src={conversation.profile_picture_url} alt="" className="w-full h-full object-cover" />
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
                  <Badge variant="outline" className="text-[9px] px-1 py-0">Lead vinculado</Badge>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
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

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        {loading ? (
          <div className="space-y-3">
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
          <div className="space-y-1">
            {messages.map((msg, idx) => {
              const isOut = msg.direction === "out";
              const isNote = msg.is_internal_note;
              const showDate = idx === 0 ||
                format(new Date(messages[idx - 1].created_at), "yyyy-MM-dd") !== format(new Date(msg.created_at), "yyyy-MM-dd");

              const StatusIcon = isOut && msg.status ? MESSAGE_STATUS_ICON[msg.status] || Check : null;

              return (
                <div key={msg.id}>
                  {showDate && (
                    <div className="flex justify-center my-3">
                      <Badge variant="secondary" className="text-[10px] px-3 py-0.5 bg-muted/70">
                        {format(new Date(msg.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
                      </Badge>
                    </div>
                  )}

                  <div className={`flex ${isOut ? "justify-end" : "justify-start"} mb-1`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-sm leading-relaxed ${
                        isNote
                          ? "bg-warning/10 border border-warning/30 text-foreground italic"
                          : isOut
                          ? "bg-primary text-primary-foreground rounded-br-md"
                          : "bg-muted rounded-bl-md text-foreground"
                      }`}
                    >
                      {isNote && (
                        <div className="flex items-center gap-1 mb-1 text-[10px] text-warning font-medium">
                          <StickyNote className="h-3 w-3" />
                          Nota interna
                        </div>
                      )}
                      {(msg.message_type === "image") && msg.media_url && (
                        <img src={msg.media_url} alt="Imagem" className="rounded-lg mb-1 max-w-full max-h-48 object-cover" />
                      )}
                      {msg.message_type === "audio" && (
                        <div className="flex items-center gap-2 text-xs opacity-80">
                          <span>🎵</span> Mensagem de áudio
                        </div>
                      )}
                      {msg.message_type === "document" && (
                        <div className="flex items-center gap-2 text-xs opacity-80">
                          <span>📄</span> {msg.content || "Documento"}
                        </div>
                      )}
                      {msg.message_type === "sticker" && (
                        <div className="text-2xl">🏷️</div>
                      )}
                      {msg.message_type === "location" && (
                        <div className="flex items-center gap-2 text-xs opacity-80">
                          <span>📍</span> Localização
                        </div>
                      )}
                      {(msg.message_type === "text" || !["audio", "document", "sticker", "location"].includes(msg.message_type)) && msg.content && (
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                      )}
                      <div className={`flex items-center gap-1 mt-1 ${isNote ? "text-warning/70" : isOut ? "text-primary-foreground/60" : "text-muted-foreground"}`}>
                        <span className="text-[10px]">{format(new Date(msg.created_at), "HH:mm")}</span>
                        {StatusIcon && (
                          <StatusIcon className={`h-3 w-3 ${msg.status === "read" ? "text-blue-400" : ""} ${msg.status === "failed" ? "text-destructive" : ""}`} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Composer */}
      <div className="p-3 border-t border-border/40 bg-card/50">
        {isNoteMode && (
          <div className="flex items-center gap-2 mb-2 px-1">
            <StickyNote className="h-3.5 w-3.5 text-warning" />
            <span className="text-xs text-warning font-medium">Modo nota interna — não será enviada ao cliente</span>
            <Button size="icon" variant="ghost" className="h-5 w-5 ml-auto" onClick={() => setIsNoteMode(false)}>
              <X className="h-3 w-3" />
            </Button>
          </div>
        )}
        <div className="flex items-center gap-2">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="icon"
                variant={isNoteMode ? "default" : "ghost"}
                className={`h-9 w-9 shrink-0 ${isNoteMode ? "bg-warning hover:bg-warning/90 text-warning-foreground" : ""}`}
                onClick={() => setIsNoteMode(!isNoteMode)}
              >
                <StickyNote className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Nota interna</TooltipContent>
          </Tooltip>

          <Input
            ref={inputRef}
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={isNoteMode ? "Escreva uma nota interna..." : "Digite uma mensagem..."}
            className={`flex-1 h-9 text-sm ${isNoteMode ? "border-warning/30 bg-warning/5" : ""}`}
            disabled={isSending}
          />

          <Button
            size="icon"
            className={`h-9 w-9 shrink-0 ${isNoteMode ? "bg-warning hover:bg-warning/90" : ""}`}
            onClick={handleSend}
            disabled={!inputValue.trim() || isSending}
          >
            {isSending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
