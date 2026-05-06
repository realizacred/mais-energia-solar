import { useState, useCallback } from "react";
import { LimitReachedDialog } from "./LimitReachedDialog";
import { useTenantPlan } from "@/hooks/useTenantPlan";
import { useTenantLockState, isOperationAllowed } from "@/hooks/useTenantLockState";
import { toast } from "sonner";

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
  const { data: lockState } = useTenantLockState();
  const [state, setState] = useState<PlanGuardState>({
    open: false,
    metricKey: "",
    currentValue: 0,
    limitValue: 0,
  });

  const guardLock = useCallback(
    (operation: "read" | "write" | "ai" | "automation" | "send" = "write"): boolean => {
      const level = lockState?.level ?? "none";
      if (!isOperationAllowed(level, operation)) {
        const msg = level === "hard"
          ? "Conta suspensa. Regularize o pagamento para liberar o sistema."
          : "Conta com pendência financeira: novos recursos bloqueados temporariamente.";
        toast.error(msg);
        return false;
      }
      return true;
    },
    [lockState?.level]
  );

  const guardLimit = useCallback(
    async (metricKey: string, delta = 1, operation: "read" | "write" | "ai" | "automation" | "send" = "write"): Promise<boolean> => {
      // PR-4: lock_state first
      if (!guardLock(operation)) return false;
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
        return true;
      }
    },
    [checkLimit, guardLock]
  );

  const guardFeature = useCallback(
    (featureKey: string, features: Record<string, boolean>): boolean => {
      return features[featureKey] !== false;
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

  return { guardLimit, guardFeature, guardLock, lockLevel: lockState?.level ?? "none", LimitDialog };
}
