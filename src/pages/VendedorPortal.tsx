import { lazy, Suspense, useMemo, Component, type ReactNode, type ErrorInfo } from "react";
import { Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Menu } from "lucide-react";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { VendorSidebar } from "@/components/vendor/sidebar";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useVendedorPortal } from "@/hooks/useVendedorPortal";
import { VendorBottomNav } from "@/components/vendor/VendorBottomNav";
import { useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import { InstallAppBanner } from "@/components/vendor/InstallAppBanner";

// Error boundary to prevent VendorBottomNav crashes from killing the whole portal
class BottomNavErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[VendorBottomNav crash]", error, info);
  }
  render() { return this.state.hasError ? null : this.props.children; }
}

// Lazy load sub-pages
const VendorDashboardView = lazy(() => import("@/components/vendor/views/VendorDashboardView"));
const VendorWhatsAppView = lazy(() => import("@/components/vendor/views/VendorWhatsAppView"));
const VendorAgendaView = lazy(() => import("@/components/vendor/views/VendorAgendaView"));
const VendorOrcamentosView = lazy(() => import("@/components/vendor/views/VendorOrcamentosView"));
const VendorPropostasView = lazy(() => import("@/components/vendor/views/VendorPropostasView"));
const VendorGamificacaoView = lazy(() => import("@/components/vendor/views/VendorGamificacaoView"));
const VendorLinksView = lazy(() => import("@/components/vendor/views/VendorLinksView"));
const VendorNotificacoesView = lazy(() => import("@/components/vendor/views/VendorNotificacoesView"));
const VendorCreditoView = lazy(() => import("@/components/vendor/views/VendorCreditoView"));

export default function VendedorPortal() {
  const { user, loading: authLoading } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const asParam = searchParams.get("as");

  const portal = useVendedorPortal();

  const activeTab = useMemo(() => {
    const segments = location.pathname.replace(/^\/(consultor|vendedor)/, "").split("/").filter(Boolean);
    return segments[0] || "dashboard";
  }, [location.pathname]);

  // Build redirect path preserving ?as= param
  const dashboardRedirect = asParam ? `dashboard?as=${asParam}` : "dashboard";

  const badgeCounts = useMemo(() => {
    return { 
      orcamentos: portal.serverStats?.nao_vistos ?? 0,
      pendentes: portal.serverStats?.pendentes ?? 0
    };
  }, [portal.serverStats]);

  // Read WA unread count from existing react-query cache (populated by WaNotificationProvider)
  const queryClient = useQueryClient();
  const waUnreadCount = useMemo(() => {
    const data = queryClient.getQueryData<Array<{ unread_for_user: number }>>(
      ["wa-notification-poll", user?.id]
    );
    return data?.reduce((sum, c) => sum + c.unread_for_user, 0) ?? 0;
  }, [queryClient, user?.id, activeTab]); // re-check on tab change

  if (authLoading || portal.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingState message="Carregando portal..." size="lg" />
      </div>
    );
  }

  const isWhatsApp = activeTab === "whatsapp";

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full bg-muted/30">
        <VendorSidebar
          activeTab={activeTab}
          vendedorNome={portal.vendedor?.nome || ""}
          isAdminMode={portal.isAdminMode}
          isViewingAsVendedor={portal.isViewingAsVendedor}
          onSignOut={portal.handleSignOut}
          badgeCounts={badgeCounts}
        />

        <SidebarInset className="flex-1 min-w-0 w-full overflow-hidden">
          <InstallAppBanner vendedorNome={portal.vendedor?.nome} />
          <header className="page-header border-b border-border/50 bg-background/80 backdrop-blur-md sticky top-0 z-30">
            <div className="flex items-center h-14 px-4 sm:px-6">
              <SidebarTrigger className="-ml-1 h-9 w-9">
                <Menu className="h-5 w-5" />
              </SidebarTrigger>
            </div>
          </header>

          <main className="flex-1 relative min-h-[calc(100vh-3.5rem)]">
            {/* WhatsApp — always mounted, toggled via display for persistence */}
            <div
              style={{ display: isWhatsApp ? 'block' : 'none' }}
              className="absolute inset-0 p-3 sm:p-4 md:p-6 pb-20 md:pb-6 overflow-x-hidden"
            >
              <Suspense fallback={<LoadingSpinner />}>
                <VendorWhatsAppView portal={portal} />
              </Suspense>
            </div>

            <div 
              style={{ display: isWhatsApp ? 'none' : 'block' }}
              className="absolute inset-0 p-3 sm:p-4 md:p-6 pb-24 md:pb-6 space-y-4 sm:space-y-5 overflow-y-auto overflow-x-hidden animate-fade-in"
            >
              <Suspense fallback={<LoadingSpinner />}>
                <Routes>
                  <Route index element={<Navigate to={dashboardRedirect} replace />} />
                  <Route
                    path="dashboard"
                    element={<VendorDashboardView portal={portal} />}
                  />
                  <Route path="whatsapp" element={<div />} />
                  <Route
                    path="agenda"
                    element={<VendorAgendaView />}
                  />
                  <Route
                    path="orcamentos"
                    element={<VendorOrcamentosView portal={portal} />}
                  />
                  <Route
                    path="propostas"
                    element={<VendorPropostasView portal={portal} />}
                  />
                  <Route
                    path="gamificacao"
                    element={<VendorGamificacaoView portal={portal} />}
                  />
                  <Route
                    path="links"
                    element={<VendorLinksView portal={portal} />}
                  />
                  <Route
                    path="notificacoes"
                    element={<VendorNotificacoesView portal={portal} />}
                  />
                  <Route
                    path="credito"
                    element={<VendorCreditoView />}
                  />
                  <Route path="*" element={<Navigate to={dashboardRedirect} replace />} />
                </Routes>
              </Suspense>
            </div>
          </main>
        </SidebarInset>

        <BottomNavErrorBoundary>
          <VendorBottomNav
            unreadWhatsApp={waUnreadCount}
            badgeOrcamentos={badgeCounts.orcamentos}
          />
        </BottomNavErrorBoundary>
      </div>
    </SidebarProvider>
  );
}
