/**
 * SuperAdminSidebar — Navegação principal do painel Super Admin.
 * Estilo Linear (colapsável, ícones sempre visíveis). RB-76: única central, sem duplicar.
 */
import { NavLink, useLocation } from "react-router-dom";
import {
  LayoutDashboard,
  Building2,
  CreditCard,
  Package,
  Briefcase,
  Webhook,
  History,
  Activity,
  TrendingUp,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

const TENANT_NAV = [
  { title: "Visão Geral", url: "/super-admin", icon: LayoutDashboard, exact: true },
  { title: "Tenants", url: "/super-admin/tenants", icon: Building2 },
];

const PLATFORM_NAV = [
  { title: "Billing", url: "/super-admin/billing", icon: CreditCard },
  { title: "Planos & Features", url: "/super-admin/plans", icon: Package },
  { title: "Jobs & Crons", url: "/super-admin/jobs", icon: Briefcase },
  { title: "Webhooks", url: "/super-admin/webhooks", icon: Webhook },
  { title: "Health", url: "/super-admin/health", icon: Activity },
  { title: "Consumo", url: "/super-admin/usage", icon: TrendingUp },
  { title: "Audit Log", url: "/super-admin/audit", icon: History },
];

export function SuperAdminSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { pathname } = useLocation();

  const isActive = (url: string, exact?: boolean) =>
    exact ? pathname === url : pathname === url || pathname.startsWith(url + "/");

  const renderItems = (items: typeof TENANT_NAV) =>
    items.map((item) => (
      <SidebarMenuItem key={item.url}>
        <SidebarMenuButton asChild isActive={isActive(item.url, item.exact)}>
          <NavLink to={item.url} end={item.exact} className="flex items-center gap-2">
            <item.icon className="h-4 w-4 shrink-0" />
            {!collapsed && <span>{item.title}</span>}
          </NavLink>
        </SidebarMenuButton>
      </SidebarMenuItem>
    ));

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Operação</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(TENANT_NAV)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          {!collapsed && <SidebarGroupLabel>Plataforma</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>{renderItems(PLATFORM_NAV)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
