 import { useState } from "react";
 import { Button } from "@/components/ui/button";
 import { Input } from "@/components/ui/input";
 import {
   Select,
   SelectContent,
   SelectItem,
   SelectTrigger,
   SelectValue,
 } from "@/components/ui/select";
 import { Badge } from "@/components/ui/badge";
 import { Search, Filter, X, Calendar, User, MapPin, Zap } from "lucide-react";
 import { format, subDays, isAfter, isBefore } from "date-fns";
 
 interface Vendedor {
   nome: string;
 }
 
 interface PipelineFiltersProps {
   searchTerm: string;
   onSearchChange: (value: string) => void;
   selectedVendedor: string;
   onVendedorChange: (value: string) => void;
   selectedEstado: string;
   onEstadoChange: (value: string) => void;
   consumoRange: string;
   onConsumoRangeChange: (value: string) => void;
   dateRange: string;
   onDateRangeChange: (value: string) => void;
   vendedores: Vendedor[];
   estados: string[];
   activeFiltersCount: number;
   onClearFilters: () => void;
 }
 
 export function PipelineFilters({
   searchTerm,
   onSearchChange,
   selectedVendedor,
   onVendedorChange,
   selectedEstado,
   onEstadoChange,
   consumoRange,
   onConsumoRangeChange,
   dateRange,
   onDateRangeChange,
   vendedores,
   estados,
   activeFiltersCount,
   onClearFilters,
 }: PipelineFiltersProps) {
   const [showFilters, setShowFilters] = useState(false);
 
   return (
     <div className="space-y-3">
       {/* Search Bar */}
       <div className="flex gap-2">
         <div className="relative flex-1">
           <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
           <Input
             placeholder="Buscar por nome, telefone ou código..."
             value={searchTerm}
             onChange={(e) => onSearchChange(e.target.value)}
             className="pl-10"
           />
         </div>
         <Button
           variant={showFilters ? "secondary" : "outline"}
           onClick={() => setShowFilters(!showFilters)}
           className="gap-2"
         >
           <Filter className="h-4 w-4" />
           Filtros
           {activeFiltersCount > 0 && (
             <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
               {activeFiltersCount}
             </Badge>
           )}
         </Button>
         {activeFiltersCount > 0 && (
           <Button variant="ghost" size="icon" onClick={onClearFilters}>
             <X className="h-4 w-4" />
           </Button>
         )}
       </div>
 
       {/* Filter Options */}
       {showFilters && (
         <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-muted/50 rounded-lg border animate-in slide-in-from-top-2 duration-200">
           {/* Vendedor */}
           <div className="space-y-1.5">
             <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <User className="h-3 w-3" />
               Vendedor
             </label>
             <Select value={selectedVendedor} onValueChange={onVendedorChange}>
               <SelectTrigger>
                 <SelectValue placeholder="Todos" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todos</SelectItem>
                 {vendedores.map((v) => (
                   <SelectItem key={v.nome} value={v.nome}>
                     {v.nome}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
 
           {/* Estado */}
           <div className="space-y-1.5">
             <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <MapPin className="h-3 w-3" />
               Estado
             </label>
             <Select value={selectedEstado} onValueChange={onEstadoChange}>
               <SelectTrigger>
                 <SelectValue placeholder="Todos" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todos</SelectItem>
                 {estados.map((e) => (
                   <SelectItem key={e} value={e}>
                     {e}
                   </SelectItem>
                 ))}
               </SelectContent>
             </Select>
           </div>
 
           {/* Consumo */}
           <div className="space-y-1.5">
             <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <Zap className="h-3 w-3" />
               Consumo (kWh)
             </label>
             <Select value={consumoRange} onValueChange={onConsumoRangeChange}>
               <SelectTrigger>
                 <SelectValue placeholder="Todos" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todos</SelectItem>
                 <SelectItem value="0-300">Até 300 kWh</SelectItem>
                 <SelectItem value="300-600">300 - 600 kWh</SelectItem>
                 <SelectItem value="600-1000">600 - 1000 kWh</SelectItem>
                 <SelectItem value="1000+">Acima de 1000 kWh</SelectItem>
               </SelectContent>
             </Select>
           </div>
 
           {/* Data */}
           <div className="space-y-1.5">
             <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <Calendar className="h-3 w-3" />
               Período
             </label>
             <Select value={dateRange} onValueChange={onDateRangeChange}>
               <SelectTrigger>
                 <SelectValue placeholder="Todos" />
               </SelectTrigger>
               <SelectContent>
                 <SelectItem value="all">Todos</SelectItem>
                 <SelectItem value="today">Hoje</SelectItem>
                 <SelectItem value="7days">Últimos 7 dias</SelectItem>
                 <SelectItem value="30days">Últimos 30 dias</SelectItem>
                 <SelectItem value="90days">Últimos 90 dias</SelectItem>
               </SelectContent>
             </Select>
           </div>
         </div>
       )}
     </div>
   );
 }