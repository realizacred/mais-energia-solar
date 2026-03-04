import { useState } from "react";
import { formatBRL, formatInteger } from "@/lib/formatters/index";
import { useMetaAdsData } from "@/hooks/useMetaAdsData";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Megaphone, ChevronDown, ChevronUp, ArrowUpDown } from "lucide-react";

type SortKey = "campaign_name" | "spend" | "impressions" | "clicks" | "ctr" | "leads_count" | "cpl";
type SortDir = "asc" | "desc";

export default function MetaCampaignsPage() {
  const { data, isLoading } = useMetaAdsData(30);
  const campaigns = data?.campaigns ?? [];

  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const sorted = [...campaigns].sort((a, b) => {
    const aVal = a[sortKey];
    const bVal = b[sortKey];
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
  });

  const SortHeader = ({ label, field, align = "right" }: { label: string; field: SortKey; align?: "left" | "right" }) => (
    <th
      className={`pb-2 font-medium cursor-pointer hover:text-foreground transition-colors select-none ${align === "right" ? "text-right" : "text-left"}`}
      onClick={() => toggleSort(field)}
    >
      <span className="inline-flex items-center gap-1">
        {label}
        {sortKey === field ? (
          sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ArrowUpDown className="h-3 w-3 opacity-40" />
        )}
      </span>
    </th>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon={Megaphone}
        title="Meta Ads — Campanhas"
        description="Performance por campanha nos últimos 30 dias"
      />

      {isLoading ? (
        <Card className="animate-pulse"><CardContent className="p-6 h-40" /></Card>
      ) : !campaigns.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            Nenhuma campanha encontrada. As métricas serão populadas conforme dados forem sincronizados.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Campanhas ({campaigns.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 w-8" />
                    <SortHeader label="Nome" field="campaign_name" align="left" />
                    <SortHeader label="Gasto" field="spend" />
                    <SortHeader label="Impressões" field="impressions" />
                    <SortHeader label="Cliques" field="clicks" />
                    <SortHeader label="CTR %" field="ctr" />
                    <SortHeader label="Leads" field="leads_count" />
                    <SortHeader label="CPL" field="cpl" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => {
                    const isExpanded = expandedId === c.campaign_id;
                    const relatedAds = (data?.ads ?? []).filter(
                      (a) => campaigns.find((camp) => camp.campaign_id === c.campaign_id)
                    );

                    return (
                      <>
                        <tr
                          key={c.campaign_id}
                          className="border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors"
                          onClick={() => setExpandedId(isExpanded ? null : c.campaign_id)}
                        >
                          <td className="py-2.5">
                            {isExpanded ? (
                              <ChevronUp className="h-4 w-4 text-muted-foreground" />
                            ) : (
                              <ChevronDown className="h-4 w-4 text-muted-foreground" />
                            )}
                          </td>
                          <td className="py-2.5 max-w-[200px] truncate font-medium">
                            {c.campaign_name}
                          </td>
                          <td className="py-2.5 text-right font-medium text-primary">{formatBRL(c.spend)}</td>
                          <td className="py-2.5 text-right">{formatInteger(c.impressions)}</td>
                          <td className="py-2.5 text-right">{formatInteger(c.clicks)}</td>
                          <td className="py-2.5 text-right">{c.ctr.toFixed(2)}%</td>
                          <td className="py-2.5 text-right">{c.leads_count}</td>
                          <td className="py-2.5 text-right">{formatBRL(c.cpl)}</td>
                        </tr>
                        {isExpanded && (
                          <tr key={`${c.campaign_id}-detail`} className="bg-muted/30">
                            <td colSpan={8} className="p-4">
                              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                                <div>
                                  <span className="text-muted-foreground">CTR</span>
                                  <p className="font-semibold text-sm">{c.ctr.toFixed(2)}%</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">CPC</span>
                                  <p className="font-semibold text-sm">
                                    {c.clicks > 0 ? formatBRL(c.spend / c.clicks) : "—"}
                                  </p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">CPL</span>
                                  <p className="font-semibold text-sm">{formatBRL(c.cpl)}</p>
                                </div>
                                <div>
                                  <span className="text-muted-foreground">Custo / 1k Impressões</span>
                                  <p className="font-semibold text-sm">
                                    {c.impressions > 0 ? formatBRL((c.spend / c.impressions) * 1000) : "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
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
