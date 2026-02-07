import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Users, Trophy, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { subMonths, isAfter } from "date-fns";

interface Lead {
  id: string;
  vendedor: string | null;
  created_at: string;
  status_id: string | null;
  media_consumo: number;
}

interface LeadStatus {
  id: string;
  nome: string;
  cor: string;
}

interface VendorPerformanceProps {
  leads: Lead[];
  statuses: LeadStatus[];
}

interface VendorStats {
  name: string;
  totalLeads: number;
  thisMonth: number;
  lastMonth: number;
  growth: number;
  avgConsumption: number;
  statusDistribution: Record<string, number>;
  conversionRate: number;
}

export default function VendorPerformance({ leads, statuses }: VendorPerformanceProps) {
  const vendorStats = useMemo(() => {
    const now = new Date();
    const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonthStart = subMonths(thisMonthStart, 1);
    
    // Group leads by vendor
    const vendorMap: Record<string, Lead[]> = {};
    leads.forEach((lead) => {
      const vendor = lead.vendedor || "Sem vendedor";
      if (!vendorMap[vendor]) {
        vendorMap[vendor] = [];
      }
      vendorMap[vendor].push(lead);
    });

    // Find "closed" status (last in order typically)
    const closedStatusIds = statuses
      .filter((s) => s.nome.toLowerCase().includes("fechado") || s.nome.toLowerCase().includes("conclu"))
      .map((s) => s.id);

    // Calculate stats for each vendor
    const stats: VendorStats[] = Object.entries(vendorMap).map(([name, vendorLeads]) => {
      const thisMonth = vendorLeads.filter((l) => isAfter(new Date(l.created_at), thisMonthStart)).length;
      const lastMonth = vendorLeads.filter((l) => {
        const date = new Date(l.created_at);
        return isAfter(date, lastMonthStart) && !isAfter(date, thisMonthStart);
      }).length;

      const growth = lastMonth > 0 
        ? Math.round(((thisMonth - lastMonth) / lastMonth) * 100) 
        : thisMonth > 0 ? 100 : 0;

      const totalConsumption = vendorLeads.reduce((acc, l) => acc + l.media_consumo, 0);
      const avgConsumption = vendorLeads.length > 0 ? Math.round(totalConsumption / vendorLeads.length) : 0;

      // Status distribution
      const statusDistribution: Record<string, number> = {};
      vendorLeads.forEach((l) => {
        const statusId = l.status_id || "sem_status";
        statusDistribution[statusId] = (statusDistribution[statusId] || 0) + 1;
      });

      // Conversion rate (leads that reached "closed" status)
      const closedLeads = vendorLeads.filter((l) => closedStatusIds.includes(l.status_id || "")).length;
      const conversionRate = vendorLeads.length > 0 ? Math.round((closedLeads / vendorLeads.length) * 100) : 0;

      return {
        name,
        totalLeads: vendorLeads.length,
        thisMonth,
        lastMonth,
        growth,
        avgConsumption,
        statusDistribution,
        conversionRate,
      };
    });

    // Sort by total leads descending
    return stats.sort((a, b) => b.totalLeads - a.totalLeads);
  }, [leads, statuses]);

  // Top performer
  const topPerformer = vendorStats[0];
  const maxLeads = topPerformer?.totalLeads || 1;

  const getGrowthIcon = (growth: number) => {
    if (growth > 0) return <TrendingUp className="w-3 h-3 text-green-600" />;
    if (growth < 0) return <TrendingDown className="w-3 h-3 text-red-600" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const getGrowthColor = (growth: number) => {
    if (growth > 0) return "text-green-600";
    if (growth < 0) return "text-red-600";
    return "text-muted-foreground";
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          Performance por Vendedor
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {vendorStats.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            Nenhum lead cadastrado ainda
          </p>
        ) : (
          <div className="space-y-3">
            {vendorStats.slice(0, 6).map((vendor, index) => (
              <div key={vendor.name} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {index === 0 && <Trophy className="w-4 h-4 text-yellow-500" />}
                    <span className="font-medium text-sm truncate max-w-[120px]" title={vendor.name}>
                      {vendor.name}
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs">
                    <div className="flex items-center gap-1">
                      {getGrowthIcon(vendor.growth)}
                      <span className={getGrowthColor(vendor.growth)}>
                        {vendor.growth > 0 ? "+" : ""}{vendor.growth}%
                      </span>
                    </div>
                    <Badge variant="secondary" className="text-xs">
                      {vendor.totalLeads} leads
                    </Badge>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <Progress 
                    value={(vendor.totalLeads / maxLeads) * 100} 
                    className="h-2 flex-1"
                  />
                  <span className="text-xs text-muted-foreground w-12 text-right">
                    {vendor.avgConsumption} kWh
                  </span>
                </div>

                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <span>Este mês: {vendor.thisMonth}</span>
                  <span>•</span>
                  <span>Mês anterior: {vendor.lastMonth}</span>
                  <span>•</span>
                  <span className="text-green-600">Conv: {vendor.conversionRate}%</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Summary */}
        {vendorStats.length > 0 && (
          <div className="pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-center">
              <div>
                <p className="text-lg font-bold text-primary">{vendorStats.length}</p>
                <p className="text-xs text-muted-foreground">Vendedores Ativos</p>
              </div>
              <div>
                <p className="text-lg font-bold text-green-600">
                  {Math.round(vendorStats.reduce((acc, v) => acc + v.conversionRate, 0) / vendorStats.length)}%
                </p>
                <p className="text-xs text-muted-foreground">Conversão Média</p>
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
