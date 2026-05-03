import { useState, useMemo } from "react";
import { Search, X, Filter, List, Layers, Tag, Users, Pencil, Plus, ArrowUpDown, Check, SlidersHorizontal, GripVertical } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjetoFunil, ProjetoEtiqueta } from "@/hooks/useProjetoPipeline";
import { cn } from "@/lib/utils";
import { useUserFunnelOrder } from "@/hooks/useUserFunnelOrder";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Chip arrastável de funil no filtro do kanban principal.
// UX: o chip inteiro é o handle — activationConstraint evita conflito com clique.
function SortableFunilChip({
  funil,
  active,
  onSelect,
  onEditEtapas,
}: {
  funil: ProjetoFunil;
  active: boolean;
  onSelect: () => void;
  onEditEtapas?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: funil.id });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center shrink-0">
      <button
        type="button"
        onClick={onSelect}
        {...attributes}
        {...listeners}
        className={cn(
          "flex items-center gap-1 px-3 h-7 text-xs font-medium rounded-md whitespace-nowrap touch-none select-none transition-all",
          isDragging ? "cursor-grabbing" : "cursor-grab",
          active
            ? "bg-background text-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground hover:bg-background/50",
        )}
        title="Arraste para reordenar • Clique para selecionar"
      >
        <GripVertical className="h-3 w-3 opacity-50" />
        {funil.nome}
      </button>
      {onEditEtapas && (
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 -ml-0.5"
          onClick={(e) => {
            e.stopPropagation();
            onEditEtapas();
          }}
          title={`Editar etapas de "${funil.nome}"`}
        >
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </Button>
      )}
    </div>
  );
}

interface ConsultorOption { id: string; nome: string; }

interface Props {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  funis: ProjetoFunil[];
  filterFunil: string;
  onFilterFunilChange: (v: string) => void;
  filterConsultor: string;
  onFilterConsultorChange: (v: string) => void;
  consultores: ConsultorOption[];
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  filterTipoProjetoSolar?: string;
  onFilterTipoProjetoSolarChange?: (v: string) => void;
  etiquetas: ProjetoEtiqueta[];
  filterEtiquetas: string[];
  onFilterEtiquetasChange: (ids: string[]) => void;
  viewMode: "kanban-etapa" | "kanban-consultor" | "lista";
  onViewModeChange: (v: "kanban-etapa" | "kanban-consultor" | "lista") => void;
  allowAllFunis?: boolean;
  onClearFilters: () => void;
  onEditEtapas?: (funilId: string) => void;
  onCreateFunil?: () => void;
  onReorderFunis?: () => void;
}

// Status agrupado por categoria da etapa do projeto (aberto/ganho/perdido/excluido).
// Reflete o ciclo de vida comercial em vez de status técnicos individuais.
const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "aberto", label: "Abertos" },
  { value: "ganho", label: "Ganhos" },
  { value: "perdido", label: "Perdidos" },
  { value: "excluido", label: "Excluídos" },
];

export function ProjetoFilters({
  searchTerm, onSearchChange,
  funis, filterFunil, onFilterFunilChange,
  filterConsultor, onFilterConsultorChange, consultores,
  filterStatus, onFilterStatusChange,
  etiquetas, filterEtiquetas, onFilterEtiquetasChange,
  viewMode, onViewModeChange,
  onClearFilters,
  onEditEtapas, onCreateFunil, onReorderFunis,
  allowAllFunis,
}: Props) {
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filterConsultor !== "todos") count++;
    if (filterStatus !== "todos") count++;
    if (filterEtiquetas.length > 0) count++;
    if (searchTerm.length > 0) count++;
    return count;
  }, [filterConsultor, filterStatus, filterEtiquetas, searchTerm]);

  const hasActive = activeFilterCount > 0;

  // Ordem: (1) canônica do BD por `ordem`, (2) sobrescrita pela preferência pessoal do usuário.
  const { sortByUserOrder, setOrder } = useUserFunnelOrder("projeto-funis");
  const activeFunis = useMemo(() => {
    const canonical = [...funis]
      .filter((f) => f.ativo)
      .sort((a, b) => a.ordem - b.ordem);
    return sortByUserOrder(canonical);
  }, [funis, sortByUserOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIndex = activeFunis.findIndex((f) => f.id === active.id);
    const newIndex = activeFunis.findIndex((f) => f.id === over.id);
    if (oldIndex < 0 || newIndex < 0) return;
    const reordered = arrayMove(activeFunis, oldIndex, newIndex).map((f) => f.id);
    setOrder(reordered);
  };

  const toggleEtiqueta = (id: string) => {
    if (filterEtiquetas.includes(id)) {
      onFilterEtiquetasChange(filterEtiquetas.filter(e => e !== id));
    } else {
      onFilterEtiquetasChange([...filterEtiquetas, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-end gap-3 sm:gap-4">
        {/* Left: Funil | Lista toggle */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0 overflow-x-auto">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange("kanban-consultor")}
            className={cn(
              "gap-1.5 text-sm font-semibold border-b-2 rounded-none px-2 h-9",
              viewMode === "kanban-consultor"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            Consultores
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange("kanban-etapa")}
            className={cn(
              "gap-1.5 text-sm font-semibold border-b-2 rounded-none px-2 h-9",
              viewMode === "kanban-etapa"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Filter className="h-4 w-4" />
            Funil
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onViewModeChange("lista")}
            className={cn(
              "gap-1.5 text-sm font-semibold border-b-2 rounded-none px-2 h-9",
              viewMode === "lista"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
            Lista
          </Button>
          {activeFilterCount > 0 && (
            <Badge variant="outline" className="text-[10px] h-5 ml-1 bg-primary/10 text-primary border-primary/20">
              <SlidersHorizontal className="h-3 w-3 mr-1" />
              {activeFilterCount}
            </Badge>
          )}
        </div>

        {/* Right: Filters with labels above */}
        <div className="flex flex-wrap items-end gap-2 sm:gap-3 sm:ml-auto">
          {/* Funil - Tabs horizontais */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Filter className="h-3 w-3" />
              Funil
            </label>
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none rounded-lg border border-border/60 bg-muted/40 p-0.5">
              {allowAllFunis && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onFilterFunilChange("todos")}
                  className={cn(
                    "px-3 h-7 text-xs font-medium rounded-md whitespace-nowrap shrink-0",
                    filterFunil === "todos"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  Todos
                </Button>
              )}
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={activeFunis.map((f) => f.id)}
                  strategy={horizontalListSortingStrategy}
                >
                  {activeFunis.map((f) => (
                    <SortableFunilChip
                      key={f.id}
                      funil={f}
                      active={filterFunil === f.id}
                      onSelect={() => onFilterFunilChange(f.id)}
                      onEditEtapas={onEditEtapas ? () => onEditEtapas(f.id) : undefined}
                    />
                  ))}
                </SortableContext>
              </DndContext>
              {onCreateFunil && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0"
                  onClick={onCreateFunil}
                  title="Criar novo funil"
                >
                  <Plus className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
          </div>

          {/* Consultor */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Users className="h-3 w-3" />
              Consultor
            </label>
            <Select value={filterConsultor} onValueChange={onFilterConsultorChange}>
              <SelectTrigger className="w-full xl:w-[140px] h-9 text-xs border-border/60 bg-card">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {consultores.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              Status
            </label>
            <Select value={filterStatus} onValueChange={onFilterStatusChange}>
               <SelectTrigger className="w-full xl:w-[130px] h-9 text-xs border-border/60 bg-card">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Etiquetas */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Tag className="h-3 w-3" />
              Etiquetas
            </label>
            <Select value="todas" onValueChange={(v) => { if (v !== "todas") toggleEtiqueta(v); }}>
              <SelectTrigger className="w-full xl:w-[130px] h-9 text-xs border-border/60 bg-card">
                <SelectValue placeholder="Todas">
                  {filterEtiquetas.length > 0 ? `${filterEtiquetas.length} selecionada(s)` : "Todas"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {etiquetas.map(et => (
                  <SelectItem key={et.id} value={et.id}>
                    <span
                      className="text-[10px] font-bold rounded px-1 py-0.5 border mr-1.5"
                      style={{ backgroundColor: `${et.cor}20`, color: et.cor, borderColor: `${et.cor}40` }}
                    >
                      {et.nome.substring(0, 3).toUpperCase()}
                    </span>
                    {et.nome}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="flex flex-col gap-1 col-span-2 sm:col-span-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider opacity-0 hidden sm:block">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={e => onSearchChange(e.target.value)}
                className="pl-8 h-9 w-full sm:w-[160px] text-xs border-border/60 bg-card"
              />
            </div>
          </div>

          {/* Clear */}
          {hasActive && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground h-9 px-2 text-xs gap-1 hover:text-destructive col-span-2 sm:col-span-1">
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Active tag badges */}
      {filterEtiquetas.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-muted-foreground font-medium">
            Etiquetas ativas:
          </span>
          {filterEtiquetas.map(etId => {
            const et = etiquetas.find(e => e.id === etId);
            if (!et) return null;
            return (
              <button
                key={etId}
                type="button"
                onClick={() => toggleEtiqueta(etId)}
                className="group inline-flex items-center gap-1.5 h-6 pl-2 pr-1.5 rounded-full border text-[11px] font-medium transition-colors"
                style={{
                  backgroundColor: `${et.cor}1A`,
                  color: et.cor,
                  borderColor: `${et.cor}66`,
                }}
                title={`Remover filtro: ${et.nome}`}
              >
                <span
                  className="inline-block h-2 w-2 rounded-full shrink-0"
                  style={{ backgroundColor: et.cor }}
                />
                <span className="leading-none">{et.nome}</span>
                <span
                  className="inline-flex items-center justify-center h-4 w-4 rounded-full transition-colors group-hover:bg-foreground/10"
                  aria-hidden
                >
                  <X className="h-3 w-3" />
                </span>
              </button>
            );
          })}
          {filterEtiquetas.length > 1 && (
            <button
              type="button"
              onClick={() => onFilterEtiquetasChange([])}
              className="text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline ml-1"
            >
              Limpar etiquetas
            </button>
          )}
        </div>
      )}
    </div>
  );
}