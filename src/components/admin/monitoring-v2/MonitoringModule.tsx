import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LoadingState } from "@/components/ui-kit/LoadingState";

const MonitorDashboard = lazy(() => import("./MonitorDashboard"));
const MonitorPlants = lazy(() => import("./MonitorPlants"));
const MonitorPlantDetail = lazy(() => import("./MonitorPlantDetail"));
const MonitorAlerts = lazy(() => import("./MonitorAlerts"));
const MonitorReports = lazy(() => import("./MonitorReports"));

/** Nested router for /admin/monitoramento/* */
export default function MonitoringModule() {
  return (
    <Suspense fallback={<LoadingState message="Carregando módulo..." />}>
      <Routes>
        <Route index element={<MonitorDashboard />} />
        <Route path="usinas" element={<MonitorPlants />} />
        <Route path="usinas/:plantId" element={<MonitorPlantDetail />} />
        <Route path="alertas" element={<MonitorAlerts />} />
        <Route path="relatorios" element={<MonitorReports />} />
        <Route path="*" element={<Navigate to="/admin/monitoramento" replace />} />
      </Routes>
    </Suspense>
  );
}
