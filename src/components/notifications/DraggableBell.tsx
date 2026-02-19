import { useState, useRef, useCallback, useEffect } from "react";
import { Bell, BellOff, Volume2, VolumeX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface DraggableBellProps {
  enabled: boolean;
  soundEnabled: boolean;
  totalUnread: number;
  onSetEnabled: (val: boolean) => void;
  onSetSoundEnabled: (val: boolean) => void;
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
}: DraggableBellProps) {
  const [position, setPosition] = useState(getInitialPosition);
  const [isDragging, setIsDragging] = useState(false);
  const wasDragged = useRef(false);
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const bellRef = useRef<HTMLDivElement>(null);

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
    // Snap to nearest edge
    const midX = window.innerWidth / 2;
    const snapped = clamp({
      x: position.x < midX ? 16 : window.innerWidth - 60,
      y: position.y,
    });
    setPosition(snapped);
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(snapped)); } catch {}
  }, [isDragging, position, clamp]);

  // Recalculate on resize
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
      <Popover>
        <PopoverTrigger asChild>
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
            {totalUnread > 0 && enabled && (
              <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-sm">
                {totalUnread > 99 ? "99+" : totalUnread}
              </span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent side="top" align="start" className="w-64 p-3">
          <div className="space-y-3">
            <p className="text-sm font-semibold text-foreground">Notificações WhatsApp</p>
            <div className="space-y-2.5">
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
            {totalUnread > 0 && (
              <p className="text-xs text-muted-foreground pt-1 border-t border-border/40">
                {totalUnread} mensage{totalUnread === 1 ? "m" : "ns"} não lida{totalUnread === 1 ? "" : "s"}
              </p>
            )}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
