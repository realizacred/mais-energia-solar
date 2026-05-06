/**
 * SuperAdmin — Entry point do módulo. Apenas roteamento interno.
 * Toda lógica de guard e shell está em SuperAdminLayout.
 * Páginas em src/pages/super-admin/.
 */
import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import {
  CreditCard,
  Package,
  Briefcase,
  Webhook,
  History,
  Activity,
} from "lucide-react";
import { LoadingState } from "@/components/ui-kit";
import { SuperAdminLayout } from "@/components/super-admin/SuperAdminLayout";
import { SuperAdminPlaceholderPage } from "./super-admin/SuperAdminPlaceholderPage";

const OverviewPage = lazy(() => import("./super-admin/SuperAdminOverviewPage"));
const TenantsPage = lazy(() => import("./super-admin/SuperAdminTenantsPage"));
const TenantDetailPage = lazy(() => import("./super-admin/SuperAdminTenantDetailPage"));
const BillingPage = lazy(() => import("./super-admin/SuperAdminBillingPage"));
const WebhooksPage = lazy(() => import("./super-admin/SuperAdminWebhooksPage"));
const HealthPage = lazy(() => import("./super-admin/SuperAdminHealthPage"));

function PageFallback() {
  return <LoadingState message="Carregando..." />;
}

export default function SuperAdmin() {
  return (
    <Routes>
      <Route element={<SuperAdminLayout />}>
        <Route
          index
          element={
            <Suspense fallback={<PageFallback />}>
              <OverviewPage />
            </Suspense>
          }
        />
        <Route
          path="tenants"
          element={
            <Suspense fallback={<PageFallback />}>
              <TenantsPage />
            </Suspense>
          }
        />
        <Route
          path="tenants/:tenantId"
          element={
            <Suspense fallback={<PageFallback />}>
              <TenantDetailPage />
            </Suspense>
          }
        />
        <Route
          path="billing"
          element={
            <Suspense fallback={<PageFallback />}>
              <BillingPage />
            </Suspense>
          }
        />
        <Route
          path="plans"
          element={
            <SuperAdminPlaceholderPage
              icon={Package}
              title="Planos & Features"
              description="Catálogo de planos, features e limites"
              phase="PR-3"
              scope={[
                "Catálogo de plans (preços, ciclos)",
                "plan_features por plano",
                "plan_limits por plano",
                "Sincronização com Asaas",
              ]}
            />
          }
        />
        <Route
          path="jobs"
          element={
            <SuperAdminPlaceholderPage
              icon={Briefcase}
              title="Jobs & Crons"
              description="Monitoramento de cron jobs, filas e dead-letters"
              phase="PR-4"
              scope={[
                "Lista de pg_cron jobs e última execução",
                "Filas (wa_outbox, processamentos)",
                "Dead-letter queue",
                "Replay manual",
              ]}
            />
          }
        />
        <Route
          path="webhooks"
          element={
            <Suspense fallback={<PageFallback />}>
              <WebhooksPage />
            </Suspense>
          }
        />
        <Route
          path="health"
          element={
            <Suspense fallback={<PageFallback />}>
              <HealthPage />
            </Suspense>
          }
        />
        <Route
          path="audit"
          element={
            <SuperAdminPlaceholderPage
              icon={History}
              title="Audit Log Global"
              description="Todas as ações de Super Admin executadas na plataforma"
              phase="PR-4"
              scope={[
                "Filtro por super admin, tenant, ação",
                "Detalhe de payload",
                "Export CSV",
              ]}
            />
          }
        />
        <Route path="*" element={<Navigate to="/super-admin" replace />} />
      </Route>
    </Routes>
  );
}
