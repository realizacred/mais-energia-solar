 import { useMemo } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import {
   Tooltip,
   TooltipContent,
   TooltipProvider,
   TooltipTrigger,
 } from "@/components/ui/tooltip";
 import {
   TrendingUp,
   TrendingDown,
   Users,
   Target,
   Clock,
   ArrowDown,
   Percent,
   DollarSign,
 } from "lucide-react";
 import { cn } from "@/lib/utils";
 
 interface LeadStatus {
   id: string;
   nome: string;
   cor: string;
   ordem: number;
 }
 
 interface Lead {
   id: string;
   status_id: string | null;
   created_at: string;
   media_consumo: number;
 }
 
 interface EnhancedFunnelProps {
   leads: Lead[];
   statuses: LeadStatus[];
   previousPeriodLeads?: Lead[];
 }
 
 export function EnhancedFunnel({ leads, statuses, previousPeriodLeads }: EnhancedFunnelProps) {
   const funnelData = useMemo(() => {
     const sortedStatuses = [...statuses].sort((a, b) => a.ordem - b.ordem);
     
     const statusCounts: Record<string, { count: number; totalConsumo: number }> = {};
     leads.forEach((lead) => {
       const statusId = lead.status_id || "sem_status";
       if (!statusCounts[statusId]) {
         statusCounts[statusId] = { count: 0, totalConsumo: 0 };
       }
       statusCounts[statusId].count++;
       statusCounts[statusId].totalConsumo += lead.media_consumo;
     });
 
     const totalLeads = leads.length;
     let cumulativeCount = totalLeads;
     
     return sortedStatuses.map((status, index) => {
       const data = statusCounts[status.id] || { count: 0, totalConsumo: 0 };
       const percentage = totalLeads > 0 ? Math.round((data.count / totalLeads) * 100) : 0;
       const avgConsumo = data.count > 0 ? Math.round(data.totalConsumo / data.count) : 0;
       
       // Calculate conversion from previous stage
       const prevCount = index > 0 ? (statusCounts[sortedStatuses[index - 1].id]?.count || 0) : totalLeads;
       const conversionFromPrev = prevCount > 0 ? Math.round((data.count / prevCount) * 100) : 0;
       
       cumulativeCount -= data.count;
       
       return {
         id: status.id,
         name: status.nome,
         color: status.cor,
         count: data.count,
         percentage,
         avgConsumo,
         conversionFromPrev,
         potentialValue: avgConsumo * data.count * 4.5, // Estimativa de valor por kWh
       };
     });
   }, [leads, statuses]);
 
   // Calculate overall metrics
   const metrics = useMemo(() => {
     const totalLeads = leads.length;
     const leadsWithoutStatus = leads.filter((l) => !l.status_id).length;
     const avgConsumo = totalLeads > 0 
       ? Math.round(leads.reduce((sum, l) => sum + l.media_consumo, 0) / totalLeads)
       : 0;
     
     // Calculate conversion (first to last stage)
     const firstStage = funnelData[0]?.count || 0;
     const lastStage = funnelData[funnelData.length - 1]?.count || 0;
     const overallConversion = firstStage > 0 ? Math.round((lastStage / firstStage) * 100) : 0;
 
     // Calculate trend (compare with previous period if available)
     let trend = 0;
     if (previousPeriodLeads && previousPeriodLeads.length > 0) {
       trend = Math.round(((totalLeads - previousPeriodLeads.length) / previousPeriodLeads.length) * 100);
     }
 
     return { totalLeads, leadsWithoutStatus, avgConsumo, overallConversion, trend };
   }, [leads, funnelData, previousPeriodLeads]);
 
   return (
     <Card>
       <CardHeader className="pb-2">
         <div className="flex items-center justify-between">
           <CardTitle className="text-base flex items-center gap-2">
             <Target className="w-4 h-4 text-primary" />
             Funil de Conversão
           </CardTitle>
           <div className="flex items-center gap-2">
             {metrics.trend !== 0 && (
               <Badge 
                 variant={metrics.trend > 0 ? "default" : "destructive"}
                 className="gap-1"
               >
                 {metrics.trend > 0 ? (
                   <TrendingUp className="h-3 w-3" />
                 ) : (
                   <TrendingDown className="h-3 w-3" />
                 )}
                 {metrics.trend > 0 ? "+" : ""}{metrics.trend}%
               </Badge>
             )}
           </div>
         </div>
       </CardHeader>
       <CardContent className="space-y-4">
         {/* Summary Stats */}
         <div className="grid grid-cols-4 gap-3">
           <div className="text-center p-2 rounded-lg bg-muted/50">
             <div className="flex items-center justify-center gap-1 text-primary mb-1">
               <Users className="w-4 h-4" />
               <span className="text-lg font-bold">{metrics.totalLeads}</span>
             </div>
             <p className="text-[10px] text-muted-foreground">Total Leads</p>
           </div>
           <div className="text-center p-2 rounded-lg bg-muted/50">
             <div className="flex items-center justify-center gap-1 text-primary mb-1">
               <Percent className="w-4 h-4" />
               <span className="text-lg font-bold">{metrics.overallConversion}%</span>
             </div>
             <p className="text-[10px] text-muted-foreground">Conversão</p>
           </div>
           <div className="text-center p-2 rounded-lg bg-muted/50">
             <div className="flex items-center justify-center gap-1 text-primary mb-1">
               <TrendingUp className="w-4 h-4" />
               <span className="text-lg font-bold">{metrics.avgConsumo}</span>
             </div>
             <p className="text-[10px] text-muted-foreground">Consumo Médio</p>
           </div>
           <div className="text-center p-2 rounded-lg bg-muted/50">
             <div className="flex items-center justify-center gap-1 text-muted-foreground mb-1">
               <Clock className="w-4 h-4" />
               <span className="text-lg font-bold">{metrics.leadsWithoutStatus}</span>
             </div>
             <p className="text-[10px] text-muted-foreground">Sem Status</p>
           </div>
         </div>
 
         {/* Funnel Visualization */}
         <div className="space-y-2 pt-2">
           {funnelData.map((stage, index) => {
             // Progressive width for funnel effect
             const widthPercent = Math.max(100 - (index * (50 / Math.max(funnelData.length, 1))), 30);
             
             return (
               <div key={stage.id} className="space-y-1">
                 {/* Stage Header */}
                 <div className="flex items-center justify-between text-xs px-1">
                   <div className="flex items-center gap-2">
                    <div 
                       className="w-2.5 h-2.5 rounded-full ring-2 ring-offset-1 ring-muted" 
                       style={{ backgroundColor: stage.color }}
                     />
                     <span className="font-medium">{stage.name}</span>
                   </div>
                   <div className="flex items-center gap-3 text-muted-foreground">
                     <TooltipProvider>
                       <Tooltip>
                         <TooltipTrigger className="cursor-help">
                           <span className="font-medium text-foreground">{stage.count}</span> leads
                         </TooltipTrigger>
                         <TooltipContent>
                           <p>{stage.percentage}% do total</p>
                         </TooltipContent>
                       </Tooltip>
                     </TooltipProvider>
                     <TooltipProvider>
                       <Tooltip>
                         <TooltipTrigger className="cursor-help flex items-center gap-1">
                           <DollarSign className="h-3 w-3" />
                           <span className="text-[10px]">
                             {new Intl.NumberFormat("pt-BR", {
                               notation: "compact",
                               compactDisplay: "short",
                             }).format(stage.potentialValue)}
                           </span>
                         </TooltipTrigger>
                         <TooltipContent>
                           <p>Potencial estimado</p>
                         </TooltipContent>
                       </Tooltip>
                     </TooltipProvider>
                   </div>
                 </div>
 
                 {/* Funnel Bar */}
                 <div className="relative h-10 flex items-center justify-center">
                   <div 
                     className={cn(
                       "h-full rounded-md transition-all duration-500 flex items-center justify-center gap-2",
                       "hover:opacity-90 cursor-pointer"
                     )}
                     style={{ 
                       width: `${widthPercent}%`,
                       backgroundColor: stage.color,
                       marginLeft: `${(100 - widthPercent) / 2}%`,
                     }}
                   >
                     <span className="text-sm font-semibold text-white drop-shadow">
                       {stage.count}
                     </span>
                     <span className="text-[10px] text-white/80">
                       ({stage.percentage}%)
                     </span>
                   </div>
                 </div>
 
                 {/* Conversion Arrow */}
                 {index < funnelData.length - 1 && (
                   <div className="flex items-center justify-center py-0.5">
                     <div className="flex items-center gap-1.5">
                       <ArrowDown className="h-3 w-3 text-muted-foreground" />
                       <Badge 
                         variant="outline" 
                         className={cn(
                           "text-[10px] h-5 px-2",
                           funnelData[index + 1]?.conversionFromPrev >= 50 
                             ? "border-primary/20 bg-primary/10 text-primary"
                             : funnelData[index + 1]?.conversionFromPrev >= 25 
                               ? "border-muted bg-muted text-muted-foreground"
                               : "border-destructive/20 bg-destructive/10 text-destructive"
                         )}
                       >
                         {funnelData[index + 1]?.conversionFromPrev || 0}% conversão
                       </Badge>
                     </div>
                   </div>
                 )}
               </div>
             );
           })}
         </div>
       </CardContent>
     </Card>
   );
 }