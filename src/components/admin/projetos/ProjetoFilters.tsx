import { Search, Filter, LayoutGrid, List } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ProjetoEtapaCategoria } from "@/hooks/useProjetoPipeline";

interface ConsultorOption { id: string; nome: string; }

interface Props {
  searchTerm: string;
  onSearchChange: (v: string) => void;
  filterCategoria: string;
  onFilterCategoriaChange: (v: string) => void;
  filterConsultor: string;
  onFilterConsultorChange: (v: string) => void;
  consultores: ConsultorOption[];
  viewMode: "kanban" | "lista";
  onViewModeChange: (v: "kanban" | "lista") => void;
  onClearFilters: () => void;
}

const CATEGORIAS: { value: string; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "aberto", label: "🔵 Abertos" },
  { value: "ganho", label: "🟢 Ganhos" },
  { value: "perdido", label: "🔴 Perdidos" },
  { value: "excluido", label: "⚫ Excluídos" },
];

export function ProjetoFilters({
  searchTerm, onSearchChange,
  filterCategoria, onFilterCategoriaChange,
  filterConsultor, onFilterConsultorChange,
  consultores,
  viewMode, onViewModeChange,
  onClearFilters,
}: Props) {
  const hasActive = filterCategoria !== "todos" || filterConsultor !== "todos";

  return (
    <div className="flex flex-wrap items-end gap-3">
      {/* Busca */}
      <div className="flex-1 min-w-[180px] max-w-sm space-y-1">
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

      {/* Status */}
      <div className="space-y-1">
        <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Status</label>
        <Select value={filterCategoria} onValueChange={onFilterCategoriaChange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Todos" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
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

      {/* Limpar */}
      {hasActive && (
        <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground h-9">
          Limpar filtros
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
  );
}
