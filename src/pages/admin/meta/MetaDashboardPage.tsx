import { useMetaAdsData } from "@/hooks/useMetaAdsData";
import { formatBRL } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart2, DollarSign, MousePointerClick, Users, TrendingUp,
  AlertCircle, Eye, RefreshCw, Target, Repeat, Settings,
} from "lucide-react";
import { TopAdsBySpend } from "@/components/admin/meta/TopAdsBySpend";
import { TopCampaignsChart } from "@/components/admin/meta/TopCampaignsChart";
import { MetaTimeSeriesChart } from "@/components/admin/meta/MetaTimeSeriesChart";
import { SpendDistributionChart } from "@/components/admin/meta/SpendDistributionChart";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui-kit/StatCard";

function useMetaIntegrationStatus() {
  return useQuery({
    queryKey: ["meta-integration-status"],
    staleTime: 1000 * 60 * 5,
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

export default function MetaDashboardPage() {
  const { data: status } = useMetaIntegrationStatus();
  const { data, isLoading, refetch } = useMetaAdsData(30);
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const metrics = data?.totals;
  const isConnected = status?.isActive && status?.hasToken;

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
      {/* Header §26 */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <BarChart2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Meta Ads — Dashboard</h1>
            <p className="text-sm text-muted-foreground">Visão geral de performance dos últimos 30 dias</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => navigate("/admin/catalogo-integracoes")}
            className="gap-1.5"
          >
            <Settings className="w-3.5 h-3.5" />
            Configurar Meta
          </Button>
          <Button
            onClick={handleSync}
            disabled={syncing || !status?.isActive}
            size="sm"
            className="gap-1.5"
          >
            <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
            {syncing ? "Sincronizando..." : "Sincronizar Métricas"}
          </Button>
        </div>
      </div>

      {/* Connection Status §22 */}
      <div className="p-4 rounded-lg bg-muted/50 border border-border">
        <div className="flex items-center gap-2 mb-1">
          <div className={cn(
            "w-2 h-2 rounded-full",
            isConnected ? "bg-success" : "bg-destructive"
          )} />
          <span className="text-sm font-medium text-foreground">
            {isConnected ? "Conectado" : "Não configurado"}
          </span>
          <Button
            variant="outline"
            size="sm"
            className="ml-auto gap-1.5"
            onClick={() => navigate("/admin/catalogo-integracoes")}
          >
            <Settings className="w-3.5 h-3.5" />
            Configurar
          </Button>
        </div>
        {!isConnected && (
          <p className="text-xs text-muted-foreground">
            Configure o Access Token e App Secret para começar a receber dados.
          </p>
        )}
      </div>

      {status && !status.isActive && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm text-warning">
              Integração Meta não está ativa. Configure as credenciais em{" "}
              <a href="/admin/catalogo-integracoes" className="underline font-medium">Integrações → Meta</a>.
            </p>
          </CardContent>
        </Card>
      )}

      {/* KPI Cards §27 */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
          {[...Array(7)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-5 h-20" /></Card>
          ))}
        </div>
      ) : metrics ? (
        <>
           <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
             <StatCard icon={DollarSign} label="Investimento" value={formatBRL(metrics.spend)} />
             <StatCard icon={Eye} label="Alcance" value={metrics.reach.toLocaleString("pt-BR")} />
             <StatCard icon={BarChart2} label="Impressões" value={metrics.impressions.toLocaleString("pt-BR")} />
             <StatCard icon={MousePointerClick} label="Cliques" value={metrics.clicks.toLocaleString("pt-BR")} />
             <StatCard icon={TrendingUp} label="CTR" value={`${metrics.ctr.toFixed(2)}%`} />
             <StatCard icon={Users} label="Leads" value={metrics.leads.toLocaleString("pt-BR")} />
             <StatCard icon={Target} label="CPL" value={formatBRL(metrics.cpl)} />
           </div>
           <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
             <StatCard icon={MousePointerClick} label="CPC" value={formatBRL(metrics.cpc)} subtitle="Custo por clique" />
             <StatCard icon={Target} label="CPL" value={formatBRL(metrics.cpl)} subtitle="Custo por lead" />
             <StatCard icon={Repeat} label="Frequência" value={metrics.frequency.toFixed(2)} subtitle="Impressões / Alcance" />
          </div>
        </>
      ) : null}

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
    </div>
  );
}
