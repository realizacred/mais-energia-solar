import { useMetaAdsData } from "@/hooks/useMetaAdsData";
import { formatBRL, formatIntegerBR } from "@/lib/formatters";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart2, DollarSign, MousePointerClick, Users, TrendingUp,
  AlertCircle, Eye, RefreshCw, Target, Repeat,
} from "lucide-react";
import { TopAdsBySpend } from "@/components/admin/meta/TopAdsBySpend";
import { TopCampaignsChart } from "@/components/admin/meta/TopCampaignsChart";
import { MetaTimeSeriesChart } from "@/components/admin/meta/MetaTimeSeriesChart";
import { SpendDistributionChart } from "@/components/admin/meta/SpendDistributionChart";
import { MetaNavTabs } from "@/components/admin/meta/MetaNavTabs";
import { MetricsGuideSheet } from "@/components/admin/meta/MetricsGuideSheet";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { StatCard } from "@/components/ui-kit/StatCard";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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

const PERIOD_OPTIONS = [
  { value: "7", label: "7 dias" },
  { value: "14", label: "14 dias" },
  { value: "30", label: "30 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
];

export default function MetaDashboardPage() {
  const { data: status } = useMetaIntegrationStatus();
  const [period, setPeriod] = useState("30");
  const { data, isLoading, refetch } = useMetaAdsData(Number(period));
  const [syncing, setSyncing] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  const metrics = data?.totals;
  const isConnected = status?.isActive && status?.hasToken;

  // Check data completeness
  const expectedDays = Number(period);
  const actualDays = data?.daily?.length ?? 0;
  const completenessPercent = expectedDays > 0 ? Math.round((actualDays / expectedDays) * 100) : 100;
  const isIncomplete = completenessPercent < 80 && actualDays > 0;

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
      <PageHeader
        icon={BarChart2}
        title="Meta Ads — Painel"
        description="Visão geral de performance dos anúncios"
        actions={
          <div className="flex items-center gap-2">
            <MetricsGuideSheet />
            <Button
              onClick={handleSync}
              disabled={syncing || !status?.isActive}
              size="sm"
              className="gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
              {syncing ? "Sincronizando..." : "Atualizar"}
            </Button>
          </div>
        }
      />

      <MetaNavTabs />

      {/* Connection banner */}
      {status && !status.isActive && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <AlertCircle className="h-5 w-5 text-warning shrink-0" />
            <p className="text-sm text-warning">
              Integração Meta não está ativa.{" "}
              <a href="/admin/meta-facebook-config" className="underline font-medium">
                Configurar
              </a>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Sync banner */}
      {syncing && (
        <Card className="border-warning/50 bg-warning/5">
          <CardContent className="flex items-center gap-3 p-4">
            <RefreshCw className="h-4 w-4 text-warning animate-spin shrink-0" />
            <p className="text-sm text-warning">Sincronização em andamento...</p>
          </CardContent>
        </Card>
      )}

      {/* Period selector */}
      <div className="flex items-center gap-3 flex-wrap">
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-[140px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PERIOD_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {isIncomplete && (
          <span className="text-xs text-warning">
            ⚠ Dados incompletos — {completenessPercent}% coletados
          </span>
        )}
      </div>

      {/* KPI Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {[...Array(9)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-5 h-20" /></Card>
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          <StatCard icon={DollarSign} label="Investimento" value={formatBRL(metrics.spend)} />
          <StatCard icon={Users} label="Alcance" value={formatIntegerBR(metrics.reach)} />
          <StatCard icon={Eye} label="Impressões" value={formatIntegerBR(metrics.impressions)} />
          <StatCard icon={MousePointerClick} label="Cliques" value={formatIntegerBR(metrics.clicks)} />
          <StatCard icon={TrendingUp} label="CTR" value={`${metrics.ctr.toFixed(2)}%`} />
          <StatCard icon={Target} label="Leads" value={formatIntegerBR(metrics.leads)} color="success" />
          <StatCard icon={DollarSign} label="CPC" value={formatBRL(metrics.cpc)} subtitle="Custo por clique" />
          <StatCard icon={DollarSign} label="CPL" value={formatBRL(metrics.cpl)} subtitle="Custo por lead" color="warning" />
          <StatCard icon={Repeat} label="Frequência" value={metrics.frequency.toFixed(2)} subtitle="Impressões / Alcance" />
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <BarChart2 className="w-8 h-8 text-muted-foreground/40 mb-2" />
          <p className="text-sm text-muted-foreground">Nenhum dado disponível</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Configure a integração com a Meta para visualizar métricas
          </p>
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
    </div>
  );
}
