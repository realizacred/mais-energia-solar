import { Search, X, Filter, List, Layers, Tag, Users } from "lucide-react";
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
  viewMode: "kanban-etapa" | "lista";
  onViewModeChange: (v: "kanban-etapa" | "lista") => void;
  onClearFilters: () => void;
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
      <div className="flex items-end gap-4 flex-wrap">
        {/* Left: Funil | Lista toggle */}
        <div className="flex items-center gap-4 shrink-0">
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
            <Select value={filterFunil} onValueChange={onFilterFunilChange}>
              <SelectTrigger className="w-[150px] h-9 text-xs border-border/60 bg-card">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos</SelectItem>
                {funis.filter(f => f.ativo).map(f => (
                  <SelectItem key={f.id} value={f.id}>{f.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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