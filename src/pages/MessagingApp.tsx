import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { WaInbox } from "@/components/admin/inbox/WaInbox";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { MessageCircle, Settings } from "lucide-react";

const PushNotificationSettings = lazy(() =>
  import("@/components/admin/PushNotificationSettings").then((m) => ({
    default: m.PushNotificationSettings,
  }))
);

type Tab = "messages" | "settings";

/**
 * Dedicated standalone messaging PWA at /app.
 * Swaps the manifest to app-manifest.json for independent install.
 */
export default function MessagingApp() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>("messages");

  // Theme-color for messaging context (no manifest swap — single manifest strategy)
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

  // Auth guard — redirect to /auth with from=app so we come back here
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
          <WaInbox vendorMode vendorUserId={user.id} showCompactStats />
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
          <button
            onClick={() => setActiveTab("messages")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors active:bg-muted/30 ${
              activeTab === "messages"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <MessageCircle className={`h-5 w-5 ${activeTab === "messages" ? "fill-primary/20" : ""}`} />
            Mensagens
          </button>
          <button
            onClick={() => setActiveTab("settings")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors active:bg-muted/30 ${
              activeTab === "settings"
                ? "text-primary"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className={`h-5 w-5 ${activeTab === "settings" ? "fill-primary/20" : ""}`} />
            Configurações
          </button>
        </div>
      </nav>
    </div>
  );
}
