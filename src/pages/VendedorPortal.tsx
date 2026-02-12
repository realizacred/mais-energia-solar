import { lazy, Suspense, useState, useEffect, useMemo } from "react";
import { useNavigate, Routes, Route, Navigate, useLocation, useSearchParams } from "react-router-dom";
import { Menu, Sun } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { SidebarProvider, SidebarTrigger, SidebarInset } from "@/components/ui/sidebar";
import { VendorSidebar, VENDOR_TAB_TITLES } from "@/components/vendor/sidebar";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useVendedorPortal } from "@/hooks/useVendedorPortal";
import Footer from "@/components/layout/Footer";

// Lazy load sub-pages
const VendorDashboardView = lazy(() => import("@/components/vendor/views/VendorDashboardView"));
const VendorWhatsAppView = lazy(() => import("@/components/vendor/views/VendorWhatsAppView"));
const VendorAgendaView = lazy(() => import("@/components/vendor/views/VendorAgendaView"));
const VendorOrcamentosView = lazy(() => import("@/components/vendor/views/VendorOrcamentosView"));
const VendorGamificacaoView = lazy(() => import("@/components/vendor/views/VendorGamificacaoView"));
const VendorLinksView = lazy(() => import("@/components/vendor/views/VendorLinksView"));
const VendorNotificacoesView = lazy(() => import("@/components/vendor/views/VendorNotificacoesView"));

export default function VendedorPortal() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const asParam = searchParams.get("as");

  const portal = useVendedorPortal();

  const activeTab = useMemo(() => {
    const segments = location.pathname.replace("/vendedor", "").split("/").filter(Boolean);
    return segments[0] || "dashboard";
  }, [location.pathname]);

  // Build redirect path preserving ?as= param
  const dashboardRedirect = asParam ? `dashboard?as=${asParam}` : "dashboard";

  const badgeCounts = useMemo(() => {
    const unseenCount = portal.orcamentos.filter((o) => !o.visto).length;
    return { orcamentos: unseenCount };
  }, [portal.orcamentos]);

  if (authLoading || portal.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background gradient-mesh">
        <div className="flex flex-col items-center gap-4 animate-pulse-soft">
          <div className="p-4 rounded-2xl bg-primary/10">
            <Sun className="w-8 h-8 text-primary animate-spin-slow" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Carregando portal...</p>
        </div>
      </div>
    );
  }

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

        <SidebarInset className="flex-1 min-w-0">
          <header className="page-header">
            <SidebarTrigger className="-ml-1 sm:-ml-2 h-9 w-9 sm:h-10 sm:w-10">
              <Menu className="h-5 w-5" />
            </SidebarTrigger>
            <div className="h-5 w-px bg-border/50 hidden sm:block" />
            <div className="flex items-center gap-2 min-w-0 flex-1">
              <h1 className="page-header-title">
                {VENDOR_TAB_TITLES[activeTab] || activeTab}
              </h1>
            </div>
          </header>

          <main className="flex-1 p-4 md:p-6 space-y-5 overflow-x-hidden animate-fade-in">
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                <Route index element={<Navigate to={dashboardRedirect} replace />} />
                <Route
                  path="dashboard"
                  element={<VendorDashboardView portal={portal} />}
                />
                <Route
                  path="whatsapp"
                  element={<VendorWhatsAppView portal={portal} />}
                />
                <Route
                  path="agenda"
                  element={<VendorAgendaView />}
                />
                <Route
                  path="orcamentos"
                  element={<VendorOrcamentosView portal={portal} />}
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
                <Route path="*" element={<Navigate to={dashboardRedirect} replace />} />
              </Routes>
            </Suspense>
          </main>

          <Footer />
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}
