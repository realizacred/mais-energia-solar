import { Search, Filter, SlidersHorizontal } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface VendorLeadFiltersProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  filterVisto: string;
  onFilterVistoChange: (value: string) => void;
  filterEstado: string;
  onFilterEstadoChange: (value: string) => void;
  filterStatus: string;
  onFilterStatusChange: (value: string) => void;
  excludeTerminal: boolean;
  onExcludeTerminalChange: (value: boolean) => void;
  maxAgeDays: number | null;
  onMaxAgeDaysChange: (value: number | null) => void;
  operationalStatus: string;
  onOperationalStatusChange: (value: string) => void;
  estados: string[];
  statuses: { id: string; nome: string }[];
  onClearFilters: () => void;
}

export function VendorLeadFilters({
  searchTerm,
  onSearchChange,
  filterVisto,
  onFilterVistoChange,
  filterEstado,
  onFilterEstadoChange,
  filterStatus,
  onFilterStatusChange,
  excludeTerminal,
  onExcludeTerminalChange,
  maxAgeDays,
  onMaxAgeDaysChange,
  operationalStatus,
  onOperationalStatusChange,
  estados,
  statuses,
  onClearFilters,
}: VendorLeadFiltersProps) {
  const isMobile = useIsMobile();
  const hasActiveFilters =
    filterVisto !== "todos" ||
    filterEstado !== "todos" ||
    filterStatus !== "todos" ||
    excludeTerminal ||
    maxAgeDays !== null ||
    operationalStatus !== "todos";

  const FilterControls = () => (
    <div className="grid grid-cols-1 sm:flex sm:flex-wrap gap-2 w-full sm:w-auto">
      <div className="space-y-1.5 sm:space-y-0">
        <label className="text-[10px] font-medium uppercase text-muted-foreground sm:hidden px-1">Prioridade</label>
        <Select value={operationalStatus} onValueChange={onOperationalStatusChange}>
          <SelectTrigger className="w-full sm:w-[150px] h-9">
            <SelectValue placeholder="Prioridade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todas Prioridades</SelectItem>
            <SelectItem value="em_dia">Em dia</SelectItem>
            <SelectItem value="atencao">Atenção</SelectItem>
            <SelectItem value="urgente">Urgente</SelectItem>
            <SelectItem value="reativacao">Reativação</SelectItem>
            <SelectItem value="backlog_antigo">Backlog Antigo</SelectItem>
            <SelectItem value="finalizado">Finalizado</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 sm:space-y-0">
        <label className="text-[10px] font-medium uppercase text-muted-foreground sm:hidden px-1">Visualização</label>
        <Select value={filterVisto} onValueChange={onFilterVistoChange}>
          <SelectTrigger className="w-full sm:w-[130px] h-9">
            <SelectValue placeholder="Visualização" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="visto">Vistos</SelectItem>
            <SelectItem value="nao_visto">Não Vistos</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 sm:space-y-0">
        <label className="text-[10px] font-medium uppercase text-muted-foreground sm:hidden px-1">Status</label>
        <Select value={filterStatus} onValueChange={onFilterStatusChange}>
          <SelectTrigger className="w-full sm:w-[140px] h-9">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos Status</SelectItem>
            <SelectItem value="novo">Novo</SelectItem>
            {statuses.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 sm:space-y-0">
        <label className="text-[10px] font-medium uppercase text-muted-foreground sm:hidden px-1">Período</label>
        <Select 
          value={maxAgeDays?.toString() || "todos"} 
          onValueChange={(val) => onMaxAgeDaysChange(val === "todos" ? null : parseInt(val))}
        >
          <SelectTrigger className="w-full sm:w-[130px] h-9">
            <SelectValue placeholder="Período" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todo o período</SelectItem>
            <SelectItem value="30">Últimos 30 dias</SelectItem>
            <SelectItem value="60">Últimos 60 dias</SelectItem>
            <SelectItem value="90">Últimos 90 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-1.5 sm:space-y-0">
        <label className="text-[10px] font-medium uppercase text-muted-foreground sm:hidden px-1">Estado</label>
        <Select value={filterEstado} onValueChange={onFilterEstadoChange}>
          <SelectTrigger className="w-full sm:w-[120px] h-9">
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
      </div>

      <div className="space-y-1.5 sm:space-y-0 flex items-center gap-2">
        <Button
          variant={excludeTerminal ? "secondary" : "outline"}
          size="sm"
          className="h-9 px-3 gap-2 text-xs font-medium"
          onClick={() => onExcludeTerminalChange(!excludeTerminal)}
        >
          {excludeTerminal ? "Ocultar Finalizados" : "Mostrar Finalizados"}
        </Button>
      </div>

      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          className="text-muted-foreground hover:text-foreground w-full sm:w-auto mt-2 sm:mt-0"
        >
          Limpar filtros
        </Button>
      )}
    </div>
  );

  return (
    <div className="flex flex-col gap-3 sm:gap-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome, telefone, cidade ou ID..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10"
          />
        </div>
        {isMobile && (
          <Sheet>
            <SheetTrigger asChild>
              <Button variant="outline" size="icon" className="h-10 w-10 shrink-0 border-primary/20 bg-primary/5 text-primary relative">
                <SlidersHorizontal className="h-4 w-4" />
                {hasActiveFilters && (
                  <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary ring-2 ring-background" />
                )}
              </Button>
            </SheetTrigger>
            <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 h-[60vh]">
              <SheetHeader className="mb-6 text-left">
                <SheetTitle>Filtros</SheetTitle>
                <SheetDescription>Refine sua lista de leads</SheetDescription>
              </SheetHeader>
              <div className="space-y-6">
                <FilterControls />
              </div>
            </SheetContent>
          </Sheet>
        )}
      </div>

      <div className="hidden sm:flex flex-row flex-wrap items-center gap-3 pt-2 border-t">
        <div className="flex items-center gap-2 text-sm text-muted-foreground shrink-0">
          <Filter className="w-4 h-4" />
          <span>Filtros:</span>
        </div>
        <FilterControls />
      </div>
    </div>
  );
}
