 import { Card, CardContent } from "@/components/ui/card";
 import { CalendarDays, Play, TrendingUp, Wrench } from "lucide-react";
 
 interface InstaladorStatsCardsProps {
   servicosHoje: number;
   servicosEmAndamento: number;
   servicosConcluidos: number;
 }
 
 export function InstaladorStatsCards({
   servicosHoje,
   servicosEmAndamento,
   servicosConcluidos,
 }: InstaladorStatsCardsProps) {
   const stats = [
     {
       title: "Hoje",
       value: servicosHoje,
       icon: CalendarDays,
       color: "text-secondary",
       bgColor: "bg-secondary/10",
     },
     {
       title: "Em Andamento",
       value: servicosEmAndamento,
       icon: Play,
       color: "text-warning",
       bgColor: "bg-warning/10",
     },
     {
       title: "Concluídos",
       value: servicosConcluidos,
       icon: TrendingUp,
       color: "text-success",
       bgColor: "bg-success/10",
     },
   ];
 
   return (
     <div className="grid grid-cols-3 gap-3 sm:gap-4">
       {stats.map((stat) => (
         <Card key={stat.title} className="border-0 shadow-sm hover-lift">
           <CardContent className="p-4 text-center">
             <div className={`inline-flex items-center justify-center w-10 h-10 rounded-full ${stat.bgColor} mb-2`}>
               <stat.icon className={`h-5 w-5 ${stat.color}`} />
             </div>
             <div className={`text-2xl sm:text-3xl font-bold ${stat.color}`}>{stat.value}</div>
             <div className="text-[10px] sm:text-xs font-medium text-muted-foreground uppercase tracking-wide">
               {stat.title}
             </div>
           </CardContent>
         </Card>
       ))}
     </div>
   );
 }