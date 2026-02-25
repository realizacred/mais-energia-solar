import React, { useState, useCallback, useEffect, useMemo } from "react";
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
import { SidebarSearch } from "./SidebarSearch";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import {
  type SidebarSection,
  type MenuItem,
} from "./sidebarConfig";
import { useMenuAccess, useCanAccessItem } from "@/hooks/useMenuAccess";
import { useNavConfig } from "@/hooks/useNavConfig";

interface AdminSidebarProps {
  activeTab: string;
  userEmail?: string;
  onSignOut: () => void;
  badgeCounts?: Record<string, number>;
}

/* ─── Build a flat lookup: item id → { item, section } ─── */
function buildItemMap(sections: SidebarSection[]) {
  const map = new Map<string, { item: MenuItem; section: SidebarSection }>();
  sections.forEach((section) =>
    section.items.forEach((item) => map.set(item.id, { item, section }))
  );
  return map;
}

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

  const itemPath = `/admin/${item.id}`;

  const handleClick = (e: React.MouseEvent) => {
    // Ctrl+Click or Cmd+Click opens in new tab
    if (e.ctrlKey || e.metaKey) {
      window.open(itemPath, '_blank');
      return;
    }
    navigate(itemPath);
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
          transition-all duration-200 ease-in-out rounded-lg mx-1 my-px group/btn relative
          pl-4
          ${
            isActive
              ? "bg-sidebar-primary/10 text-sidebar-primary font-semibold border-l-[3px] border-sidebar-primary shadow-sm shadow-sidebar-primary/5"
              : "text-sidebar-foreground-muted hover:bg-sidebar-accent/80 hover:text-sidebar-foreground border-l-[3px] border-transparent"
          }
        `}
      >
        {/* Drag handle */}
        {draggable && !collapsed && (
          <GripVertical className="h-3 w-3 shrink-0 opacity-0 group-hover/item:opacity-30 cursor-grab active:cursor-grabbing transition-opacity -ml-1 mr-px" />
        )}
        <item.icon
          className={`h-4 w-4 shrink-0 sidebar-icon ${
            isActive ? 'text-sidebar-primary' : section.iconColor || 'text-sidebar-foreground-muted'
          }`}
          data-active={isActive}
        />
        {item.description ? (
          <div className="flex flex-col items-start min-w-0 flex-1">
            <span className="text-[12.5px] truncate leading-tight">
              {item.title}
            </span>
            <span className="text-[10px] opacity-50 font-normal truncate leading-tight">
              {item.description}
            </span>
          </div>
        ) : (
          <span className="text-[12.5px] truncate flex-1">{item.title}</span>
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
      <SidebarGroup className="mb-0.5 px-2 py-0">
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className={`
              text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-2.5
              flex items-center gap-2.5 cursor-pointer select-none
              transition-all duration-200 ease-in-out
              hover:bg-sidebar-accent/60 rounded-lg
              text-sidebar-foreground/70
            `}
          >
            <div className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 ${section.indicatorClass || ''}`}>
              <LabelIcon className="h-3.5 w-3.5 sidebar-label-icon" />
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 text-sidebar-foreground/80 font-extrabold">{section.label}</span>
                <ChevronDown className="h-3 w-3 text-sidebar-foreground-muted transition-transform duration-200 ease-in-out group-data-[state=closed]/collapsible:-rotate-90" />
              </>
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>

        <CollapsibleContent className="sidebar-collapsible-content">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0 mt-1 ml-1 pl-2 border-l border-sidebar-border/40">
              {orderedItems.map((item, idx) => {
                const isActive = activeTab === item.id;
                const badgeCount = badgeCounts?.[item.id] || 0;
                const isDragging = dragId === item.id;
                const isOver = overId === item.id && dragId !== item.id;

                // Add spacing before subsection labels
                const prevItem = idx > 0 ? orderedItems[idx - 1] : null;
                const showExtraSpacing = item.subsectionLabel || (item.separator && !item.subsectionLabel);

                return (
                  <React.Fragment key={item.id}>
                    {item.subsectionLabel && !dragId && (
                      <div className={`mx-2 ${idx > 0 ? 'mt-3' : 'mt-1'} mb-1 flex items-center gap-2`}>
                        <span className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-foreground/40 select-none">
                          {item.subsectionLabel}
                        </span>
                        <div className="flex-1 h-px bg-border/30" />
                      </div>
                    )}
                    {item.separator && !item.subsectionLabel && !dragId && (
                      <div className="mx-3 my-2 h-px bg-border/20" />
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
  itemMap,
}: {
  favoriteIds: string[];
  activeTab: string;
  badgeCounts?: Record<string, number>;
  onToggleFav: (id: string) => void;
  itemMap: Map<string, { item: MenuItem; section: SidebarSection }>;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const resolvedItems = favoriteIds
    .map((id) => itemMap.get(id))
    .filter(Boolean) as { item: MenuItem; section: SidebarSection }[];

  if (resolvedItems.length === 0) return null;

  return (
    <Collapsible defaultOpen className="group/collapsible">
      <SidebarGroup className="mb-0.5 px-2 py-0">
        <CollapsibleTrigger asChild>
          <SidebarGroupLabel
            className={`
              text-[10px] font-bold uppercase tracking-[0.12em] px-3 py-2.5
              flex items-center gap-2.5 cursor-pointer select-none
              transition-all duration-200 ease-in-out
              hover:bg-sidebar-accent/60 rounded-lg
              text-sidebar-foreground/70
            `}
          >
            <div className="w-6 h-6 rounded-md flex items-center justify-center shrink-0 bg-warning/10">
              <Star className="h-3.5 w-3.5 text-warning" fill="currentColor" />
            </div>
            {!collapsed && (
              <>
                <span className="flex-1 text-sidebar-foreground/80 font-extrabold">Favoritos</span>
                <ChevronDown className="h-3 w-3 text-sidebar-foreground-muted transition-transform duration-200 group-data-[state=closed]/collapsible:-rotate-90" />
              </>
            )}
          </SidebarGroupLabel>
        </CollapsibleTrigger>
        <CollapsibleContent className="sidebar-collapsible-content">
          <SidebarGroupContent>
            <SidebarMenu className="gap-0 mt-1 ml-1 pl-2 border-l border-warning/20">
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

  const { sections: navSections } = useNavConfig();
  const filteredSections = useMenuAccess(navSections);
  const canAccessItem = useCanAccessItem();

  // Build item map from dynamic sections
  const itemMap = useMemo(() => buildItemMap(filteredSections), [filteredSections]);

  // Filter favorites to only show accessible items
  const accessibleFavorites = useMemo(
    () => favorites.filter((id) => canAccessItem(id)),
    [favorites, canAccessItem]
  );

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
    <Sidebar collapsible="icon" className="sidebar-premium border-0">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-3.5">
        <Link
          to="/"
          className="flex items-center gap-3 transition-all duration-200 hover:opacity-80"
        >
          {collapsed ? (
            <div className="p-1.5 rounded-xl bg-primary/10 transition-colors mx-auto">
              <Sun className="h-5 w-5 text-primary" />
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <img src={logo} alt="Logo" className="h-8 w-auto" />
              <div className="flex flex-col">
                <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-sidebar-foreground/60">
                  Admin
                </span>
              </div>
            </div>
          )}
        </Link>
      </SidebarHeader>

      <SidebarContent className="scrollbar-thin py-2 space-y-0.5">
        <SidebarSearch />
        {accessibleFavorites.length > 0 && (
          <>
            <FavoritesSection
              favoriteIds={accessibleFavorites}
              activeTab={activeTab}
              badgeCounts={badgeCounts}
              onToggleFav={toggleFavorite}
              itemMap={itemMap}
            />
            <div className="mx-4 my-1 h-px bg-border/30" />
          </>
        )}

        {filteredSections.map((section) => (
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

      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
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