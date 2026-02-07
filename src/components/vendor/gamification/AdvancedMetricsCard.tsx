 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Progress } from "@/components/ui/progress";
 import { Badge } from "@/components/ui/badge";
 import {
   Clock,
   Zap,
   DollarSign,
   Shield,
   TrendingUp,
   TrendingDown,
   Timer,
 } from "lucide-react";
 import { AdvancedMetrics } from "@/hooks/useAdvancedMetrics";
 
 interface AdvancedMetricsCardProps {
   metrics: AdvancedMetrics | null;
   loading?: boolean;
 }
 
 export function AdvancedMetricsCard({ metrics, loading }: AdvancedMetricsCardProps) {
   if (loading) {
     return (
       <Card>
         <CardHeader>
           <CardTitle className="text-base flex items-center gap-2">
             <TrendingUp className="h-4 w-4 text-primary" />
             Métricas de Performance
           </CardTitle>
         </CardHeader>
         <CardContent className="flex items-center justify-center py-8">
           <div className="animate-pulse text-muted-foreground">Calculando...</div>
         </CardContent>
       </Card>
     );
   }
 
   if (!metrics) return null;
 
    const metricItems = [
      {
        label: "Tempo Médio de Fechamento",
        value: `${metrics.tempo_medio_fechamento_dias} dias`,
        icon: Timer,
        description: "Dias entre captação e conversão",
        color: metrics.tempo_medio_fechamento_dias <= 7 ? "text-success" : "text-warning",
        bgColor: metrics.tempo_medio_fechamento_dias <= 7 ? "bg-success/10" : "bg-warning/10",
      },
      {
        label: "Taxa de Resposta Rápida",
        value: `${metrics.taxa_resposta_rapida_percent}%`,
        icon: Zap,
        description: "Leads contatados em < 24h",
        color: metrics.taxa_resposta_rapida_percent >= 80 ? "text-success" : "text-primary",
        bgColor: metrics.taxa_resposta_rapida_percent >= 80 ? "bg-success/10" : "bg-primary/10",
        progress: metrics.taxa_resposta_rapida_percent,
      },
      {
        label: "Ticket Médio",
        value: new Intl.NumberFormat("pt-BR", {
          style: "currency",
          currency: "BRL",
          maximumFractionDigits: 0,
        }).format(metrics.ticket_medio),
        icon: DollarSign,
        description: "Valor médio por conversão",
        color: "text-secondary",
        bgColor: "bg-secondary/10",
      },
      {
        label: "Taxa de Retenção",
        value: `${metrics.taxa_retencao_percent}%`,
        icon: Shield,
        description: "Leads não perdidos",
        color: metrics.taxa_retencao_percent >= 70 ? "text-success" : "text-destructive",
        bgColor: metrics.taxa_retencao_percent >= 70 ? "bg-success/10" : "bg-destructive/10",
        progress: metrics.taxa_retencao_percent,
      },
    ];
 
   return (
     <Card>
       <CardHeader className="pb-2">
         <CardTitle className="text-base flex items-center gap-2">
           <TrendingUp className="h-4 w-4 text-primary" />
           Métricas de Performance
         </CardTitle>
       </CardHeader>
       <CardContent>
         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
           {metricItems.map((item) => (
             <div
               key={item.label}
               className={`p-4 rounded-lg ${item.bgColor} border border-border/50`}
             >
               <div className="flex items-start justify-between">
                 <div className="flex-1 min-w-0">
                   <p className="text-xs text-muted-foreground truncate">{item.label}</p>
                   <p className={`text-xl font-bold ${item.color} mt-1`}>{item.value}</p>
                   <p className="text-xs text-muted-foreground mt-1">{item.description}</p>
                 </div>
                 <div className={`p-2 rounded-full ${item.bgColor}`}>
                   <item.icon className={`h-5 w-5 ${item.color}`} />
                 </div>
               </div>
               {item.progress !== undefined && (
                 <Progress value={item.progress} className="h-1.5 mt-3" />
               )}
             </div>
           ))}
         </div>
 
         {/* Summary stats */}
         <div className="mt-4 pt-4 border-t grid grid-cols-4 gap-2 text-center">
           <div>
             <p className="text-lg font-bold text-foreground">{metrics.total_leads_atendidos}</p>
             <p className="text-xs text-muted-foreground">Leads atendidos</p>
           </div>
            <div>
              <p className="text-lg font-bold text-success">{metrics.leads_respondidos_24h}</p>
              <p className="text-xs text-muted-foreground">Resp. em 24h</p>
            </div>
            <div>
              <p className="text-lg font-bold text-secondary">{metrics.leads_convertidos}</p>
              <p className="text-xs text-muted-foreground">Convertidos</p>
            </div>
            <div>
              <p className="text-lg font-bold text-destructive">{metrics.leads_perdidos}</p>
              <p className="text-xs text-muted-foreground">Perdidos</p>
            </div>
          </div>
       </CardContent>
     </Card>
   );
 }