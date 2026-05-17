import { useNavigate, useLocation, useSearchParams } from "react-router-dom";
import { LayoutDashboard, MessageCircle, FileText, CalendarCheck, CreditCard } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useVendorBadges } from "@/hooks/useVendorBadges";

interface VendorBottomNavProps {
  unreadWhatsApp?: number;
}

const NAV_ITEMS = [
  { id: "dashboard", label: "Painel", icon: LayoutDashboard },
  { id: "whatsapp", label: "Whats", icon: MessageCircle },
  { id: "orcamentos", label: "Leads", icon: FileText },
  { id: "credito", label: "Crédito", icon: CreditCard },
  { id: "agenda", label: "Agenda", icon: CalendarCheck },
] as const;

export function VendorBottomNav({ unreadWhatsApp = 0 }: VendorBottomNavProps) {
  const { data: realBadgeCounts } = useVendorBadges();

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
    if (id === "orcamentos") return realBadgeCounts?.orcamentos || 0;
    if (id === "credito") return realBadgeCounts?.credito || 0;
    if (id === "agenda") return realBadgeCounts?.agenda || 0;
    return 0;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden h-[calc(4rem+safe-area-inset-bottom)] pb-[safe-area-inset-bottom] bg-background/80 backdrop-blur-xl border-t border-border/50 shadow-[0_-8px_20px_-6px_rgba(0,0,0,0.1)]">
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
              "flex-1 flex flex-col items-center justify-center gap-1 min-h-[44px] h-full rounded-none transition-all duration-300 px-0 relative",
              isActive
                ? "text-primary"
                : "text-muted-foreground/70 hover:text-foreground"
            )}
          >
            {isActive && (
              <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_1px_6px_rgba(var(--primary),0.4)]" />
            )}
            <div className="relative transition-transform duration-300 group">
              <Icon className={cn(
                "h-5 w-5 transition-all duration-300", 
                isActive ? "stroke-[2.5] scale-110" : "group-hover:scale-110"
              )} />
              {showGreenDot && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-success ring-2 ring-background animate-pulse" />
              )}
              {badge > 0 && (
                <Badge
                  variant="secondary"
                  className="absolute -top-2.5 -right-3.5 h-4.5 min-w-[18px] px-1 text-[10px] font-bold bg-destructive text-destructive-foreground border-2 border-background rounded-full flex items-center justify-center"
                >
                  {badge > 99 ? "99+" : badge}
                </Badge>
              )}
            </div>
            <span className={cn(
              "text-[10px] transition-all duration-300",
              isActive ? "font-bold tracking-tight" : "font-medium opacity-70"
            )}>
              {item.label}
            </span>
          </Button>
        );
      })}
    </nav>
  );
}
