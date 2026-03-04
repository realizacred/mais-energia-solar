import { useMetaAdsData } from "@/hooks/useMetaAdsData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BarChart3, DollarSign, MousePointerClick, Users, TrendingUp,
  AlertCircle, Eye, RefreshCw, Target, Repeat,
} from "lucide-react";
import { TopAdsBySpend } from "@/components/admin/meta/TopAdsBySpend";
import { TopCampaignsChart } from "@/components/admin/meta/TopCampaignsChart";
import { MetaTimeSeriesChart } from "@/components/admin/meta/MetaTimeSeriesChart";
import { SpendDistributionChart } from "@/components/admin/meta/SpendDistributionChart";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

function useMetaIntegrationStatus() {
  return useQuery({
    queryKey: ["meta-integration-status"],
    queryFn: async () => {
      const { data } = await supabase
        .from("integration_configs")
        .select("service_key, is_active")
        .in("service_key", ["meta_facebook", "meta_facebook_app_secret", "meta_facebook_verify_token"]);
      const map = new Map(data?.map((c) => [c.service_key, c.is_active]) ?? []);
      return {
        hasToken: map.has("meta_facebook"),
        isActive: map.get("meta_facebook") ?? false,
        hasAppSecret: map.has("meta_facebook_app_secret"),
        hasVerifyToken: map.has("meta_facebook_verify_token"),
      };
    },
  });
}

function StatCard({ title, value, icon: Icon, subtitle }: { title: string; value: string | number; icon: React.ComponentType<{ className?: string }>; subtitle?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold">{value}</p>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  );
}

export default function MetaDashboardPage() {
  const { data: status } = useMetaIntegrationStatus();
  const { data, isLoading, refetch } = useMetaAdsData(30);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();

  const metrics = data?.totals;

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: result, error } = await supabase.functions.invoke("meta-ads-sync");
      if (error) throw error;
      toast({
        title: "Sincronização concluída",
        description: `${result?.upserted ?? 0} registros atualizados, ${result?.campaigns ?? 0} campanhas.`,
      });
      refetch();
    } catch (err: any) {
      toast({
        title: "Erro na sincronização",
        description: err.message || "Erro desconhecido",
        variant: "destructive",
      });
    } finally {
      setSyncing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <PageHeader
          icon={BarChart3}
          title="Meta Ads — Dashboard"
          description="Visão geral de performance dos últimos 30 dias"
        />
        <Button
          onClick={handleSync}
          disabled={syncing || !status?.isActive}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${syncing ? "animate-spin" : ""}`} />
          {syncing ? "Sincronizando..." : "Sincronizar Métricas"}
        </Button>
      </div>

      {status && !status.isActive && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm text-warning">
              Integração Meta não está ativa. Configure as credenciais em{" "}
              <a href="/admin/meta-facebook-config" className="underline font-medium">Integrações → Meta</a>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards - Row 1 */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[...Array(7)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          <StatCard title="Investimento" value={`R$ ${metrics.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
          <StatCard title="Alcance" value={metrics.reach.toLocaleString("pt-BR")} icon={Eye} />
          <StatCard title="Impressões" value={metrics.impressions.toLocaleString("pt-BR")} icon={BarChart3} />
          <StatCard title="Cliques" value={metrics.clicks.toLocaleString("pt-BR")} icon={MousePointerClick} />
          <StatCard title="CTR" value={`${metrics.ctr.toFixed(2)}%`} icon={TrendingUp} />
          <StatCard title="Leads" value={metrics.leads.toLocaleString("pt-BR")} icon={Users} />
          <StatCard title="CPL" value={`R$ ${metrics.cpl.toFixed(2)}`} icon={Target} />
        </div>
      ) : null}

      {/* KPI Cards - Row 2: CPC + Frequência */}
      {metrics && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          <StatCard title="CPC" value={`R$ ${metrics.cpc.toFixed(2)}`} icon={MousePointerClick} subtitle="Custo por clique" />
          <StatCard title="CPL" value={`R$ ${metrics.cpl.toFixed(2)}`} icon={Target} subtitle="Custo por lead" />
          <StatCard title="Frequência" value={metrics.frequency.toFixed(2)} icon={Repeat} subtitle="Impressões / Alcance" />
        </div>
      )}

      {/* Time Series + Spend Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2">
          <MetaTimeSeriesChart daily={data?.daily ?? []} isLoading={isLoading} />
        </div>
        <SpendDistributionChart campaigns={data?.campaigns ?? []} isLoading={isLoading} />
      </div>

      {/* Top Ads + Top Campaigns Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TopAdsBySpend ads={data?.ads ?? []} isLoading={isLoading} />
        <TopCampaignsChart campaigns={data?.campaigns ?? []} isLoading={isLoading} />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status da Conexão</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant={status?.hasToken ? "default" : "secondary"}>Access Token</Badge>
            <Badge variant={status?.hasAppSecret ? "default" : "secondary"}>App Secret</Badge>
            <Badge variant={status?.hasVerifyToken ? "default" : "secondary"}>Verify Token</Badge>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
