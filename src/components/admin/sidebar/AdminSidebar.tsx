import { Link } from "react-router-dom";
import {
  Brain,
  Users,
  Kanban,
  Bell,
  UserCheck,
  DollarSign,
  BarChart3,
  Calculator,
  Building2,
  Webhook,
  LogOut,
  Sun,
  Instagram,
  Shield,
  Plug,
  Lightbulb,
  Trophy,
  Wallet,
  ClipboardCheck,
  TrendingUp,
  Settings,
  Coins,
  ClipboardList,
  Star,
  CalendarClock,
  Wrench,
  AlertTriangle,
  MessageCircle,
  Cable,
  Workflow,
  Rocket,
  Inbox,
  ChevronRight,
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
  SidebarHeader,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
import { useBrandSettings } from "@/hooks/useBrandSettings";
import logoFallback from "@/assets/logo.png";
import { SIDEBAR_SECTIONS, type SidebarSection } from "./sidebarConfig";

interface AdminSidebarProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  userEmail?: string;
  onSignOut: () => void;
}

function SidebarSectionGroup({
  section,
  activeTab,
  onTabChange,
}: {
  section: SidebarSection;
  activeTab: string;
  onTabChange: (tab: string) => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const LabelIcon = section.labelIcon;

  return (
    <SidebarGroup className="mb-0 px-2 py-0.5">
      <SidebarGroupLabel
        className={`
          text-[10px] font-extrabold uppercase tracking-[0.14em] px-3 py-2
          flex items-center gap-2 opacity-90
          ${section.labelClass}
        `}
      >
        <div
          className={`
            w-5 h-5 rounded-md flex items-center justify-center shrink-0
            ${section.indicatorBg}
          `}
        >
          <LabelIcon className="h-3 w-3 text-white" />
        </div>
        {!collapsed && section.label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu className="gap-px">
          {section.items.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <SidebarMenuItem key={item.id}>
                <SidebarMenuButton
                  onClick={() => onTabChange(item.id)}
                  isActive={isActive}
                  tooltip={
                    item.description
                      ? `${item.title} — ${item.description}`
                      : item.title
                  }
                  className={`
                    transition-all duration-200 rounded-lg mx-1 my-px group/btn
                    ${
                      isActive
                        ? `${section.activeClass} shadow-sm`
                        : `text-sidebar-foreground/60 ${section.hoverClass} hover:text-sidebar-foreground`
                    }
                  `}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.description ? (
                    <div className="flex flex-col items-start min-w-0 flex-1">
                      <span className="text-[13px] truncate leading-tight">
                        {item.title}
                      </span>
                      <span className="text-[10px] opacity-40 font-normal truncate leading-tight">
                        {item.description}
                      </span>
                    </div>
                  ) : (
                    <span className="text-[13px] truncate flex-1">
                      {item.title}
                    </span>
                  )}
                  {isActive && !collapsed && (
                    <ChevronRight className="h-3 w-3 opacity-50 shrink-0" />
                  )}
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AdminSidebar({
  activeTab,
  onTabChange,
  userEmail,
  onSignOut,
}: AdminSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { settings } = useBrandSettings();
  const logo = settings?.logo_url || logoFallback;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/20"
    >
      {/* Header with logo */}
      <SidebarHeader className="border-b border-border/20 p-3">
        <Link
          to="/"
          className="flex items-center gap-3 transition-all duration-200 hover:opacity-80"
        >
          {collapsed ? (
            <div className="p-1.5 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors mx-auto">
              <Sun className="h-5 w-5 text-primary" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img
                src={logo}
                alt="Logo"
                className="h-8 w-auto"
              />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Admin
                </span>
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      {/* Scrollable sections */}
      <SidebarContent className="scrollbar-thin py-2">
        {SIDEBAR_SECTIONS.map((section) => (
          <SidebarSectionGroup
            key={section.label}
            section={section}
            activeTab={activeTab}
            onTabChange={onTabChange}
          />
        ))}
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-border/20 p-3 space-y-2">
        {!collapsed && userEmail && (
          <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border/20">
            <p className="text-[11px] text-muted-foreground truncate font-medium">
              {userEmail}
            </p>
          </div>
        )}
        {!collapsed && <PortalSwitcher />}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={onSignOut}
          className="w-full gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/8 rounded-lg transition-all duration-200 h-9"
        >
          <LogOut className="h-4 w-4" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
