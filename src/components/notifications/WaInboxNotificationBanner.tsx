import { useEffect, useMemo, useState } from "react";
import { Bell, BellOff, Smartphone, X, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebPushSubscription } from "@/hooks/useWebPushSubscription";

const IOS_DISMISS_KEY = "wa_ios_pwa_dismissed_at";
const DISMISS_DAYS = 7;

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  // iPad on iOS 13+ reports as Mac with touch
  const iPadOS = /Macintosh/i.test(ua) && "ontouchend" in document;
  return /iPhone|iPad|iPod/i.test(ua) || iPadOS;
}

function isStandalonePWA(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as any).standalone === true
  );
}

/**
 * Inline activation banner for the WhatsApp Inbox.
 * - Prompts for notification permission if not granted
 * - Auto-subscribes when permission is granted but not subscribed
 * - Shows iOS "install PWA" hint when relevant
 * - Compact status pill (🔴/🟡/🟢) when everything is configured
 */
export function WaInboxNotificationBanner() {
  const { isSupported, permission, isSubscribed, isLoading, isReady, subscribe } =
    useWebPushSubscription();

  const ios = useMemo(() => isIOS(), []);
  const standalone = useMemo(() => isStandalonePWA(), []);
  const [iosDismissed, setIosDismissed] = useState(true);

  // Auto-subscribe when permission granted but no subscription yet
  useEffect(() => {
    if (!isReady || !isSupported) return;
    if (permission === "granted" && !isSubscribed && !isLoading) {
      subscribe();
    }
  }, [isReady, isSupported, permission, isSubscribed, isLoading, subscribe]);

  // iOS dismiss state
  useEffect(() => {
    if (!ios || standalone) return;
    const raw = localStorage.getItem(IOS_DISMISS_KEY);
    if (raw) {
      const days = (Date.now() - parseInt(raw, 10)) / (1000 * 60 * 60 * 24);
      if (days < DISMISS_DAYS) {
        setIosDismissed(true);
        return;
      }
    }
    setIosDismissed(false);
  }, [ios, standalone]);

  // iOS, not installed → show install hint
  if (ios && !standalone && !iosDismissed) {
    return (
      <div className="shrink-0 mb-2 flex items-start gap-3 px-4 py-3 rounded-lg border border-warning/30 bg-warning/10 text-sm">
        <Smartphone className="h-4 w-4 shrink-0 text-warning mt-0.5" />
        <div className="flex-1 min-w-0">
          <p className="font-medium text-warning-foreground">
            Receba notificações no iPhone
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Toque em <span className="font-semibold">Compartilhar</span> →{" "}
            <span className="font-semibold">Adicionar à Tela de Início</span> para
            receber sons e alertas como o WhatsApp.
          </p>
        </div>
        <button
          onClick={() => {
            localStorage.setItem(IOS_DISMISS_KEY, Date.now().toString());
            setIosDismissed(true);
          }}
          aria-label="Fechar"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    );
  }

  if (!isReady || !isSupported) return null;

  // Permission denied → red status, instruction
  if (permission === "denied") {
    return (
      <div className="shrink-0 mb-2 flex items-center gap-3 px-4 py-2 rounded-lg border border-destructive/30 bg-destructive/10 text-sm">
        <BellOff className="h-4 w-4 shrink-0 text-destructive" />
        <span className="flex-1 text-destructive">
          Notificações bloqueadas. Ative nas configurações do navegador para
          receber alertas de novas mensagens.
        </span>
        <span className="text-xs font-medium text-destructive">🔴</span>
      </div>
    );
  }

  // Not granted yet → activation CTA (yellow)
  if (permission !== "granted") {
    return (
      <div className="shrink-0 mb-2 flex items-center gap-3 px-4 py-2 rounded-lg border border-warning/30 bg-warning/10 text-sm">
        <Bell className="h-4 w-4 shrink-0 text-warning" />
        <span className="flex-1 text-warning-foreground">
          Ative as notificações para receber sons e alertas de novas mensagens.
        </span>
        <Button size="sm" onClick={subscribe} disabled={isLoading} className="h-7 text-xs">
          {isLoading ? "Ativando..." : "Ativar notificações"}
        </Button>
        <span className="text-xs">🟡</span>
      </div>
    );
  }

  // Granted but not yet subscribed (auto-subscribe in flight) → yellow
  if (!isSubscribed) {
    return (
      <div className="shrink-0 mb-2 flex items-center gap-3 px-4 py-2 rounded-lg border border-warning/20 bg-warning/5 text-xs">
        <Bell className="h-3.5 w-3.5 shrink-0 text-warning animate-pulse" />
        <span className="flex-1 text-muted-foreground">
          Configurando notificações push...
        </span>
        <span>🟡</span>
      </div>
    );
  }

  // Fully active → small green confirmation (auto-fades into UI)
  return (
    <div className="shrink-0 mb-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-success/10 border border-success/20 text-xs text-success w-fit">
      <CheckCircle2 className="h-3 w-3" />
      <span>Notificações ativas</span>
      <span>🟢</span>
    </div>
  );
}
