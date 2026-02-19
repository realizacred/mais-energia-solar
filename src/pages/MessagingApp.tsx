import { useEffect, useState, lazy, Suspense, useCallback } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { WaInbox } from "@/components/admin/inbox/WaInbox";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MessageCircle, Settings, Contact as ContactIcon } from "lucide-react";

const PushNotificationSettings = lazy(() =>
  import("@/components/admin/PushNotificationSettings").then((m) => ({
    default: m.PushNotificationSettings,
  }))
);

const ContactsPage = lazy(() => import("@/pages/admin/ContactsPage"));

type Tab = "messages" | "contacts" | "settings";

/**
 * Dedicated standalone messaging PWA at /app.
 * Swaps the manifest to app-manifest.json for independent install.
 */
export default function MessagingApp() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    const tab = searchParams.get("tab");
    return tab === "contacts" || tab === "settings" ? tab : "messages";
  });
  const [pendingConversationId, setPendingConversationId] = useState<string | null>(
    () => searchParams.get("conversation")
  );

  // When URL params change (e.g. from Contacts navigation), apply them
  useEffect(() => {
    const tab = searchParams.get("tab");
    const convId = searchParams.get("conversation");
    if (tab === "messages" && convId) {
      setActiveTab("messages");
      setPendingConversationId(convId);
      // Clean URL params after consuming
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams]);

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
      <div className="flex-1 min-h-0">
        {activeTab === "messages" && (
          <WaInbox vendorMode vendorUserId={user.id} showCompactStats initialConversationId={pendingConversationId} />
        )}
        {activeTab === "contacts" && (
          <Suspense fallback={<LoadingSpinner />}>
            <ContactsPage />
          </Suspense>
        )}
        {activeTab === "settings" && (
          <div className="h-full overflow-y-auto">
            <div className="p-4 max-w-lg mx-auto">
              <h1 className="text-xl font-bold text-foreground mb-4">Configurações</h1>
              <Suspense fallback={<LoadingSpinner />}>
                <PushNotificationSettings />
              </Suspense>
            </div>
          </div>
        )}
      </div>

      {/* Bottom navigation */}
      <nav className="shrink-0 border-t border-border/40 bg-card safe-area-bottom" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="flex">
          {([
            { key: "messages" as Tab, icon: MessageCircle, label: "Mensagens" },
            { key: "contacts" as Tab, icon: ContactIcon, label: "Contatos" },
            { key: "settings" as Tab, icon: Settings, label: "Ajustes" },
          ]).map(({ key, icon: Icon, label }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors active:bg-muted/30 ${
                activeTab === key
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`h-5 w-5 ${activeTab === key ? "fill-primary/20" : ""}`} />
              {label}
            </button>
          ))}
        </div>
      </nav>
    </div>
  );
}
