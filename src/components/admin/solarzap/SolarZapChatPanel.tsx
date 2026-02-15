import { useState, useRef, useEffect } from "react";
import {
  Smile, Paperclip, Mic, Zap, Send, ArrowLeft, Phone, Video,
  MoreVertical, CheckCheck, Check, Image, FileText, Play, Pause,
  StickyNote, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { WaConversation, WaMessage } from "@/hooks/useWaInbox";
import { format } from "date-fns";

interface Props {
  conversation: WaConversation | null;
  messages: WaMessage[];
  loading: boolean;
  isSending: boolean;
  onSendMessage: (content: string, isNote?: boolean) => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

// Simple waveform component for audio messages
function AudioWaveform({ duration }: { duration?: number }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const togglePlay = () => {
    if (playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setPlaying(false);
    } else {
      setPlaying(true);
      setProgress(0);
      intervalRef.current = setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            if (intervalRef.current) clearInterval(intervalRef.current);
            setPlaying(false);
            return 0;
          }
          return p + 2;
        });
      }, (duration || 10) * 20);
    }
  };

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current); }, []);

  const bars = Array.from({ length: 28 }, () => 20 + Math.random() * 80);

  return (
    <div className="flex items-center gap-2 min-w-[180px]">
      <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={togglePlay}>
        {playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
      </Button>
      <div className="flex items-end gap-[2px] h-6 flex-1">
        {bars.map((h, i) => (
          <div
            key={i}
            className={cn(
              "w-[3px] rounded-full transition-colors duration-100",
              i / bars.length * 100 < progress ? "bg-primary" : "bg-muted-foreground/30"
            )}
            style={{ height: `${h}%` }}
          />
        ))}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground shrink-0">
        {duration ? `${Math.floor(duration / 60)}:${String(duration % 60).padStart(2, "0")}` : "0:00"}
      </span>
    </div>
  );
}

function MessageStatusIcon({ status }: { status?: string | null }) {
  if (status === "read") return <CheckCheck className="h-3 w-3 text-info" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  if (status === "pending") return <Loader2 className="h-3 w-3 text-muted-foreground animate-spin" />;
  return <Check className="h-3 w-3 text-muted-foreground" />;
}

function formatMsgTime(dateStr: string) {
  try {
    return format(new Date(dateStr), "HH:mm");
  } catch {
    return "";
  }
}

export function SolarZapChatPanel({ conversation, messages, loading, isSending, onSendMessage, onBack, showBackButton }: Props) {
  const [message, setMessage] = useState("");
  const [isNoteMode, setIsNoteMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <EmptyIcon className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Escolha um contato para iniciar</p>
        </div>
      </div>
    );
  }

  const displayName = conversation.cliente_nome || conversation.lead_nome || conversation.cliente_telefone || "Desconhecido";

  const handleSend = () => {
    if (!message.trim()) return;
    onSendMessage(message.trim(), isNoteMode);
    setMessage("");
    setIsNoteMode(false);
  };

  return (
    <div className="flex-1 flex flex-col bg-background min-w-0">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/50 bg-card">
        {showBackButton && (
          <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" onClick={onBack}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <Avatar className="h-9 w-9 shrink-0">
          {conversation.profile_picture_url && (
            <AvatarImage src={conversation.profile_picture_url} alt={displayName} />
          )}
          <AvatarFallback className="text-xs font-medium bg-muted">
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">{displayName}</h3>
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 h-4",
                conversation.status === "open" ? "text-success border-success/30" : "text-muted-foreground"
              )}
            >
              {conversation.status === "open" ? "Aberto" : conversation.status === "resolved" ? "Resolvido" : "Pendente"}
            </Badge>
          </div>
          {conversation.vendedor_nome && (
            <span className="text-[10px] text-muted-foreground">
              Atendido por {conversation.vendedor_nome}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8"><Phone className="h-4 w-4" /></Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="icon" variant="ghost" className="h-8 w-8"><MoreVertical className="h-4 w-4" /></Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Ver perfil</DropdownMenuItem>
              <DropdownMenuItem>Transferir</DropdownMenuItem>
              <DropdownMenuItem>Encerrar atendimento</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 px-4 py-3">
        {loading ? (
          <div className="space-y-3 max-w-2xl mx-auto">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className={cn("flex", i % 2 === 0 ? "justify-start" : "justify-end")}>
                <Skeleton className={cn("h-12 rounded-xl", i % 2 === 0 ? "w-3/5" : "w-2/5")} />
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-3 max-w-2xl mx-auto">
            {messages.map((msg) => {
              const isOut = msg.direction === "out";
              const isNote = msg.is_internal_note;

              return (
                <div
                  key={msg.id}
                  className={cn("flex", isOut ? "justify-end" : "justify-start")}
                >
                  <div
                    className={cn(
                      "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                      isNote
                        ? "bg-warning/10 text-foreground border border-warning/30 rounded-br-sm"
                        : isOut
                          ? "bg-primary/10 text-foreground rounded-br-sm"
                          : "bg-muted text-foreground rounded-bl-sm"
                    )}
                  >
                    {/* Internal note indicator */}
                    {isNote && (
                      <div className="flex items-center gap-1 mb-1">
                        <StickyNote className="h-3 w-3 text-warning" />
                        <span className="text-[9px] text-warning font-medium">Nota Interna</span>
                      </div>
                    )}

                    {/* Sender name for outbound messages */}
                    {isOut && msg.sent_by_name && (
                      <p className="text-[10px] text-primary font-medium mb-0.5">{msg.sent_by_name}</p>
                    )}

                    {/* Group participant name */}
                    {!isOut && msg.participant_name && (
                      <p className="text-[10px] text-info font-medium mb-0.5">{msg.participant_name}</p>
                    )}

                    {/* Message content */}
                    {msg.message_type === "audio" ? (
                      <AudioWaveform />
                    ) : msg.message_type === "image" ? (
                      msg.media_url ? (
                        <img src={msg.media_url} alt="Imagem" className="rounded-lg max-w-full max-h-48 object-cover" />
                      ) : (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <Image className="h-4 w-4" />
                          <span>Imagem</span>
                        </div>
                      )
                    ) : msg.message_type === "document" ? (
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <FileText className="h-4 w-4" />
                        <span>{msg.content || "Documento"}</span>
                      </div>
                    ) : (
                      <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                    )}

                    {/* Timestamp + status */}
                    <div className={cn("flex items-center gap-1 mt-1", isOut ? "justify-end" : "justify-start")}>
                      <span className="text-[10px] font-mono text-muted-foreground">{formatMsgTime(msg.created_at)}</span>
                      {isOut && !isNote && <MessageStatusIcon status={msg.status} />}
                    </div>
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
        )}
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border/50 bg-card p-2">
        {isNoteMode && (
          <div className="flex items-center gap-1 px-2 pb-1.5">
            <StickyNote className="h-3 w-3 text-warning" />
            <span className="text-[10px] text-warning font-medium">Modo Nota Interna</span>
            <Button size="sm" variant="ghost" className="h-5 text-[10px] px-1.5 ml-auto" onClick={() => setIsNoteMode(false)}>
              Cancelar
            </Button>
          </div>
        )}
        <div className="flex items-center gap-1.5 max-w-2xl mx-auto">
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-muted-foreground">
            <Smile className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-muted-foreground">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            placeholder={isNoteMode ? "Escrever nota interna..." : "Digite sua mensagem..."}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className={cn("flex-1 h-9 text-sm", isNoteMode && "border-warning/30")}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
          />
          <Button
            size="icon"
            variant="ghost"
            className={cn("h-9 w-9 shrink-0", isNoteMode ? "text-warning" : "text-warning")}
            onClick={() => setIsNoteMode(!isNoteMode)}
            title="Nota interna"
          >
            <StickyNote className="h-4 w-4" />
          </Button>
          {message.trim() ? (
            <Button
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={handleSend}
              disabled={isSending}
            >
              {isSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
            </Button>
          ) : (
            <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-muted-foreground">
              <Mic className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
