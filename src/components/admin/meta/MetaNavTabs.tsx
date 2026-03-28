import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const TABS = [
  { label: "Painel", path: "/admin/meta-dashboard" },
  { label: "Campanhas", path: "/admin/meta-campaigns" },
  { label: "Leads", path: "/admin/meta-leads" },
  { label: "Configurações", path: "/admin/meta-facebook-config" },
];

export function MetaNavTabs() {
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground">
      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => navigate(tab.path)}
            className={cn(
              "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "hover:bg-background/50 hover:text-foreground"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}
