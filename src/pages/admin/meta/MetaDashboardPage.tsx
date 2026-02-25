import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart3, DollarSign, MousePointerClick, Users, TrendingUp, AlertCircle } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

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

function useMetaMetricsSummary() {
  const since = format(subDays(new Date(), 30), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["meta-metrics-summary", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_ad_metrics")
        .select("spend, clicks, impressions, leads_count, ctr, cpc, cpl")
        .gte("date", since);
      if (error) throw error;
      const totals = (data ?? []).reduce(
        (acc, r) => ({
          spend: acc.spend + (r.spend ?? 0),
          clicks: acc.clicks + (r.clicks ?? 0),
          impressions: acc.impressions + (r.impressions ?? 0),
          leads: acc.leads + (r.leads_count ?? 0),
        }),
        { spend: 0, clicks: 0, impressions: 0, leads: 0 }
      );
      const ctr = totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0;
      const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
      return { ...totals, ctr, cpl };
    },
  });
}

function StatCard({ title, value, icon: Icon, suffix }: { title: string; value: string | number; icon: React.ComponentType<{ className?: string }>; suffix?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-xs text-muted-foreground">{title}</p>
          <p className="text-lg font-semibold">{value}{suffix}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function MetaDashboardPage() {
  const { data: status } = useMetaIntegrationStatus();
  const { data: metrics, isLoading } = useMetaMetricsSummary();

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
