import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SalesFunnel, VendorPerformance, ConversionMetrics } from "@/components/admin/analytics";
import { RevenueForecastWidget } from "@/components/admin/widgets/RevenueForecastWidget";
import DashboardCharts from "@/components/admin/DashboardCharts";
import { BarChart3, Users, TrendingUp, Target, DollarSign } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { useAnalyticsLeads, useAnalyticsLeadStatuses, type AnalyticsLead, type AnalyticsLeadStatus } from "@/hooks/useAnalyticsDashboard";
import { LeadsByOriginChart } from "@/components/admin/metrics/LeadsByOriginChart";
import { ClosingTimeCard } from "@/components/admin/metrics/ClosingTimeCard";
import { RevenuePrevVsRealizedChart } from "@/components/admin/metrics/RevenuePrevVsRealizedChart";

interface AnalyticsDashboardProps {
  leads?: AnalyticsLead[];
  statuses?: AnalyticsLeadStatus[];
}

export default function AnalyticsDashboard({ leads: propLeads, statuses: propStatuses }: AnalyticsDashboardProps) {
  const { data: fetchedLeads, isLoading: loadingLeads } = useAnalyticsLeads();
  const { data: fetchedStatuses, isLoading: loadingStatuses } = useAnalyticsLeadStatuses();

  const leads = propLeads || fetchedLeads || [];
  const statuses = propStatuses || fetchedStatuses || [];
  const isLoading = !propLeads && !propStatuses && (loadingLeads || loadingStatuses);

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
    
    const dayOfMonth = now.getDate();
    const daysInLastMonth = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const proportionalLastMonth = lastMonthLeads > 0
      ? (lastMonthLeads / daysInLastMonth) * dayOfMonth
      : 0;

    const growth = proportionalLastMonth > 0
      ? Math.round(((thisMonthLeads - proportionalLastMonth) / proportionalLastMonth) * 100)
      : thisMonthLeads > 0 ? 100 : 0;
    
    const closedStatuses = statuses.filter(s => 
      s.nome.toLowerCase().includes("fechado") || s.nome.toLowerCase().includes("conclu")
    ).map(s => s.id);
    
    const closedLeads = leads.filter(l => closedStatuses.includes(l.status_id || "")).length;
    const conversionRate = leads.length > 0 ? Math.round((closedLeads / leads.length) * 100) : 0;
    
    const uniqueVendors = new Set(leads.map(l => l.consultor).filter(Boolean)).size;
    
    return {
      total: leads.length,
      thisMonth: thisMonthLeads,
      growth,
      conversionRate,
      uniqueVendors,
      closedLeads,
    };
  }, [leads, statuses]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-32" />
            </Card>
          ))}
        </div>
        <div className="space-y-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full rounded-lg" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Dashboard"
        description="Visão geral de leads, conversão e performance"
      />

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <Card className="border-l-[3px] border-l-secondary bg-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
              <Target className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight leading-none">{summaryStats.total}</p>
              <p className="text-sm text-muted-foreground mt-1">Total de leads</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-success bg-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight leading-none">
                {summaryStats.growth > 0 ? "+" : ""}{summaryStats.growth}%
              </p>
              <p className="text-sm text-muted-foreground mt-1">Crescimento</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-secondary bg-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
              <BarChart3 className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight leading-none">{summaryStats.conversionRate}%</p>
              <p className="text-sm text-muted-foreground mt-1">Conversão</p>
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-secondary bg-card">
          <CardContent className="flex items-center gap-4 p-5">
            <div className="w-10 h-10 rounded-lg bg-secondary/10 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-secondary" />
            </div>
            <div>
              <p className="text-2xl font-bold tracking-tight leading-none">{summaryStats.uniqueVendors}</p>
              <p className="text-sm text-muted-foreground mt-1">Consultores</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabbed Content */}
      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="overflow-x-auto flex-wrap h-auto grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="overview" className="gap-1.5 shrink-0 whitespace-nowrap"><BarChart3 className="h-4 w-4 text-info" /> Visão Geral</TabsTrigger>
          <TabsTrigger value="commercial" className="gap-1.5 shrink-0 whitespace-nowrap"><DollarSign className="h-4 w-4 text-success" /> Comercial</TabsTrigger>
          <TabsTrigger value="funnel" className="gap-1.5 shrink-0 whitespace-nowrap"><Target className="h-4 w-4 text-primary" /> Funil</TabsTrigger>
          <TabsTrigger value="vendors" className="gap-1.5 shrink-0 whitespace-nowrap"><Users className="h-4 w-4 text-secondary" /> Vendedores</TabsTrigger>
          <TabsTrigger value="conversion" className="gap-1.5 shrink-0 whitespace-nowrap"><TrendingUp className="h-4 w-4 text-success" /> Conversão</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <RevenueForecastWidget />
          <DashboardCharts leads={leads} />
        </TabsContent>

        <TabsContent value="commercial" className="space-y-6">
          <LeadsByOriginChart />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <ClosingTimeCard />
            <RevenuePrevVsRealizedChart />
          </div>
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
                  Top 10 consultores por quantidade de leads
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {Object.entries(
                    leads.reduce((acc: Record<string, number>, l) => {
                      const v = l.consultor || "Sem consultor";
                      acc[v] = (acc[v] || 0) + 1;
                      return acc;
                    }, {})
                  )
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 10)
                    .map(([name, count], i) => (
                      <div key={name} className="flex items-center gap-3 py-1">
                        <span className="w-6 h-6 rounded-full bg-secondary/10 flex items-center justify-center text-xs font-bold text-secondary">
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
                  <p className="text-5xl font-bold text-secondary">{summaryStats.conversionRate}%</p>
                  <p className="text-sm text-muted-foreground mt-1">Taxa de Conversão Geral</p>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t">
                  <div className="text-center">
                    <p className="text-2xl font-bold">{summaryStats.total}</p>
                    <p className="text-xs text-muted-foreground">Leads Totais</p>
                  </div>
                  <div className="text-center">
                    <p className="text-2xl font-bold text-success">{summaryStats.closedLeads}</p>
                    <p className="text-xs text-muted-foreground">Convertidos</p>
                  </div>
                </div>

                <div className="pt-4 border-t">
                  <p className="text-sm font-medium mb-2">Metas</p>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Meta de Conversão</span>
                      <span className={summaryStats.conversionRate >= 20 ? "text-success" : "text-warning"}>
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
