import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { LayoutDashboard, MessageCircle, FileText, CalendarCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface VendorBottomNavProps {
  unreadWhatsApp?: number;
  badgeOrcamentos?: number;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "orcamentos", label: "Orçamentos", icon: FileText },
  { id: "agenda", label: "Agenda", icon: CalendarCheck },
] as const;

export function VendorBottomNav({ unreadWhatsApp = 0, badgeOrcamentos = 0 }: VendorBottomNavProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const asParam = searchParams.get("as");

  const activeTab = (() => {
    const segments = location.pathname.replace(/^\/(consultor|vendedor)/, "").split("/").filter(Boolean);
    return segments[0] || "dashboard";
  })();

  // Check if any WA instance is connected for green dot indicator
  const { data: waInstances } = useQuery({
    queryKey: ["wa-instances-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_instances")
        .select("status")
        .eq("status", "connected")
        .limit(1);
      return data;
    },
    staleTime: 1000 * 30,
  });

  const isWaConnected = (waInstances?.length ?? 0) > 0;

  const handleNavigate = (id: string) => {
    const path = `/consultor/${id}${asParam ? `?as=${asParam}` : ""}`;
    navigate(path);
  };

  const getBadge = (id: string) => {
    if (id === "whatsapp") return unreadWhatsApp;
    if (id === "orcamentos") return badgeOrcamentos;
    return 0;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden h-16 bg-background border-t border-border shadow-[0_-2px_10px_-3px_hsl(var(--foreground)/0.08)]">
      {NAV_ITEMS.map((item) => {
        const isActive = activeTab === item.id;
        const badge = getBadge(item.id);
        const Icon = item.icon;
        const showGreenDot = item.id === "whatsapp" && isWaConnected;

        return (
          <Button
            key={item.id}
            variant="ghost"
            onClick={() => handleNavigate(item.id)}
            className={cn(
              "flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[44px] h-full rounded-none transition-colors duration-150 px-0",
              isActive
                ? "text-primary hover:text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <div className="relative">
              <Icon className={cn("h-5 w-5", isActive && "stroke-[2.5]")} />
              {showGreenDot && (
                <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success ring-1 ring-background" />
              )}
              {badge > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -top-2 -right-3 h-4 min-w-4 px-1 text-[9px] font-bold bg-destructive text-destructive-foreground border-0 rounded-full"
                >
                  {badge > 99 ? "99+" : badge}
                </Badge>
              )}
            </div>
            <span className={cn(
              "text-[10px] leading-tight",
              isActive ? "font-semibold" : "font-medium"
            )}>
              {item.label}
            </span>
          </Button>
        );
      })}
    </nav>
  );
}
