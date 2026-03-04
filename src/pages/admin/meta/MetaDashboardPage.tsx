import { useMetaAdsData } from "@/hooks/useMetaAdsData";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, DollarSign, MousePointerClick, Users, TrendingUp, AlertCircle } from "lucide-react";
import { TopAdsBySpend } from "@/components/admin/meta/TopAdsBySpend";
import { TopCampaignsChart } from "@/components/admin/meta/TopCampaignsChart";

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

function StatCard({ title, value, icon: Icon }: { title: string; value: string | number; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MetaDashboardPage() {
  const { data: status } = useMetaIntegrationStatus();
  const { data, isLoading } = useMetaAdsData(30);

  const metrics = data?.totals;

  return (
    <div className="space-y-6">
      <PageHeader
        icon={BarChart3}
        title="Meta Ads — Dashboard"
        description="Visão geral de performance dos últimos 30 dias"
      />

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

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-4 h-20" /></Card>
          ))}
        </div>
      ) : metrics ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard title="Investimento" value={`R$ ${metrics.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`} icon={DollarSign} />
          <StatCard title="Cliques" value={metrics.clicks.toLocaleString("pt-BR")} icon={MousePointerClick} />
          <StatCard title="Leads" value={metrics.leads.toLocaleString("pt-BR")} icon={Users} />
          <StatCard title="CPL" value={`R$ ${metrics.cpl.toFixed(2)}`} icon={TrendingUp} />
        </div>
      ) : null}

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
