import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone } from "lucide-react";
import { format, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";

interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  leads_count: number;
}

function useMetaCampaigns() {
  const since = format(subDays(new Date(), 30), "yyyy-MM-dd");
  return useQuery({
    queryKey: ["meta-campaigns", since],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_ad_metrics")
        .select("campaign_id, campaign_name, spend, clicks, impressions, leads_count")
        .gte("date", since)
        .order("date", { ascending: false });
      if (error) throw error;

      // Aggregate by campaign
      const map = new Map<string, CampaignRow>();
      for (const r of data ?? []) {
        const id = r.campaign_id ?? "unknown";
        const existing = map.get(id) ?? {
          campaign_id: id,
          campaign_name: r.campaign_name ?? "Sem nome",
          spend: 0, clicks: 0, impressions: 0, leads_count: 0,
        };
        existing.spend += r.spend ?? 0;
        existing.clicks += r.clicks ?? 0;
        existing.impressions += r.impressions ?? 0;
        existing.leads_count += r.leads_count ?? 0;
        map.set(id, existing);
      }
      return Array.from(map.values()).sort((a, b) => b.spend - a.spend);
    },
  });
}

export default function MetaCampaignsPage() {
  const { data: campaigns, isLoading } = useMetaCampaigns();

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Megaphone}
        title="Meta Ads — Campanhas"
        description="Performance por campanha nos últimos 30 dias"
      />

      {isLoading ? (
        <Card className="animate-pulse"><CardContent className="p-6 h-40" /></Card>
      ) : !campaigns?.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma campanha encontrada. As métricas serão populadas conforme dados forem sincronizados.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">{campaigns.length} campanhas</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 font-medium">Campanha</th>
                    <th className="pb-2 font-medium text-right">Investimento</th>
                    <th className="pb-2 font-medium text-right">Cliques</th>
                    <th className="pb-2 font-medium text-right">Impressões</th>
                    <th className="pb-2 font-medium text-right">Leads</th>
                    <th className="pb-2 font-medium text-right">CPL</th>
                  </tr>
                </thead>
                <tbody>
                  {campaigns.map((c) => {
                    const cpl = c.leads_count > 0 ? c.spend / c.leads_count : 0;
                    return (
                      <tr key={c.campaign_id} className="border-b last:border-0">
                        <td className="py-2.5 max-w-[200px] truncate">{c.campaign_name}</td>
                        <td className="py-2.5 text-right">R$ {c.spend.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}</td>
                        <td className="py-2.5 text-right">{c.clicks.toLocaleString("pt-BR")}</td>
                        <td className="py-2.5 text-right">{c.impressions.toLocaleString("pt-BR")}</td>
                        <td className="py-2.5 text-right">{c.leads_count}</td>
                        <td className="py-2.5 text-right">R$ {cpl.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
