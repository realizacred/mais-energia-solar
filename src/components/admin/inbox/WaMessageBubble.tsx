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
  MapPin,
  RefreshCw,
  FileWarning,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WaMessage, WaConversation } from "@/hooks/useWaInbox";
import { renderFormattedText } from "./WaFormatting";
import { WaAudioPlayer } from "./WaAudioPlayer";

const MESSAGE_STATUS_CONFIG: Record<string, { icon: typeof Check; className: string; label: string }> = {
  pending: { icon: Clock, className: "text-muted-foreground/60", label: "Enviando..." },
  queued: { icon: Clock, className: "text-muted-foreground/60", label: "Na fila" },
  sending: { icon: Clock, className: "text-muted-foreground/70", label: "Enviando..." },
  sent: { icon: Check, className: "text-muted-foreground", label: "Enviado" },
  delivered: { icon: CheckCheck, className: "text-muted-foreground", label: "Entregue" },
  read: { icon: CheckCheck, className: "text-info", label: "Lido" },
  failed: { icon: AlertCircle, className: "text-destructive", label: "Falhou" },
};

const QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

/** Check if media permanently failed to download */
function isMediaFailed(msg: WaMessage): boolean {
  return msg.media_status === "failed" || (!msg.media_url && !!(msg.metadata as any)?.media_failed);
}

/** Check if media is still being fetched */
function isMediaPending(msg: WaMessage): boolean {
  return !msg.media_url && (msg.media_status === "pending" || msg.media_status === "fetching");
}

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
  onRetry?: (msg: WaMessage) => void;
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
  onRetry,
}: WaMessageBubbleProps) {
  const isOut = msg.direction === "out";
  const isNote = msg.is_internal_note;
  const mediaFailed = isMediaFailed(msg);

  const showDate = idx === 0 ||
    format(new Date(visibleMessages[idx - 1].created_at), "yyyy-MM-dd") !== format(new Date(msg.created_at), "yyyy-MM-dd");

  const statusCfg = isOut && msg.status ? MESSAGE_STATUS_CONFIG[msg.status] || null : null;
  const quotedMsg = msg.quoted_message_id ? messagesMap.get(msg.quoted_message_id) : null;

  /** Render media loading or failed state */
  const renderMediaPlaceholder = (label: string) => {
    if (mediaFailed || msg.message_type === "error" || msg.content === "Mídia não disponível") {
      return (
        <div className="flex items-center gap-2 text-xs text-muted-foreground/60 italic py-2">
          <FileWarning className="h-3.5 w-3.5 opacity-50" />
          <span>🚫 Mídia não disponível</span>
        </div>
      );
    }
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse py-2">
        <Clock className="h-3.5 w-3.5" />
        <span>Carregando {label}…</span>
      </div>
    );
  };

  return (
    <div>
      {showDate && (
        <div className="flex justify-center my-3">
          <Badge variant="secondary" className="text-[11px] px-3 py-1 bg-muted text-muted-foreground font-medium shadow-sm border border-border/40">
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
            {/* RB-03-exception: chat micro-interaction — hover reply/react buttons */}
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
              // RB-03-exception: chat micro-interaction — emoji reaction picker
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
          className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[14.5px] leading-snug shadow-sm ring-1 ${
            isNote
              ? "bg-warning/10 ring-warning/30 text-foreground italic"
              : isOut
              ? "bg-primary text-primary-foreground ring-primary/20 rounded-br-md"
              : "bg-card ring-border/60 rounded-bl-md text-foreground"
          }`}
        >
          {/* Quoted message */}
          {quotedMsg && (
            <div className={`mb-1.5 p-2 rounded-lg border-l-2 text-[11px] ${
              isOut ? "bg-primary-foreground/15 border-primary-foreground/50" : "bg-muted/60 border-primary/50"
            }`}>
              <p className={`font-semibold text-[10px] ${isOut ? "text-primary-foreground/90" : "text-primary"}`}>
                {quotedMsg.direction === "out" ? (quotedMsg.sent_by_name || "Você") : conversation.cliente_nome || "Cliente"}
              </p>
              <p className={`truncate ${isOut ? "text-primary-foreground/80" : "text-muted-foreground"}`}>
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
          {isNote && (
            <div className="flex items-center gap-1 mb-1 text-[10px] text-warning font-medium">
              <StickyNote className="h-3 w-3" />
              Nota interna{msg.sent_by_name ? ` · ${msg.sent_by_name}` : ""}
            </div>
          )}

          {/* ── Media content ── */}

          {/* IMAGE */}
          {msg.message_type === "image" && msg.media_url && (
            <div
              className="cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => onMediaPreview({ url: msg.media_url!, type: "image", caption: msg.content || undefined })}
            >
              <img src={msg.media_url} alt="Imagem" className="rounded-lg mb-1 max-w-full max-h-48 object-cover" />
            </div>
          )}
          {msg.message_type === "image" && !msg.media_url && renderMediaPlaceholder("imagem")}
          {msg.message_type === "image" && msg.content && (
            <p className="whitespace-pre-wrap break-words text-xs mt-1">{renderFormattedText(msg.content)}</p>
          )}

          {/* GIF */}
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
            ) : renderMediaPlaceholder("GIF")
          )}
          {msg.message_type === "gif" && msg.content && (
            <p className="whitespace-pre-wrap break-words text-xs mt-1">{renderFormattedText(msg.content)}</p>
          )}

          {/* VIDEO */}
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
            ) : renderMediaPlaceholder("vídeo")
          )}

          {/* AUDIO */}
          {msg.message_type === "audio" && (
            msg.media_url ? (
              <WaAudioPlayer src={msg.media_url} />
            ) : renderMediaPlaceholder("áudio")
          )}

          {/* DOCUMENT — premium mini-card */}
          {msg.message_type === "document" && (
            msg.media_url ? (
              <div
                className={`flex items-center gap-2.5 p-2 rounded-lg ${
                  isOut
                    ? "bg-primary-foreground/15 hover:bg-primary-foreground/20"
                    : "bg-muted/70 hover:bg-muted"
                } transition-colors cursor-pointer`}
                onClick={() => msg.media_url && onMediaPreview({ url: msg.media_url, type: "document", caption: msg.content || undefined })}
              >
                <div className={`shrink-0 h-9 w-9 rounded-md flex items-center justify-center ${
                  isOut ? "bg-primary-foreground/20 text-primary-foreground" : "bg-background text-primary border border-border"
                }`}>
                  <FileWarning className="hidden" />
                  <span className="text-base">📄</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-[13px] font-medium truncate ${isOut ? "text-primary-foreground" : "text-foreground"}`}>
                    {msg.content || "Documento"}
                  </p>
                  <p className={`text-[10.5px] ${isOut ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                    Toque para abrir
                  </p>
                </div>
                <a
                  href={msg.media_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download
                  className={`shrink-0 p-1.5 rounded-md transition-colors ${
                    isOut
                      ? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/15"
                      : "text-muted-foreground hover:text-foreground hover:bg-background"
                  }`}
                  title="Baixar"
                  onClick={(e) => e.stopPropagation()}
                >
                  <Download className="h-3.5 w-3.5" />
                </a>
              </div>
            ) : renderMediaPlaceholder("documento")
          )}

          {/* STICKER */}
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

          {/* LOCATION — with Google Maps link */}
          {msg.message_type === "location" && (
            (() => {
              const coords = msg.content?.split(",");
              const lat = coords?.[0]?.trim();
              const lng = coords?.[1]?.trim();
              const mapUrl = lat && lng ? `https://www.google.com/maps?q=${lat},${lng}` : null;
              return (
                <a
                  href={mapUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-xs text-primary hover:text-primary/80 transition-colors"
                >
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>
                    {lat && lng ? `${lat}, ${lng}` : "Localização"}
                  </span>
                </a>
              );
            })()
          )}

          {/* CONTACT */}
          {msg.message_type === "contact" && (
            <div className="flex items-center gap-2 text-xs">
              <span>👤</span>
              <span className="font-medium">
                {msg.content ? msg.content : "Contato compartilhado"}
              </span>
            </div>
          )}

          {/* TEXT (or unknown types with content) */}
          {(msg.message_type === "text" || !["audio", "document", "sticker", "location", "image", "video", "gif", "contact"].includes(msg.message_type)) && msg.content && (
            <p className="whitespace-pre-wrap break-words">{renderFormattedText(msg.content)}</p>
          )}
          {(msg.message_type === "video" || msg.message_type === "gif") && msg.content && (
            <p className="whitespace-pre-wrap break-words text-xs mt-1">{renderFormattedText(msg.content)}</p>
          )}

          {/* Fallback for corrupted/empty messages — no content and no media */}
          {!msg.content && !msg.media_url && !["location", "reaction"].includes(msg.message_type) && (
            <p className="whitespace-pre-wrap break-words text-sm italic text-muted-foreground opacity-70">
              🚫 Mídia não disponível
            </p>
          )}

          {isOut && msg.sent_by_name && !isNote && (
            <p className="text-[10px] text-primary-foreground/70 mt-0.5">
              Enviado por {msg.sent_by_name}
            </p>
          )}

          {/* Failed message error + retry */}
          {msg.status === "failed" && (
            <div className="flex items-center gap-1.5 mt-0.5">
              {msg.error_message ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <p className={`text-[10px] cursor-help truncate flex-1 font-medium ${isOut ? "text-destructive-foreground bg-destructive/90 px-1.5 py-0.5 rounded" : "text-destructive"}`}>
                      ⚠ Falha no envio
                    </p>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-[10px] break-all">
                    {msg.error_message}
                  </TooltipContent>
                </Tooltip>
              ) : (
                <p className={`text-[10px] truncate flex-1 font-medium ${isOut ? "text-destructive-foreground bg-destructive/90 px-1.5 py-0.5 rounded" : "text-destructive"}`}>
                  ⚠ Falha no envio
                </p>
              )}
              {onRetry && msg.direction === "out" && (
                // RB-03-exception: chat micro-interaction — retry with stopPropagation
                <button
                  onClick={(e) => { e.stopPropagation(); onRetry(msg); }}
                  className={`flex items-center gap-0.5 text-[10px] font-medium shrink-0 transition-colors ${
                    isOut ? "text-primary-foreground hover:text-primary-foreground/80 underline" : "text-primary hover:text-primary/80"
                  }`}
                  title="Tentar reenviar"
                >
                  <RefreshCw className="h-3 w-3" />
                  Reenviar
                </button>
              )}
            </div>
          )}

          {/* Timestamp & status */}
          <div className={`flex items-center gap-1 mt-1 justify-end ${
            isNote ? "text-warning/80" : isOut ? "text-primary-foreground/75" : "text-muted-foreground"
          }`}>
            <span className="text-[10.5px] font-medium tabular-nums">{format(new Date(msg.created_at), "HH:mm")}</span>
            {statusCfg && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <statusCfg.icon className={`h-3.5 w-3.5 ${
                    isOut
                      ? msg.status === "read"
                        ? "text-primary-foreground"
                        : msg.status === "failed"
                          ? "text-destructive-foreground"
                          : "text-primary-foreground/70"
                      : statusCfg.className
                  }`} />
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
