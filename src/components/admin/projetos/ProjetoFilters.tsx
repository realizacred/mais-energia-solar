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
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, código..."
            value={searchTerm}
            onChange={e => onSearchChange(e.target.value)}
            className="pl-9 h-9"
          />
        </div>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
        </div>

        <Select value={filterCategoria} onValueChange={onFilterCategoriaChange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIAS.map(c => (
              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterConsultor} onValueChange={onFilterConsultorChange}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Responsável" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            {consultores.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActive && (
          <Button variant="ghost" size="sm" onClick={onClearFilters} className="text-muted-foreground">
            Limpar filtros
          </Button>
        )}

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
    </div>
  );
}
