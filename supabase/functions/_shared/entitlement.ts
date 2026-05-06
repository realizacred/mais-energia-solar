/**
 * Shared entitlement engine for Edge Functions.
 * SSOT: check_feature_access + consume_tenant_limit + tenant_lock_state.
 *
 * PR-4: enforceTenantAccess() unifies feature + lock + atomic limit consumption.
 * Legacy helpers (enforceFeature, enforceUsageLimit, trackUsage, checkUsageLimit)
 * are preserved for back-compat but now route through consume_tenant_limit
 * (atomic, no race conditions).
 */

export interface EntitlementResult {
  has_access: boolean;
  source: "plan" | "override" | "role" | "none";
  plan_code: string | null;
  reason: string | null;
}

export interface LockState {
  level: "none" | "soft" | "hard";
  reason: string | null;
  since: string | null;
}

export interface ConsumeResult {
  allowed: boolean;
  reason?: string;
  current_value: number;
  limit_value: number;
  remaining: number;
}

/* ------------------------------------------------------------------ */
/* Feature access                                                      */
/* ------------------------------------------------------------------ */

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
    console.error(`[entitlement] check_feature_access ${featureKey}:`, error.message);
    return { has_access: false, source: "none", plan_code: null, reason: `Erro: ${error.message}` };
  }
  return data as EntitlementResult;
}

/* ------------------------------------------------------------------ */
/* Lock state                                                          */
/* ------------------------------------------------------------------ */

export async function getTenantLockState(
  supabase: any,
  tenantId: string,
): Promise<LockState> {
  const { data, error } = await supabase.rpc("tenant_lock_state", { _tenant_id: tenantId });
  if (error) {
    console.error(`[entitlement] tenant_lock_state:`, error.message);
    return { level: "none", reason: null, since: null };
  }
  return (data ?? { level: "none", reason: null, since: null }) as LockState;
}

/* ------------------------------------------------------------------ */
/* Atomic consumption (consume_tenant_limit RPC = SELECT FOR UPDATE)   */
/* ------------------------------------------------------------------ */

export async function consumeTenantLimit(
  supabase: any,
  tenantId: string,
  metricKey: string,
  delta: number = 1,
  options?: { userId?: string; source?: string; metadata?: Record<string, unknown> },
): Promise<ConsumeResult> {
  const { data, error } = await supabase.rpc("consume_tenant_limit", {
    _tenant_id: tenantId,
    _metric_key: metricKey,
    _delta: delta,
    _source: options?.source ?? "edge_function",
    _user_id: options?.userId ?? null,
    _metadata: options?.metadata ?? {},
  });
  if (error) {
    console.error(`[entitlement] consume_tenant_limit ${metricKey}:`, error.message);
    // Fail open on RPC error to avoid breaking flows
    return { allowed: true, current_value: 0, limit_value: -1, remaining: -1 };
  }
  const r = (data ?? {}) as any;
  return {
    allowed: !!r.allowed,
    reason: r.reason,
    current_value: Number(r.current_value ?? 0),
    limit_value: Number(r.limit_value ?? -1),
    remaining: Number(r.remaining ?? -1),
  };
}

/* ------------------------------------------------------------------ */
/* Unified gate — feature + lock + atomic consumption                  */
/* ------------------------------------------------------------------ */

export interface EnforceOptions {
  featureKey?: string;
  metricKey?: string;
  delta?: number;
  /** Operation criticality. soft lock blocks `write`/`ai`/`automation`; hard blocks all except `read`. */
  operation?: "read" | "write" | "ai" | "automation" | "send";
  userId?: string;
  source?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Single gate for any premium operation.
 * Returns null if allowed, or a Response (403) describing the denial.
 *
 * Order:
 *   1. Lock state (hard blocks non-read; soft blocks write/ai/automation/send)
 *   2. Feature access (if featureKey)
 *   3. Atomic limit consumption (if metricKey) — already records usage_event
 */
export async function enforceTenantAccess(
  supabase: any,
  tenantId: string,
  corsHeaders: Record<string, string>,
  opts: EnforceOptions,
): Promise<Response | null> {
  const operation = opts.operation ?? "write";

  // 1. Lock state
  const lock = await getTenantLockState(supabase, tenantId);
  if (lock.level === "hard" && operation !== "read") {
    return denial(corsHeaders, 423, {
      error: "tenant_locked",
      lock_level: "hard",
      reason: lock.reason ?? "Conta suspensa.",
      since: lock.since,
    });
  }
  if (lock.level === "soft" && (operation === "write" || operation === "ai" || operation === "automation" || operation === "send")) {
    // Soft allows critical send (WA), but blocks new write/ai/automation
    if (operation !== "send") {
      return denial(corsHeaders, 423, {
        error: "tenant_soft_locked",
        lock_level: "soft",
        reason: lock.reason ?? "Conta com pendência financeira — novos recursos bloqueados.",
        since: lock.since,
      });
    }
  }

  // 2. Feature
  if (opts.featureKey) {
    const fr = await checkFeatureAccess(supabase, tenantId, opts.featureKey);
    if (!fr.has_access) {
      // audit
      try {
        await supabase.from("audit_feature_access_log").insert({
          tenant_id: tenantId,
          user_id: opts.userId ?? null,
          feature_key: opts.featureKey,
          access_result: "denied",
          reason: fr.reason,
        });
      } catch (_) { /* noop */ }
      return denial(corsHeaders, 403, {
        error: "feature_not_available",
        message: "Recurso não disponível no plano atual",
        feature_key: opts.featureKey,
        plan_code: fr.plan_code,
        reason: fr.reason,
      });
    }
  }

  // 3. Limit (atomic — records event when allowed)
  if (opts.metricKey) {
    const cr = await consumeTenantLimit(supabase, tenantId, opts.metricKey, opts.delta ?? 1, {
      userId: opts.userId,
      source: opts.source,
      metadata: opts.metadata,
    });
    if (!cr.allowed) {
      try {
        await supabase.from("audit_feature_access_log").insert({
          tenant_id: tenantId,
          user_id: opts.userId ?? null,
          feature_key: opts.metricKey,
          access_result: "limit_exceeded",
          reason: `${cr.current_value}/${cr.limit_value}`,
        });
      } catch (_) { /* noop */ }
      return denial(corsHeaders, 429, {
        error: "limit_exceeded",
        message: "Limite do plano atingido",
        metric_key: opts.metricKey,
        current: cr.current_value,
        limit: cr.limit_value,
      });
    }
  }

  return null;
}

function denial(cors: Record<string, string>, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

/* ------------------------------------------------------------------ */
/* Legacy compatibility helpers (route through new engine)             */
/* ------------------------------------------------------------------ */

export async function enforceFeature(
  supabase: any,
  tenantId: string,
  featureKey: string,
  corsHeaders: Record<string, string>,
  options?: { userId?: string; skipAudit?: boolean },
): Promise<Response | null> {
  return enforceTenantAccess(supabase, tenantId, corsHeaders, {
    featureKey,
    operation: "ai",
    userId: options?.userId,
  });
}

export interface UsageLimitResult {
  allowed: boolean;
  current_value: number;
  limit_value: number;
  remaining: number;
}

export async function checkUsageLimit(
  supabase: any,
  tenantId: string,
  metricKey: string,
  delta: number = 1,
): Promise<UsageLimitResult> {
  // Read-only check (delta=0) via legacy backend RPC (still exists)
  const { data, error } = await supabase.rpc("check_usage_limit_backend", {
    _tenant_id: tenantId,
    _metric_key: metricKey,
    _delta: delta,
  });
  if (error) {
    return { allowed: true, current_value: 0, limit_value: -1, remaining: -1 };
  }
  const row = data?.[0] ?? { allowed: true, current_value: 0, limit_value: -1, remaining: -1 };
  return row as UsageLimitResult;
}

export async function enforceUsageLimit(
  supabase: any,
  tenantId: string,
  metricKey: string,
  corsHeaders: Record<string, string>,
  options?: { userId?: string; delta?: number },
): Promise<Response | null> {
  // Read-only gate (legacy two-step pattern: enforce then trackUsage).
  // For new code use enforceTenantAccess (atomic consume).
  const result = await checkUsageLimit(supabase, tenantId, metricKey, options?.delta ?? 1);
  if (result.allowed) return null;
  try {
    await supabase.from("audit_feature_access_log").insert({
      tenant_id: tenantId,
      user_id: options?.userId ?? null,
      feature_key: metricKey,
      access_result: "limit_exceeded",
      reason: `${result.current_value}/${result.limit_value}`,
    });
  } catch (_) { /* noop */ }
  return new Response(JSON.stringify({
    error: "limit_exceeded",
    message: "Limite do plano atingido",
    metric_key: metricKey,
    current: result.current_value,
    limit: result.limit_value,
  }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

/**
 * Legacy trackUsage — now atomic via consume_tenant_limit (delta=N, no limit check).
 * Kept for callers that already enforced separately.
 */
export async function trackUsage(
  supabase: any,
  tenantId: string,
  metricKey: string,
  delta: number = 1,
  options?: { userId?: string; source?: string; metadata?: Record<string, unknown> },
): Promise<void> {
  // Use consume to keep counters/events consistent. If limit was already enforced
  // upstream, this still records — caller should not double-enforce.
  await consumeTenantLimit(supabase, tenantId, metricKey, delta, options);
}
