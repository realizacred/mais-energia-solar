import { Search, X, Filter } from "lucide-react";
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
  viewMode: "kanban" | "lista";
  onViewModeChange: (v: "kanban" | "lista") => void;
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

  // Count active status filters
  const statusCount = filterStatus !== "todos" ? 1 : 0;

  return (
    <div className="space-y-3">
      {/* ── Top row: View toggle + Filters ── */}
      <div className="flex items-center gap-6">
        {/* View mode tabs */}
        <div className="flex items-center gap-1 border-b-2 border-transparent">
          <button
            onClick={() => onViewModeChange("kanban")}
            className={cn(
              "flex items-center gap-1.5 pb-1.5 px-1 text-sm font-medium transition-colors border-b-2 -mb-[2px]",
              viewMode === "kanban"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Funil
          </button>
          <button
            onClick={() => onViewModeChange("lista")}
            className={cn(
              "flex items-center gap-1.5 pb-1.5 px-1 text-sm font-medium transition-colors border-b-2 -mb-[2px]",
              viewMode === "lista"
                ? "text-primary border-primary"
                : "text-muted-foreground border-transparent hover:text-foreground"
            )}
          >
            ☰ Lista
          </button>
        </div>

        {/* Filters aligned right */}
        <div className="flex items-center gap-4 ml-auto flex-wrap">
          {/* Funil */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              <Filter className="h-2.5 w-2.5" />
              Funil *
            </label>
            <Select value={filterFunil} onValueChange={onFilterFunilChange}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
                <SelectValue placeholder="Vendedores" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Vendedores</SelectItem>
                {funis.filter(f => f.ativo).map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Responsável */}
          <div className="space-y-0.5">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              👤 Responsável
            </label>
            <Select value={filterConsultor} onValueChange={onFilterConsultorChange}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
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
          <div className="space-y-0.5">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              ◎ Status *
            </label>
            <Select value={filterStatus} onValueChange={onFilterStatusChange}>
              <SelectTrigger className="w-[140px] h-8 text-xs">
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
          <div className="space-y-0.5">
            <label className="text-[10px] font-medium text-muted-foreground flex items-center gap-1">
              ◇ Etiquetas
            </label>
            <Select value="todas" onValueChange={() => {}}>
              <SelectTrigger className="w-[120px] h-8 text-xs">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Todas</SelectItem>
                {etiquetas.map(et => (
                  <SelectItem key={et.id} value={et.id}>{et.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar..."
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-8 h-8 w-[140px] text-xs"
            />
          </div>

          {/* Clear */}
          {hasActive && (
            <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground h-8 px-2 text-xs gap-1">
              <X className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Etiquetas inline */}
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
