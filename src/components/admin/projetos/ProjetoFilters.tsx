import { Search, X, Filter, LayoutGrid, Columns3, Users, Layers } from "lucide-react";
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
  viewMode: "kanban" | "kanban-etapa" | "lista";
  onViewModeChange: (v: "kanban" | "kanban-etapa" | "lista") => void;
  onClearFilters: () => void;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "open", label: "Aberto" },
  { value: "won", label: "Ganho" },
  { value: "lost", label: "Perdido" },
  { value: "archived", label: "Arquivado" },
];

export function ProjetoFilters({
  searchTerm, onSearchChange,
  funis, filterFunil, onFilterFunilChange,
  filterConsultor, onFilterConsultorChange, consultores,
  filterStatus, onFilterStatusChange,
  etiquetas, filterEtiquetas, onFilterEtiquetasChange,
  viewMode, onViewModeChange,
  onClearFilters,
}: Props) {
  const hasActive = filterFunil !== "todos" || filterConsultor !== "todos" || filterStatus !== "todos" || filterEtiquetas.length > 0 || searchTerm.length > 0;

  const toggleEtiqueta = (id: string) => {
    if (filterEtiquetas.includes(id)) {
      onFilterEtiquetasChange(filterEtiquetas.filter(e => e !== id));
    } else {
      onFilterEtiquetasChange([...filterEtiquetas, id]);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-4">
        {/* View mode toggle — pill style */}
        <div className="flex items-center rounded-lg border border-border/60 bg-muted/40 p-0.5">
          <button
            onClick={() => onViewModeChange("kanban")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              viewMode === "kanban"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Users className="h-3.5 w-3.5" />
            Responsável
          </button>
          <button
            onClick={() => onViewModeChange("kanban-etapa")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              viewMode === "kanban-etapa"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="h-3.5 w-3.5" />
            Etapas
          </button>
          <button
            onClick={() => onViewModeChange("lista")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all",
              viewMode === "lista"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
            Lista
          </button>
        </div>

        {/* Filters aligned right */}
        <div className="flex items-center gap-3 ml-auto flex-wrap">
          {/* Funil */}
          <Select value={filterFunil} onValueChange={onFilterFunilChange}>
            <SelectTrigger className="w-[140px] h-8 text-xs border-border/60 bg-card">
              <Filter className="h-3 w-3 mr-1 text-muted-foreground" />
              <SelectValue placeholder="Funil" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os funis</SelectItem>
              {funis.filter(f => f.ativo).map(f => (
                <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Responsável */}
          <Select value={filterConsultor} onValueChange={onFilterConsultorChange}>
            <SelectTrigger className="w-[140px] h-8 text-xs border-border/60 bg-card">
              <SelectValue placeholder="Responsável" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos</SelectItem>
              {consultores.map(c => (
                <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Status */}
          <Select value={filterStatus} onValueChange={onFilterStatusChange}>
            <SelectTrigger className="w-[120px] h-8 text-xs border-border/60 bg-card">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Etiquetas */}
          {etiquetas.length > 0 && (
            <Select value="todas" onValueChange={() => {}}>
              <SelectTrigger className="w-[120px] h-8 text-xs border-border/60 bg-card">
                <SelectValue placeholder="Etiquetas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {etiquetas.map(et => (
                  <SelectItem key={et.id} value={et.id}>{et.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-8 h-8 w-[160px] text-xs border-border/60 bg-card"
            />
          </div>

          {/* Clear */}
          {hasActive && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground h-8 px-2 text-xs gap-1 hover:text-destructive">
              <X className="h-3.5 w-3.5" />
              Limpar
            </Button>
          )}
        </div>
      </div>

      {/* Active tag badges */}
      {etiquetas.length > 0 && filterEtiquetas.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {etiquetas.filter(et => filterEtiquetas.includes(et.id)).map(et => (
            <Badge
              key={et.id}
              className="text-[10px] h-5 px-2 cursor-pointer"
              style={{ backgroundColor: et.cor, borderColor: et.cor }}
              onClick={() => toggleEtiqueta(et.id)}
            >
              {et.nome} ×
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
