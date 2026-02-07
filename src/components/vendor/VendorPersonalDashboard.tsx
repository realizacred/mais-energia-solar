 import { useMemo } from "react";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Badge } from "@/components/ui/badge";
 import {
   TrendingUp,
   TrendingDown,
   Target,
   Percent,
   Clock,
   CheckCircle2,
   Users,
   Calendar,
 } from "lucide-react";
 import {
   LineChart,
   Line,
   XAxis,
   YAxis,
   CartesianGrid,
   Tooltip,
   ResponsiveContainer,
   BarChart,
   Bar,
   Cell,
 } from "recharts";
 import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, differenceInDays, parseISO } from "date-fns";
 import { ptBR } from "date-fns/locale";
 import type { OrcamentoVendedor } from "@/hooks/useOrcamentosVendedor";
 import type { LeadStatus } from "@/types/lead";
 
 interface VendorPersonalDashboardProps {
   orcamentos: OrcamentoVendedor[];
   statuses: LeadStatus[];
   vendedorNome: string;
 }
 
 // Status IDs that represent "converted/won" leads
 const CONVERTED_STATUS_NAMES = ["convertido", "fechado", "ganho", "cliente"];
 
 export function VendorPersonalDashboard({
   orcamentos,
   statuses,
   vendedorNome,
 }: VendorPersonalDashboardProps) {
   // Find converted status IDs
   const convertedStatusIds = useMemo(() => {
     return statuses
       .filter((s) =>
         CONVERTED_STATUS_NAMES.some((name) =>
           s.nome.toLowerCase().includes(name)
         )
       )
       .map((s) => s.id);
   }, [statuses]);
 
   // Calculate metrics
   const metrics = useMemo(() => {
     const now = new Date();
     const thisMonthStart = startOfMonth(now);
     const thisMonthEnd = endOfMonth(now);
     const lastMonthStart = startOfMonth(subDays(thisMonthStart, 1));
     const lastMonthEnd = endOfMonth(lastMonthStart);
 
     // This month data
     const thisMonthOrcamentos = orcamentos.filter((o) => {
       const date = parseISO(o.created_at);
       return date >= thisMonthStart && date <= thisMonthEnd;
     });
 
     // Last month data
     const lastMonthOrcamentos = orcamentos.filter((o) => {
       const date = parseISO(o.created_at);
       return date >= lastMonthStart && date <= lastMonthEnd;
     });
 
     // Converted count
     const convertedThisMonth = thisMonthOrcamentos.filter(
       (o) => o.status_id && convertedStatusIds.includes(o.status_id)
     ).length;
     const convertedLastMonth = lastMonthOrcamentos.filter(
       (o) => o.status_id && convertedStatusIds.includes(o.status_id)
     ).length;
 
     // Total conversions all time
     const totalConverted = orcamentos.filter(
       (o) => o.status_id && convertedStatusIds.includes(o.status_id)
     ).length;
 
     // Conversion rate
     const conversionRate =
       orcamentos.length > 0
         ? Math.round((totalConverted / orcamentos.length) * 100)
         : 0;
 
     // Average time to first contact (days from created_at to ultimo_contato)
     const contactedOrcamentos = orcamentos.filter((o) => o.ultimo_contato);
     const avgDaysToContact =
       contactedOrcamentos.length > 0
         ? Math.round(
             contactedOrcamentos.reduce((sum, o) => {
               const created = parseISO(o.created_at);
               const contacted = parseISO(o.ultimo_contato!);
               return sum + differenceInDays(contacted, created);
             }, 0) / contactedOrcamentos.length
           )
         : 0;
 
     // Growth percentage
     const growthPercent =
       lastMonthOrcamentos.length > 0
         ? Math.round(
             ((thisMonthOrcamentos.length - lastMonthOrcamentos.length) /
               lastMonthOrcamentos.length) *
               100
           )
         : thisMonthOrcamentos.length > 0
         ? 100
         : 0;
 
     return {
       thisMonth: thisMonthOrcamentos.length,
       lastMonth: lastMonthOrcamentos.length,
       convertedThisMonth,
       convertedLastMonth,
       totalConverted,
       conversionRate,
       avgDaysToContact,
       growthPercent,
     };
   }, [orcamentos, convertedStatusIds]);
 
   // Daily trend data (last 14 days)
   const trendData = useMemo(() => {
     const last14Days = eachDayOfInterval({
       start: subDays(new Date(), 13),
       end: new Date(),
     });
 
     return last14Days.map((day) => {
       const count = orcamentos.filter((o) =>
         isSameDay(parseISO(o.created_at), day)
       ).length;
 
       return {
         date: format(day, "dd/MM", { locale: ptBR }),
         orcamentos: count,
       };
     });
   }, [orcamentos]);
 
   // Status distribution for bar chart
   const statusDistribution = useMemo(() => {
     const statusCounts = new Map<string, number>();
 
     // Count "Novo" (no status)
     const novos = orcamentos.filter((o) => !o.status_id).length;
     if (novos > 0) {
       statusCounts.set("Novo", novos);
     }
 
     // Count each status
     statuses.forEach((status) => {
       const count = orcamentos.filter((o) => o.status_id === status.id).length;
       if (count > 0) {
         statusCounts.set(status.nome, count);
       }
     });
 
     return Array.from(statusCounts.entries()).map(([name, count]) => ({
       name: name.length > 12 ? name.slice(0, 12) + "..." : name,
       fullName: name,
       count,
       color:
         name === "Novo"
           ? "hsl(var(--primary))"
           : statuses.find((s) => s.nome === name)?.cor || "hsl(var(--muted))",
     }));
   }, [orcamentos, statuses]);
 
   return (
     <div className="space-y-4">
       {/* Header */}
       <div className="flex items-center justify-between">
         <div>
           <h2 className="text-lg font-semibold">Dashboard Pessoal</h2>
           <p className="text-sm text-muted-foreground">
             Seu desempenho em {format(new Date(), "MMMM 'de' yyyy", { locale: ptBR })}
           </p>
         </div>
         <Badge variant="outline" className="gap-1">
           <Calendar className="h-3 w-3" />
           Atualizado agora
         </Badge>
       </div>
 
       {/* Metric Cards */}
       <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
         {/* This Month */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <Users className="h-3 w-3" />
               Este Mês
             </CardTitle>
           </CardHeader>
           <CardContent className="pt-0">
             <div className="flex items-baseline gap-2">
               <span className="text-2xl font-bold">{metrics.thisMonth}</span>
               {metrics.growthPercent !== 0 && (
                 <Badge
                   variant={metrics.growthPercent > 0 ? "default" : "destructive"}
                   className="text-xs gap-0.5"
                 >
                   {metrics.growthPercent > 0 ? (
                     <TrendingUp className="h-3 w-3" />
                   ) : (
                     <TrendingDown className="h-3 w-3" />
                   )}
                   {Math.abs(metrics.growthPercent)}%
                 </Badge>
               )}
             </div>
             <p className="text-xs text-muted-foreground mt-1">
               vs {metrics.lastMonth} mês passado
             </p>
           </CardContent>
         </Card>
 
         {/* Conversions */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <CheckCircle2 className="h-3 w-3" />
               Convertidos
             </CardTitle>
           </CardHeader>
           <CardContent className="pt-0">
             <div className="flex items-baseline gap-2">
               <span className="text-2xl font-bold text-primary">
                 {metrics.convertedThisMonth}
               </span>
               <span className="text-sm text-muted-foreground">este mês</span>
             </div>
             <p className="text-xs text-muted-foreground mt-1">
               {metrics.totalConverted} total
             </p>
           </CardContent>
         </Card>
 
         {/* Conversion Rate */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <Percent className="h-3 w-3" />
               Taxa de Conversão
             </CardTitle>
           </CardHeader>
           <CardContent className="pt-0">
             <div className="flex items-baseline gap-2">
               <span className="text-2xl font-bold">{metrics.conversionRate}%</span>
             </div>
             <p className="text-xs text-muted-foreground mt-1">
               de todos os orçamentos
             </p>
           </CardContent>
         </Card>
 
         {/* Avg Response Time */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
               <Clock className="h-3 w-3" />
               Tempo de Resposta
             </CardTitle>
           </CardHeader>
           <CardContent className="pt-0">
             <div className="flex items-baseline gap-2">
               <span className="text-2xl font-bold">
                 {metrics.avgDaysToContact === 0 ? "<1" : metrics.avgDaysToContact}
               </span>
               <span className="text-sm text-muted-foreground">
                 {metrics.avgDaysToContact <= 1 ? "dia" : "dias"}
               </span>
             </div>
             <p className="text-xs text-muted-foreground mt-1">
               média até 1º contato
             </p>
           </CardContent>
         </Card>
       </div>
 
       {/* Charts Row */}
       <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
         {/* Trend Chart */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium flex items-center gap-2">
               <TrendingUp className="h-4 w-4 text-primary" />
               Orçamentos Captados (14 dias)
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="h-[180px]">
               <ResponsiveContainer width="100%" height="100%">
                 <LineChart data={trendData}>
                   <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                   <XAxis
                     dataKey="date"
                     tick={{ fontSize: 10 }}
                     tickLine={false}
                     axisLine={false}
                   />
                   <YAxis
                     tick={{ fontSize: 10 }}
                     tickLine={false}
                     axisLine={false}
                     allowDecimals={false}
                   />
                   <Tooltip
                     contentStyle={{
                       backgroundColor: "hsl(var(--background))",
                       border: "1px solid hsl(var(--border))",
                       borderRadius: "8px",
                       fontSize: "12px",
                     }}
                   />
                   <Line
                     type="monotone"
                     dataKey="orcamentos"
                     stroke="hsl(var(--primary))"
                     strokeWidth={2}
                     dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, r: 3 }}
                     activeDot={{ r: 5 }}
                   />
                 </LineChart>
               </ResponsiveContainer>
             </div>
           </CardContent>
         </Card>
 
         {/* Status Distribution */}
         <Card>
           <CardHeader className="pb-2">
             <CardTitle className="text-sm font-medium flex items-center gap-2">
               <Target className="h-4 w-4 text-primary" />
               Distribuição por Status
             </CardTitle>
           </CardHeader>
           <CardContent>
             <div className="h-[180px]">
               {statusDistribution.length > 0 ? (
                 <ResponsiveContainer width="100%" height="100%">
                   <BarChart data={statusDistribution} layout="vertical">
                     <CartesianGrid
                       strokeDasharray="3 3"
                       className="stroke-muted"
                       horizontal={false}
                     />
                     <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                     <YAxis
                       type="category"
                       dataKey="name"
                       tick={{ fontSize: 10 }}
                       width={80}
                     />
                     <Tooltip
                       contentStyle={{
                         backgroundColor: "hsl(var(--background))",
                         border: "1px solid hsl(var(--border))",
                         borderRadius: "8px",
                         fontSize: "12px",
                       }}
                       formatter={(value, name, props) => [
                         value,
                         props.payload.fullName,
                       ]}
                     />
                     <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                       {statusDistribution.map((entry, index) => (
                         <Cell key={`cell-${index}`} fill={entry.color} />
                       ))}
                     </Bar>
                   </BarChart>
                 </ResponsiveContainer>
               ) : (
                 <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                   Nenhum orçamento ainda
                 </div>
               )}
             </div>
           </CardContent>
         </Card>
       </div>
     </div>
   );
 }