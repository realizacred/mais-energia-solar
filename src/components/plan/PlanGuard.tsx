import { useState, useCallback } from "react";
import { LimitReachedDialog } from "./LimitReachedDialog";
import { useTenantPlan, PlanLimitError } from "@/hooks/useTenantPlan";

interface PlanGuardState {
  open: boolean;
  metricKey: string;
  currentValue: number;
  limitValue: number;
}

/**
 * Hook that provides a guard function + the dialog component.
 * 
 * Usage:
 * ```tsx
 * const { guardLimit, LimitDialog } = usePlanGuard();
 * 
 * const handleCreate = async () => {
 *   const ok = await guardLimit("max_leads_month");
 *   if (!ok) return; // dialog shown
 *   // proceed with creation
 * };
 * 
 * return <>{LimitDialog}</>
 * ```
 */
export function usePlanGuard() {
  const { checkLimit } = useTenantPlan();
  const [state, setState] = useState<PlanGuardState>({
    open: false,
    metricKey: "",
    currentValue: 0,
    limitValue: 0,
  });

  const guardLimit = useCallback(
    async (metricKey: string, delta = 1): Promise<boolean> => {
      try {
        const result = await checkLimit(metricKey, delta);
        if (!result.allowed) {
          setState({
            open: true,
            metricKey,
            currentValue: result.current_value,
            limitValue: result.limit_value,
          });
          return false;
        }
        return true;
      } catch {
        // If check fails (no subscription, etc.), allow by default
        return true;
      }
    },
    [checkLimit]
  );

  const guardFeature = useCallback(
    (featureKey: string, features: Record<string, boolean>): boolean => {
      return features[featureKey] !== false; // undefined = allowed
    },
    []
  );

  const LimitDialog = (
    <LimitReachedDialog
      open={state.open}
      onClose={() => setState((s) => ({ ...s, open: false }))}
      metricKey={state.metricKey}
      currentValue={state.currentValue}
      limitValue={state.limitValue}
    />
  );

  return { guardLimit, guardFeature, LimitDialog };
}
