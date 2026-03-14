import React from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { LayoutDashboard, Sun, AlertTriangle, FileText, Plug, DollarSign, BookOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, path: "" },
  { key: "usinas", label: "Usinas", icon: Sun, path: "usinas" },
  { key: "alertas", label: "Alertas", icon: AlertTriangle, path: "alertas" },
  { key: "relatorios", label: "Relatórios", icon: FileText, path: "relatorios" },
  { key: "cobrancas", label: "Cobranças", icon: DollarSign, path: "cobrancas" },
  { key: "integracoes", label: "Integrações", icon: Plug, path: "integracoes" },
  { key: "tutorial-alertas", label: "Entenda", icon: BookOpen, path: "entenda-alertas" },
] as const;

function getActiveTab(pathname: string): string {
  const segment = pathname.replace("/admin/monitoramento", "").replace(/^\//, "").split("/")[0];
  if (!segment) return "dashboard";
  const match = NAV_ITEMS.find((n) => n.path === segment);
  return match?.key || "dashboard";
}

export function MonitorNav() {
  const navigate = useNavigate();
  const location = useLocation();
  const activeTab = getActiveTab(location.pathname);

  return (
    <nav className="flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border overflow-x-auto">
      {NAV_ITEMS.map((item) => {
        const Icon = item.icon;
        const isActive = activeTab === item.key;
        return (
          <Button
            key={item.key}
            variant="ghost"
            size="sm"
            onClick={() => navigate(`/admin/monitoramento${item.path ? `/${item.path}` : ""}`)}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all duration-200 h-auto",
              isActive
                ? "bg-primary/10 text-primary border border-primary shadow-sm hover:bg-primary/15"
                : "text-muted-foreground hover:text-foreground hover:bg-card/50"
            )}
          >
            <Icon className={cn("h-4 w-4 shrink-0", isActive ? "text-primary" : "text-muted-foreground/70")} />
            <span className="hidden sm:inline">{item.label}</span>
          </Button>
        );
      })}
    </nav>
  );
}
