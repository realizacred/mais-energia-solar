import React, { useMemo } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  StickyNote,
  Check,
  CheckCheck,
  Clock,
  AlertCircle,
  Reply,
  Download,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WaMessage, WaConversation } from "@/hooks/useWaInbox";
import { renderFormattedText } from "./WaFormatting";

const MESSAGE_STATUS_CONFIG: Record<string, { icon: typeof Check; className: string; label: string }> = {
  pending: { icon: Clock, className: "text-muted-foreground/50", label: "Enviando..." },
  sent: { icon: Check, className: "text-muted-foreground/70", label: "Enviado" },
  delivered: { icon: CheckCheck, className: "text-muted-foreground/70", label: "Entregue" },
  read: { icon: CheckCheck, className: "text-info", label: "Lido" },
  failed: { icon: AlertCircle, className: "text-destructive", label: "Falhou" },
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

interface WaMessageBubbleProps {
  msg: WaMessage;
  idx: number;
  visibleMessages: WaMessage[];
  conversation: WaConversation;
  messagesMap: Map<string, WaMessage>;
  reactionPickerMsgId: string | null;
  onContextMenu: (e: React.MouseEvent, msg: WaMessage) => void;
  onReply: (msg: WaMessage) => void;
  onReactionPickerToggle: (msgId: string | null) => void;
  onSendReaction: (messageId: string, reaction: string) => void;
  onMediaPreview: (data: { url: string; type: "image" | "video" | "audio" | "document"; caption?: string }) => void;
}

export function WaMessageBubble({
  msg,
  idx,
  visibleMessages,
  conversation,
  messagesMap,
  reactionPickerMsgId,
  onContextMenu,
  onReply,
  onReactionPickerToggle,
  onSendReaction,
  onMediaPreview,
}: WaMessageBubbleProps) {
  const isOut = msg.direction === "out";
  const isNote = msg.is_internal_note;

  // ✅ FIX: Use visibleMessages for date separator comparison (not raw messages)
  const showDate = idx === 0 ||
    format(new Date(visibleMessages[idx - 1].created_at), "yyyy-MM-dd") !== format(new Date(msg.created_at), "yyyy-MM-dd");

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
        className={`flex ${isOut ? "justify-end" : "justify-start"} mb-1 group/msg relative px-3`}
        onContextMenu={(e) => onContextMenu(e, msg)}
      >
        {/* Hover actions */}
        {!isNote && (
          <div className={`absolute ${isOut ? "left-1" : "right-1"} top-1/2 -translate-y-1/2 opacity-0 group-hover/msg:opacity-100 transition-opacity z-10 flex items-center gap-0.5`}>
            <button
              onClick={() => onReply(msg)}
              className="p-1 rounded-full hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors"
              title="Responder"
            >
              <Reply className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onReactionPickerToggle(reactionPickerMsgId === msg.id ? null : msg.id)}
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
                  onReactionPickerToggle(null);
                }}
                className="text-lg hover:scale-125 transition-transform p-0.5"
              >
                {emoji}
              </button>
            ))}
          </div>
        )}

        <div
          className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[15px] leading-relaxed shadow-sm ${
            isNote
              ? "bg-warning/10 border border-warning/30 text-foreground italic"
              : isOut
              ? "bg-primary/10 text-foreground border border-primary/15 rounded-br-md"
              : "bg-card border border-border/30 rounded-bl-md text-foreground"
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
            <p className="text-[10px] font-semibold text-primary/80 mb-0.5">
              {msg.sent_by_name}
            </p>
          )}
          {isNote && (
            <div className="flex items-center gap-1 mb-1 text-[10px] text-warning font-medium">
              <StickyNote className="h-3 w-3" />
              Nota interna{msg.sent_by_name ? ` · ${msg.sent_by_name}` : ""}
            </div>
          )}

          {/* Media content */}
          {msg.message_type === "image" && msg.media_url && (
            <div
              className="cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onMediaPreview({ url: msg.media_url!, type: "image", caption: msg.content || undefined })}
            >
              <img src={msg.media_url} alt="Imagem" className="rounded-lg mb-1 max-w-full max-h-48 object-cover" />
            </div>
          )}
          {msg.message_type === "image" && !msg.media_url && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-2">
              <Clock className="h-3.5 w-3.5" />
              <span>Carregando imagem…</span>
            </div>
          )}
          {msg.message_type === "image" && msg.content && (
            <p className="whitespace-pre-wrap break-words text-xs mt-1">{renderFormattedText(msg.content)}</p>
          )}
          {/* GIF - autoplay loop */}
          {msg.message_type === "gif" && (
            msg.media_url ? (
              <div
                className="cursor-pointer hover:opacity-90 transition-opacity block mb-1"
                onClick={() => onMediaPreview({ url: msg.media_url!, type: "video", caption: msg.content || undefined })}
              >
                <video
                  src={msg.media_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="rounded-lg max-w-full max-h-48 object-cover"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs opacity-80">
                <span>🎞️</span> GIF
              </div>
            )
          )}
          {msg.message_type === "gif" && msg.content && (
            <p className="whitespace-pre-wrap break-words text-xs mt-1">{renderFormattedText(msg.content)}</p>
          )}
          {msg.message_type === "video" && (
            msg.media_url ? (
              <div
                className="cursor-pointer hover:opacity-90 transition-opacity block mb-1"
                onClick={() => onMediaPreview({ url: msg.media_url!, type: "video", caption: msg.content || undefined })}
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-2">
                <Clock className="h-3.5 w-3.5" />
                <span>Carregando vídeo…</span>
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
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-2">
                <Clock className="h-3.5 w-3.5" />
                <span>Carregando áudio…</span>
              </div>
            )
          )}
          {msg.message_type === "document" && (
            msg.media_url ? (
              <div
                className="flex items-center gap-2 text-xs opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
                onClick={() => msg.media_url && onMediaPreview({ url: msg.media_url, type: "document", caption: msg.content || undefined })}
              >
                <span>📄</span> {msg.content || "Documento"}
              </div>
            ) : (
              <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-2">
                <Clock className="h-3.5 w-3.5" />
                <span>Carregando documento…</span>
              </div>
            )
          )}
          {msg.message_type === "sticker" && (
            msg.media_url ? (
              <div
                className="cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => onMediaPreview({ url: msg.media_url!, type: "image" })}
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
          {(msg.message_type === "text" || !["audio", "document", "sticker", "location", "image", "video", "gif"].includes(msg.message_type)) && msg.content && (
            <p className="whitespace-pre-wrap break-words">{renderFormattedText(msg.content)}</p>
          )}
          {(msg.message_type === "video" || msg.message_type === "gif") && msg.content && (
            <p className="whitespace-pre-wrap break-words text-xs mt-1">{renderFormattedText(msg.content)}</p>
          )}

          {/* Timestamp & status */}
          <div className={`flex items-center gap-1 mt-1 ${isNote ? "text-warning/70" : "text-muted-foreground"}`}>
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
}
