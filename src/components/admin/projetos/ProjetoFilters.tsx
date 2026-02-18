import { useState, useMemo } from "react";
import { Search, X, Filter, List, Layers, Tag, Users, Pencil, Plus, ArrowUpDown, ChevronDown, Check } from "lucide-react";
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  const [funilPopoverOpen, setFunilPopoverOpen] = useState(false);
  const [funilSearch, setFunilSearch] = useState("");

  const activeFunis = funis.filter(f => f.ativo);
  const filteredFunis = useMemo(() => {
    if (!funilSearch.trim()) return activeFunis;
    const q = funilSearch.toLowerCase();
    return activeFunis.filter(f => f.nome.toLowerCase().includes(q));
  }, [activeFunis, funilSearch]);

  const selectedFunilNome = filterFunil === "todos" ? "Todos os funis" : (funis.find(f => f.id === filterFunil)?.nome || "Selecione");

  const toggleEtiqueta = (id: string) => {
    if (filterEtiquetas.includes(id)) {
      onFilterEtiquetasChange(filterEtiquetas.filter(e => e !== id));
    } else {
      onFilterEtiquetasChange([...filterEtiquetas, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-end gap-4 flex-wrap">
        {/* Left: Funil | Lista toggle */}
        <div className="flex items-center gap-4 shrink-0">
          <button
            onClick={() => onViewModeChange("kanban-consultor")}
            className={cn(
              "flex items-center gap-1.5 pb-1 text-sm font-semibold border-b-2 transition-colors",
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
              "flex items-center gap-1.5 pb-1 text-sm font-semibold border-b-2 transition-colors",
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
              "flex items-center gap-1.5 pb-1 text-sm font-semibold border-b-2 transition-colors",
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
        <div className="flex items-end gap-3 ml-auto flex-wrap">
          {/* Funil */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Filter className="h-3 w-3" />
              Funil
            </label>
            <Popover open={funilPopoverOpen} onOpenChange={(v) => { setFunilPopoverOpen(v); if (!v) setFunilSearch(""); }}>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-between w-[170px] h-9 px-3 text-xs rounded-md border border-border/60 bg-card hover:bg-accent/50 transition-colors">
                  <span className="truncate font-medium">{selectedFunilNome}</span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0 ml-1" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-[220px] p-0" sideOffset={4}>
                {/* Search */}
                <div className="p-2 border-b border-border/40">
                  <div className="relative">
                    <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                    <Input
                      placeholder="Procurar..."
                      value={funilSearch}
                      onChange={e => setFunilSearch(e.target.value)}
                      className="h-8 pl-7 text-xs"
                      autoFocus
                    />
                  </div>
                </div>
                {/* List */}
                <div className="max-h-[200px] overflow-y-auto py-1">
                  {allowAllFunis && (
                    <div
                      className={cn(
                        "flex items-center px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors",
                        filterFunil === "todos" && "bg-accent/30"
                      )}
                    >
                      <button
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        onClick={() => { onFilterFunilChange("todos"); setFunilPopoverOpen(false); setFunilSearch(""); }}
                      >
                        {filterFunil === "todos" && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <span className={cn("text-xs truncate", filterFunil === "todos" ? "font-semibold text-foreground" : "text-foreground/80")}>Todos os funis</span>
                      </button>
                    </div>
                  )}
                  {filteredFunis.map(f => (
                    <div
                      key={f.id}
                      className={cn(
                        "flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-accent/50 transition-colors group",
                        filterFunil === f.id && "bg-accent/30"
                      )}
                    >
                      <button
                        className="flex items-center gap-2 flex-1 min-w-0 text-left"
                        onClick={() => { onFilterFunilChange(f.id); setFunilPopoverOpen(false); setFunilSearch(""); }}
                      >
                        {filterFunil === f.id && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                        <span className={cn("text-xs truncate", filterFunil === f.id ? "font-semibold text-foreground" : "text-foreground/80")}>{f.nome}</span>
                      </button>
                      {onEditEtapas && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setFunilPopoverOpen(false); onEditEtapas(f.id); }}
                          className="p-1 rounded hover:bg-muted transition-colors opacity-60 hover:opacity-100"
                          title={`Editar etapas de "${f.nome}"`}
                        >
                          <Pencil className="h-3.5 w-3.5 text-primary" />
                        </button>
                      )}
                    </div>
                  ))}
                  {filteredFunis.length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-3">Nenhum funil encontrado</p>
                  )}
                </div>
                {/* Actions */}
                <div className="border-t border-border/40 p-1.5 space-y-0.5">
                  {onCreateFunil && (
                    <button
                      onClick={() => { setFunilPopoverOpen(false); onCreateFunil(); }}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-primary hover:bg-primary/5 rounded-md transition-colors font-medium"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Criar novo
                    </button>
                  )}
                  {onReorderFunis && (
                    <button
                      onClick={() => { setFunilPopoverOpen(false); onReorderFunis(); }}
                      className="flex items-center gap-2 w-full px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent/50 rounded-md transition-colors"
                    >
                      <ArrowUpDown className="h-3.5 w-3.5" />
                      Reorganizar
                    </button>
                  )}
                </div>
              </PopoverContent>
            </Popover>
          </div>

          {/* Consultor */}
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
              <Users className="h-3 w-3" />
              Consultor
            </label>
            <Select value={filterConsultor} onValueChange={onFilterConsultorChange}>
              <SelectTrigger className="w-[150px] h-9 text-xs border-border/60 bg-card">
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
              <SelectTrigger className="w-[140px] h-9 text-xs border-border/60 bg-card">
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
              <SelectTrigger className="w-[140px] h-9 text-xs border-border/60 bg-card">
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
          <div className="flex flex-col gap-1">
            <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider opacity-0">
              Buscar
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Buscar..."
                value={searchTerm}
                onChange={e => onSearchChange(e.target.value)}
                className="pl-8 h-9 w-[160px] text-xs border-border/60 bg-card"
              />
            </div>
          </div>

          {/* Clear */}
          {hasActive && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground h-9 px-2 text-xs gap-1 hover:text-destructive">
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