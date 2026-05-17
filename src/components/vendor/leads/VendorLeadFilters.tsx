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
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10 h-10 shadow-sm"
          />
        </div>
        <div className="sm:hidden">
          <FilterControls />
        </div>
      </div>

      <div className="hidden sm:flex flex-row items-center justify-between pt-2 border-t border-border/40">
        <FilterControls />
      </div>
    </div>
  );
}
