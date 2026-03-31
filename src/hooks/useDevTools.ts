import { useDevToolsContext } from "@/contexts/DevToolsContext";

/** Simplified hook for components to consume DevTools state */
export function useDevTools() {
  const ctx = useDevToolsContext();
  return {
    enabled: ctx.enabled,
    registerLoadingHook: ctx.registerLoadingHook,
    unregisterLoadingHook: ctx.unregisterLoadingHook,
    setActiveProposalVars: ctx.setActiveProposalVars,
  };
}

/**
 * Returns data attributes to spread on a JSX element for DevTools inspection.
 * Usage: <span {...useRegisterDevVar("cliente_nome", value)}>...</span>
 */
export function useRegisterDevVar(varName: string, componentName?: string) {
  const ctx = useDevToolsContext();
  if (!ctx.enabled) return {};
  return {
    "data-dev-var": varName,
    "data-dev-component": componentName ?? varName,
  } as Record<string, string>;
}
