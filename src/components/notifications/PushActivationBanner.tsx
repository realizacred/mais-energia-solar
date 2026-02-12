import { useState, useEffect } from "react";
import { Bell, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWebPushSubscription } from "@/hooks/useWebPushSubscription";
import { useAuth } from "@/hooks/useAuth";

const DISMISS_KEY = "push_activation_dismissed_at";
const DISMISS_DAYS = 7;

/**
 * A floating banner that prompts users to activate push notifications
 * if they haven't done so. Dismissable for 7 days.
 */
export function PushActivationBanner() {
  const { user } = useAuth();
  const { isSupported, permission, isSubscribed, isLoading, isReady, subscribe } =
    useWebPushSubscription();
  const [dismissed, setDismissed] = useState(true); // start hidden

  useEffect(() => {
    // Wait until the hook has finished its async check
    if (!user || !isReady || !isSupported) return;

    // Already subscribed, permission granted, or denied — don't show
    if (isSubscribed || permission === "granted" || permission === "denied") {
      setDismissed(true);
      return;
    }

    // Check dismiss timestamp
    const raw = localStorage.getItem(DISMISS_KEY);
    if (raw) {
      const dismissedAt = parseInt(raw, 10);
      const daysSince = (Date.now() - dismissedAt) / (1000 * 60 * 60 * 24);
      if (daysSince < DISMISS_DAYS) {
        setDismissed(true);
        return;
      }
    }

    setDismissed(false);
  }, [user, isReady, isSupported, isSubscribed, permission]);

  const handleDismiss = () => {
    localStorage.setItem(DISMISS_KEY, Date.now().toString());
    setDismissed(true);
  };

  const handleActivate = async () => {
    const ok = await subscribe();
    if (ok) {
      setDismissed(true);
      // Clear dismiss key so it doesn't interfere later
      localStorage.removeItem(DISMISS_KEY);
    }
  };

  if (dismissed || !user) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm animate-in slide-in-from-bottom-4 fade-in duration-300">
      <div className="bg-card border border-border rounded-lg shadow-lg p-4 flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
            <Bell className="h-5 w-5 text-primary" />
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">
            Ative as notificações push 🔔
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Receba alertas de novos leads, orçamentos e mensagens mesmo com o
            navegador fechado.
          </p>
          <div className="flex items-center gap-2 mt-3">
            <Button
              size="sm"
              onClick={handleActivate}
              disabled={isLoading}
              className="h-8 text-xs"
            >
              {isLoading ? "Ativando..." : "Ativar agora"}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleDismiss}
              className="h-8 text-xs text-muted-foreground"
            >
              Depois
            </Button>
          </div>
        </div>

        <button
          onClick={handleDismiss}
          className="flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          aria-label="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
