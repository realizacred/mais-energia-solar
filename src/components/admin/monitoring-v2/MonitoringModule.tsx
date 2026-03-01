import React from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Sun, AlertTriangle, FileText, Settings, Plug } from "lucide-react";

const MonitorDashboard = lazy(() => import("./MonitorDashboard"));
const MonitorPlants = lazy(() => import("./MonitorPlants"));
const MonitorPlantDetail = lazy(() => import("./MonitorPlantDetail"));
const MonitorAlerts = lazy(() => import("./MonitorAlerts"));
const MonitorReports = lazy(() => import("./MonitorReports"));
const MonitorSettings = lazy(() => import("./MonitorSettings"));

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "" },
  { key: "usinas", label: "Usinas", icon: Sun, path: "usinas" },
  { key: "alertas", label: "Alertas", icon: AlertTriangle, path: "alertas" },
  { key: "relatorios", label: "Relatórios", icon: FileText, path: "relatorios" },
  { key: "integracoes", label: "Integrações", icon: Plug, path: "integracoes" },
] as const;

function getActiveTab(pathname: string): string {
  const segment = pathname.replace("/admin/monitoramento", "").replace(/^\//, "").split("/")[0];
  if (!segment) return "dashboard";
  const match = NAV_ITEMS.find((n) => n.path === segment);
  return match?.key || "dashboard";
}

/** Nested router for /admin/monitoramento/* */
export default function MonitoringModule() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = getActiveTab(location.pathname);

  // Hide tabs on detail pages (usinas/:id)
  const isDetailPage = /\/usinas\/[^/]+/.test(location.pathname.replace("/admin/monitoramento", ""));

  return (
    <div className="space-y-4">
      {!isDetailPage && (
        <Tabs value={activeTab} onValueChange={(v) => {
          const item = NAV_ITEMS.find((n) => n.key === v);
          if (item) navigate(`/admin/monitoramento${item.path ? `/${item.path}` : ""}`);
        }}>
          <TabsList className="bg-muted/50 border border-border p-1 h-auto flex-wrap">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              return (
                <TabsTrigger
                  key={item.key}
                  value={item.key}
                  className="gap-2 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground text-xs sm:text-sm"
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden sm:inline">{item.label}</span>
                </TabsTrigger>
              );
            })}
          </TabsList>
        </Tabs>
      )}

      <Suspense fallback={<LoadingState message="Carregando módulo..." />}>
        <Routes>
          <Route index element={<MonitorDashboard />} />
          <Route path="usinas" element={<MonitorPlants />} />
          <Route path="usinas/:plantId" element={<MonitorPlantDetail />} />
          <Route path="alertas" element={<MonitorAlerts />} />
          <Route path="relatorios" element={<MonitorReports />} />
          <Route path="integracoes" element={<MonitorSettings />} />
          <Route path="*" element={<Navigate to="/admin/monitoramento" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
