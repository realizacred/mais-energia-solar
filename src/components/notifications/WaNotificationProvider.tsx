import { useEffect, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useWaNotifications } from "@/hooks/useWaNotifications";
import { WaNotificationPopup } from "./WaNotificationPopup";

/**
 * Global provider that shows WhatsApp notification popups and settings bell.
 * Mount once inside BrowserRouter + AuthProvider.
 * Suppresses popups when user is on the WhatsApp inbox page.
 */
export function WaNotificationProvider() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const {
    enabled,
    setEnabled,
    soundEnabled,
    setSoundEnabled,
    pendingNotifications,
    dismissNotification,
    dismissAll,
    totalUnread,
    unansweredConversations,
    setIsOnInbox,
  } = useWaNotifications();

  // Detect if user is on the inbox page
  // Admin inbox: /admin with tab=inbox (we check via a data attribute or URL hash)
  // We'll use a simpler heuristic: check if the WaInbox component is mounted
  // by looking at the URL path
  useEffect(() => {
    const isAdmin = location.pathname === "/admin";
    const isVendedor = location.pathname.startsWith("/consultor") || location.pathname.startsWith("/vendedor");
    // We can't easily detect the active tab from URL, so we'll use a global flag
    // that the inbox components set
    const onInbox = document.querySelector("[data-wa-inbox-active]") !== null;
    setIsOnInbox(onInbox);
  }, [location, setIsOnInbox, pendingNotifications]);

  // Listen for inbox mount/unmount via a MutationObserver
  useEffect(() => {
    const observer = new MutationObserver(() => {
      const onInbox = document.querySelector("[data-wa-inbox-active]") !== null;
      setIsOnInbox(onInbox);
    });
    observer.observe(document.body, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [setIsOnInbox]);

  const handleOpenConversation = useCallback(
    (conversationId: string) => {
      // Navigate to admin inbox
      // Store the conversation ID so inbox can auto-select it
      sessionStorage.setItem("wa_open_conversation", conversationId);
      navigate("/admin");
      // Small delay then set tab (admin will read from sessionStorage)
    },
    [navigate]
  );

  // Don't render for unauthenticated users
  if (!user) return null;

  return (
    <WaNotificationPopup
      notifications={pendingNotifications}
      totalUnread={totalUnread}
      unansweredConversations={unansweredConversations}
      enabled={enabled}
      soundEnabled={soundEnabled}
      onSetEnabled={setEnabled}
      onSetSoundEnabled={setSoundEnabled}
      onDismiss={dismissNotification}
      onDismissAll={dismissAll}
      onOpenConversation={handleOpenConversation}
    />
  );
}
