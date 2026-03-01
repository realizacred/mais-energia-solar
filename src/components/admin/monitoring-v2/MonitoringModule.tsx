import React from "react";
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom";
import { lazy, Suspense } from "react";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { LayoutDashboard, Sun, AlertTriangle, FileText, Plug, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";

const MonitorDashboard = lazy(() => import("./MonitorDashboard"));
const MonitorPlants = lazy(() => import("./MonitorPlants"));
const MonitorPlantDetail = lazy(() => import("./MonitorPlantDetail"));
const MonitorAlerts = lazy(() => import("./MonitorAlerts"));
const MonitorReports = lazy(() => import("./MonitorReports"));
const MonitorSettings = lazy(() => import("./MonitorSettings"));
const MonitorBilling = lazy(() => import("./MonitorBilling"));

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "" },
  { key: "usinas", label: "Usinas", icon: Sun, path: "usinas" },
  { key: "alertas", label: "Alertas", icon: AlertTriangle, path: "alertas" },
  { key: "relatorios", label: "Relatórios", icon: FileText, path: "relatorios" },
  { key: "cobrancas", label: "Cobranças", icon: DollarSign, path: "cobrancas" },
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
    <div className="space-y-5">
      {!isDetailPage && (
        <nav className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/60 overflow-x-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.key;
            return (
              <button
                key={item.key}
                onClick={() => navigate(`/admin/monitoramento${item.path ? `/${item.path}` : ""}`)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "bg-card text-foreground shadow-sm border border-border/60"
                    : "text-muted-foreground hover:text-foreground hover:bg-card/50"
                )}
              >
                <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "")} />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </nav>
      )}

      <Suspense fallback={<LoadingState message="Carregando módulo..." />}>
        <Routes>
          <Route index element={<MonitorDashboard />} />
          <Route path="usinas" element={<MonitorPlants />} />
          <Route path="usinas/:plantId" element={<MonitorPlantDetail />} />
          <Route path="alertas" element={<MonitorAlerts />} />
          <Route path="relatorios" element={<MonitorReports />} />
          <Route path="cobrancas" element={<MonitorBilling />} />
          <Route path="integracoes" element={<MonitorSettings />} />
          <Route path="*" element={<Navigate to="/admin/monitoramento" replace />} />
        </Routes>
      </Suspense>
    </div>
  );
}
