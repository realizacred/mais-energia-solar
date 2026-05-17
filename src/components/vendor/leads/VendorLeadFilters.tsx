import { Search, Filter, SlidersHorizontal, AlertTriangle, Clock, CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";
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
    <div className="flex flex-wrap gap-2 w-full sm:w-auto">
      <div className="flex bg-muted/50 p-1 rounded-lg border border-border/40">
        <Button 
          variant={operationalStatus === "urgente" ? "default" : "ghost"} 
          size="sm" 
          className={cn("h-7 text-[11px] px-3", operationalStatus === "urgente" && "bg-destructive text-destructive-foreground hover:bg-destructive/90")}
          onClick={() => onOperationalStatusChange(operationalStatus === "urgente" ? "todos" : "urgente")}
        >
          Urgentes
        </Button>
        <Button 
          variant={operationalStatus === "atencao" ? "default" : "ghost"} 
          size="sm" 
          className={cn("h-7 text-[11px] px-3", operationalStatus === "atencao" && "bg-warning text-warning-foreground hover:bg-warning/90")}
          onClick={() => onOperationalStatusChange(operationalStatus === "atencao" ? "todos" : "atencao")}
        >
          Pendentes
        </Button>
        <Button 
          variant={operationalStatus === "em_dia" ? "default" : "ghost"} 
          size="sm" 
          className={cn("h-7 text-[11px] px-3", operationalStatus === "em_dia" && "bg-success text-success-foreground hover:bg-success/90")}
          onClick={() => onOperationalStatusChange(operationalStatus === "em_dia" ? "todos" : "em_dia")}
        >
          Em dia
        </Button>
        <Button 
          variant={operationalStatus === "todos" ? "secondary" : "ghost"} 
          size="sm" 
          className="h-7 text-[11px] px-3"
          onClick={() => onOperationalStatusChange("todos")}
        >
          Todos
        </Button>
      </div>

      <div className="flex items-center gap-2 ml-auto">
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="h-9 text-xs text-muted-foreground hover:text-foreground"
          >
            Limpar
          </Button>
        )}
      </div>
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
