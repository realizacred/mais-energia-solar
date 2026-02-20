import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { WaInbox } from "@/components/admin/inbox/WaInbox";
import { supabase } from "@/integrations/supabase/client";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MessageCircle, Settings, Contact as ContactIcon, MessageCirclePlus, LogOut } from "lucide-react";

const PushNotificationSettings = lazy(() =>
  import("@/components/admin/PushNotificationSettings").then((m) => ({
    default: m.PushNotificationSettings,
  }))
);

const ContactsPage = lazy(() => import("@/pages/admin/ContactsPage"));

type Tab = "messages" | "contacts" | "settings";
import { WaStartConversationDialog } from "@/components/admin/inbox/WaStartConversationDialog";

/**
 * Dedicated standalone messaging PWA at /app.
 * Swaps the manifest to app-manifest.json for independent install.
 */
export default function MessagingApp() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("messages");
  const [initialConversationId, setInitialConversationId] = useState<string | null>(null);
  const [showNewChat, setShowNewChat] = useState(false);
  const [inboxKey, setInboxKey] = useState(0);

  // Read URL params once on mount (e.g. deep link /app?tab=messages&conversation=xxx)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get("tab");
    const convId = params.get("conversation");

    if (tab === "messages" || tab === "contacts" || tab === "settings") setActiveTab(tab);
    if (convId) setInitialConversationId(convId);

    if (tab || convId) {
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  // Callback for ContactsPage: switch to messages tab and open conversation
  const handleOpenConversation = useCallback((conversationId: string) => {
    // Append timestamp to force re-trigger even if same conversation ID
    setInitialConversationId(conversationId + ":" + Date.now());
    setActiveTab("messages");
  }, []);

  // Theme-color for messaging context
  useEffect(() => {
    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeMeta);
    }
    const original = themeMeta.getAttribute("content") || "#e8760d";
    themeMeta.setAttribute("content", "#16a34a");
    return () => {
      themeMeta?.setAttribute("content", original);
    };
  }, []);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth?from=app", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div className="h-[100dvh] flex flex-col bg-background w-full max-w-full overflow-x-hidden">
      {/* Main content */}
      <div className="flex-1 min-h-0 overflow-hidden relative">
        {activeTab === "messages" && (
          <WaInbox key={inboxKey} vendorMode vendorUserId={user.id} showCompactStats initialConversationId={initialConversationId} />
        )}
        {activeTab === "contacts" && (
          <Suspense fallback={<LoadingSpinner />}>
            <ContactsPage onOpenConversation={handleOpenConversation} />
          </Suspense>
        )}
        {activeTab === "settings" && (
          <div className="h-full overflow-y-auto">
            <div className="p-4 max-w-lg mx-auto space-y-6">
              <h1 className="text-xl font-bold text-foreground">Configurações</h1>
              <Suspense fallback={<LoadingSpinner />}>
                <PushNotificationSettings />
              </Suspense>
              <div className="border-t border-border/40 pt-4">
                <p className="text-xs text-muted-foreground mb-3">Conectado como <span className="font-medium text-foreground">{user.email}</span></p>
                <button
                  onClick={() => supabase.auth.signOut()}
                  className="w-full flex items-center justify-center gap-2 rounded-lg border border-destructive/30 bg-destructive/5 hover:bg-destructive/10 text-destructive py-2.5 text-sm font-medium transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  Sair da conta
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="shrink-0 border-t border-border/40 bg-card safe-area-bottom relative z-50" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex">
          {/* Mensagens */}
          <button
            onClick={() => {
              if (activeTab === "messages") {
                // Already on messages — reset to conversation list
                setInitialConversationId(null);
                setInboxKey((k) => k + 1);
              } else {
                setActiveTab("messages");
              }
            }}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors active:bg-muted/30 ${
              activeTab === "messages" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className={`h-5 w-5 ${activeTab === "messages" ? "fill-primary/20" : ""}`} />
            Mensagens
          </button>

          {/* Nova conversa — center action */}
          <button
            onClick={(e) => { e.stopPropagation(); setShowNewChat(true); }}
            className="flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium text-success hover:text-success/80 transition-colors active:bg-muted/30"
          >
            <div className="h-5 w-5 rounded-full bg-success/10 flex items-center justify-center">
              <MessageCirclePlus className="h-4 w-4" />
            </div>
            Nova
          </button>

          {/* Contatos */}
          <button
            onClick={() => setActiveTab("contacts")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors active:bg-muted/30 ${
              activeTab === "contacts" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <ContactIcon className={`h-5 w-5 ${activeTab === "contacts" ? "fill-primary/20" : ""}`} />
            Contatos
          </button>

          {/* Ajustes */}
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors active:bg-muted/30 ${
              activeTab === "settings" ? "text-primary" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className={`h-5 w-5 ${activeTab === "settings" ? "fill-primary/20" : ""}`} />
            Ajustes
          </button>
        </div>
      </nav>

      {/* New conversation dialog */}
      <WaStartConversationDialog
        open={showNewChat}
        onOpenChange={setShowNewChat}
        instances={[]}
        onConversationStarted={(convId) => {
          setShowNewChat(false);
          handleOpenConversation(convId);
        }}
      />
    </div>
  );
}
