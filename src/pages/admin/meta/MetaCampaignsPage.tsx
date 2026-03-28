import { useState, useMemo } from "react";
import { formatBRL, formatInteger } from "@/lib/formatters/index";
import { useMetaAdsData } from "@/hooks/useMetaAdsData";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { StatCard } from "@/components/ui-kit/StatCard";
import { MetaNavTabs } from "@/components/admin/meta/MetaNavTabs";
import { CampaignsGuideSheet } from "@/components/admin/meta/CampaignsGuideSheet";
import { SearchInput } from "@/components/ui-kit/SearchInput";
import { Megaphone, ChevronDown, ChevronUp, ArrowUpDown, RefreshCw, DollarSign, Eye, MousePointerClick, Users } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type SortKey = "campaign_name" | "spend" | "impressions" | "reach" | "clicks" | "ctr" | "leads_count" | "cpl";
type SortDir = "asc" | "desc";
type StatusFilter = "ALL" | "ACTIVE" | "PAUSED";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-success/10 text-success border-success/30",
  PAUSED: "bg-warning/10 text-warning border-warning/30",
  DELETED: "bg-destructive/10 text-destructive border-destructive/30",
  ARCHIVED: "bg-muted text-muted-foreground border-border",
};

function StatusBadge({ status }: { status: string | null }) {
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  const colorClass = STATUS_COLORS[status] || "bg-muted text-muted-foreground border-border";
  return (
    <Badge variant="outline" className={cn("text-[10px] font-semibold uppercase tracking-wider", colorClass)}>
      {status}
    </Badge>
  );
}

export default function MetaCampaignsPage() {
  const { data, isLoading, refetch } = useMetaAdsData(30);
  const campaigns = data?.campaigns ?? [];
  const { toast } = useToast();

  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [syncing, setSyncing] = useState(false);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  };

  const filtered = useMemo(() => {
    let result = campaigns;
    if (statusFilter !== "ALL") {
      result = result.filter((c) => c.effective_status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((c) => c.campaign_name?.toLowerCase().includes(q));
    }
    return result;
  }, [campaigns, statusFilter, search]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const aVal = a[sortKey];
      const bVal = b[sortKey];
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortDir === "asc" ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
      }
      return sortDir === "asc" ? (aVal as number) - (bVal as number) : (bVal as number) - (aVal as number);
    });
  }, [filtered, sortKey, sortDir]);

  // Summary of filtered campaigns
  const summary = useMemo(() => {
    return filtered.reduce(
      (acc, c) => ({
        spend: acc.spend + c.spend,
        impressions: acc.impressions + c.impressions,
        clicks: acc.clicks + c.clicks,
        reach: acc.reach + c.reach,
      }),
      { spend: 0, impressions: 0, clicks: 0, reach: 0 }
    );
  }, [filtered]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { error } = await supabase.functions.invoke("meta-ads-sync");
      if (error) throw error;
      toast({ title: "Sincronização concluída" });
      refetch();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSyncing(false);
    }
  };

  const SortHeader = ({ label, field, align = "right" }: { label: string; field: SortKey; align?: "left" | "right" }) => (
    <th
      className={cn(
        "pb-2 font-medium cursor-pointer hover:text-foreground transition-colors select-none",
        align === "right" ? "text-right" : "text-left"
      )}
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
        description="Visualize suas campanhas de anúncios"
        actions={
          <div className="flex items-center gap-2">
            <CampaignsGuideSheet />
            <Button
              onClick={handleSync}
              disabled={syncing}
              size="sm"
              className="gap-1.5"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", syncing && "animate-spin")} />
              Atualizar
            </Button>
          </div>
        }
      />

      <MetaNavTabs />

      {/* Summary cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <StatCard icon={DollarSign} label="Investimento" value={formatBRL(summary.spend)} />
          <StatCard icon={Users} label="Alcance" value={formatInteger(summary.reach)} />
          <StatCard icon={Eye} label="Impressões" value={formatInteger(summary.impressions)} />
          <StatCard icon={MousePointerClick} label="Cliques" value={formatInteger(summary.clicks)} />
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="inline-flex h-9 items-center rounded-md bg-muted p-1 text-muted-foreground">
          {(["ALL", "ACTIVE", "PAUSED"] as StatusFilter[]).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className={cn(
                "inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1 text-xs font-medium transition-all",
                statusFilter === s
                  ? "bg-background text-foreground shadow-sm"
                  : "hover:bg-background/50 hover:text-foreground"
              )}
            >
              {s === "ALL" ? "Todas" : s === "ACTIVE" ? "Ativas" : "Pausadas"}
            </button>
          ))}
        </div>
        <SearchInput value={search} onChange={setSearch} placeholder="Buscar campanha..." />
      </div>

      {isLoading ? (
        <Card className="animate-pulse"><CardContent className="p-6 h-40" /></Card>
      ) : !sorted.length ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Megaphone className="w-8 h-8 mx-auto mb-2 text-muted-foreground/40" />
            <p>Nenhuma campanha encontrada neste período</p>
            <a href="/admin/meta-facebook-config" className="text-primary text-sm underline mt-1 inline-block">
              Configurar integração
            </a>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4" />
              Campanhas ({sorted.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-muted-foreground text-left">
                    <th className="pb-2 w-8" />
                    <SortHeader label="Nome" field="campaign_name" align="left" />
                    <th className="pb-2 font-medium text-center">Status</th>
                    <SortHeader label="Gasto" field="spend" />
                    <SortHeader label="Impressões" field="impressions" />
                    <SortHeader label="Alcance" field="reach" />
                    <SortHeader label="Cliques" field="clicks" />
                    <SortHeader label="CTR %" field="ctr" />
                    <SortHeader label="Leads" field="leads_count" />
                    <SortHeader label="CPL" field="cpl" />
                  </tr>
                </thead>
                <tbody>
                  {sorted.map((c) => {
                    const isExpanded = expandedId === c.campaign_id;
                    return (
                      <React.Fragment key={c.campaign_id}>
                        <tr
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
                          <td className="py-2.5 max-w-[200px] truncate font-medium">{c.campaign_name}</td>
                          <td className="py-2.5 text-center"><StatusBadge status={c.effective_status} /></td>
                          <td className="py-2.5 text-right font-medium text-primary">{formatBRL(c.spend)}</td>
                          <td className="py-2.5 text-right">{formatInteger(c.impressions)}</td>
                          <td className="py-2.5 text-right">{formatInteger(c.reach)}</td>
                          <td className="py-2.5 text-right">{formatInteger(c.clicks)}</td>
                          <td className="py-2.5 text-right">{c.ctr.toFixed(2)}%</td>
                          <td className="py-2.5 text-right">{c.leads_count}</td>
                          <td className="py-2.5 text-right">{formatBRL(c.cpl)}</td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-muted/30">
                            <td colSpan={10} className="p-4">
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
                                  <span className="text-muted-foreground">CPM (Custo / 1k Impr.)</span>
                                  <p className="font-semibold text-sm">
                                    {c.impressions > 0 ? formatBRL((c.spend / c.impressions) * 1000) : "—"}
                                  </p>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
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

import React from "react";
