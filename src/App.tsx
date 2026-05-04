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
import { TenantGuardGate } from "@/components/guards/TenantGuardGate";
import { DevToolsProvider } from "@/contexts/DevToolsContext";
import { DevToolsOverlay } from "@/components/dev/DevToolsOverlay";
import { RealtimeHeartbeatProvider } from "@/components/providers/RealtimeHeartbeatProvider";
import { PublicErrorBoundary } from "@/components/proposal-landing/PublicErrorBoundary";

// Lazy load all page components for code splitting
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
      staleTime: 2 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      refetchOnWindowFocus: false,
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
          <PWAReturnRedirect />
          <PWAAutoInstallPrompt />
          <RealtimeHeartbeatProvider />
          <WaNotificationProvider />
          <PushActivationBanner />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              {/* Public routes — no tenant guard */}
              <Route path="/" element={<Index />} />
              <Route path="/v/:codigo" element={<VendorPage />} />
              <Route path="/w/:slug" element={<WaChannelPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/calculadora" element={<Calculadora />} />
              <Route path="/checklist" element={<Checklist />} />
              <Route path="/instalar" element={<Instalar />} />
              <Route path="/avaliacao" element={<Avaliacao />} />
              <Route path="/ativar-conta" element={<AtivarConta />} />
              <Route path="/aguardando-aprovacao" element={<PendingApproval />} />
              <Route path="/proposta/:token" element={<PublicErrorBoundary><PropostaPublica /></PublicErrorBoundary>} />
              <Route path="/pl/:token" element={<PublicErrorBoundary><PropostaLanding /></PublicErrorBoundary>} />
              <Route path="/kits/:token" element={<KitsLanding />} />
              <Route path="/oauth/google/callback" element={<OAuthGoogleCallback />} />
              <Route path="/oauth/google-contacts/callback" element={<GoogleContactsCallbackPage />} />
              <Route path="/politica-de-privacidade" element={<PoliticaPrivacidade />} />
              <Route path="/uc/login" element={<UCLogin />} />
              <Route path="/uc/:token" element={<UCPublica />} />

              {/* Protected routes — tenant guard active */}
              <Route path="/portal" element={<TenantGuardGate><PortalSelector /></TenantGuardGate>} />
              <Route path="/admin/*" element={<TenantGuardGate><Admin /></TenantGuardGate>} />
              {/* Aliases funcionais — renderizam o mesmo Admin shell. /admin/* permanece canônico.
                  Permite URLs por área (Comercial / Comunicação / Energia / Automações / Operações /
                  Financeiro / Configurações / Integrações) sem alterar permissões, navRegistry ou backend. */}
              <Route path="/comercial/*" element={<TenantGuardGate><Admin /></TenantGuardGate>} />
              <Route path="/comunicacao/*" element={<TenantGuardGate><Admin /></TenantGuardGate>} />
              <Route path="/energia/*" element={<TenantGuardGate><Admin /></TenantGuardGate>} />
              <Route path="/automacoes/*" element={<TenantGuardGate><Admin /></TenantGuardGate>} />
              <Route path="/operacoes/*" element={<TenantGuardGate><Admin /></TenantGuardGate>} />
              <Route path="/financeiro/*" element={<TenantGuardGate><Admin /></TenantGuardGate>} />
              <Route path="/configuracoes/*" element={<TenantGuardGate><Admin /></TenantGuardGate>} />
              <Route path="/integracoes/*" element={<TenantGuardGate><Admin /></TenantGuardGate>} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              <Route path="/consultor/*" element={<TenantGuardGate><VendedorPortal /></TenantGuardGate>} />
              <Route path="/vendedor/*" element={<TenantGuardGate><VendedorPortal /></TenantGuardGate>} />
              <Route path="/instalador" element={<TenantGuardGate><Instalador /></TenantGuardGate>} />
              <Route path="/inbox" element={<TenantGuardGate><Inbox /></TenantGuardGate>} />
              <Route path="/app" element={<TenantGuardGate><MessagingApp /></TenantGuardGate>} />
              <Route path="/app/debug" element={<TenantGuardGate><AppDebug /></TenantGuardGate>} />
              <Route path="/sistema" element={<TenantGuardGate><Sistema /></TenantGuardGate>} />
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
