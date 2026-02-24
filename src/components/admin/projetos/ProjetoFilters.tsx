import { useState, useMemo } from "react";
import { Search, X, Filter, List, Layers, Tag, Users, Pencil, Plus, ArrowUpDown, Check } from "lucide-react";
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

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "open", label: "Aberto" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
  { value: "archived", label: "Excluído" },
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
  const hasActive = filterConsultor !== "todos" || filterStatus !== "todos" || filterEtiquetas.length > 0 || searchTerm.length > 0;

  const activeFunis = funis.filter(f => f.ativo);

  const toggleEtiqueta = (id: string) => {
    if (filterEtiquetas.includes(id)) {
      onFilterEtiquetasChange(filterEtiquetas.filter(e => e !== id));
    } else {
      onFilterEtiquetasChange([...filterEtiquetas, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4 flex-wrap">
        {/* Left: Funil | Lista toggle */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0 overflow-x-auto">
          <button
            onClick={() => onViewModeChange("kanban-consultor")}
            className={cn(
              "flex items-center gap-1.5 pb-1 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
              viewMode === "kanban-consultor"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-4 w-4" />
            Consultores
          </button>
          <button
            onClick={() => onViewModeChange("kanban-etapa")}
            className={cn(
              "flex items-center gap-1.5 pb-1 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
              viewMode === "kanban-etapa"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <Filter className="h-4 w-4" />
            Funil
          </button>
          <button
            onClick={() => onViewModeChange("lista")}
            className={cn(
              "flex items-center gap-1.5 pb-1 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap",
              viewMode === "lista"
                ? "border-foreground text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            <List className="h-4 w-4" />
            Lista
          </button>
        </div>

        {/* Right: Filters with labels above */}
        <div className="grid grid-cols-2 lg:flex lg:items-end gap-2 lg:gap-3 lg:ml-auto">
          {/* Funil - Tabs horizontais */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Filter className="h-3 w-3" />
              Funil
            </label>
            <div className="flex items-center gap-0.5 overflow-x-auto scrollbar-none rounded-lg border border-border/60 bg-muted/40 p-0.5">
              {allowAllFunis && (
                <button
                  onClick={() => onFilterFunilChange("todos")}
                  className={cn(
                    "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap shrink-0",
                    filterFunil === "todos"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                  )}
                >
                  Todos
                </button>
              )}
              {activeFunis.map(f => (
                <div key={f.id} className="flex items-center shrink-0">
                  <button
                    onClick={() => onFilterFunilChange(f.id)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-medium rounded-md transition-all whitespace-nowrap",
                      filterFunil === f.id
                        ? "bg-background text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground hover:bg-background/50"
                    )}
                  >
                    {f.nome}
                  </button>
                  {onEditEtapas && (
                    <button
                      onClick={(e) => { e.stopPropagation(); onEditEtapas(f.id); }}
                      className="p-0.5 rounded hover:bg-muted transition-colors -ml-0.5"
                      title={`Editar etapas de "${f.nome}"`}
                    >
                      <Pencil className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                    </button>
                  )}
                </div>
              ))}
              {onCreateFunil && (
                <button
                  onClick={onCreateFunil}
                  className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-background/50 transition-colors shrink-0"
                  title="Criar novo funil"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
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
              <SelectTrigger className="w-full lg:w-[140px] h-9 text-xs border-border/60 bg-card">
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
              <SelectTrigger className="w-full lg:w-[130px] h-9 text-xs border-border/60 bg-card">
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
              <SelectTrigger className="w-full lg:w-[130px] h-9 text-xs border-border/60 bg-card">
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
          <div className="flex flex-col gap-1 col-span-2 lg:col-span-1">
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
        <div className="flex flex-wrap gap-1.5">
          {filterEtiquetas.map(etId => {
            const et = etiquetas.find(e => e.id === etId);
            return et ? (
              <Badge
                key={etId}
                className="text-[10px] h-5 px-2 cursor-pointer border"
                style={{ backgroundColor: `${et.cor}20`, color: et.cor, borderColor: `${et.cor}40` }}
                onClick={() => toggleEtiqueta(etId)}
              >
                {et.nome} ×
              </Badge>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
}