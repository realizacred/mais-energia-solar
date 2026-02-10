import { useState, useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";

const VAPID_PUBLIC_KEY = "BN7x20p9ZNjAb17M71fTYU6Myqo1eKkuiu2dsh0RKKtGlTU-UGvmOCzFPkQOlMgaFmNj6iZbdsPactDyeMWOvw8";

interface PushState {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
  isLoading: boolean;
}

export function useWebPushSubscription() {
  const { user } = useAuth();
  const [state, setState] = useState<PushState>({
    isSupported: false,
    permission: "unsupported",
    isSubscribed: false,
    isLoading: false,
  });
  const swRegistrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Check support and existing subscription on mount
  useEffect(() => {
    const check = async () => {
      const supported = "Notification" in window && "serviceWorker" in navigator && "PushManager" in window;
      if (!supported) return;

      try {
        // Register the push service worker
        const reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
        swRegistrationRef.current = reg;

        const permission = Notification.permission;
        let isSubscribed = false;

        if (permission === "granted") {
          const existingSub = await reg.pushManager.getSubscription();
          isSubscribed = !!existingSub;
        }

        setState({
          isSupported: true,
          permission,
          isSubscribed,
          isLoading: false,
        });
      } catch (e) {
        console.warn("[useWebPushSubscription] SW registration failed:", e);
        setState((prev) => ({ ...prev, isSupported: true, permission: Notification.permission }));
      }
    };

    check();
  }, []);

  // Listen for push notification click messages from SW
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "PUSH_NOTIFICATION_CLICK" && event.data?.conversationId) {
        // Store for inbox to pick up
        sessionStorage.setItem("wa_open_conversation", event.data.conversationId);
      }
    };
    navigator.serviceWorker?.addEventListener("message", handler);
    return () => navigator.serviceWorker?.removeEventListener("message", handler);
  }, []);

  // Subscribe to push notifications
  const subscribe = useCallback(async () => {
    if (!state.isSupported || !user) return false;

    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      // Request permission
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));

      if (permission !== "granted") {
        toast({
          title: "Permissão negada",
          description: "Ative nas configurações do navegador.",
          variant: "destructive",
        });
        return false;
      }

      // Get or register SW
      let reg = swRegistrationRef.current;
      if (!reg) {
        reg = await navigator.serviceWorker.register("/push-sw.js", { scope: "/" });
        swRegistrationRef.current = reg;
        // Wait for activation
        await navigator.serviceWorker.ready;
      }

      // Subscribe to push manager
      const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      const subJson = pushSub.toJSON();
      if (!subJson.endpoint || !subJson.keys?.p256dh || !subJson.keys?.auth) {
        throw new Error("Invalid subscription data");
      }

      // Register with backend
      const { error } = await supabase.functions.invoke("register-push-subscription", {
        body: {
          action: "subscribe",
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          userAgent: navigator.userAgent,
        },
      });

      if (error) throw error;

      setState((prev) => ({ ...prev, isSubscribed: true }));
      toast({
        title: "Notificações push ativadas! 🔔",
        description: "Você receberá alertas de novas mensagens.",
      });
      return true;
    } catch (e) {
      console.error("[useWebPushSubscription] Subscribe error:", e);
      toast({
        title: "Erro",
        description: "Não foi possível ativar push notifications.",
        variant: "destructive",
      });
      return false;
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, [state.isSupported, user]);

  // Unsubscribe
  const unsubscribe = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true }));

    try {
      const reg = swRegistrationRef.current || (await navigator.serviceWorker.getRegistration());
      if (reg) {
        const sub = await reg.pushManager.getSubscription();
        if (sub) {
          const endpoint = sub.endpoint;
          await sub.unsubscribe();
          await supabase.functions.invoke("register-push-subscription", {
            body: { action: "unsubscribe", endpoint },
          });
        }
      }

      setState((prev) => ({ ...prev, isSubscribed: false }));
      toast({
        title: "Push desativado",
        description: "Você não receberá mais alertas push.",
      });
    } catch (e) {
      console.error("[useWebPushSubscription] Unsubscribe error:", e);
    } finally {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  return {
    ...state,
    subscribe,
    unsubscribe,
  };
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  return Uint8Array.from([...rawData].map((char) => char.charCodeAt(0)));
}
