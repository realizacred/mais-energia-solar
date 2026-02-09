import { useState, useRef, useEffect } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  StickyNote,
  User,
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { WaChatComposer } from "./WaChatComposer";
import { WaLeadInfoCard } from "./WaLeadInfoCard";

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
  onSendMedia: (file: File, caption?: string) => void;
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
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

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
                        <a href={msg.media_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.media_url} alt="Imagem" className="rounded-lg mb-1 max-w-full max-h-48 object-cover cursor-pointer hover:opacity-90 transition-opacity" />
                        </a>
                      )}
                      {msg.message_type === "audio" && (
                        <div className="flex items-center gap-2 text-xs opacity-80">
                          <span>🎵</span> Mensagem de áudio
                        </div>
                      )}
                      {msg.message_type === "document" && (
                        <a
                          href={msg.media_url || "#"}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 transition-opacity"
                        >
                          <span>📄</span> {msg.content || "Documento"}
                        </a>
                      )}
                      {msg.message_type === "sticker" && (
                        <div className="text-2xl">🏷️</div>
                      )}
                      {msg.message_type === "location" && (
                        <div className="flex items-center gap-2 text-xs opacity-80">
                          <span>📍</span> Localização
                        </div>
                      )}
                      {(msg.message_type === "text" || !["audio", "document", "sticker", "location", "image"].includes(msg.message_type)) && msg.content && (
                        <p className="whitespace-pre-wrap break-words">{renderFormattedText(msg.content)}</p>
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
      <WaChatComposer
        onSendMessage={onSendMessage}
        onSendMedia={onSendMedia}
        isSending={isSending}
        isNoteMode={isNoteMode}
        onNoteModeChange={setIsNoteMode}
      />

      {/* Lead Info Card */}
      {conversation.lead_id && (
        <WaLeadInfoCard
          leadId={conversation.lead_id}
          open={showLeadInfo}
          onOpenChange={setShowLeadInfo}
        />
      )}
    </div>
  );
}

// ── Render WhatsApp formatted text ──
function renderFormattedText(text: string): React.ReactNode {
  // Simple WhatsApp formatting: *bold*, _italic_, ~strikethrough~
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
