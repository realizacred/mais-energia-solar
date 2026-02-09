import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { MessageCircle, X, ExternalLink, Volume2, VolumeX, BellOff, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import type { WaNewMessage } from "@/hooks/useWaNotifications";

interface WaNotificationPopupProps {
  notifications: WaNewMessage[];
  totalUnread: number;
  enabled: boolean;
  soundEnabled: boolean;
  onSetEnabled: (val: boolean) => void;
  onSetSoundEnabled: (val: boolean) => void;
  onDismiss: (conversationId: string) => void;
  onDismissAll: () => void;
  onOpenConversation?: (conversationId: string) => void;
}

export function WaNotificationPopup({
  notifications,
  totalUnread,
  enabled,
  soundEnabled,
  onSetEnabled,
  onSetSoundEnabled,
  onDismiss,
  onDismissAll,
  onOpenConversation,
}: WaNotificationPopupProps) {
  // Auto-dismiss after 8 seconds
  useEffect(() => {
    if (notifications.length === 0) return;
    const timers = notifications.map((n) =>
      setTimeout(() => onDismiss(n.conversationId), 8000)
    );
    return () => timers.forEach(clearTimeout);
  }, [notifications, onDismiss]);

  return (
    <>
      {/* ── Floating notification toasts ─────────────── */}
      <div className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        <AnimatePresence mode="popLayout">
          {notifications.slice(0, 3).map((n) => (
            <motion.div
              key={n.conversationId}
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, x: 80, scale: 0.9 }}
              transition={{ type: "spring", stiffness: 400, damping: 30 }}
              className="pointer-events-auto"
            >
              <div className="bg-card border border-border/60 rounded-xl shadow-lg p-3 flex items-start gap-3">
                <div className="shrink-0 w-9 h-9 rounded-full bg-success/15 flex items-center justify-center">
                  <MessageCircle className="h-4.5 w-4.5 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">
                    {n.clienteNome || n.clienteTelefone}
                  </p>
                  <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                    {n.preview || "Nova mensagem recebida"}
                  </p>
                </div>
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <button
                    onClick={() => onDismiss(n.conversationId)}
                    className="p-1 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                  {onOpenConversation && (
                    <button
                      onClick={() => {
                        onOpenConversation(n.conversationId);
                        onDismiss(n.conversationId);
                      }}
                      className="p-1 rounded-md hover:bg-primary/10 text-primary transition-colors"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {notifications.length > 3 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="pointer-events-auto text-center"
          >
            <button
              onClick={onDismissAll}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors bg-card/80 backdrop-blur-sm border border-border/40 rounded-lg px-3 py-1.5 shadow-sm"
            >
              +{notifications.length - 3} mais · Fechar todas
            </button>
          </motion.div>
        )}
      </div>

      {/* ── Floating bell button with settings ────────── */}
      <div className="fixed bottom-4 left-4 z-[99]">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              size="icon"
              variant="outline"
              className="h-11 w-11 rounded-full shadow-lg border-border/60 bg-card hover:bg-muted relative"
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
              <p className="text-sm font-semibold text-foreground">
                Notificações WhatsApp
              </p>

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
                    {soundEnabled ? (
                      <Volume2 className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <VolumeX className="h-4 w-4 text-muted-foreground" />
                    )}
                    Som
                  </label>
                  <Switch
                    checked={soundEnabled}
                    onCheckedChange={onSetSoundEnabled}
                    disabled={!enabled}
                  />
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
    </>
  );
}
