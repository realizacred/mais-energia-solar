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

  // Swap manifest link to the dedicated messaging manifest
  useEffect(() => {
    const existing = document.querySelector('link[rel="manifest"]');
    const originalHref = existing?.getAttribute("href") || "";

    if (existing) {
      existing.setAttribute("href", "/app-manifest.json");
    } else {
      const link = document.createElement("link");
      link.rel = "manifest";
      link.href = "/app-manifest.json";
      document.head.appendChild(link);
    }

    // Update theme-color meta
    let themeMeta = document.querySelector('meta[name="theme-color"]');
    if (!themeMeta) {
      themeMeta = document.createElement("meta");
      themeMeta.setAttribute("name", "theme-color");
      document.head.appendChild(themeMeta);
    }
    themeMeta.setAttribute("content", "#16a34a");

    return () => {
      // Restore original manifest when leaving /app
      const el = document.querySelector('link[rel="manifest"]');
      if (el && originalHref) el.setAttribute("href", originalHref);
    };
  }, []);

  // Auth guard
  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      {/* Main content */}
      <div className="flex-1 min-h-0">
        {activeTab === "messages" && (
          <WaInbox vendorMode vendorUserId={user.id} />
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
      <nav className="shrink-0 border-t border-border/40 bg-card/95 backdrop-blur-sm safe-area-bottom">
        <div className="flex">
          <button
            onClick={() => setActiveTab("messages")}
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
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
            className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs font-medium transition-colors ${
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
