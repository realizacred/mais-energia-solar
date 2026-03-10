import React from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LoadingState } from "@/components/ui-kit/LoadingState";

const MonitorDashboard = lazy(() => import("./MonitorDashboard"));
const MonitorPlants = lazy(() => import("./MonitorPlants"));
const MonitorPlantDetail = lazy(() => import("./MonitorPlantDetail"));
const InverterDetailPage = lazy(() => import("./devices/InverterDetailPage"));
const MonitorAlerts = lazy(() => import("./MonitorAlerts"));
const MonitorReports = lazy(() => import("./MonitorReports"));
const MonitorSettings = lazy(() => import("./MonitorSettings"));
const MonitorBilling = lazy(() => import("./MonitorBilling"));
const MonitorAlertsTutorial = lazy(() => import("./MonitorAlertsTutorial"));
const MonitorMpptStrings = lazy(() => import("./MonitorMpptStrings"));

/** Nested router for /admin/monitoramento/* */
export default function MonitoringModule() {
  return (
    <Suspense fallback={<LoadingState message="Carregando módulo..." />}>
      <Routes>
        <Route index element={<MonitorDashboard />} />
        <Route path="usinas" element={<MonitorPlants />} />
        <Route path="usinas/:plantId" element={<MonitorPlantDetail />} />
        <Route path="usinas/:plantId/inversor/:deviceId" element={<InverterDetailPage />} />
        <Route path="mppt-strings" element={<MonitorMpptStrings />} />
        <Route path="alertas" element={<MonitorAlerts />} />
        <Route path="relatorios" element={<MonitorReports />} />
        <Route path="cobrancas" element={<MonitorBilling />} />
        <Route path="integracoes" element={<MonitorSettings />} />
        <Route path="entenda-alertas" element={<MonitorAlertsTutorial />} />
        <Route path="*" element={<Navigate to="/admin/monitoramento" replace />} />
      </Routes>
    </Suspense>
  );
}
