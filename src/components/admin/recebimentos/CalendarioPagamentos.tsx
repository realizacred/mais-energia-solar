 import { useState, useEffect, useMemo } from "react";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { ScrollArea } from "@/components/ui/scroll-area";
 import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
 import {
   format,
   startOfMonth,
   endOfMonth,
   eachDayOfInterval,
   isSameMonth,
   isSameDay,
   addMonths,
   subMonths,
   isToday,
   startOfWeek,
   endOfWeek,
 } from "date-fns";
 import { ptBR } from "date-fns/locale";
 
 interface Parcela {
   id: string;
   numero_parcela: number;
   valor: number;
   data_vencimento: string;
   status: string;
   recebimentos: {
     clientes: { nome: string };
   };
 }
 
 export function CalendarioPagamentos() {
   const [currentMonth, setCurrentMonth] = useState(new Date());
   const [parcelas, setParcelas] = useState<Parcela[]>([]);
   const [loading, setLoading] = useState(true);
   const [selectedDate, setSelectedDate] = useState<Date | null>(null);
 
   useEffect(() => {
     fetchParcelas();
   }, [currentMonth]);
 
   const fetchParcelas = async () => {
     setLoading(true);
     try {
       const inicio = format(startOfMonth(currentMonth), "yyyy-MM-dd");
       const fim = format(endOfMonth(currentMonth), "yyyy-MM-dd");
 
       const { data, error } = await supabase
         .from("parcelas")
         .select(`
           id,
           numero_parcela,
           valor,
           data_vencimento,
           status,
           recebimentos (
             clientes (nome)
           )
         `)
         .gte("data_vencimento", inicio)
         .lte("data_vencimento", fim)
         .order("data_vencimento");
 
       if (error) throw error;
       setParcelas((data as unknown as Parcela[]) || []);
     } catch (error) {
       console.error("Error fetching parcelas:", error);
     } finally {
       setLoading(false);
     }
   };
 
   const formatCurrency = (value: number) => {
     return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
   };
 
   const parcelasPorDia = useMemo(() => {
     const map = new Map<string, Parcela[]>();
     parcelas.forEach((p) => {
       const key = p.data_vencimento;
       if (!map.has(key)) map.set(key, []);
       map.get(key)!.push(p);
     });
     return map;
   }, [parcelas]);
 
   const monthStart = startOfMonth(currentMonth);
   const monthEnd = endOfMonth(currentMonth);
   const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 });
   const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });
   const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
 
   const getStatusColor = (status: string, dataVencimento: string) => {
     if (status === "paga") return "bg-green-500";
     if (status === "pendente" && new Date(dataVencimento) < new Date()) return "bg-red-500";
     if (status === "pendente") return "bg-yellow-500";
     return "bg-gray-500";
   };
 
   const selectedDayParcelas = selectedDate
     ? parcelasPorDia.get(format(selectedDate, "yyyy-MM-dd")) || []
     : [];
 
   return (
     <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
       {/* Calendário */}
       <Card className="lg:col-span-2">
         <CardHeader>
           <div className="flex items-center justify-between">
             <CardTitle className="text-sm flex items-center gap-2">
               <CalendarIcon className="h-4 w-4" />
               {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
             </CardTitle>
             <div className="flex gap-1">
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
               >
                 <ChevronLeft className="h-4 w-4" />
               </Button>
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={() => setCurrentMonth(new Date())}
               >
                 Hoje
               </Button>
               <Button
                 variant="ghost"
                 size="icon"
                 onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
               >
                 <ChevronRight className="h-4 w-4" />
               </Button>
             </div>
           </div>
         </CardHeader>
         <CardContent>
           {loading ? (
             <div className="flex justify-center py-12">
               <Loader2 className="h-6 w-6 animate-spin" />
             </div>
           ) : (
             <div className="grid grid-cols-7 gap-1">
               {["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"].map((dia) => (
                 <div key={dia} className="text-center text-xs font-medium text-muted-foreground py-2">
                   {dia}
                 </div>
               ))}
               
               {days.map((day) => {
                 const dateKey = format(day, "yyyy-MM-dd");
                 const dayParcelas = parcelasPorDia.get(dateKey) || [];
                 const isCurrentMonth = isSameMonth(day, currentMonth);
                 const isSelected = selectedDate && isSameDay(day, selectedDate);
                 
                 return (
                   <button
                     key={dateKey}
                     onClick={() => setSelectedDate(day)}
                     className={`
                       relative p-2 min-h-16 text-left rounded-lg transition-colors
                       ${!isCurrentMonth ? "text-muted-foreground/50" : ""}
                       ${isToday(day) ? "bg-primary/10 font-bold" : ""}
                       ${isSelected ? "ring-2 ring-primary" : ""}
                       hover:bg-accent
                     `}
                   >
                     <span className="text-sm">{format(day, "d")}</span>
                     {dayParcelas.length > 0 && (
                       <div className="absolute bottom-1 left-1 right-1 flex flex-wrap gap-0.5">
                         {dayParcelas.slice(0, 3).map((p) => (
                           <div
                             key={p.id}
                             className={`h-1.5 w-1.5 rounded-full ${getStatusColor(p.status, p.data_vencimento)}`}
                           />
                         ))}
                         {dayParcelas.length > 3 && (
                           <span className="text-xs text-muted-foreground">+{dayParcelas.length - 3}</span>
                         )}
                       </div>
                     )}
                   </button>
                 );
               })}
             </div>
           )}
 
           {/* Legenda */}
           <div className="flex gap-4 mt-4 pt-4 border-t text-xs text-muted-foreground">
             <div className="flex items-center gap-1">
               <div className="h-2 w-2 rounded-full bg-yellow-500" />
               Pendente
             </div>
             <div className="flex items-center gap-1">
               <div className="h-2 w-2 rounded-full bg-green-500" />
               Pago
             </div>
             <div className="flex items-center gap-1">
               <div className="h-2 w-2 rounded-full bg-red-500" />
               Atrasado
             </div>
           </div>
         </CardContent>
       </Card>
 
       {/* Detalhes do Dia */}
       <Card>
         <CardHeader>
           <CardTitle className="text-sm">
             {selectedDate
               ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
               : "Selecione um dia"}
           </CardTitle>
         </CardHeader>
         <CardContent>
           {!selectedDate ? (
             <p className="text-sm text-muted-foreground text-center py-4">
               Clique em um dia para ver os vencimentos
             </p>
           ) : selectedDayParcelas.length === 0 ? (
             <p className="text-sm text-muted-foreground text-center py-4">
               Nenhum vencimento neste dia
             </p>
           ) : (
             <ScrollArea className="h-64">
               <div className="space-y-2">
                 {selectedDayParcelas.map((parcela) => (
                   <div
                     key={parcela.id}
                     className="p-3 rounded-lg border bg-card space-y-1"
                   >
                     <div className="flex items-center justify-between">
                       <p className="text-sm font-medium truncate">
                         {parcela.recebimentos?.clientes?.nome}
                       </p>
                       <Badge
                         className={`${getStatusColor(parcela.status, parcela.data_vencimento)} text-white text-xs`}
                       >
                         {parcela.status === "paga" ? "Pago" : parcela.status === "pendente" && new Date(parcela.data_vencimento) < new Date() ? "Atrasado" : "Pendente"}
                       </Badge>
                     </div>
                     <div className="flex justify-between text-sm">
                       <span className="text-muted-foreground">Parcela {parcela.numero_parcela}</span>
                       <span className="font-medium">{formatCurrency(parcela.valor)}</span>
                     </div>
                   </div>
                 ))}
               </div>
             </ScrollArea>
           )}
         </CardContent>
       </Card>
     </div>
   );
 }