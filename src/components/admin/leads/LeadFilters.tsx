import { Search, Filter, X } from "lucide-react";
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
import type { VendedorFilter } from "@/hooks/useLeads";
import type { LeadStatus } from "@/types/lead";

interface LeadFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterVisto: string;
  onFilterVistoChange: (value: string) => void;
  filterVendedor: string;
  onFilterVendedorChange: (value: string) => void;
  filterEstado: string;
  onFilterEstadoChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  vendedores: VendedorFilter[];
  estados: string[];
  statuses: LeadStatus[];
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
  filterStatus,
  onFilterStatusChange,
  vendedores,
  estados,
  statuses,
  onClearFilters,
}: LeadFiltersProps) {
  const activeCount = [
    filterVisto !== "todos" ? 1 : 0,
    filterVendedor !== "todos" ? 1 : 0,
    filterEstado !== "todos" ? 1 : 0,
    filterStatus !== "todos" ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

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

      <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Filter className="w-4 h-4" />
          <span>Filtros</span>
          {activeCount > 0 && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-xs px-1.5 py-0 h-5">
              {activeCount}
            </Badge>
          )}
        </div>

        <Select value={filterVisto} onValueChange={onFilterVistoChange}>
          <SelectTrigger className="w-[140px] h-9">
            <SelectValue placeholder="Visualização" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="visto">Vistos</SelectItem>
            <SelectItem value="nao_visto">Não Vistos</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                <div className="flex items-center gap-2">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: s.cor }}
                  />
                  {s.nome}
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterVendedor} onValueChange={onFilterVendedorChange}>
          <SelectTrigger className="w-[160px] h-9">
            <SelectValue placeholder="Consultor" />
          </SelectTrigger>
          <SelectContent className="z-50 bg-popover border border-border shadow-lg">
            <SelectItem value="todos">Todos Consultores</SelectItem>
            <SelectItem value="sem_vendedor">⚠️ Sem Consultor</SelectItem>
            {vendedores.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.nome}
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

        {activeCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="text-muted-foreground hover:text-foreground gap-1.5"
          >
            <X className="w-3.5 h-3.5" />
            Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}
