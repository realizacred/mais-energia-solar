import { useState, useRef, useEffect } from "react";
import {
  Smile, Paperclip, Mic, Zap, Send, ArrowLeft, Phone, Video,
  MoreVertical, CheckCheck, Check, Image, FileText, Play, Pause,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { SolarZapConversation } from "./SolarZapConversationList";

interface ChatMessage {
  id: string;
  content: string;
  direction: "in" | "out";
  timestamp: string;
  status?: "sent" | "delivered" | "read";
  type: "text" | "audio" | "image" | "document";
  mediaUrl?: string;
  duration?: number; // audio duration in seconds
}

interface Props {
  conversation: SolarZapConversation | null;
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

function MessageStatusIcon({ status }: { status?: string }) {
  if (status === "read") return <CheckCheck className="h-3 w-3 text-info" />;
  if (status === "delivered") return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
  return <Check className="h-3 w-3 text-muted-foreground" />;
}

// Demo messages for the prototype
const DEMO_MESSAGES: ChatMessage[] = [
  { id: "1", content: "Olá! Vi o anúncio de vocês sobre energia solar. Quanto custa mais ou menos para uma casa que gasta R$500 por mês?", direction: "in", timestamp: "09:15", type: "text" },
  { id: "2", content: "Bom dia! 😊 Fico feliz pelo seu interesse! Para um consumo de R$500/mês, o sistema ideal seria de aproximadamente 5.4 kWp.", direction: "out", timestamp: "09:18", type: "text", status: "read" },
  { id: "3", content: "Vou te enviar uma simulação detalhada com os valores e o retorno do investimento.", direction: "out", timestamp: "09:18", type: "text", status: "read" },
  { id: "4", content: "", direction: "out", timestamp: "09:20", type: "audio", duration: 45, status: "delivered" },
  { id: "5", content: "Muito interessante! E qual é o prazo de retorno do investimento?", direction: "in", timestamp: "09:32", type: "text" },
  { id: "6", content: "Para esse perfil, o payback é de aproximadamente 4 anos e meio. Após isso, toda a economia é lucro! ☀️", direction: "out", timestamp: "09:35", type: "text", status: "read" },
  { id: "7", content: "Posso agendar uma visita técnica para avaliar o telhado? É gratuito e sem compromisso.", direction: "out", timestamp: "09:35", type: "text", status: "delivered" },
];

export function SolarZapChatPanel({ conversation, onBack, showBackButton }: Props) {
  const [message, setMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversation]);

  if (!conversation) {
    return (
      <div className="flex-1 flex items-center justify-center bg-muted/20">
        <div className="text-center">
          <MessageCircleIcon className="h-12 w-12 text-muted-foreground/20 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Selecione uma conversa</p>
          <p className="text-xs text-muted-foreground/60 mt-1">Escolha um contato para iniciar</p>
        </div>
      </div>
    );
  }

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
          <AvatarFallback className="text-xs font-medium bg-muted">
            {conversation.nome.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-semibold text-foreground truncate">{conversation.nome}</h3>
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 h-4",
                conversation.status === "online" ? "text-success border-success/30" : "text-muted-foreground"
              )}
            >
              {conversation.status === "online" ? "Online" : "Offline"}
            </Badge>
          </div>
          <Badge variant="outline" className="font-mono text-[9px] px-1 mt-0.5">
            Ticket #{ conversation.id.slice(0, 4).toUpperCase()}
          </Badge>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <Button size="icon" variant="ghost" className="h-8 w-8"><Phone className="h-4 w-4" /></Button>
          <Button size="icon" variant="ghost" className="h-8 w-8"><Video className="h-4 w-4" /></Button>
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
        <div className="space-y-3 max-w-2xl mx-auto">
          {DEMO_MESSAGES.map((msg) => (
            <div
              key={msg.id}
              className={cn("flex", msg.direction === "out" ? "justify-end" : "justify-start")}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-xl px-3 py-2 text-sm",
                  msg.direction === "out"
                    ? "bg-primary/10 text-foreground rounded-br-sm"
                    : "bg-muted text-foreground rounded-bl-sm"
                )}
              >
                {msg.type === "audio" ? (
                  <AudioWaveform duration={msg.duration} />
                ) : msg.type === "image" ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Image className="h-4 w-4" />
                    <span>Imagem</span>
                  </div>
                ) : msg.type === "document" ? (
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    <span>Documento</span>
                  </div>
                ) : (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                )}
                <div className={cn("flex items-center gap-1 mt-1", msg.direction === "out" ? "justify-end" : "justify-start")}>
                  <span className="text-[10px] font-mono text-muted-foreground">{msg.timestamp}</span>
                  {msg.direction === "out" && <MessageStatusIcon status={msg.status} />}
                </div>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Input */}
      <div className="border-t border-border/50 bg-card p-2">
        <div className="flex items-center gap-1.5 max-w-2xl mx-auto">
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-muted-foreground">
            <Smile className="h-5 w-5" />
          </Button>
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-muted-foreground">
            <Paperclip className="h-5 w-5" />
          </Button>
          <Input
            placeholder="Digite sua mensagem..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            className="flex-1 h-9 text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && message.trim()) {
                setMessage("");
              }
            }}
          />
          <Button size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-warning">
            <Zap className="h-5 w-5" />
          </Button>
          {message.trim() ? (
            <Button size="icon" className="h-9 w-9 shrink-0" onClick={() => setMessage("")}>
              <Send className="h-4 w-4" />
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

// Empty state icon
function MessageCircleIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z" />
    </svg>
  );
}
