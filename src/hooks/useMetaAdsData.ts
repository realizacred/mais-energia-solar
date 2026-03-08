import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";

export interface AdRow {
  ad_id: string;
  ad_name: string;
  spend: number;
  ctr: number;
  clicks: number;
  impressions: number;
  reach: number;
  leads_count: number;
}

export interface CampaignRow {
  campaign_id: string;
  campaign_name: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  leads_count: number;
  ctr: number;
  cpl: number;
  effective_status: string | null;
}

function aggregateBy<T extends Record<string, any>>(
  data: T[],
  keyField: string,
  nameField: string,
  sumFields: string[],
  pickFields?: string[]
): Map<string, Record<string, any>> {
  const map = new Map<string, Record<string, any>>();
  for (const r of data) {
    const id = r[keyField] ?? "unknown";
    const existing = map.get(id) ?? {
      [keyField]: id,
      [nameField]: r[nameField] ?? "Sem nome",
      ...Object.fromEntries(sumFields.map((f) => [f, 0])),
      ...Object.fromEntries((pickFields ?? []).map((f) => [f, r[f] ?? null])),
    };
    for (const f of sumFields) {
      existing[f] += r[f] ?? 0;
    }
    map.set(id, existing);
  }
  return map;
}

export interface DailyRow {
  date: string;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  leads_count: number;
}

export function useMetaAdsData(days = 30) {
  const since = format(subDays(new Date(), days), "yyyy-MM-dd");

  return useQuery({
    queryKey: ["meta-ads-full", since],
    staleTime: 1000 * 60 * 5,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("facebook_ad_metrics")
        .select("date, ad_id, ad_name, campaign_id, campaign_name, spend, clicks, impressions, reach, leads_count, ctr, cpc, cpl, effective_status")
        .gte("date", since)
        .order("date", { ascending: true });

      if (error) throw error;
      const rows = data ?? [];

      // Aggregate ads
      const adsMap = aggregateBy(rows, "ad_id", "ad_name", ["spend", "clicks", "impressions", "reach", "leads_count"]);
      const ads: AdRow[] = Array.from(adsMap.values()).map((a) => ({
        ad_id: a.ad_id,
        ad_name: a.ad_name,
        spend: a.spend,
        clicks: a.clicks,
        impressions: a.impressions,
        reach: a.reach,
        leads_count: a.leads_count,
        ctr: a.impressions > 0 ? (a.clicks / a.impressions) * 100 : 0,
      }));
      ads.sort((a, b) => b.spend - a.spend);

      // Aggregate campaigns
      const campMap = aggregateBy(
        rows, "campaign_id", "campaign_name",
        ["spend", "clicks", "impressions", "reach", "leads_count"],
        ["effective_status"]
      );
      const campaigns: CampaignRow[] = Array.from(campMap.values()).map((c) => ({
        campaign_id: c.campaign_id,
        campaign_name: c.campaign_name,
        spend: c.spend,
        clicks: c.clicks,
        impressions: c.impressions,
        reach: c.reach,
        leads_count: c.leads_count,
        ctr: c.impressions > 0 ? (c.clicks / c.impressions) * 100 : 0,
        cpl: c.leads_count > 0 ? c.spend / c.leads_count : 0,
        effective_status: c.effective_status,
      }));
      campaigns.sort((a, b) => b.spend - a.spend);

      // Daily time series
      const dailyMap = new Map<string, DailyRow>();
      for (const r of rows) {
        const d = r.date as string;
        const existing = dailyMap.get(d) ?? { date: d, spend: 0, clicks: 0, impressions: 0, reach: 0, leads_count: 0 };
        existing.spend += r.spend ?? 0;
        existing.clicks += r.clicks ?? 0;
        existing.impressions += r.impressions ?? 0;
        existing.reach += (r as any).reach ?? 0;
        existing.leads_count += r.leads_count ?? 0;
        dailyMap.set(d, existing);
      }
      const daily = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));

      // Summary totals
      const totals = rows.reduce(
        (acc, r) => ({
          spend: acc.spend + (r.spend ?? 0),
          clicks: acc.clicks + (r.clicks ?? 0),
          impressions: acc.impressions + (r.impressions ?? 0),
          reach: acc.reach + ((r as any).reach ?? 0),
          leads: acc.leads + (r.leads_count ?? 0),
        }),
        { spend: 0, clicks: 0, impressions: 0, reach: 0, leads: 0 }
      );

      const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0;
      const cpl = totals.leads > 0 ? totals.spend / totals.leads : 0;
      const frequency = totals.reach > 0 ? totals.impressions / totals.reach : 0;

      return {
        ads,
        campaigns,
        daily,
        totals: {
          ...totals,
          ctr: totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0,
          cpc,
          cpl,
          frequency,
        },
      };
    },
  });
}
