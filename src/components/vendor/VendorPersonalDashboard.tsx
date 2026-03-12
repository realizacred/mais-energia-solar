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
          <Card className="border-l-[3px] border-l-primary border-border/60">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div className="min-w-0">
                <div className="flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-foreground">{metrics.thisMonth}</p>
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
                <p className="text-xs text-muted-foreground truncate">Este Mês</p>
                <p className="text-xs text-muted-foreground/70 truncate">
                  vs {metrics.lastMonth} mês passado
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Conversions */}
          <Card className="border-l-[3px] border-l-success border-border/60">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 shrink-0">
                <CheckCircle2 className="h-5 w-5 text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{metrics.convertedThisMonth}</p>
                <p className="text-xs text-muted-foreground truncate">Convertidos</p>
                <p className="text-xs text-muted-foreground/70 truncate">{metrics.totalConverted} total</p>
              </div>
            </CardContent>
          </Card>

          {/* Conversion Rate */}
          <Card className="border-l-[3px] border-l-secondary border-border/60">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-secondary/10 shrink-0">
                <Percent className="h-5 w-5 text-secondary" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">{metrics.conversionRate}%</p>
                <p className="text-xs text-muted-foreground truncate">Taxa de Conversão</p>
                <p className="text-xs text-muted-foreground/70 truncate">de todos os orçamentos</p>
              </div>
            </CardContent>
          </Card>

          {/* Avg Response Time */}
          <Card className="border-l-[3px] border-l-info border-border/60">
            <CardContent className="flex items-center gap-4 p-4">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 shrink-0">
                <Clock className="h-5 w-5 text-info" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl font-bold text-foreground">
                  {metrics.avgDaysToContact === 0 ? "<1" : metrics.avgDaysToContact}
                </p>
                <p className="text-xs text-muted-foreground truncate">Tempo de Resposta</p>
                <p className="text-xs text-muted-foreground/70 truncate">
                  {metrics.avgDaysToContact <= 1 ? "dia" : "dias"} média até 1º contato
                </p>
              </div>
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