import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  LogOut,
  Sun,
  ChevronDown,
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
import { useLogo } from "@/hooks/useLogo";
import {
  VENDOR_SIDEBAR_SECTIONS,
  type VendorSidebarSection,
  type VendorMenuItem,
} from "./vendorSidebarConfig";

interface VendorSidebarProps {
  activeTab: string;
  vendedorNome: string;
  isAdminMode?: boolean;
  isViewingAsVendedor?: boolean;
  onSignOut: () => void;
  badgeCounts?: Record<string, number>;
}

function VendorSidebarItem({
  item,
  section,
  isActive,
  collapsed,
  badgeCount,
}: {
  item: VendorMenuItem;
  section: VendorSidebarSection;
  isActive: boolean;
  collapsed: boolean;
  badgeCount: number;
}) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const asParam = searchParams.get("as");

  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        onClick={() => navigate(`/consultor/${item.id}${asParam ? `?as=${asParam}` : ""}`)}
        isActive={isActive}
        tooltip={
          item.description
            ? `${item.title} — ${item.description}`
            : item.title
        }
        className={`
          transition-all duration-200 rounded-lg mx-1 my-px text-[13px]
          ${
            isActive
              ? `${section.activeClass} shadow-sm font-semibold`
              : `text-sidebar-foreground/65 ${section.hoverClass} hover:text-sidebar-foreground/90`
          }
        `}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {item.description ? (
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="text-[13px] truncate leading-tight">
              {item.title}
            </span>
            <span className="text-[10px] opacity-50 font-normal truncate leading-tight">
              {item.description}
            </span>
          </div>
        ) : (
          <span className="text-[13px] truncate flex-1">{item.title}</span>
        )}
        {badgeCount > 0 && !collapsed && (
          <Badge
            variant="secondary"
            className="h-5 min-w-5 px-1.5 text-[10px] font-bold bg-warning/15 text-warning border-0 shrink-0"
          >
            {badgeCount}
          </Badge>
        )}
        {badgeCount > 0 && collapsed && (
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-warning" />
        )}
        {isActive && !collapsed && badgeCount === 0 && (
          <ChevronRight className="h-3 w-3 opacity-50 shrink-0" />
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

function VendorSidebarSectionGroup({
  section,
  activeTab,
  badgeCounts,
}: {
  section: VendorSidebarSection;
  activeTab: string;
  badgeCounts?: Record<string, number>;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const LabelIcon = section.labelIcon;
  const hasActiveItem = section.items.some((item) => item.id === activeTab);
  const shouldBeOpen = hasActiveItem || section.defaultOpen !== false;

  return (
    <Collapsible defaultOpen={shouldBeOpen} className="group/collapsible">
      <SidebarGroup className="mb-0 px-2 py-0.5">
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className={`
              text-[10px] font-extrabold uppercase tracking-[0.14em] px-3 py-2
              flex items-center gap-2 cursor-pointer select-none
              transition-all duration-200
              hover:bg-accent/50 rounded-lg
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
            {!collapsed && (
              <>
                <span className="flex-1 opacity-80">{section.label}</span>
                <ChevronDown className="h-3 w-3 opacity-30 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
              </>
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px mt-0.5">
              {section.items.map((item) => (
                <VendorSidebarItem
                  key={item.id}
                  item={item}
                  section={section}
                  isActive={activeTab === item.id}
                  collapsed={collapsed}
                  badgeCount={badgeCounts?.[item.id] || 0}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

export function VendorSidebar({
  activeTab,
  vendedorNome,
  isAdminMode,
  isViewingAsVendedor,
  onSignOut,
  badgeCounts,
}: VendorSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const logo = useLogo({ variant: "small" });

  const displayName =
    isAdminMode && !isViewingAsVendedor ? "Administrador" : vendedorNome;

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-border/15 bg-sidebar-background/80 backdrop-blur-sm"
    >
      <SidebarHeader className="border-b border-border/15 px-3 py-3.5">
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
              <img src={logo} alt="Logo" className="h-8 w-auto" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-primary/80">
                  Consultor
                </span>
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin py-2 space-y-0.5">
        {VENDOR_SIDEBAR_SECTIONS.map((section) => (
          <VendorSidebarSectionGroup
            key={section.label}
            section={section}
            activeTab={activeTab}
            badgeCounts={badgeCounts}
          />
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/15 p-3 space-y-2">
        {!collapsed && (
          <div className="px-3 py-2 rounded-lg bg-muted/30 border border-border/15">
            <p className="text-[11px] text-muted-foreground/80 truncate font-medium">
              {displayName}
            </p>
            {isAdminMode && (
              <span className="text-[10px] text-primary font-medium">
                Modo Admin
              </span>
            )}
          </div>
        )}
        {!collapsed && <PortalSwitcher />}
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "default"}
          onClick={onSignOut}
          className={`
            w-full justify-start gap-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10
            ${collapsed ? "justify-center px-0" : ""}
          `}
        >
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-sm">Sair</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
