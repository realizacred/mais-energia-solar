import { Search, Filter, LayoutGrid, List, X } from "lucide-react";
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

interface ConsultorOption { id: string; nome: string; }

interface Props {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  // Funil
  funis: ProjetoFunil[];
  filterFunil: string;
  onFilterFunilChange: (v: string) => void;
  // Responsável
  filterConsultor: string;
  onFilterConsultorChange: (v: string) => void;
  consultores: ConsultorOption[];
  // Status
  filterStatus: string;
  onFilterStatusChange: (v: string) => void;
  // Etiquetas
  etiquetas: ProjetoEtiqueta[];
  filterEtiquetas: string[];
  onFilterEtiquetasChange: (ids: string[]) => void;
  // View
  viewMode: "kanban" | "lista";
  onViewModeChange: (v: "kanban" | "lista") => void;
  onClearFilters: () => void;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "aguardando_documentacao", label: "Aguard. Doc" },
  { value: "em_analise", label: "Em Análise" },
  { value: "aprovado", label: "Aprovado" },
  { value: "em_instalacao", label: "Em Instalação" },
  { value: "instalado", label: "Instalado" },
  { value: "comissionado", label: "Comissionado" },
  { value: "concluido", label: "Concluído" },
  { value: "cancelado", label: "Cancelado" },
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
      <div className="flex flex-wrap items-end gap-3">
        {/* Busca */}
        <div className="flex-1 min-w-[180px] max-w-xs space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Buscar</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Nome, código..."
              value={searchTerm}
              onChange={e => onSearchChange(e.target.value)}
              className="pl-9 h-9"
            />
          </div>
        </div>

        {/* Funil */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Funil</label>
          <Select value={filterFunil} onValueChange={onFilterFunilChange}>
            <SelectTrigger className="w-[150px] h-9">
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

        {/* Responsável */}
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Responsável</label>
          <Select value={filterConsultor} onValueChange={onFilterConsultorChange}>
            <SelectTrigger className="w-[160px] h-9">
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
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</label>
          <Select value={filterStatus} onValueChange={onFilterStatusChange}>
            <SelectTrigger className="w-[150px] h-9">
              <SelectValue placeholder="Todos" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(s => (
                <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Limpar */}
        {hasActive && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground h-9 gap-1">
            <X className="h-3 w-3" />
            Limpar
          </Button>
        )}

        {/* View toggle */}
        <div className="ml-auto flex gap-1">
          <Button
            variant={viewMode === "kanban" ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => onViewModeChange("kanban")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === "lista" ? "default" : "outline"}
            size="icon"
            className="h-9 w-9"
            onClick={() => onViewModeChange("lista")}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Etiquetas */}
      {etiquetas.length > 0 && (
        <div className="space-y-1">
          <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Etiquetas</label>
          <div className="flex flex-wrap gap-1.5">
            {etiquetas.map(et => {
              const isActive = filterEtiquetas.includes(et.id);
              return (
                <Badge
                  key={et.id}
                  variant={isActive ? "default" : "outline"}
                  className="cursor-pointer text-[11px] h-6 px-2 transition-colors"
                  style={isActive ? { backgroundColor: et.cor, borderColor: et.cor } : { borderColor: et.cor, color: et.cor }}
                  onClick={() => toggleEtiqueta(et.id)}
                >
                  {et.nome}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
