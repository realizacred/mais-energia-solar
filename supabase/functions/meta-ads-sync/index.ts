import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { fetchWithTimeout, sanitizeError, updateHealthCache } from "../_shared/error-utils.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getSupabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
  );
}

interface MetaInsightRow {
  campaign_id: string;
  campaign_name: string;
  ad_id: string | null;
  ad_name: string | null;
  adset_id: string | null;
  adset_name: string | null;
  spend: number;
  clicks: number;
  impressions: number;
  reach: number;
  ctr: number;
  cpc: number;
  cpl: number;
  leads_count: number;
  effective_status: string | null;
  date: string;
}

const INSIGHTS_FIELDS = [
  "campaign_id",
  "campaign_name",
  "ad_id",
  "ad_name",
  "adset_id",
  "adset_name",
  "spend",
  "clicks",
  "impressions",
  "reach",
  "ctr",
  "cpc",
  "actions",
  "cost_per_action_type",
].join(",");

async function fetchAllPages(url: string): Promise<any[]> {
  const results: any[] = [];
  let nextUrl: string | null = url;
  let pageCount = 0;

  while (nextUrl && pageCount < 50) {
    const res = await fetchWithTimeout(nextUrl, {}, 30000);
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[meta-ads-sync] API error ${res.status}: ${errBody}`);

      // Detect token expiration (401/403)
      if (res.status === 401 || res.status === 403) {
        const error = new Error(`Meta API token error ${res.status}: ${errBody}`);
        (error as any).isTokenExpired = true;
        throw error;
      }

      throw new Error(`Meta API ${res.status}: ${errBody}`);
    }
    const json = await res.json();
    if (json.data) results.push(...json.data);
    nextUrl = json.paging?.next || null;
    pageCount++;
  }

  return results;
}

function extractLeadsFromActions(actions: any[]): number {
  if (!Array.isArray(actions)) return 0;
  const leadAction = actions.find(
    (a: any) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
  );
  return leadAction ? Number(leadAction.value) || 0 : 0;
}

function extractCPLFromCostPerAction(costPerAction: any[]): number {
  if (!Array.isArray(costPerAction)) return 0;
  const cplAction = costPerAction.find(
    (a: any) => a.action_type === "lead" || a.action_type === "onsite_conversion.lead_grouped"
  );
  return cplAction ? Number(cplAction.value) || 0 : 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = getSupabaseAdmin();
  let tenantId: string | undefined;

  try {
    // ── Get Meta access token from integration_configs ───────
    const { data: tokenConfig } = await supabase
      .from("integration_configs")
      .select("api_key, tenant_id")
      .eq("service_key", "meta_facebook")
      .eq("is_active", true)
      .limit(1)
      .maybeSingle();

    if (!tokenConfig?.api_key) {
      console.error("[meta-ads-sync] No active Meta access token found");
      return new Response(
        JSON.stringify({ error: "Meta access token not configured" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenConfig.api_key;
    tenantId = tokenConfig.tenant_id;

    // ── Get Ad Account ID from integrations metadata ─────────
    const { data: integration } = await supabase
      .from("integrations")
      .select("metadata")
      .eq("tenant_id", tenantId)
      .eq("provider", "meta_facebook")
      .maybeSingle();

    let adAccountId = (integration?.metadata as any)?.ad_account_id;

    // Fallback: try to discover ad accounts from API
    if (!adAccountId) {
      console.log("[meta-ads-sync] No ad_account_id in metadata, discovering from API...");
      const discoverUrl = `https://graph.facebook.com/v21.0/me/adaccounts?fields=account_id,name,account_status&access_token=${accessToken}`;
      const discoverRes = await fetchWithTimeout(discoverUrl, {}, 15000);
      const discoverJson = await discoverRes.json();

      if (discoverJson.data?.length > 0) {
        const activeAccount = discoverJson.data.find((a: any) => a.account_status === 1) || discoverJson.data[0];
        adAccountId = activeAccount.id;
        console.log(`[meta-ads-sync] Discovered ad account: ${adAccountId} (${activeAccount.name})`);
      } else {
        console.error("[meta-ads-sync] No ad accounts found for this token");
        return new Response(
          JSON.stringify({ error: "No ad accounts found" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    if (!adAccountId.startsWith("act_")) {
      adAccountId = `act_${adAccountId}`;
    }

    console.log(`[meta-ads-sync] Syncing for ad account ${adAccountId}, tenant ${tenantId}`);

    // ── Fetch campaign statuses ──────────────────────────────
    const campaignsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/campaigns?fields=id,name,effective_status&limit=500&access_token=${accessToken}`;
    const campaignsData = await fetchAllPages(campaignsUrl);
    const campaignStatusMap = new Map<string, string>();
    for (const c of campaignsData) {
      campaignStatusMap.set(c.id, c.effective_status || "UNKNOWN");
    }
    console.log(`[meta-ads-sync] Found ${campaignsData.length} campaigns`);

    // ── Fetch ad-level insights (last 30 days, daily breakdown) ──
    const insightsUrl = `https://graph.facebook.com/v21.0/${adAccountId}/insights?fields=${INSIGHTS_FIELDS}&level=ad&time_increment=1&date_preset=last_30d&limit=500&access_token=${accessToken}`;
    const insightsData = await fetchAllPages(insightsUrl);
    console.log(`[meta-ads-sync] Fetched ${insightsData.length} insight rows`);

    // ── Transform and upsert ─────────────────────────────────
    const rows: any[] = [];

    for (const row of insightsData) {
      const leads = extractLeadsFromActions(row.actions);
      const cpl = extractCPLFromCostPerAction(row.cost_per_action_type);

      rows.push({
        tenant_id: tenantId,
        date: row.date_start,
        campaign_id: row.campaign_id || null,
        campaign_name: row.campaign_name || null,
        ad_id: row.ad_id || null,
        ad_name: row.ad_name || null,
        adset_id: row.adset_id || null,
        adset_name: row.adset_name || null,
        spend: Number(row.spend) || 0,
        clicks: Number(row.clicks) || 0,
        impressions: Number(row.impressions) || 0,
        reach: Number(row.reach) || 0,
        ctr: Number(row.ctr) || 0,
        cpc: Number(row.cpc) || 0,
        cpl: cpl,
        leads_count: leads,
        effective_status: campaignStatusMap.get(row.campaign_id) || null,
      });
    }

    // Batch upsert in chunks of 100
    let upserted = 0;
    let errors = 0;
    const CHUNK = 100;

    for (let i = 0; i < rows.length; i += CHUNK) {
      const chunk = rows.slice(i, i + CHUNK);
      const { error } = await supabase
        .from("facebook_ad_metrics")
        .upsert(chunk, {
          onConflict: "tenant_id,date,campaign_id,ad_id",
          ignoreDuplicates: false,
        });

      if (error) {
        console.error(`[meta-ads-sync] Upsert error chunk ${i}: ${error.message}`);
        errors++;
      } else {
        upserted += chunk.length;
      }
    }

    // Update health cache on success
    await updateHealthCache(supabase, "meta_ads", "up", {
      metadata: { campaigns: campaignsData.length, insights: insightsData.length, upserted },
    }, tenantId);

    console.log(`[meta-ads-sync] Done: ${upserted} upserted, ${errors} errors`);

    return new Response(
      JSON.stringify({
        success: true,
        campaigns: campaignsData.length,
        insights: insightsData.length,
        upserted,
        errors,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("[meta-ads-sync] Fatal error:", err);

    // Detect token expiration and update health cache
    if (err.isTokenExpired) {
      console.error("[meta-ads-sync] Token expired — updating health cache");
      await updateHealthCache(supabase, "meta_ads", "down", {
        error_message: "Token expirado. Reconecte a integração Meta Ads.",
        metadata: { reason: "token_expired" },
      }, tenantId);
    } else {
      await updateHealthCache(supabase, "meta_ads", "degraded", {
        error_message: sanitizeError(err),
      }, tenantId);
    }

    return new Response(
      JSON.stringify({ error: sanitizeError(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
