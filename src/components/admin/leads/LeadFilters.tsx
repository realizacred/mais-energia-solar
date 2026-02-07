import { Search, Filter } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface LeadFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterVisto: string;
  onFilterVistoChange: (value: string) => void;
  filterVendedor: string;
  onFilterVendedorChange: (value: string) => void;
  filterEstado: string;
  onFilterEstadoChange: (value: string) => void;
  vendedores: string[];
  estados: string[];
  onClearFilters: () => void;
}

export function LeadFilters({
  searchTerm,
  onSearchChange,
  filterVisto,
  onFilterVistoChange,
  filterVendedor,
  onFilterVendedorChange,
  filterEstado,
  onFilterEstadoChange,
  vendedores,
  estados,
  onClearFilters,
}: LeadFiltersProps) {
  const hasActiveFilters =
    filterVisto !== "todos" ||
    filterVendedor !== "todos" ||
    filterEstado !== "todos";

  return (
    <div className="flex flex-col gap-4">
      <div className="relative w-full md:w-80">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, telefone, cidade..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span>Filtros:</span>
        </div>

        <Select value={filterVisto} onValueChange={onFilterVistoChange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="visto">Vistos</SelectItem>
            <SelectItem value="nao_visto">Não Vistos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterVendedor} onValueChange={onFilterVendedorChange}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Vendedor" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Vendedores</SelectItem>
            {vendedores.map((v) => (
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterEstado} onValueChange={onFilterEstadoChange}>
          <SelectTrigger className="w-[120px] h-9">
            <SelectValue placeholder="Estado" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Estados</SelectItem>
            {estados.map((e) => (
              <SelectItem key={e} value={e}>
                {e}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
