import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

interface NotificationPermissionState {
  isSupported: boolean;
  permission: NotificationPermission | "unsupported";
  isSubscribed: boolean;
}

export function usePushNotifications() {
  const [state, setState] = useState<NotificationPermissionState>({
    isSupported: false,
    permission: "unsupported",
    isSubscribed: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  // Check if notifications are supported
  useEffect(() => {
    const isSupported = "Notification" in window && "serviceWorker" in navigator;
    
    if (isSupported) {
      setState((prev) => ({
        ...prev,
        isSupported: true,
        permission: Notification.permission,
      }));
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) {
      toast({
        title: "Não suportado",
        description: "Seu navegador não suporta notificações push.",
        variant: "destructive",
      });
      return false;
    }

    setIsLoading(true);
    
    try {
      const permission = await Notification.requestPermission();
      
      setState((prev) => ({
        ...prev,
        permission,
        isSubscribed: permission === "granted",
      }));

      if (permission === "granted") {
        toast({
          title: "Notificações ativadas! 🔔",
          description: "Você receberá alertas de novos orçamentos.",
        });
        
        // Store permission in localStorage for persistence
        localStorage.setItem("push_notifications_enabled", "true");
        
        return true;
      } else if (permission === "denied") {
        toast({
          title: "Permissão negada",
          description: "As notificações foram bloqueadas. Você pode ativá-las nas configurações do navegador.",
          variant: "destructive",
        });
      }
      
      return false;
    } catch (error) {
      console.error("Error requesting notification permission:", error);
      toast({
        title: "Erro",
        description: "Não foi possível ativar as notificações.",
        variant: "destructive",
      });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [state.isSupported]);

  // Send a local notification
  const sendNotification = useCallback((title: string, options?: NotificationOptions) => {
    if (!state.isSupported || state.permission !== "granted") {
      console.log("Notifications not available or not granted");
      return;
    }

    try {
      const notification = new Notification(title, {
        icon: "/pwa-icon-192.png",
        badge: "/pwa-icon-192.png",
        tag: "orcamento-notification",
        ...options,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
        // Navigate to vendedor portal if clicked
        if (options?.data?.url) {
          window.location.href = options.data.url;
        }
      };
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }, [state.isSupported, state.permission]);

  // Subscribe to realtime orcamentos updates
  const subscribeToOrcamentos = useCallback((vendedorNome: string) => {
    if (!state.isSupported || state.permission !== "granted") {
      return null;
    }

    const channel = supabase
      .channel("orcamentos-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orcamentos",
          filter: `vendedor=eq.${vendedorNome}`,
        },
        (payload) => {
          const orcamento = payload.new;
          sendNotification("Novo Orçamento! 📋", {
            body: `Orçamento ${orcamento.orc_code || ""} recebido - ${orcamento.cidade}/${orcamento.estado}`,
            data: { url: "/vendedor?tab=orcamentos" },
          });
        }
      )
      .subscribe();

    return channel;
  }, [state.isSupported, state.permission, sendNotification]);

  // Subscribe to realtime leads updates
  const subscribeToLeads = useCallback((vendedorNome: string) => {
    if (!state.isSupported || state.permission !== "granted") {
      return null;
    }

    const channel = supabase
      .channel("leads-notifications")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "leads",
          filter: `vendedor=eq.${vendedorNome}`,
        },
        (payload) => {
          const lead = payload.new;
          sendNotification("Novo Lead! 🎯", {
            body: `${lead.nome} - ${lead.cidade}/${lead.estado}`,
            data: { url: "/vendedor?tab=leads" },
          });
        }
      )
      .subscribe();

    return channel;
  }, [state.isSupported, state.permission, sendNotification]);

  // Disable notifications
  const disableNotifications = useCallback(() => {
    localStorage.removeItem("push_notifications_enabled");
    setState((prev) => ({
      ...prev,
      isSubscribed: false,
    }));
    toast({
      title: "Notificações desativadas",
      description: "Você não receberá mais alertas push.",
    });
  }, []);

  // Check stored preference on mount
  useEffect(() => {
    const storedPreference = localStorage.getItem("push_notifications_enabled");
    if (storedPreference === "true" && state.permission === "granted") {
      setState((prev) => ({ ...prev, isSubscribed: true }));
    }
  }, [state.permission]);

  return {
    ...state,
    isLoading,
    requestPermission,
    sendNotification,
    subscribeToOrcamentos,
    subscribeToLeads,
    disableNotifications,
  };
}
