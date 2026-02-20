import { useState, useRef, useCallback, useEffect } from "react";
import { Bell, BellOff, Volume2, VolumeX, Clock, MessageCircle, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DraggableBellProps {
  enabled: boolean;
  soundEnabled: boolean;
  totalUnread: number;
  onSetEnabled: (val: boolean) => void;
  onSetSoundEnabled: (val: boolean) => void;
  onOpenConversation?: (conversationId: string) => void;
}

const STORAGE_KEY = "wa_bell_position";

function getInitialPosition(): { x: number; y: number } {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return { x: 16, y: window.innerHeight - 60 };
}

export function DraggableBell({
  enabled,
  soundEnabled,
  totalUnread,
  onSetEnabled,
  onSetSoundEnabled,
  onOpenConversation,
}: DraggableBellProps) {
  const { user } = useAuth();
  const [position, setPosition] = useState(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const wasDragged = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const bellRef = useRef<HTMLDivElement>(null);

  // Fetch unanswered conversations for current user
  const { data: unanswered = [] } = useQuery({
    queryKey: ["unanswered-conversations-bell", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("wa_conversations")
          .select("id, cliente_nome, cliente_telefone, last_message_preview, last_message_at, last_message_direction, unread_count")
          .eq("last_message_direction", "in")
          .in("status", ["open", "pending"])
          .order("last_message_at", { ascending: false })
          .limit(50);
        if (error) {
          console.error("[DraggableBell] query error:", error);
          return [];
        }
        return data || [];
      } catch (err) {
        console.error("[DraggableBell] unexpected error:", err);
        return [];
      }
    },
    refetchInterval: 30_000,
  });

  const unansweredCount = unanswered.length;

  const clamp = useCallback((pos: { x: number; y: number }) => {
    const size = 44;
    return {
      x: Math.max(0, Math.min(pos.x, window.innerWidth - size)),
      y: Math.max(0, Math.min(pos.y, window.innerHeight - size)),
    };
  }, []);

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    wasDragged.current = false;
    dragStart.current = { x: e.clientX, y: e.clientY, posX: position.x, posY: position.y };
    setIsDragging(true);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [position]);

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    if (Math.abs(dx) > 3 || Math.abs(dy) > 3) wasDragged.current = true;
    const newPos = clamp({
      x: dragStart.current.posX + dx,
      y: dragStart.current.posY + dy,
    });
    setPosition(newPos);
  }, [isDragging, clamp]);

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (!isDragging) return;
    setIsDragging(false);
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    const midX = window.innerWidth / 2;
    const snapped = clamp({
      x: position.x < midX ? 16 : window.innerWidth - 60,
      y: position.y,
    });
    setPosition(snapped);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapped)); } catch {}
  }, [isDragging, position, clamp]);

  useEffect(() => {
    const onResize = () => setPosition((p) => clamp(p));
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [clamp]);

  return (
    <div
      ref={bellRef}
      className="fixed z-[99] touch-none"
      style={{ left: position.x, top: position.y }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
    >
      <Sheet>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="outline"
            className={`h-11 w-11 rounded-full shadow-lg border-border/60 bg-card hover:bg-muted relative ${isDragging ? "cursor-grabbing scale-110" : "cursor-grab"} transition-transform`}
            onClick={(e) => { if (wasDragged.current) e.preventDefault(); }}
          >
            {enabled ? (
              <Bell className="h-5 w-5 text-foreground" />
            ) : (
              <BellOff className="h-5 w-5 text-muted-foreground" />
            )}
            {unansweredCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm">
                {unansweredCount > 99 ? "99+" : unansweredCount}
              </span>
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto p-0">
          <SheetHeader className="px-4 pt-4 pb-3 border-b border-border/40">
            <SheetTitle className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-warning" />
              Conversas sem resposta
              {unansweredCount > 0 && (
                <Badge variant="destructive" className="text-[10px]">{unansweredCount}</Badge>
              )}
              {/* Settings toggle */}
              <button
                onClick={(e) => { e.stopPropagation(); setShowSettings((v) => !v); }}
                className="ml-auto p-1.5 rounded-md hover:bg-muted transition-colors"
                title="Configurações de notificações"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
              </button>
            </SheetTitle>
          </SheetHeader>

          {/* Notification settings (collapsible) */}
          {showSettings && (
            <div className="px-4 py-3 border-b border-border/40 bg-muted/30 space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm text-foreground flex items-center gap-2 cursor-pointer">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Notificações
                </label>
                <Switch checked={enabled} onCheckedChange={onSetEnabled} />
              </div>
              <div className="flex items-center justify-between">
                <label className="text-sm text-foreground flex items-center gap-2 cursor-pointer">
                  {soundEnabled ? <Volume2 className="h-4 w-4 text-muted-foreground" /> : <VolumeX className="h-4 w-4 text-muted-foreground" />}
                  Som
                </label>
                <Switch checked={soundEnabled} onCheckedChange={onSetSoundEnabled} disabled={!enabled} />
              </div>
            </div>
          )}

          {/* Unanswered conversations list */}
          <div className="divide-y divide-border/30">
            {unansweredCount === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center px-4">
                <MessageCircle className="h-8 w-8 text-success mb-3" />
                <p className="text-sm font-medium">Tudo respondido! 🎉</p>
                <p className="text-xs text-muted-foreground mt-1">Nenhuma conversa aguardando resposta.</p>
              </div>
            ) : (
              unanswered.map((conv) => (
                <button
                  key={conv.id}
                  onClick={() => onOpenConversation?.(conv.id)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-left"
                >
                  <div className="h-10 w-10 rounded-full bg-destructive/10 flex items-center justify-center shrink-0">
                    <MessageCircle className="h-4 w-4 text-destructive" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {conv.cliente_nome || conv.cliente_telefone}
                    </p>
                    {conv.last_message_preview && (
                      <p className="text-xs text-muted-foreground truncate">{conv.last_message_preview}</p>
                    )}
                    {conv.last_message_at && (
                      <p className="text-[10px] text-warning mt-0.5">
                        {formatDistanceToNow(new Date(conv.last_message_at), { addSuffix: true, locale: ptBR })}
                      </p>
                    )}
                  </div>
                  {conv.unread_count > 0 && (
                    <Badge variant="destructive" className="text-[10px] shrink-0">{conv.unread_count}</Badge>
                  )}
                </button>
              ))
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
