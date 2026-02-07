 import { useState } from "react";
 import { Card, CardContent } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Input } from "@/components/ui/input";
 import { 
   Filter, 
   X, 
   ChevronDown,
   ChevronUp,
   Calendar,
   TrendingUp,
   MapPin,
   Zap,
   Search,
   SlidersHorizontal
 } from "lucide-react";
 import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
 import { Calendar as CalendarComponent } from "@/components/ui/calendar";
 import { format } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import { cn } from "@/lib/utils";
 
 export interface AdvancedFiltersState {
   searchTerm: string;
   filterVisto: string;
   filterEstado: string;
   filterStatus: string;
   consumoMin: number | null;
   consumoMax: number | null;
   dateFrom: Date | null;
   dateTo: Date | null;
   tipoTelhado: string;
   scoreLevel: string;
 }
 
 interface AdvancedFiltersProps {
   filters: AdvancedFiltersState;
   onFiltersChange: (filters: AdvancedFiltersState) => void;
   estados: string[];
   statuses: { id: string; nome: string; cor: string }[];
   tiposTelhado?: string[];
   hasScores?: boolean;
 }
 
 const DEFAULT_TIPOS_TELHADO = [
   "Cerâmico",
   "Fibrocimento",
   "Metálico",
   "Laje",
   "Outro",
 ];
 
 export function AdvancedFilters({
   filters,
   onFiltersChange,
   estados,
   statuses,
   tiposTelhado = DEFAULT_TIPOS_TELHADO,
   hasScores = false,
 }: AdvancedFiltersProps) {
   const [expanded, setExpanded] = useState(false);
 
   const updateFilter = <K extends keyof AdvancedFiltersState>(
     key: K,
     value: AdvancedFiltersState[K]
   ) => {
     onFiltersChange({ ...filters, [key]: value });
   };
 
   const clearFilters = () => {
     onFiltersChange({
       searchTerm: "",
       filterVisto: "todos",
       filterEstado: "todos",
       filterStatus: "todos",
       consumoMin: null,
       consumoMax: null,
       dateFrom: null,
       dateTo: null,
       tipoTelhado: "todos",
       scoreLevel: "todos",
     });
   };
 
   const activeFiltersCount = [
     filters.filterVisto !== "todos",
     filters.filterEstado !== "todos",
     filters.filterStatus !== "todos",
     filters.consumoMin !== null,
     filters.consumoMax !== null,
     filters.dateFrom !== null,
     filters.dateTo !== null,
     filters.tipoTelhado !== "todos",
     filters.scoreLevel !== "todos",
   ].filter(Boolean).length;
 
   return (
     <Card className="border-dashed">
       <CardContent className="p-3 space-y-3">
         {/* Search and Toggle Row */}
         <div className="flex gap-2">
           <div className="relative flex-1">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
             <Input
               placeholder="Buscar por nome, telefone, cidade ou código..."
               value={filters.searchTerm}
               onChange={(e) => updateFilter("searchTerm", e.target.value)}
               className="pl-9"
             />
           </div>
           <Button
             variant={expanded ? "secondary" : "outline"}
             size="sm"
             onClick={() => setExpanded(!expanded)}
             className="gap-1 shrink-0"
           >
             <SlidersHorizontal className="h-4 w-4" />
             Filtros
             {activeFiltersCount > 0 && (
               <Badge variant="destructive" className="ml-1 h-5 w-5 p-0 text-xs">
                 {activeFiltersCount}
               </Badge>
             )}
             {expanded ? (
               <ChevronUp className="h-4 w-4" />
             ) : (
               <ChevronDown className="h-4 w-4" />
             )}
           </Button>
           {activeFiltersCount > 0 && (
             <Button
               variant="ghost"
               size="sm"
               onClick={clearFilters}
               className="gap-1 text-muted-foreground shrink-0"
             >
               <X className="h-4 w-4" />
               Limpar
             </Button>
           )}
         </div>
 
         {/* Quick Filters */}
         <div className="flex flex-wrap gap-2">
           {/* Visualização */}
           <select
             className="h-9 px-3 rounded-md border border-input bg-background text-sm"
             value={filters.filterVisto}
             onChange={(e) => updateFilter("filterVisto", e.target.value)}
           >
             <option value="todos">👁️ Todos</option>
             <option value="visto">✓ Vistos</option>
             <option value="nao_visto">○ Não vistos</option>
           </select>
 
           {/* Estado */}
           <select
             className="h-9 px-3 rounded-md border border-input bg-background text-sm"
             value={filters.filterEstado}
             onChange={(e) => updateFilter("filterEstado", e.target.value)}
           >
             <option value="todos">📍 Todos os estados</option>
             {estados.map((estado) => (
               <option key={estado} value={estado}>
                 {estado}
               </option>
             ))}
           </select>
 
           {/* Status */}
           <select
             className="h-9 px-3 rounded-md border border-input bg-background text-sm"
             value={filters.filterStatus}
             onChange={(e) => updateFilter("filterStatus", e.target.value)}
           >
             <option value="todos">🏷️ Todos os status</option>
             <option value="novo">Novo</option>
             {statuses.map((status) => (
               <option key={status.id} value={status.id}>
                 {status.nome}
               </option>
             ))}
           </select>
 
           {/* Score Level (if available) */}
           {hasScores && (
             <select
               className="h-9 px-3 rounded-md border border-input bg-background text-sm"
               value={filters.scoreLevel}
               onChange={(e) => updateFilter("scoreLevel", e.target.value)}
             >
               <option value="todos">🎯 Score</option>
               <option value="hot">🔥 Quentes</option>
               <option value="warm">☀️ Mornos</option>
               <option value="cold">❄️ Frios</option>
             </select>
           )}
         </div>
 
         {/* Expanded Filters */}
         {expanded && (
           <div className="pt-3 border-t space-y-3">
             <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
               {/* Consumo Range */}
               <div className="space-y-1">
                 <label className="text-xs font-medium flex items-center gap-1">
                   <Zap className="h-3 w-3" />
                   Consumo (kWh)
                 </label>
                 <div className="flex gap-2">
                   <Input
                     type="number"
                     placeholder="Mín"
                     value={filters.consumoMin || ""}
                     onChange={(e) =>
                       updateFilter(
                         "consumoMin",
                         e.target.value ? Number(e.target.value) : null
                       )
                     }
                     className="h-9"
                   />
                   <Input
                     type="number"
                     placeholder="Máx"
                     value={filters.consumoMax || ""}
                     onChange={(e) =>
                       updateFilter(
                         "consumoMax",
                         e.target.value ? Number(e.target.value) : null
                       )
                     }
                     className="h-9"
                   />
                 </div>
               </div>
 
               {/* Tipo de Telhado */}
               <div className="space-y-1">
                 <label className="text-xs font-medium flex items-center gap-1">
                   <MapPin className="h-3 w-3" />
                   Tipo de Telhado
                 </label>
                 <select
                   className="w-full h-9 px-3 rounded-md border border-input bg-background text-sm"
                   value={filters.tipoTelhado}
                   onChange={(e) => updateFilter("tipoTelhado", e.target.value)}
                 >
                   <option value="todos">Todos</option>
                   {tiposTelhado.map((tipo) => (
                     <option key={tipo} value={tipo}>
                       {tipo}
                     </option>
                   ))}
                 </select>
               </div>
 
               {/* Date From */}
               <div className="space-y-1">
                 <label className="text-xs font-medium flex items-center gap-1">
                   <Calendar className="h-3 w-3" />
                   Data inicial
                 </label>
                 <Popover>
                   <PopoverTrigger asChild>
                     <Button
                       variant="outline"
                       className={cn(
                         "w-full h-9 justify-start text-left font-normal",
                         !filters.dateFrom && "text-muted-foreground"
                       )}
                     >
                       {filters.dateFrom
                         ? format(filters.dateFrom, "dd/MM/yyyy")
                         : "Selecionar"}
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-auto p-0" align="start">
                     <CalendarComponent
                       mode="single"
                       selected={filters.dateFrom || undefined}
                       onSelect={(date) => updateFilter("dateFrom", date || null)}
                       locale={ptBR}
                     />
                   </PopoverContent>
                 </Popover>
               </div>
 
               {/* Date To */}
               <div className="space-y-1">
                 <label className="text-xs font-medium flex items-center gap-1">
                   <Calendar className="h-3 w-3" />
                   Data final
                 </label>
                 <Popover>
                   <PopoverTrigger asChild>
                     <Button
                       variant="outline"
                       className={cn(
                         "w-full h-9 justify-start text-left font-normal",
                         !filters.dateTo && "text-muted-foreground"
                       )}
                     >
                       {filters.dateTo
                         ? format(filters.dateTo, "dd/MM/yyyy")
                         : "Selecionar"}
                     </Button>
                   </PopoverTrigger>
                   <PopoverContent className="w-auto p-0" align="start">
                     <CalendarComponent
                       mode="single"
                       selected={filters.dateTo || undefined}
                       onSelect={(date) => updateFilter("dateTo", date || null)}
                       locale={ptBR}
                     />
                   </PopoverContent>
                 </Popover>
               </div>
             </div>
 
             {/* Active Filters Summary */}
             {activeFiltersCount > 0 && (
               <div className="flex flex-wrap items-center gap-2 pt-2">
                 <span className="text-xs text-muted-foreground">Filtros ativos:</span>
                 {filters.filterVisto !== "todos" && (
                   <Badge variant="secondary" className="gap-1">
                     {filters.filterVisto === "visto" ? "Vistos" : "Não vistos"}
                     <X
                       className="h-3 w-3 cursor-pointer"
                       onClick={() => updateFilter("filterVisto", "todos")}
                     />
                   </Badge>
                 )}
                 {filters.filterEstado !== "todos" && (
                   <Badge variant="secondary" className="gap-1">
                     {filters.filterEstado}
                     <X
                       className="h-3 w-3 cursor-pointer"
                       onClick={() => updateFilter("filterEstado", "todos")}
                     />
                   </Badge>
                 )}
                 {filters.filterStatus !== "todos" && (
                   <Badge variant="secondary" className="gap-1">
                     {filters.filterStatus === "novo"
                       ? "Novo"
                       : statuses.find((s) => s.id === filters.filterStatus)?.nome}
                     <X
                       className="h-3 w-3 cursor-pointer"
                       onClick={() => updateFilter("filterStatus", "todos")}
                     />
                   </Badge>
                 )}
                 {(filters.consumoMin || filters.consumoMax) && (
                   <Badge variant="secondary" className="gap-1">
                     Consumo: {filters.consumoMin || 0} - {filters.consumoMax || "∞"} kWh
                     <X
                       className="h-3 w-3 cursor-pointer"
                       onClick={() => {
                         updateFilter("consumoMin", null);
                         updateFilter("consumoMax", null);
                       }}
                     />
                   </Badge>
                 )}
                 {filters.tipoTelhado !== "todos" && (
                   <Badge variant="secondary" className="gap-1">
                     {filters.tipoTelhado}
                     <X
                       className="h-3 w-3 cursor-pointer"
                       onClick={() => updateFilter("tipoTelhado", "todos")}
                     />
                   </Badge>
                 )}
                 {(filters.dateFrom || filters.dateTo) && (
                   <Badge variant="secondary" className="gap-1">
                     {filters.dateFrom
                       ? format(filters.dateFrom, "dd/MM")
                       : "Início"}{" "}
                     -{" "}
                     {filters.dateTo ? format(filters.dateTo, "dd/MM") : "Fim"}
                     <X
                       className="h-3 w-3 cursor-pointer"
                       onClick={() => {
                         updateFilter("dateFrom", null);
                         updateFilter("dateTo", null);
                       }}
                     />
                   </Badge>
                 )}
               </div>
             )}
           </div>
         )}
       </CardContent>
     </Card>
   );
 }