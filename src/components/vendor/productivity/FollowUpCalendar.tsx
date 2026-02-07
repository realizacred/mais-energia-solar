 import { useState, useMemo } from "react";
 import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
 import { Button } from "@/components/ui/button";
 import { Badge } from "@/components/ui/badge";
 import { Calendar } from "@/components/ui/calendar";
 import { 
   CalendarDays, 
   ChevronLeft, 
   ChevronRight, 
   Phone,
   MessageCircle,
   Clock,
   AlertTriangle
 } from "lucide-react";
 import { format, isSameDay, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import type { Lead } from "@/types/lead";
 import { cn } from "@/lib/utils";
 
 interface FollowUpCalendarProps {
   leads: Lead[];
   onSelectLead?: (lead: Lead) => void;
 }
 
 interface ScheduledAction {
   lead: Lead;
   date: Date;
   action: string;
 }
 
 export function FollowUpCalendar({ leads, onSelectLead }: FollowUpCalendarProps) {
   const [currentMonth, setCurrentMonth] = useState(new Date());
   const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
 
   // Get all scheduled follow-ups
   const scheduledActions = useMemo(() => {
     const actions: ScheduledAction[] = [];
     
     leads.forEach((lead) => {
       if (lead.data_proxima_acao) {
         actions.push({
           lead,
           date: parseISO(lead.data_proxima_acao),
           action: lead.proxima_acao || "Follow-up",
         });
       }
     });
     
     return actions;
   }, [leads]);
 
   // Get actions for a specific date
   const getActionsForDate = (date: Date) => {
     return scheduledActions.filter((action) => isSameDay(action.date, date));
   };
 
   // Get actions for selected date
   const selectedDateActions = selectedDate ? getActionsForDate(selectedDate) : [];
 
   // Get days with scheduled actions for calendar highlighting
   const daysWithActions = useMemo(() => {
     const days = new Set<string>();
     scheduledActions.forEach((action) => {
       days.add(format(action.date, "yyyy-MM-dd"));
     });
     return days;
   }, [scheduledActions]);
 
   // Today's actions count
   const todayActions = getActionsForDate(new Date());
 
   // Overdue actions
   const overdueActions = useMemo(() => {
     const today = new Date();
     today.setHours(0, 0, 0, 0);
     return scheduledActions.filter((action) => action.date < today);
   }, [scheduledActions]);
 
   const openWhatsApp = (lead: Lead) => {
     const message = encodeURIComponent(`Olá ${lead.nome}! Tudo bem?`);
     const phone = lead.telefone.replace(/\D/g, "");
     const formattedPhone = phone.startsWith("55") ? phone : `55${phone}`;
     window.open(`https://wa.me/${formattedPhone}?text=${message}`, "_blank");
   };
 
   const navigateMonth = (direction: "prev" | "next") => {
     setCurrentMonth((prev) => 
       direction === "prev" ? subMonths(prev, 1) : addMonths(prev, 1)
     );
   };
 
   return (
     <Card>
       <CardHeader className="pb-3">
         <div className="flex items-center gap-2">
           <CalendarDays className="h-5 w-5 text-primary" />
           <CardTitle className="text-base">Calendário de Follow-up</CardTitle>
         </div>
         <CardDescription>
           Visualize e gerencie suas próximas ações agendadas
         </CardDescription>
       </CardHeader>
       <CardContent>
         {/* Stats Row */}
         <div className="grid grid-cols-2 gap-3 mb-4">
           <div className="p-3 rounded-lg bg-primary/10 border border-primary/20">
             <div className="flex items-center gap-2">
               <Clock className="h-4 w-4 text-primary" />
               <span className="text-sm font-medium">Hoje</span>
             </div>
             <p className="text-2xl font-bold text-primary mt-1">{todayActions.length}</p>
             <p className="text-xs text-muted-foreground">ações agendadas</p>
           </div>
           <div className={cn(
             "p-3 rounded-lg border",
             overdueActions.length > 0 
               ? "bg-destructive/10 border-destructive/20" 
               : "bg-green-50 border-green-200"
           )}>
             <div className="flex items-center gap-2">
               <AlertTriangle className={cn(
                 "h-4 w-4",
                 overdueActions.length > 0 ? "text-destructive" : "text-green-600"
               )} />
               <span className="text-sm font-medium">Atrasadas</span>
             </div>
             <p className={cn(
               "text-2xl font-bold mt-1",
               overdueActions.length > 0 ? "text-destructive" : "text-green-600"
             )}>
               {overdueActions.length}
             </p>
             <p className="text-xs text-muted-foreground">pendências</p>
           </div>
         </div>
 
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
           {/* Calendar */}
           <div className="border rounded-lg p-3">
             <div className="flex items-center justify-between mb-2">
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="h-8 w-8"
                 onClick={() => navigateMonth("prev")}
               >
                 <ChevronLeft className="h-4 w-4" />
               </Button>
               <span className="text-sm font-medium capitalize">
                 {format(currentMonth, "MMMM yyyy", { locale: ptBR })}
               </span>
               <Button 
                 variant="ghost" 
                 size="icon" 
                 className="h-8 w-8"
                 onClick={() => navigateMonth("next")}
               >
                 <ChevronRight className="h-4 w-4" />
               </Button>
             </div>
             <Calendar
               mode="single"
               selected={selectedDate}
               onSelect={setSelectedDate}
               month={currentMonth}
               onMonthChange={setCurrentMonth}
               locale={ptBR}
               className="rounded-md"
               modifiers={{
                 hasAction: (date) => daysWithActions.has(format(date, "yyyy-MM-dd")),
               }}
               modifiersClassNames={{
                 hasAction: "bg-primary/20 text-primary font-bold",
               }}
             />
           </div>
 
           {/* Selected Date Actions */}
           <div className="border rounded-lg p-3">
             <h4 className="font-medium text-sm mb-3">
               {selectedDate 
                 ? format(selectedDate, "dd 'de' MMMM", { locale: ptBR })
                 : "Selecione uma data"
               }
               {selectedDate && isToday(selectedDate) && (
                 <Badge variant="secondary" className="ml-2">Hoje</Badge>
               )}
             </h4>
             
             {selectedDateActions.length > 0 ? (
               <div className="space-y-2 max-h-[280px] overflow-y-auto">
                 {selectedDateActions.map((action, index) => (
                   <div 
                     key={`${action.lead.id}-${index}`}
                     className="p-3 rounded-lg border bg-muted/30 hover:bg-muted/50 transition-colors"
                   >
                     <div className="flex items-start justify-between gap-2">
                       <div className="min-w-0">
                         <p className="font-medium text-sm truncate">{action.lead.nome}</p>
                         <p className="text-xs text-muted-foreground">{action.action}</p>
                         <p className="text-xs text-muted-foreground mt-1">
                           {action.lead.cidade}, {action.lead.estado}
                         </p>
                       </div>
                       <div className="flex gap-1 shrink-0">
                         <Button
                           size="icon"
                           variant="ghost"
                           className="h-8 w-8"
                           onClick={() => window.open(`tel:${action.lead.telefone}`, "_self")}
                         >
                           <Phone className="h-4 w-4" />
                         </Button>
                         <Button
                           size="icon"
                           variant="ghost"
                           className="h-8 w-8 text-green-600"
                           onClick={() => openWhatsApp(action.lead)}
                         >
                           <MessageCircle className="h-4 w-4" />
                         </Button>
                       </div>
                     </div>
                     {onSelectLead && (
                       <Button 
                         size="sm" 
                         variant="link" 
                         className="h-auto p-0 mt-2 text-xs"
                         onClick={() => onSelectLead(action.lead)}
                       >
                         Ver detalhes →
                       </Button>
                     )}
                   </div>
                 ))}
               </div>
             ) : (
               <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                 <CalendarDays className="h-8 w-8 opacity-20 mb-2" />
                 <p className="text-sm">Nenhuma ação agendada</p>
               </div>
             )}
           </div>
         </div>
 
         {/* Overdue Actions Alert */}
         {overdueActions.length > 0 && (
           <div className="mt-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20">
             <div className="flex items-center gap-2 mb-2">
               <AlertTriangle className="h-4 w-4 text-destructive" />
               <span className="text-sm font-medium text-destructive">
                 Ações atrasadas ({overdueActions.length})
               </span>
             </div>
             <div className="space-y-2 max-h-[150px] overflow-y-auto">
               {overdueActions.slice(0, 5).map((action, index) => (
                 <div 
                   key={`overdue-${action.lead.id}-${index}`}
                   className="flex items-center justify-between p-2 rounded bg-background"
                 >
                   <div className="min-w-0">
                     <p className="text-sm font-medium truncate">{action.lead.nome}</p>
                     <p className="text-xs text-muted-foreground">
                       {format(action.date, "dd/MM")} - {action.action}
                     </p>
                   </div>
                   <Button
                     size="sm"
                     variant="destructive"
                     className="gap-1 shrink-0"
                     onClick={() => openWhatsApp(action.lead)}
                   >
                     <MessageCircle className="h-3 w-3" />
                     Contatar
                   </Button>
                 </div>
               ))}
             </div>
           </div>
         )}
       </CardContent>
     </Card>
   );
 }