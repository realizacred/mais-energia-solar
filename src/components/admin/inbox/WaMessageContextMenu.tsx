import { useEffect, useCallback, useRef } from "react";
import { Reply, Copy, Forward, Trash2 } from "lucide-react";
import type { WaMessage } from "@/hooks/useWaInbox";

interface ContextMenuState {
  x: number;
  y: number;
  message: WaMessage;
}

interface WaMessageContextMenuProps {
  contextMenu: ContextMenuState | null;
  onClose: () => void;
  onReply: (msg: WaMessage) => void;
  onCopy: (msg: WaMessage) => void;
  onForward: (msg: WaMessage) => void;
  onDeleteForMe: (msg: WaMessage) => void;
  onOpenReactionPicker: (msgId: string) => void;
}

export function WaMessageContextMenu({
  contextMenu,
  onClose,
  onReply,
  onCopy,
  onForward,
  onDeleteForMe,
  onOpenReactionPicker,
}: WaMessageContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!contextMenu) return;
    const close = () => onClose();
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [contextMenu, onClose]);

  // Clamp position to viewport bounds
  const getClampedPosition = useCallback(() => {
    if (!contextMenu) return { top: 0, left: 0 };
    const menuWidth = 200;
    const menuHeight = 220;
    const padding = 8;

    const maxX = window.innerWidth - menuWidth - padding;
    const maxY = window.innerHeight - menuHeight - padding;

    return {
      top: Math.max(padding, Math.min(contextMenu.y, maxY)),
      left: Math.max(padding, Math.min(contextMenu.x, maxX)),
    };
  }, [contextMenu]);

  if (!contextMenu) return null;

  const pos = getClampedPosition();

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-card border border-border rounded-xl shadow-xl py-1.5 min-w-[180px] animate-in fade-in-0 zoom-in-95"
      style={{ top: pos.top, left: pos.left }}
      onClick={(e) => e.stopPropagation()}
    >
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
        onClick={() => onReply(contextMenu.message)}
      >
        <Reply className="h-4 w-4 text-muted-foreground" />
        Responder
      </button>
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
        onClick={() => {
          onOpenReactionPicker(contextMenu.message.id);
          onClose();
        }}
      >
        <span className="text-base">😀</span>
        Reagir
      </button>
      {contextMenu.message.content && (
        <button
          className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
          onClick={() => onCopy(contextMenu.message)}
        >
          <Copy className="h-4 w-4 text-muted-foreground" />
          Copiar
        </button>
      )}
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-muted/60 transition-colors"
        onClick={() => onForward(contextMenu.message)}
      >
        <Forward className="h-4 w-4 text-muted-foreground" />
        Encaminhar
      </button>
      <div className="h-px bg-border/50 mx-2 my-1" />
      <button
        className="w-full flex items-center gap-2.5 px-3 py-2 text-sm hover:bg-destructive/10 text-destructive transition-colors"
        onClick={() => onDeleteForMe(contextMenu.message)}
      >
        <Trash2 className="h-4 w-4" />
        Apagar para mim
      </button>
    </div>
  );
}

export type { ContextMenuState };
