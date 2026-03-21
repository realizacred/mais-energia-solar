/**
 * Shared entitlement checker for Edge Functions.
 * Uses the DB function check_feature_access() as SSOT.
 * Also provides usage tracking helpers.
 */

export interface EntitlementResult {
  has_access: boolean;
  source: "plan" | "override" | "role" | "none";
  plan_code: string | null;
  reason: string | null;
}

/**
 * Check if a tenant has access to a feature.
 * Uses the SECURITY DEFINER function check_feature_access.
 * Admin bypass should be handled by the caller if needed.
 */
export async function checkFeatureAccess(
  supabase: any,
  tenantId: string,
  featureKey: string,
): Promise<EntitlementResult> {
  const { data, error } = await supabase.rpc("check_feature_access", {
    _tenant_id: tenantId,
    _feature_key: featureKey,
  });

  if (error) {
    console.error(`[entitlement] Error checking ${featureKey} for tenant ${tenantId}:`, error.message);
    // Fail open for admin safety, fail closed for security
    return { has_access: false, source: "none", plan_code: null, reason: `Erro: ${error.message}` };
  }

  return data as EntitlementResult;
}

/**
 * Check entitlement and return a denial Response if blocked.
 * Returns null if access is granted.
 */
export async function enforceFeature(
  supabase: any,
  tenantId: string,
  featureKey: string,
  corsHeaders: Record<string, string>,
  options?: { userId?: string; skipAudit?: boolean },
): Promise<Response | null> {
  const result = await checkFeatureAccess(supabase, tenantId, featureKey);

  if (result.has_access) return null;

  // Log denial to audit table (fire-and-forget)
  if (!options?.skipAudit) {
    try {
      await supabase.from("audit_feature_access_log").insert({
        tenant_id: tenantId,
        user_id: options?.userId ?? null,
        feature_key: featureKey,
        access_result: "denied",
        reason: result.reason,
      });
    } catch (e) {
      console.error("[entitlement] Audit log error:", e);
    }
  }

  console.log(`[entitlement] DENIED: tenant=${tenantId} feature=${featureKey} reason=${result.reason}`);

  return new Response(
    JSON.stringify({
      error: "feature_not_available",
      message: "Recurso não disponível no plano atual",
      feature_key: featureKey,
      plan_code: result.plan_code,
      reason: result.reason,
    }),
    {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    },
  );
}

/**
 * Increment usage counter for a metric key (fire-and-forget).
 * Creates or updates the monthly counter in usage_counters.
 */
export async function trackUsage(
  supabase: any,
  tenantId: string,
  metricKey: string,
  delta: number = 1,
  options?: { userId?: string; source?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split("T")[0];

  try {
    // Upsert counter
    const { data: existing } = await supabase
      .from("usage_counters")
      .select("id, current_value")
      .eq("tenant_id", tenantId)
      .eq("metric_key", metricKey)
      .eq("period_start", periodStart)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("usage_counters")
        .update({ current_value: existing.current_value + delta, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("usage_counters").insert({
        tenant_id: tenantId,
        metric_key: metricKey,
        period_start: periodStart,
        period_end: periodEnd,
        current_value: delta,
      });
    }

    // Log event
    await supabase.from("usage_events").insert({
      tenant_id: tenantId,
      metric_key: metricKey,
      delta,
      source: options?.source ?? "edge_function",
      user_id: options?.userId ?? null,
      metadata: options?.metadata ?? null,
    });
  } catch (err) {
    console.error(`[entitlement] trackUsage error for ${metricKey}:`, err);
  }
}
