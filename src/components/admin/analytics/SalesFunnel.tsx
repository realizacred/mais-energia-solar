import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { TrendingUp, Users, FileText, CheckCircle, XCircle, Clock } from "lucide-react";

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
}

interface SalesFunnelProps {
  leads: Lead[];
  statuses: LeadStatus[];
}

export default function SalesFunnel({ leads, statuses }: SalesFunnelProps) {
  const funnelData = useMemo(() => {
    // Sort statuses by ordem
    const sortedStatuses = [...statuses].sort((a, b) => a.ordem - b.ordem);
    
    // Count leads per status
    const statusCounts: Record<string, number> = {};
    leads.forEach((lead) => {
      const statusId = lead.status_id || "sem_status";
      statusCounts[statusId] = (statusCounts[statusId] || 0) + 1;
    });

    // Calculate funnel stages
    const totalLeads = leads.length;
    
    return sortedStatuses.map((status) => {
      const count = statusCounts[status.id] || 0;
      const percentage = totalLeads > 0 ? Math.round((count / totalLeads) * 100) : 0;
      
      return {
        id: status.id,
        name: status.nome,
        color: status.cor,
        count,
        percentage,
      };
    });
  }, [leads, statuses]);

  // Calculate conversion rate between stages
  const conversionRates = useMemo(() => {
    if (funnelData.length < 2) return [];
    
    const rates = [];
    for (let i = 0; i < funnelData.length - 1; i++) {
      const current = funnelData[i].count;
      const next = funnelData[i + 1].count;
      const rate = current > 0 ? Math.round((next / current) * 100) : 0;
      rates.push({
        from: funnelData[i].name,
        to: funnelData[i + 1].name,
        rate,
      });
    }
    return rates;
  }, [funnelData]);

  // Overall conversion (first to last stage)
  const overallConversion = useMemo(() => {
    if (funnelData.length < 2) return 0;
    const first = funnelData[0].count;
    const last = funnelData[funnelData.length - 1].count;
    return first > 0 ? Math.round((last / first) * 100) : 0;
  }, [funnelData]);

  // Leads without status
  const leadsWithoutStatus = useMemo(() => {
    return leads.filter((l) => !l.status_id).length;
  }, [leads]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          Funil de Vendas
          <span className="ml-auto text-sm font-normal text-muted-foreground">
            Conversão geral: {overallConversion}%
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Funnel Visualization */}
        <div className="space-y-3">
          {funnelData.map((stage, index) => {
            // Calculate width based on position (creates funnel shape)
            const widthPercent = 100 - (index * (40 / funnelData.length));
            
            return (
              <div key={stage.id} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div 
                      className="w-3 h-3 rounded-full" 
                      style={{ backgroundColor: stage.color }}
                    />
                    <span className="font-medium">{stage.name}</span>
                  </div>
                  <span className="text-muted-foreground">
                    {stage.count} leads ({stage.percentage}%)
                  </span>
                </div>
                <div className="relative">
                  <div 
                    className="h-8 rounded-md transition-all duration-500 flex items-center justify-center"
                    style={{ 
                      width: `${widthPercent}%`,
                      backgroundColor: stage.color,
                      opacity: 0.8,
                      marginLeft: `${(100 - widthPercent) / 2}%`,
                    }}
                  >
                    <span className="text-xs font-medium text-white drop-shadow">
                      {stage.count}
                    </span>
                  </div>
                </div>
                
                {/* Conversion arrow between stages */}
                {index < funnelData.length - 1 && conversionRates[index] && (
                  <div className="flex items-center justify-center py-1">
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <span>↓</span>
                      <span className={conversionRates[index].rate >= 50 ? "text-green-600" : conversionRates[index].rate >= 25 ? "text-yellow-600" : "text-red-600"}>
                        {conversionRates[index].rate}%
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Additional Stats */}
        <div className="grid grid-cols-3 gap-2 pt-4 border-t">
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-primary">
              <Users className="w-4 h-4" />
              <span className="text-lg font-bold">{leads.length}</span>
            </div>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-green-600">
              <CheckCircle className="w-4 h-4" />
              <span className="text-lg font-bold">{overallConversion}%</span>
            </div>
            <p className="text-xs text-muted-foreground">Conversão</p>
          </div>
          <div className="text-center">
            <div className="flex items-center justify-center gap-1 text-muted-foreground">
              <Clock className="w-4 h-4" />
              <span className="text-lg font-bold">{leadsWithoutStatus}</span>
            </div>
            <p className="text-xs text-muted-foreground">Sem Status</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
