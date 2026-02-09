import React, { useState, useCallback, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  LogOut, Sun, ChevronDown, ChevronRight, Star, GripVertical, Building2,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PortalSwitcher } from "@/components/layout/PortalSwitcher";
import { useLogo } from "@/hooks/useLogo";
import { useSidebarPreferences } from "@/hooks/useSidebarPreferences";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  SIDEBAR_SECTIONS,
  type SidebarSection,
  type MenuItem,
} from "./sidebarConfig";

interface AdminSidebarProps {
  activeTab: string;
  userEmail?: string;
  onSignOut: () => void;
  badgeCounts?: Record<string, number>;
}

/* ─── Build a flat lookup: item id → { item, section } ─── */
const ITEM_MAP = new Map<string, { item: MenuItem; section: SidebarSection }>();
SIDEBAR_SECTIONS.forEach((section) =>
  section.items.forEach((item) => ITEM_MAP.set(item.id, { item, section }))
);

/* ─── Reusable menu item renderer ─── */
function SidebarItemButton({
  item,
  section,
  isActive,
  collapsed,
  badgeCount,
  isFav,
  onToggleFav,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
}: {
  item: MenuItem;
  section: SidebarSection;
  isActive: boolean;
  collapsed: boolean;
  badgeCount: number;
  isFav: boolean;
  onToggleFav: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent, id: string) => void;
  onDragOver?: (e: React.DragEvent, id: string) => void;
  onDrop?: (e: React.DragEvent, id: string) => void;
  onDragEnd?: () => void;
}) {
  const navigate = useNavigate();

  const handleClick = () => {
    navigate(`/admin/${item.id}`);
  };

  return (
    <SidebarMenuItem
      draggable={draggable}
      onDragStart={draggable ? (e) => onDragStart?.(e as any, item.id) : undefined}
      onDragOver={draggable ? (e) => onDragOver?.(e as any, item.id) : undefined}
      onDrop={draggable ? (e) => onDrop?.(e as any, item.id) : undefined}
      onDragEnd={draggable ? onDragEnd : undefined}
      className="group/item"
    >
      <SidebarMenuButton
        onClick={handleClick}
        isActive={isActive}
        tooltip={
          item.description
            ? `${item.title} — ${item.description}`
            : item.title
        }
        className={`
          transition-all duration-200 rounded-lg mx-1 my-px group/btn relative
          ${
            isActive
              ? `${section.activeClass} shadow-sm`
              : `text-sidebar-foreground/60 ${section.hoverClass} hover:text-sidebar-foreground`
          }
        `}
      >
        {/* Drag handle */}
        {draggable && !collapsed && (
          <GripVertical className="h-3 w-3 shrink-0 opacity-0 group-hover/item:opacity-30 cursor-grab active:cursor-grabbing transition-opacity -ml-0.5 mr-px" />
        )}
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
          <span className="text-[13px] truncate flex-1">{item.title}</span>
        )}

        {/* Star button — visible on hover */}
        {!collapsed && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleFav(item.id);
            }}
            className={`
              shrink-0 p-0.5 rounded transition-all duration-150
              ${
                isFav
                  ? "opacity-100 text-warning"
                  : "opacity-0 group-hover/item:opacity-40 hover:!opacity-100 text-muted-foreground hover:text-warning"
              }
            `}
            title={isFav ? "Remover dos favoritos" : "Adicionar aos favoritos"}
          >
            <Star
              className="h-3 w-3"
              fill={isFav ? "currentColor" : "none"}
            />
          </button>
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

/* ─── Section group with collapsible + drag-reorder ─── */
function SidebarSectionGroup({
  section,
  activeTab,
  badgeCounts,
  isFavorite,
  onToggleFav,
  orderedItems,
  onReorder,
}: {
  section: SidebarSection;
  activeTab: string;
  badgeCounts?: Record<string, number>;
  isFavorite: (id: string) => boolean;
  onToggleFav: (id: string) => void;
  orderedItems: MenuItem[];
  onReorder: (sectionLabel: string, newOrder: string[]) => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const LabelIcon = section.labelIcon;
  const hasActiveItem = section.items.some((item) => item.id === activeTab);
  const shouldBeOpen = hasActiveItem || section.defaultOpen !== false;

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [overId, setOverId] = useState<string | null>(null);

  const handleDragStart = useCallback(
    (e: React.DragEvent, id: string) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", id);
      setDragId(id);
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, id: string) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setOverId(id);
    },
    []
  );

  const handleDrop = useCallback(
    (e: React.DragEvent, targetId: string) => {
      e.preventDefault();
      const sourceId = e.dataTransfer.getData("text/plain");
      if (!sourceId || sourceId === targetId) {
        setDragId(null);
        setOverId(null);
        return;
      }
      const ids = orderedItems.map((i) => i.id);
      const srcIdx = ids.indexOf(sourceId);
      const tgtIdx = ids.indexOf(targetId);
      if (srcIdx === -1 || tgtIdx === -1) return;

      const newIds = [...ids];
      newIds.splice(srcIdx, 1);
      newIds.splice(tgtIdx, 0, sourceId);
      onReorder(section.label, newIds);
      setDragId(null);
      setOverId(null);
    },
    [orderedItems, onReorder, section.label]
  );

  const handleDragEnd = useCallback(() => {
    setDragId(null);
    setOverId(null);
  }, []);

  return (
    <Collapsible defaultOpen={shouldBeOpen} className="group/collapsible">
      <SidebarGroup className="mb-0 px-2 py-1">
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className={`
              text-[10px] font-extrabold uppercase tracking-[0.14em] px-3 py-2.5
              flex items-center gap-2 cursor-pointer select-none
              transition-all duration-200
              hover:bg-accent/50 rounded-md
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
                <ChevronDown className="h-3 w-3 opacity-40 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
              </>
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px mt-0.5">
              {orderedItems.map((item) => {
                const isActive = activeTab === item.id;
                const badgeCount = badgeCounts?.[item.id] || 0;
                const isDragging = dragId === item.id;
                const isOver = overId === item.id && dragId !== item.id;

                return (
                  <React.Fragment key={item.id}>
                    {item.separator && !dragId && (
                      <div className="mx-4 my-1.5 h-px bg-border/30" />
                    )}
                    <div
                      className={`transition-all duration-150 ${
                        isDragging ? "opacity-40" : ""
                      } ${
                        isOver
                          ? "border-t-2 border-primary/40 rounded-t"
                          : ""
                      }`}
                    >
                      <SidebarItemButton
                        item={item}
                        section={section}
                        isActive={isActive}
                        collapsed={collapsed}
                        badgeCount={badgeCount}
                        isFav={isFavorite(item.id)}
                        onToggleFav={onToggleFav}
                        draggable={!collapsed}
                        onDragStart={handleDragStart}
                        onDragOver={handleDragOver}
                        onDrop={handleDrop}
                        onDragEnd={handleDragEnd}
                      />
                    </div>
                  </React.Fragment>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

/* ─── Favorites section ─── */
function FavoritesSection({
  favoriteIds,
  activeTab,
  badgeCounts,
  onToggleFav,
}: {
  favoriteIds: string[];
  activeTab: string;
  badgeCounts?: Record<string, number>;
  onToggleFav: (id: string) => void;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const resolvedItems = favoriteIds
    .map((id) => ITEM_MAP.get(id))
    .filter(Boolean) as { item: MenuItem; section: SidebarSection }[];

  if (resolvedItems.length === 0) return null;

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="mb-0 px-2 py-1">
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className={`
              text-[10px] font-extrabold uppercase tracking-[0.14em] px-3 py-2.5
              flex items-center gap-2 cursor-pointer select-none
              transition-all duration-200
              hover:bg-accent/50 rounded-md
              text-warning
            `}
          >
            <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-warning">
              <Star className="h-3 w-3 text-white" fill="white" />
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 opacity-80">Favoritos</span>
                <ChevronDown className="h-3 w-3 opacity-40 transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
              </>
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarGroupContent>
            <SidebarMenu className="gap-px mt-0.5">
              {resolvedItems.map(({ item, section }) => (
                <SidebarItemButton
                  key={item.id}
                  item={item}
                  section={section}
                  isActive={activeTab === item.id}
                  collapsed={collapsed}
                  badgeCount={badgeCounts?.[item.id] || 0}
                  isFav
                  onToggleFav={onToggleFav}
                />
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </CollapsibleContent>
      </SidebarGroup>
    </Collapsible>
  );
}

/* ─── Main Sidebar ─── */
export function AdminSidebar({
  activeTab,
  userEmail,
  onSignOut,
  badgeCounts,
}: AdminSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const logo = useLogo({ variant: "small" });
  const { user } = useAuth();
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .eq("role", "super_admin")
      .maybeSingle()
      .then(({ data }) => setIsSuperAdmin(!!data));
  }, [user]);

  const {
    favorites,
    toggleFavorite,
    isFavorite,
    setSectionOrder,
    getSectionOrder,
  } = useSidebarPreferences();

  const getOrderedItems = useCallback(
    (section: SidebarSection): MenuItem[] => {
      const customOrder = getSectionOrder(section.label);
      if (!customOrder || customOrder.length === 0) return section.items;

      const itemMap = new Map(section.items.map((i) => [i.id, i]));
      const ordered: MenuItem[] = [];
      for (const id of customOrder) {
        const item = itemMap.get(id);
        if (item) {
          ordered.push(item);
          itemMap.delete(id);
        }
      }
      for (const item of itemMap.values()) {
        ordered.push(item);
      }
      return ordered;
    },
    [getSectionOrder]
  );

  return (
    <Sidebar collapsible="icon" className="border-r border-border/20">
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
              <img src={logo} alt="Logo" className="h-8 w-auto" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                  Admin
                </span>
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin py-1.5 space-y-0.5">
        {favorites.length > 0 && (
          <>
            <FavoritesSection
              favoriteIds={favorites}
              activeTab={activeTab}
              badgeCounts={badgeCounts}
              onToggleFav={toggleFavorite}
            />
            <div className="mx-4 my-1 h-px bg-border/30" />
          </>
        )}

        {SIDEBAR_SECTIONS.map((section) => (
          <SidebarSectionGroup
            key={section.label}
            section={section}
            activeTab={activeTab}
            badgeCounts={badgeCounts}
            isFavorite={isFavorite}
            onToggleFav={toggleFavorite}
            orderedItems={getOrderedItems(section)}
            onReorder={setSectionOrder}
          />
        ))}
      </SidebarContent>

      <SidebarFooter className="border-t border-border/20 p-3 space-y-2">
        {!collapsed && userEmail && (
          <div className="px-3 py-2 rounded-lg bg-muted/50 border border-border/20">
            <p className="text-[11px] text-muted-foreground truncate font-medium">
              {userEmail}
            </p>
          </div>
        )}
        {!collapsed && <PortalSwitcher />}
        {isSuperAdmin && (
          <Link to="/super-admin">
            <Button
              variant="outline"
              size={collapsed ? "icon" : "default"}
              className={`w-full justify-start gap-2 text-primary border-primary/20 hover:bg-primary/10 ${collapsed ? "justify-center px-0" : ""}`}
            >
              <Building2 className="h-4 w-4 shrink-0" />
              {!collapsed && <span className="text-sm">Super Admin</span>}
            </Button>
          </Link>
        )}
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