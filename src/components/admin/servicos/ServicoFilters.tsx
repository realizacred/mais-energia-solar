import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
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
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, CalendarIcon, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { ServicoFilters as FiltersType, tipoOptions, statusConfig, Instalador } from "./types";

interface ServicoFiltersProps {
  filters: FiltersType;
  onFiltersChange: (filters: FiltersType) => void;
  instaladores: Instalador[];
}

export function ServicoFilters({ filters, onFiltersChange, instaladores }: ServicoFiltersProps) {
  const updateFilter = <K extends keyof FiltersType>(key: K, value: FiltersType[K]) => {
    onFiltersChange({ ...filters, [key]: value });
  };

  const clearFilters = () => {
    onFiltersChange({
      status: "todos",
      tipo: "todos",
      instaladorId: "todos",
      dataInicio: null,
      dataFim: null,
      busca: "",
    });
  };

  const hasActiveFilters = 
    filters.status !== "todos" || 
    filters.tipo !== "todos" || 
    filters.instaladorId !== "todos" ||
    filters.dataInicio !== null ||
    filters.dataFim !== null ||
    filters.busca !== "";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        {/* Busca por texto */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente, cidade, bairro..."
            value={filters.busca}
            onChange={(e) => updateFilter("busca", e.target.value)}
            className="pl-9"
          />
        </div>

        {/* Filtro por Status */}
        <Select value={filters.status} onValueChange={(v) => updateFilter("status", v)}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            {Object.entries(statusConfig).map(([key, config]) => (
              <SelectItem key={key} value={key}>{config.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro por Tipo */}
        <Select value={filters.tipo} onValueChange={(v) => updateFilter("tipo", v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Tipo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Tipos</SelectItem>
            {tipoOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Filtro por Instalador */}
        <Select value={filters.instaladorId} onValueChange={(v) => updateFilter("instaladorId", v)}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Instalador" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Instaladores</SelectItem>
            {instaladores.map((inst) => (
              <SelectItem key={inst.id} value={inst.id}>{inst.nome}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        {/* Período - Data Início */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !filters.dataInicio && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dataInicio ? format(filters.dataInicio, "dd/MM/yy") : "De"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dataInicio || undefined}
              onSelect={(date) => updateFilter("dataInicio", date || null)}
              locale={ptBR}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {/* Período - Data Fim */}
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "w-[140px] justify-start text-left font-normal",
                !filters.dataFim && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {filters.dataFim ? format(filters.dataFim, "dd/MM/yy") : "Até"}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={filters.dataFim || undefined}
              onSelect={(date) => updateFilter("dataFim", date || null)}
              locale={ptBR}
              className="p-3 pointer-events-auto"
            />
          </PopoverContent>
        </Popover>

        {hasActiveFilters && (
          <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
            <X className="h-4 w-4" />
            Limpar
          </Button>
        )}
      </div>
    </div>
  );
}
