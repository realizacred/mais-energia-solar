import { useMemo } from "react";
import { ChevronRight, Home } from "lucide-react";
import { Link } from "react-router-dom";
import { useNavConfig } from "@/hooks/useNavConfig";

interface AdminBreadcrumbProps {
  activeTab: string;
}

export function AdminBreadcrumb({ activeTab }: AdminBreadcrumbProps) {
  const { sections } = useNavConfig();

  const crumbs = useMemo(() => {
    for (const section of sections) {
      const item = section.items.find((i) => i.id === activeTab);
      if (item) {
        return { section: section.label, item: item.title };
      }
    }
    return null;
  }, [sections, activeTab]);

  if (!crumbs) return null;

  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1.5 text-xs">
      <Link
        to="/admin/dashboard"
        className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
      >
        <Home className="h-3 w-3" />
        <span className="hidden sm:inline">Início</span>
      </Link>
      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
      <span className="text-muted-foreground">{crumbs.section}</span>
      <ChevronRight className="h-3 w-3 text-muted-foreground/40" />
      <span className="font-semibold text-foreground">{crumbs.item}</span>
    </nav>
  );
}
