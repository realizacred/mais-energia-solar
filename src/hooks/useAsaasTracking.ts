/**
 * useAsaasTracking — Track Asaas integration funnel events.
 * Uses audit_feature_access_log for consistency with existing tracking.
 * §16: Queries only in hooks.
 */
import { useCallback, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

type AsaasTrackingContext = "upgrade" | "cobranca" | "fatura" | "generic";

async function logEvent(
  featureKey: string,
  accessResult: string,
  reason: string | null,
) {
  try {
    const { tenantId, userId } = await getCurrentTenantId();
    await supabase.from("audit_feature_access_log").insert({
      feature_key: featureKey,
      access_result: accessResult,
      reason,
      tenant_id: tenantId,
      user_id: userId,
    });
  } catch (err) {
    console.warn("[asaas-tracking] Failed to log event:", err);
  }
}

/**
 * Track when AsaasNotConfigured is shown (view) and clicked.
 */
export function useAsaasNotConfiguredTracking(context: AsaasTrackingContext) {
  const { user } = useAuth();
  const tracked = useRef(false);

  // View event — once per mount
  useEffect(() => {
    if (!user || tracked.current) return;
    tracked.current = true;
    logEvent("asaas_not_configured", "view", context);
  }, [user, context]);

  const trackClick = useCallback(() => {
    logEvent("asaas_not_configured", "click", context);
  }, [context]);

  return { trackClick };
}

/**
 * Track when Asaas integration is successfully configured.
 * Call after save succeeds.
 */
export function trackAsaasConfigured() {
  logEvent("asaas_configured", "configured", null);
}
