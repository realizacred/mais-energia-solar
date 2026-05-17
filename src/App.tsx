import { Suspense, lazy, useEffect } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { BrandSettingsProvider } from "@/components/BrandSettingsProvider";
import { SiteSettingsProvider } from "@/hooks/useSiteSettings";
import { WaNotificationProvider } from "@/components/notifications/WaNotificationProvider";
import { PushActivationBanner } from "@/components/notifications/PushActivationBanner";
import { consumePWAReturnUrl } from "@/hooks/usePWAInstall";
import { PWAAutoInstallPrompt } from "@/components/pwa/PWAAutoInstallPrompt";
import { PWARouteManifestUpdater } from "@/components/pwa/PWARouteManifestUpdater";
import { TenantGuardGate } from "@/components/guards/TenantGuardGate";
import { DevToolsProvider } from "@/contexts/DevToolsContext";
import { DevToolsOverlay } from "@/components/dev/DevToolsOverlay";
import { RealtimeHeartbeatProvider } from "@/components/providers/RealtimeHeartbeatProvider";
import { PublicErrorBoundary } from "@/components/proposal-landing/PublicErrorBoundary";
import { PublicLeadShell, InternalAppShell, ConsultantFieldShell } from "@/components/layout/AppShells";

const Index = lazy(() => import("./pages/Index"));
const Auth = lazy(() => import("./pages/Auth"));
const Admin = lazy(() => import("./pages/Admin"));
const Calculadora = lazy(() => import("./pages/Calculadora"));
const Checklist = lazy(() => import("./pages/Checklist"));
const VendedorPortal = lazy(() => import("./pages/VendedorPortal"));
const VendorPage = lazy(() => import("./pages/VendorPage"));
const PortalSelector = lazy(() => import("./pages/PortalSelector"));
const Instalar = lazy(() => import("./pages/Instalar"));
const Avaliacao = lazy(() => import("./pages/Avaliacao"));
const Instalador = lazy(() => import("./pages/Instalador"));
const PendingApproval = lazy(() => import("./pages/PendingApproval"));
const SuperAdmin = lazy(() => import("./pages/SuperAdmin"));
const AtivarConta = lazy(() => import("./pages/AtivarConta"));
const PropostaPublica = lazy(() => import("./pages/PropostaPublica"));
const PropostaLanding = lazy(() => import("./pages/PropostaLanding"));
const KitsLanding = lazy(() => import("./pages/KitsLanding"));
const PoliticaPrivacidade = lazy(() => import("./pages/PoliticaPrivacidade"));
const NotFound = lazy(() => import("./pages/NotFound"));
const UCPublica = lazy(() => import("./pages/UCPublica"));
const UCLogin = lazy(() => import("./pages/UCLogin"));
const WaChannelPage = lazy(() => import("./pages/WaChannelPage"));
const Inbox = lazy(() => import("./pages/Inbox"));
const MessagingApp = lazy(() => import("./pages/MessagingApp"));
const AppDebug = lazy(() => import("./pages/AppDebug"));
const Sistema = lazy(() => import("./pages/Sistema"));
const PWADebugPage = lazy(() => import("./pages/PWADebugPage"));
const OAuthGoogleCallback = lazy(() => import("./pages/OAuthGoogleCallback"));
const GoogleContactsCallbackPage = lazy(() => import("./pages/admin/GoogleContactsCallbackPage"));
const IntegrationsSandbox = lazy(() => import("./dev/IntegrationsSandboxRoute"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

/** Redirects to saved vendor page when PWA opens for the first time after install */
function PWAReturnRedirect() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const isStandalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as any).standalone === true;

    if (isStandalone && location.pathname === "/") {
      const returnUrl = consumePWAReturnUrl();
      navigate(returnUrl || "/app", { replace: true });
    }
  }, [navigate, location.pathname]);

  return null;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <DevToolsProvider>
      <BrandSettingsProvider>
      <SiteSettingsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PWARouteManifestUpdater />
          <PWAReturnRedirect />
          <PWAAutoInstallPrompt />
          <RealtimeHeartbeatProvider />
          <WaNotificationProvider />
          <PushActivationBanner />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* Public routes — no tenant guard — wrapped in PublicLeadShell */}
              <Route path="/" element={<PublicLeadShell><Index /></PublicLeadShell>} />
              <Route path="/v/:codigo" element={<PublicLeadShell><VendorPage /></PublicLeadShell>} />
              <Route path="/w/:slug" element={<PublicLeadShell><WaChannelPage /></PublicLeadShell>} />
              <Route path="/auth" element={<PublicLeadShell><Auth /></PublicLeadShell>} />
              <Route path="/calculadora" element={<PublicLeadShell><Calculadora /></PublicLeadShell>} />
              <Route path="/checklist" element={<PublicLeadShell><Checklist /></PublicLeadShell>} />
              <Route path="/instalar" element={<PublicLeadShell><Instalar /></PublicLeadShell>} />
              <Route path="/avaliacao" element={<PublicLeadShell><Avaliacao /></PublicLeadShell>} />
              <Route path="/ativar-conta" element={<PublicLeadShell><AtivarConta /></PublicLeadShell>} />
              <Route path="/aguardando-aprovacao" element={<PublicLeadShell><PendingApproval /></PublicLeadShell>} />
              <Route path="/proposta/:token" element={<PublicLeadShell><PublicErrorBoundary><PropostaPublica /></PublicErrorBoundary></PublicLeadShell>} />
              <Route path="/pl/:token" element={<PublicLeadShell><PublicErrorBoundary><PropostaLanding /></PublicErrorBoundary></PublicLeadShell>} />
              <Route path="/kits/:token" element={<PublicLeadShell><KitsLanding /></PublicLeadShell>} />
              <Route path="/oauth/google/callback" element={<PublicLeadShell><OAuthGoogleCallback /></PublicLeadShell>} />
              <Route path="/oauth/google-contacts/callback" element={<PublicLeadShell><GoogleContactsCallbackPage /></PublicLeadShell>} />
              <Route path="/politica-de-privacidade" element={<PublicLeadShell><PoliticaPrivacidade /></PublicLeadShell>} />
              <Route path="/uc/login" element={<PublicLeadShell><UCLogin /></PublicLeadShell>} />
              <Route path="/uc/:token" element={<PublicLeadShell><UCPublica /></PublicLeadShell>} />


              <Route path="/portal" element={<InternalAppShell><TenantGuardGate><PortalSelector /></TenantGuardGate></InternalAppShell>} />
              <Route path="/admin/*" element={<InternalAppShell><TenantGuardGate><Admin /></TenantGuardGate></InternalAppShell>} />
              {/* Aliases funcionais — renderizam o mesmo Admin shell. /admin/* permanece canônico.
                  Permite URLs por área (Comercial / Comunicação / Energia / Automações / Operações /
                  Financeiro / Configurações / Integrações) sem alterar permissões, navRegistry ou backend. */}
              <Route path="/comercial/*" element={<InternalAppShell><TenantGuardGate><Admin /></TenantGuardGate></InternalAppShell>} />
              <Route path="/comunicacao/*" element={<InternalAppShell><TenantGuardGate><Admin /></TenantGuardGate></InternalAppShell>} />
              <Route path="/energia/*" element={<InternalAppShell><TenantGuardGate><Admin /></TenantGuardGate></InternalAppShell>} />
              <Route path="/automacoes/*" element={<InternalAppShell><TenantGuardGate><Admin /></TenantGuardGate></InternalAppShell>} />
              <Route path="/operacoes/*" element={<InternalAppShell><TenantGuardGate><Admin /></TenantGuardGate></InternalAppShell>} />
              <Route path="/financeiro/*" element={<InternalAppShell><TenantGuardGate><Admin /></TenantGuardGate></InternalAppShell>} />
              <Route path="/configuracoes/*" element={<InternalAppShell><TenantGuardGate><Admin /></TenantGuardGate></InternalAppShell>} />
              <Route path="/integracoes/*" element={<InternalAppShell><TenantGuardGate><Admin /></TenantGuardGate></InternalAppShell>} />
              <Route path="/super-admin/*" element={<InternalAppShell><SuperAdmin /></InternalAppShell>} />
              <Route path="/consultor/*" element={<ConsultantFieldShell><TenantGuardGate><VendedorPortal /></TenantGuardGate></ConsultantFieldShell>} />
              <Route path="/vendedor/*" element={<ConsultantFieldShell><TenantGuardGate><VendedorPortal /></TenantGuardGate></ConsultantFieldShell>} />
              <Route path="/instalador" element={<ConsultantFieldShell><TenantGuardGate><Instalador /></TenantGuardGate></ConsultantFieldShell>} />
              <Route path="/inbox" element={<InternalAppShell><TenantGuardGate><Inbox /></TenantGuardGate></InternalAppShell>} />
              <Route path="/app" element={<InternalAppShell><TenantGuardGate><MessagingApp /></TenantGuardGate></InternalAppShell>} />
              <Route path="/app/debug" element={<InternalAppShell><TenantGuardGate><AppDebug /></TenantGuardGate></InternalAppShell>} />
              <Route path="/sistema" element={<InternalAppShell><TenantGuardGate><Sistema /></TenantGuardGate></InternalAppShell>} />
              <Route path="/pwa-debug" element={<PWADebugPage />} />


              {/* DEV-only sandbox (stripped in prod build) */}
              {import.meta.env.DEV && (
                <Route path="/__dev__/integrations" element={<IntegrationsSandbox />} />
              )}

              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
        <DevToolsOverlay />
      </TooltipProvider>
      </SiteSettingsProvider>
      </BrandSettingsProvider>
      </DevToolsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
