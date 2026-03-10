import { useState, useCallback, useMemo, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import {
  NAV_REGISTRY,
  NAV_SECTION_DEFAULTS,
  type NavRegistryItem,
  type NavCriticality,
} from "@/config/navRegistry";
import { toast } from "sonner";
import {
  GripVertical,
  Eye,
  EyeOff,
  RotateCcw,
  Save,
  Shield,
  ShieldAlert,
  Pencil,
  Check,
  X,
  ChevronDown,
  Info,
  Settings2,
} from "lucide-react";
import * as Icons from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { motion } from "framer-motion";

// ─── Types ───────────────────────────────────────────────────

interface NavOverrideRow {
  id: string;
  nav_key: string;
  label_override: string | null;
  group_override: string | null;
  order_override: number | null;
  visible_override: boolean;
}

interface EditableItem {
  nav_key: string;
  label: string;
  label_changed: boolean;
  group: string;
  group_changed: boolean;
  order: number;
  visible: boolean;
  visible_changed: boolean;
  criticality: NavCriticality;
  icon: string;
  description: string;
}

// ─── Helpers ─────────────────────────────────────────────────

function resolveIcon(name: string): React.ComponentType<{ className?: string }> {
  return (Icons as any)[name] ?? Icons.Circle;
}

const SECTION_LABELS = NAV_SECTION_DEFAULTS.map((s) => s.label);

function buildEditableItems(overrides: NavOverrideRow[]): EditableItem[] {
  const ovMap = new Map(overrides.map((o) => [o.nav_key, o]));

  return NAV_REGISTRY.map((reg) => {
    const ov = ovMap.get(reg.nav_key);
    const label = ov?.label_override ?? reg.label_default;
    const group = ov?.group_override ?? reg.group_default;
    const order = ov?.order_override ?? reg.order_default;
    let visible = ov?.visible_override ?? true;

    if (reg.criticality !== "normal") visible = true;

    return {
      nav_key: reg.nav_key,
      label,
      label_changed: ov?.label_override != null,
      group,
      group_changed: ov?.group_override != null,
      order,
      visible,
      visible_changed: ov?.visible_override === false,
      criticality: reg.criticality,
      icon: reg.icon,
      description: reg.description,
    };
  });
}

// ─── Drag & Drop Hook ────────────────────────────────────────

function useDragReorder(
  sectionItems: EditableItem[],
  onReorder: (reordered: EditableItem[]) => void
) {
  const dragItemRef = useRef<number | null>(null);
  const dragOverRef = useRef<number | null>(null);
  const [draggingIdx, setDraggingIdx] = useState<number | null>(null);
  const [dragOverIdx, setDragOverIdx] = useState<number | null>(null);

  const handleDragStart = useCallback((idx: number) => {
    dragItemRef.current = idx;
    setDraggingIdx(idx);
  }, []);

  const handleDragEnter = useCallback((idx: number) => {
    dragOverRef.current = idx;
    setDragOverIdx(idx);
  }, []);

  const handleDragEnd = useCallback(() => {
    const from = dragItemRef.current;
    const to = dragOverRef.current;

    if (from !== null && to !== null && from !== to) {
      const reordered = [...sectionItems];
      const [moved] = reordered.splice(from, 1);
      reordered.splice(to, 0, moved);
      const updated = reordered.map((item, i) => ({ ...item, order: i }));
      onReorder(updated);
    }

    dragItemRef.current = null;
    dragOverRef.current = null;
    setDraggingIdx(null);
    setDragOverIdx(null);
  }, [sectionItems, onReorder]);

  return { draggingIdx, dragOverIdx, handleDragStart, handleDragEnter, handleDragEnd };
}

// ─── Component ───────────────────────────────────────────────

export function MenuConfigPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: overrides = [], isLoading } = useQuery({
    queryKey: ["nav-overrides-admin", user?.id],
    enabled: !!user,
    staleTime: 1000 * 60 * 5,
    queryFn: async (): Promise<NavOverrideRow[]> => {
      const { data, error } = await supabase
        .from("nav_overrides")
        .select("id, nav_key, label_override, group_override, order_override, visible_override")
        .is("role_filter", null);
      if (error) throw error;
      return (data ?? []) as NavOverrideRow[];
    },
  });

  const [items, setItems] = useState<EditableItem[]>([]);
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editingValue, setEditingValue] = useState("");
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    if (!isLoading) {
      setItems(buildEditableItems(overrides));
      setHasChanges(false);
    }
  }, [overrides, isLoading]);

  const groupedItems = useMemo(() => {
    const map = new Map<string, EditableItem[]>();
    for (const s of SECTION_LABELS) map.set(s, []);
    for (const item of items) {
      const list = map.get(item.group) ?? [];
      list.push(item);
      map.set(item.group, list);
    }
    for (const [, list] of map) {
      list.sort((a, b) => a.order - b.order);
    }
    return map;
  }, [items]);

  // ─── Mutations ─────────────────────────────────────────────

  const updateItem = useCallback(
    (navKey: string, patch: Partial<EditableItem>) => {
      setItems((prev) =>
        prev.map((item) => (item.nav_key === navKey ? { ...item, ...patch } : item))
      );
      setHasChanges(true);
    },
    []
  );

  const toggleVisibility = useCallback(
    (navKey: string) => {
      const item = items.find((i) => i.nav_key === navKey);
      if (!item) return;
      if (item.criticality !== "normal") {
        toast.error("Este item é crítico e não pode ser ocultado");
        return;
      }
      updateItem(navKey, { visible: !item.visible, visible_changed: true });
    },
    [items, updateItem]
  );

  const handleSectionReorder = useCallback(
    (sectionLabel: string, reorderedItems: EditableItem[]) => {
      setItems((prev) => {
        const otherItems = prev.filter((i) => i.group !== sectionLabel);
        return [...otherItems, ...reorderedItems];
      });
      setHasChanges(true);
    },
    []
  );

  const changeGroup = useCallback(
    (navKey: string, newGroup: string) => {
      const item = items.find((i) => i.nav_key === navKey);
      if (!item) return;
      if (item.criticality === "system_critical") {
        toast.error("Itens críticos do sistema não podem ser movidos");
        return;
      }
      const targetItems = items.filter((i) => i.group === newGroup);
      const maxOrder = targetItems.length > 0 ? Math.max(...targetItems.map((i) => i.order)) + 1 : 0;
      updateItem(navKey, { group: newGroup, group_changed: true, order: maxOrder });
    },
    [items, updateItem]
  );

  const saveMutation = useMutation({
    mutationFn: async () => {
      const upserts: Array<{
        nav_key: string;
        label_override: string | null;
        group_override: string | null;
        order_override: number | null;
        visible_override: boolean;
      }> = [];

      for (const item of items) {
        const reg = NAV_REGISTRY.find((r) => r.nav_key === item.nav_key);
        if (!reg) continue;

        const labelChanged = item.label !== reg.label_default;
        const groupChanged = item.group !== reg.group_default;
        const orderChanged = item.order !== reg.order_default;
        const visChanged = !item.visible;

        if (labelChanged || groupChanged || orderChanged || visChanged) {
          upserts.push({
            nav_key: item.nav_key,
            label_override: labelChanged ? item.label : null,
            group_override: groupChanged ? item.group : null,
            order_override: orderChanged ? item.order : null,
            visible_override: item.visible,
          });
        }
      }

      const { error: delError } = await supabase
        .from("nav_overrides")
        .delete()
        .is("role_filter", null);
      if (delError) throw delError;

      if (upserts.length > 0) {
        const { error: insError } = await supabase
          .from("nav_overrides")
          .insert(upserts as any);
        if (insError) throw insError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nav-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["nav-overrides-admin"] });
      queryClient.refetchQueries({ queryKey: ["nav-overrides"] });
      setHasChanges(false);
      toast.success("Menu salvo com sucesso! A sidebar foi atualizada.");
    },
    onError: (err: any) => {
      toast.error("Erro ao salvar: " + err.message);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("nav_overrides")
        .delete()
        .is("role_filter", null);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["nav-overrides"] });
      queryClient.invalidateQueries({ queryKey: ["nav-overrides-admin"] });
      queryClient.refetchQueries({ queryKey: ["nav-overrides"] });
      setHasChanges(false);
      toast.success("Menu restaurado ao padrão!");
    },
    onError: (err: any) => {
      toast.error("Erro ao restaurar: " + err.message);
    },
  });

  // ─── Render ────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-72 mt-1" />
          </div>
        </div>
        <Skeleton className="h-12 w-full rounded-lg" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  const criticalityBadge = (c: NavCriticality) => {
    if (c === "system_critical")
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-destructive/10 text-destructive border-destructive/20">
          <ShieldAlert className="h-3 w-3 mr-0.5" /> Sistema
        </Badge>
      );
    if (c === "business_critical")
      return (
        <Badge variant="outline" className="text-[10px] px-1.5 py-0 bg-warning/10 text-warning border-warning/20">
          <Shield className="h-3 w-3 mr-0.5" /> Negócio
        </Badge>
      );
    return null;
  };

  return (
    <TooltipProvider>
      <motion.div
        className="p-4 md:p-6 space-y-6"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
      >
        {/* §26 Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
              <Settings2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">Personalizar Menus</h1>
              <p className="text-sm text-muted-foreground">
                Arraste para reordenar, personalize nomes e visibilidade
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="outline" size="sm" disabled={restoreMutation.isPending}>
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Restaurar Padrão
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Restaurar menu padrão?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Todas as personalizações de nome, ordem e visibilidade serão removidas.
                    Esta ação não pode ser desfeita.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancelar</AlertDialogCancel>
                  <AlertDialogAction onClick={() => restoreMutation.mutate()}>
                    Restaurar
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>

            {hasChanges && (
              <Button
                size="sm"
                disabled={saveMutation.isPending}
                onClick={() => saveMutation.mutate()}
              >
                <Save className="h-4 w-4 mr-1" />
                {saveMutation.isPending ? "Salvando..." : "Salvar Alterações"}
              </Button>
            )}
          </div>
        </div>

        {/* Legend */}
        <Card className="bg-card border-border shadow-sm">
          <CardContent className="py-3 px-4 flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <GripVertical className="h-3.5 w-3.5" /> Arraste para reordenar
            </span>
            <span className="flex items-center gap-1">
              <ShieldAlert className="h-3.5 w-3.5 text-destructive" /> Sistema — Fixo
            </span>
            <span className="flex items-center gap-1">
              <Shield className="h-3.5 w-3.5 text-warning" /> Negócio — Sempre visível
            </span>
            <span className="flex items-center gap-1">
              <Eye className="h-3.5 w-3.5" /> Normal — Totalmente personalizável
            </span>
          </CardContent>
        </Card>

        {/* Sections */}
        <div className="space-y-4">
          {SECTION_LABELS.map((sectionLabel, i) => {
            const sectionItems = groupedItems.get(sectionLabel) ?? [];
            if (sectionItems.length === 0) return null;

            return (
              <motion.div
                key={sectionLabel}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04, duration: 0.35 }}
              >
                <SectionCard
                  sectionLabel={sectionLabel}
                  sectionItems={sectionItems}
                  editingLabel={editingLabel}
                  editingValue={editingValue}
                  onEditStart={(navKey, label) => {
                    setEditingLabel(navKey);
                    setEditingValue(label);
                  }}
                  onEditChange={setEditingValue}
                  onEditConfirm={(navKey) => {
                    updateItem(navKey, { label: editingValue, label_changed: true });
                    setEditingLabel(null);
                  }}
                  onEditCancel={() => setEditingLabel(null)}
                  onToggleVisibility={toggleVisibility}
                  onChangeGroup={changeGroup}
                  onReorder={handleSectionReorder}
                  criticalityBadge={criticalityBadge}
                />
              </motion.div>
            );
          })}
        </div>

        {/* Info footer */}
        <Card className="bg-muted/30 border-border shadow-sm">
          <CardContent className="py-3 px-4 text-xs text-muted-foreground flex items-start gap-2">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <div>
              <p className="font-medium text-foreground">Sobre a personalização de menus</p>
              <ul className="mt-1 space-y-0.5 list-disc list-inside">
                <li>As rotas e permissões de acesso <strong>nunca</strong> são alteradas pela personalização.</li>
                <li>Itens críticos do sistema não podem ser ocultados nem movidos.</li>
                <li>Itens críticos de negócio não podem ser ocultados.</li>
                <li>Arraste os itens pelo ícone <GripVertical className="h-3 w-3 inline" /> para reordenar.</li>
                <li>Use "Restaurar Padrão" para voltar à configuração original.</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </TooltipProvider>
  );
}

// ─── Section Card with Drag & Drop ───────────────────────────

interface SectionCardProps {
  sectionLabel: string;
  sectionItems: EditableItem[];
  editingLabel: string | null;
  editingValue: string;
  onEditStart: (navKey: string, label: string) => void;
  onEditChange: (value: string) => void;
  onEditConfirm: (navKey: string) => void;
  onEditCancel: () => void;
  onToggleVisibility: (navKey: string) => void;
  onChangeGroup: (navKey: string, newGroup: string) => void;
  onReorder: (sectionLabel: string, items: EditableItem[]) => void;
  criticalityBadge: (c: NavCriticality) => React.ReactNode;
}

function SectionCard({
  sectionLabel,
  sectionItems,
  editingLabel,
  editingValue,
  onEditStart,
  onEditChange,
  onEditConfirm,
  onEditCancel,
  onToggleVisibility,
  onChangeGroup,
  onReorder,
  criticalityBadge,
}: SectionCardProps) {
  const sectionMeta = NAV_SECTION_DEFAULTS.find((s) => s.label === sectionLabel);
  const SectionIcon = resolveIcon(sectionMeta?.icon ?? "Folder");

  const { draggingIdx, dragOverIdx, handleDragStart, handleDragEnter, handleDragEnd } =
    useDragReorder(sectionItems, (reordered) => onReorder(sectionLabel, reordered));

  return (
    <Collapsible defaultOpen>
      <Card className="bg-card border-border shadow-sm">
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer py-3 px-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded flex items-center justify-center bg-primary/10 text-primary">
                  <SectionIcon className="h-3.5 w-3.5" />
                </div>
                <CardTitle className="text-sm font-semibold text-foreground">{sectionLabel}</CardTitle>
                <Badge variant="outline" className="text-[10px]">
                  {sectionItems.length}
                </Badge>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform" />
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="pt-0 pb-2 px-2">
            <div className="space-y-0">
              {sectionItems.map((item, idx) => {
                const ItemIcon = resolveIcon(item.icon);
                const isEditing = editingLabel === item.nav_key;
                const isDragging = draggingIdx === idx;
                const isDragOver = dragOverIdx === idx;
                const canDrag = item.criticality !== "system_critical";

                return (
                  <div
                    key={item.nav_key}
                    draggable={canDrag}
                    onDragStart={(e) => {
                      if (!canDrag) { e.preventDefault(); return; }
                      e.dataTransfer.effectAllowed = "move";
                      handleDragStart(idx);
                    }}
                    onDragEnter={() => canDrag && handleDragEnter(idx)}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
                    onDragEnd={handleDragEnd}
                    className={`
                      flex items-center gap-2 py-2.5 px-2 rounded-lg transition-all
                      ${!item.visible ? "opacity-40" : ""}
                      ${isDragging ? "opacity-30 scale-[0.98]" : ""}
                      ${isDragOver && !isDragging ? "border-t-2 border-primary" : "border-t-2 border-transparent"}
                      hover:bg-muted/20 group
                    `}
                  >
                    {/* Drag handle */}
                    <div
                      className={`
                        p-1 rounded cursor-grab active:cursor-grabbing
                        ${canDrag ? "text-muted-foreground/50 hover:text-muted-foreground hover:bg-muted/40" : "opacity-20 cursor-not-allowed"}
                      `}
                    >
                      <GripVertical className="h-4 w-4" />
                    </div>

                    {/* Icon */}
                    <ItemIcon className="h-4 w-4 text-muted-foreground shrink-0" />

                    {/* Label (editable) */}
                    <div className="flex-1 min-w-0">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            value={editingValue}
                            onChange={(e) => onEditChange(e.target.value)}
                            className="h-7 text-sm"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === "Enter") onEditConfirm(item.nav_key);
                              if (e.key === "Escape") onEditCancel();
                            }}
                          />
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEditConfirm(item.nav_key)}>
                            <Check className="h-3.5 w-3.5 text-success" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEditCancel}>
                            <X className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm font-medium text-foreground truncate">{item.label}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                            onClick={() => onEditStart(item.nav_key, item.label)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          {item.label_changed && (
                            <Tooltip>
                              <TooltipTrigger>
                                <Badge variant="outline" className="text-[9px] px-1 py-0">editado</Badge>
                              </TooltipTrigger>
                              <TooltipContent>
                                Padrão: {NAV_REGISTRY.find((r) => r.nav_key === item.nav_key)?.label_default}
                              </TooltipContent>
                            </Tooltip>
                          )}
                        </div>
                      )}
                      <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                    </div>

                    {/* Criticality badge */}
                    <div className="shrink-0">{criticalityBadge(item.criticality)}</div>

                    {/* Move to section */}
                    <Select
                      value={item.group}
                      onValueChange={(val) => onChangeGroup(item.nav_key, val)}
                      disabled={item.criticality === "system_critical"}
                    >
                      <SelectTrigger className="h-7 w-[130px] text-xs shrink-0">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SECTION_LABELS.map((sl) => (
                          <SelectItem key={sl} value={sl} className="text-xs">{sl}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Visibility toggle */}
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => onToggleVisibility(item.nav_key)}
                          disabled={item.criticality !== "normal"}
                        >
                          {item.visible ? (
                            <Eye className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <EyeOff className="h-4 w-4 text-destructive" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        {item.criticality !== "normal"
                          ? "Item crítico — não pode ser ocultado"
                          : item.visible ? "Clique para ocultar" : "Clique para exibir"}
                      </TooltipContent>
                    </Tooltip>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

export default MenuConfigPage;
