import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { BrandSettingsProvider } from "@/components/BrandSettingsProvider";
import { SiteSettingsProvider } from "@/hooks/useSiteSettings";
import { WaNotificationProvider } from "@/components/notifications/WaNotificationProvider";

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
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Dados ficam "frescos" por 2 minutos — evita refetch desnecessário
      staleTime: 2 * 60 * 1000,
      // Cache mantido por 10 minutos após componente desmontar
      gcTime: 10 * 60 * 1000,
      // Não refaz query ao voltar à aba (reduz chamadas)
      refetchOnWindowFocus: false,
      // Retry com backoff para resiliência
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
    },
  },
});

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <BrandSettingsProvider>
      <SiteSettingsProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <WaNotificationProvider />
          <Suspense fallback={<LoadingSpinner />}>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="/v/:codigo" element={<VendorPage />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/portal" element={<PortalSelector />} />
              <Route path="/admin/*" element={<Admin />} />
              <Route path="/super-admin" element={<SuperAdmin />} />
              <Route path="/vendedor" element={<VendedorPortal />} />
              <Route path="/calculadora" element={<Calculadora />} />
              <Route path="/checklist" element={<Checklist />} />
              <Route path="/instalar" element={<Instalar />} />
              <Route path="/avaliacao" element={<Avaliacao />} />
              <Route path="/instalador" element={<Instalador />} />
              <Route path="/aguardando-aprovacao" element={<PendingApproval />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
      </SiteSettingsProvider>
      </BrandSettingsProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
