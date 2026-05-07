/**
 * WaConversationContextMenu — Menu de clique direito na lista de conversas.
 * Reutiliza hooks existentes (RB-76: nada de novo backend).
 */
import { useEffect, useRef, useState } from "react";
import {
  Pin,
  PinOff,
  UserCheck,
  MailOpen,
  Mail,
  Tag as TagIcon,
  CheckCircle2,
  RotateCcw,
  UserPlus,
  Building2,
  ChevronRight,
  MessageSquare,
  Copy,
  BellOff,
  Bell,
  EyeOff,
  Eye,
} from "lucide-react";
import type { WaConversation, WaTag } from "@/hooks/useWaInbox";

export interface WaConvContextMenuState {
  x: number;
  y: number;
  conversation: WaConversation;
}

interface Props {
  state: WaConvContextMenuState | null;
  onClose: () => void;
  isPinned: boolean;
  onTogglePin: () => void;
  onAssignToMe: () => void;
  onToggleRead: () => void;
  hasUnread: boolean;
  tags: WaTag[];
  appliedTagIds: Set<string>;
  onToggleTag: (tagId: string) => void;
  isResolved: boolean;
  onResolve: () => void;
  onReopen: () => void;
  onCreateLead: () => void;
  onCreateCliente: () => void;
  onOpenConversation?: () => void;
  onCopyPhone?: () => void;
  isMuted?: boolean;
  onToggleMute?: () => void;
  isHidden?: boolean;
  onToggleHide?: () => void;
}

export function WaConversationContextMenu({
  state,
  onClose,
  isPinned,
  onTogglePin,
  onAssignToMe,
  onToggleRead,
  hasUnread,
  tags,
  appliedTagIds,
  onToggleTag,
  isResolved,
  onResolve,
  onReopen,
  onCreateLead,
  onCreateCliente,
  onOpenConversation,
  onCopyPhone,
  isMuted,
  onToggleMute,
  isHidden,
  onToggleHide,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [tagsOpen, setTagsOpen] = useState(false);

  useEffect(() => {
    if (!state) {
      setTagsOpen(false);
      return;
    }
    const handler = () => onClose();
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    // Defer attaching listeners so the same contextmenu/click event that
    // opened the menu does not immediately close it via window bubbling.
    const timer = window.setTimeout(() => {
      window.addEventListener("click", handler);
      window.addEventListener("contextmenu", handler);
      window.addEventListener("keydown", esc);
    }, 0);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("click", handler);
      window.removeEventListener("contextmenu", handler);
      window.removeEventListener("keydown", esc);
    };
  }, [state, onClose]);

  if (!state) return null;

  const W = 240;
  const H = 360;
  const pad = 8;
  const top = Math.max(pad, Math.min(state.y, window.innerHeight - H - pad));
  const left = Math.max(pad, Math.min(state.x, window.innerWidth - W - pad));

  const item =
    "w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors text-left";

  const run = (fn: () => void) => () => {
    fn();
    onClose();
  };

  return (
    <div
      ref={ref}
      className="fixed z-[60] bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[220px] animate-in fade-in-0 zoom-in-95"
      style={{ top, left, width: W }}
      onClick={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {onOpenConversation && (
        <button className={item} onClick={run(onOpenConversation)}>
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Abrir conversa
        </button>
      )}
      <button className={item} onClick={run(onTogglePin)}>
        {isPinned ? <PinOff className="h-4 w-4 text-muted-foreground" /> : <Pin className="h-4 w-4 text-muted-foreground" />}
        {isPinned ? "Desafixar" : "Fixar conversa"}
      </button>
      <button className={item} onClick={run(onAssignToMe)}>
        <UserCheck className="h-4 w-4 text-muted-foreground" />
        Atribuir para mim
      </button>
      <button className={item} onClick={run(onToggleRead)}>
        {hasUnread ? <MailOpen className="h-4 w-4 text-muted-foreground" /> : <Mail className="h-4 w-4 text-muted-foreground" />}
        {hasUnread ? "Marcar como lida" : "Marcar como não lida"}
      </button>

      {/* Tags submenu */}
      <div className="relative">
        <button
          className={item + " justify-between"}
          onClick={(e) => {
            e.stopPropagation();
            setTagsOpen((v) => !v);
          }}
        >
          <span className="flex items-center gap-2.5">
            <TagIcon className="h-4 w-4 text-muted-foreground" />
            Adicionar tag
          </span>
          <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
        {tagsOpen && (
          <div className="absolute left-full top-0 ml-1 bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[180px] max-h-[260px] overflow-y-auto">
            {tags.length === 0 && (
              <div className="px-3 py-2 text-xs text-muted-foreground">Nenhuma tag criada</div>
            )}
            {tags.map((t) => {
              const applied = appliedTagIds.has(t.id);
              return (
                <button
                  key={t.id}
                  className={item}
                  onClick={run(() => onToggleTag(t.id))}
                >
                  <span
                    className="h-3 w-3 rounded-full border"
                    style={{ background: t.color, borderColor: t.color }}
                  />
                  <span className="flex-1 truncate">{t.name}</span>
                  {applied && <CheckCircle2 className="h-3.5 w-3.5 text-success" />}
                </button>
              );
            })}
          </div>
        )}
      </div>

      <div className="h-px bg-border/50 mx-2 my-1" />

      {onToggleMute && (
        <button className={item} onClick={run(onToggleMute)}>
          {isMuted ? <Bell className="h-4 w-4 text-muted-foreground" /> : <BellOff className="h-4 w-4 text-muted-foreground" />}
          {isMuted ? "Ativar notificações" : "Silenciar conversa"}
        </button>
      )}
      {onToggleHide && (
        <button className={item} onClick={run(onToggleHide)}>
          {isHidden ? <Eye className="h-4 w-4 text-muted-foreground" /> : <EyeOff className="h-4 w-4 text-muted-foreground" />}
          {isHidden ? "Reexibir conversa" : "Ocultar conversa"}
        </button>
      )}
      {onCopyPhone && (
        <button className={item} onClick={run(onCopyPhone)}>
          <Copy className="h-4 w-4 text-muted-foreground" />
          Copiar telefone
        </button>
      )}


      {isResolved ? (
        <button className={item} onClick={run(onReopen)}>
          <RotateCcw className="h-4 w-4 text-muted-foreground" />
          Reabrir conversa
        </button>
      ) : (
        <button className={item} onClick={run(onResolve)}>
          <CheckCircle2 className="h-4 w-4 text-success" />
          Marcar como resolvida
        </button>
      )}

      <div className="h-px bg-border/50 mx-2 my-1" />

      <button className={item} onClick={run(onCreateLead)}>
        <UserPlus className="h-4 w-4 text-muted-foreground" />
        Criar lead
      </button>
      <button className={item} onClick={run(onCreateCliente)}>
        <Building2 className="h-4 w-4 text-muted-foreground" />
        Criar cliente
      </button>
    </div>
  );
}
