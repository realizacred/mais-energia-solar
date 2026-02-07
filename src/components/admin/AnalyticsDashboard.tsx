import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesFunnel, VendorPerformance, ConversionMetrics } from "@/components/admin/analytics";
import DashboardCharts from "@/components/admin/DashboardCharts";
import { BarChart3, Users, TrendingUp, Target } from "lucide-react";

interface Lead {
  id: string;
  nome: string;
  estado: string;
  cidade: string;
  media_consumo: number;
  vendedor: string | null;
  created_at: string;
  status_id: string | null;
}

interface LeadStatus {
  id: string;
  nome: string;
  cor: string;
  ordem: number;
}

interface AnalyticsDashboardProps {
  leads: Lead[];
  statuses: LeadStatus[];
}

export default function AnalyticsDashboard({ leads, statuses }: AnalyticsDashboardProps) {
  // Summary stats
  const summaryStats = useMemo(() => {
    const now = new Date();
    const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    
    const thisMonthLeads = leads.filter(l => new Date(l.created_at) >= thisMonth).length;
    const lastMonthLeads = leads.filter(l => {
      const d = new Date(l.created_at);
      return d >= lastMonth && d < thisMonth;
    }).length;
    
    const growth = lastMonthLeads > 0 
      ? Math.round(((thisMonthLeads - lastMonthLeads) / lastMonthLeads) * 100)
      : thisMonthLeads > 0 ? 100 : 0;
    
    const closedStatuses = statuses.filter(s => 
      s.nome.toLowerCase().includes("fechado") || s.nome.toLowerCase().includes("conclu")
    ).map(s => s.id);
    
    const closedLeads = leads.filter(l => closedStatuses.includes(l.status_id || "")).length;
    const conversionRate = leads.length > 0 ? Math.round((closedLeads / leads.length) * 100) : 0;
    
    const uniqueVendors = new Set(leads.map(l => l.vendedor).filter(Boolean)).size;
    
    return {
      total: leads.length,
      thisMonth: thisMonthLeads,
      growth,
      conversionRate,
      uniqueVendors,
      closedLeads,
    };
  }, [leads, statuses]);

  return (
    <div className="space-y-6">
      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-primary">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold">{summaryStats.total}</p>
              <p className="text-xs text-muted-foreground">Total de Leads</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-green-500">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-green-600">
                {summaryStats.growth > 0 ? "+" : ""}{summaryStats.growth}%
              </p>
              <p className="text-xs text-muted-foreground">Crescimento</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-blue-600">{summaryStats.conversionRate}%</p>
              <p className="text-xs text-muted-foreground">Conversão</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-purple-500">
          <CardContent className="flex items-center gap-4 pt-6">
            <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-purple-600">{summaryStats.uniqueVendors}</p>
              <p className="text-xs text-muted-foreground">Vendedores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="funnel">Funil</TabsTrigger>
          <TabsTrigger value="vendors">Vendedores</TabsTrigger>
          <TabsTrigger value="conversion">Conversão</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <DashboardCharts leads={leads} />
        </TabsContent>

        <TabsContent value="funnel" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <SalesFunnel leads={leads} statuses={statuses} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Distribuição por Status</CardTitle>
                <CardDescription>
                  Quantidade de leads em cada etapa do funil
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {statuses
                    .sort((a, b) => a.ordem - b.ordem)
                    .map((status) => {
                      const count = leads.filter(l => l.status_id === status.id).length;
                      const percent = leads.length > 0 ? Math.round((count / leads.length) * 100) : 0;
                      
                      return (
                        <div key={status.id} className="flex items-center gap-3">
                          <div 
                            className="w-3 h-3 rounded-full" 
                            style={{ backgroundColor: status.cor }}
                          />
                          <span className="text-sm flex-1">{status.nome}</span>
                          <span className="text-sm font-medium">{count}</span>
                          <span className="text-xs text-muted-foreground w-10 text-right">
                            {percent}%
                          </span>
                        </div>
                      );
                    })}
                  
                  {/* Leads without status */}
                  <div className="flex items-center gap-3 pt-2 border-t">
                    <div className="w-3 h-3 rounded-full bg-muted" />
                    <span className="text-sm flex-1 text-muted-foreground">Sem status</span>
                    <span className="text-sm font-medium">
                      {leads.filter(l => !l.status_id).length}
                    </span>
                    <span className="text-xs text-muted-foreground w-10 text-right">
                      {leads.length > 0 
                        ? Math.round((leads.filter(l => !l.status_id).length / leads.length) * 100)
                        : 0}%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="vendors" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <VendorPerformance leads={leads} statuses={statuses} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Ranking de Leads</CardTitle>
                <CardDescription>
                  Top 10 vendedores por quantidade de leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(
                    leads.reduce((acc: Record<string, number>, l) => {
                      const v = l.vendedor || "Sem vendedor";
                      acc[v] = (acc[v] || 0) + 1;
                      return acc;
                    }, {})
                  )
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([name, count], i) => (
                      <div key={name} className="flex items-center gap-3 py-1">
                        <span className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {i + 1}
                        </span>
                        <span className="text-sm flex-1 truncate" title={name}>{name}</span>
                        <span className="text-sm font-bold">{count}</span>
                      </div>
                    ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="conversion" className="space-y-4">
          <div className="grid md:grid-cols-2 gap-6">
            <ConversionMetrics leads={leads} statuses={statuses} />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Resumo de Conversão</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="text-center py-4">
                  <p className="text-5xl font-bold text-primary">{summaryStats.conversionRate}%</p>
                  <p className="text-sm text-muted-foreground mt-1">Taxa de Conversão Geral</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{summaryStats.total}</p>
                    <p className="text-xs text-muted-foreground">Leads Totais</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-green-600">{summaryStats.closedLeads}</p>
                    <p className="text-xs text-muted-foreground">Convertidos</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Metas</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Meta de Conversão</span>
                      <span className={summaryStats.conversionRate >= 20 ? "text-green-600" : "text-yellow-600"}>
                        20% {summaryStats.conversionRate >= 20 ? "✓" : ""}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span>Leads este mês</span>
                      <span>{summaryStats.thisMonth}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
