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
            <SuperAdminPlaceholderPage
              icon={CreditCard}
              title="Billing"
              description="Visão global de assinaturas, MRR e dunning"
              phase="PR-2"
              scope={[
                "Lista de assinaturas com filtros (status, plano)",
                "MRR / Churn / Trial-to-paid",
                "Cobranças em atraso e fila de dunning",
                "Replay de webhook Asaas",
                "Reenvio de cobrança",
              ]}
            />
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
            <SuperAdminPlaceholderPage
              icon={Webhook}
              title="Webhooks"
              description="Eventos recebidos e replay manual"
              phase="PR-4"
              scope={[
                "Asaas / Evolution / outros providers",
                "Status (received / processed / failed)",
                "Replay individual",
                "Filtro por tenant",
              ]}
            />
          }
        />
        <Route
          path="health"
          element={
            <SuperAdminPlaceholderPage
              icon={Activity}
              title="Health"
              description="Score de saúde por tenant e por integração"
              phase="PR-4"
              scope={[
                "Health score consolidado por tenant",
                "Drill-down por categoria (billing, WA, IA, jobs)",
                "Tenants em risco",
              ]}
            />
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
