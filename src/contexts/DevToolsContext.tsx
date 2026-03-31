import { createContext, useContext, useCallback, useEffect, useState, type ReactNode } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useRolePermissions } from "@/hooks/useRolePermissions";

interface DevToolsState {
  enabled: boolean;
  hoveredVar: string | null;
  hoveredComponent: string | null;
  hoveredHasVar: boolean;
  activeProposalVars: Record<string, unknown>;
  loadingHooks: string[];
}

interface DevToolsContextType extends DevToolsState {
  isSuperAdmin: boolean;
  toggle: () => void;
  setHoveredElement: (el: { var: string | null; component: string | null; hasVar: boolean } | null) => void;
  setActiveProposalVars: (vars: Record<string, unknown>) => void;
  registerLoadingHook: (name: string) => void;
  unregisterLoadingHook: (name: string) => void;
}

const STORAGE_KEY = "devtools_enabled";

const DevToolsContext = createContext<DevToolsContextType | null>(null);

export function DevToolsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { isAdmin } = useRolePermissions();

  const isSuperAdmin = !!user && isAdmin;

  const [state, setState] = useState<DevToolsState>(() => ({
    enabled: isSuperAdmin && sessionStorage.getItem(STORAGE_KEY) === "true",
    hoveredVar: null,
    hoveredComponent: null,
    hoveredHasVar: false,
    activeProposalVars: {},
    loadingHooks: [],
  }));

  // Sync enabled from sessionStorage when admin status changes
  useEffect(() => {
    if (isSuperAdmin) {
      const stored = sessionStorage.getItem(STORAGE_KEY) === "true";
      setState((s) => ({ ...s, enabled: stored }));
    } else {
      setState((s) => ({ ...s, enabled: false }));
    }
  }, [isSuperAdmin]);

  // Ctrl+Shift+D toggle
  useEffect(() => {
    if (!isSuperAdmin) return;
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D") {
        e.preventDefault();
        setState((prev) => {
          const next = !prev.enabled;
          sessionStorage.setItem(STORAGE_KEY, String(next));
          return { ...prev, enabled: next };
        });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isSuperAdmin]);

  // Mousemove delegation for data-dev-var / data-dev-component
  useEffect(() => {
    if (!state.enabled) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;

      const varEl = target.closest("[data-dev-var]") as HTMLElement | null;
      if (varEl) {
        setState((s) => ({
          ...s,
          hoveredVar: varEl.getAttribute("data-dev-var"),
          hoveredComponent: varEl.getAttribute("data-dev-component"),
          hoveredHasVar: true,
        }));
        return;
      }

      const compEl = target.closest("[data-dev-component]") as HTMLElement | null;
      if (compEl) {
        setState((s) => ({
          ...s,
          hoveredVar: null,
          hoveredComponent: compEl.getAttribute("data-dev-component"),
          hoveredHasVar: false,
        }));
        return;
      }

      setState((s) => ({
        ...s,
        hoveredVar: null,
        hoveredComponent: null,
        hoveredHasVar: false,
      }));
    };
    window.addEventListener("mousemove", handler, { passive: true });
    return () => window.removeEventListener("mousemove", handler);
  }, [state.enabled]);

  const toggle = useCallback(() => {
    if (!isSuperAdmin) return;
    setState((prev) => {
      const next = !prev.enabled;
      sessionStorage.setItem(STORAGE_KEY, String(next));
      return { ...prev, enabled: next };
    });
  }, [isSuperAdmin]);

  const setHoveredElement = useCallback(
    (el: { var: string | null; component: string | null; hasVar: boolean } | null) => {
      setState((s) => ({
        ...s,
        hoveredVar: el?.var ?? null,
        hoveredComponent: el?.component ?? null,
        hoveredHasVar: el?.hasVar ?? false,
      }));
    },
    []
  );

  const setActiveProposalVars = useCallback((vars: Record<string, unknown>) => {
    setState((s) => ({ ...s, activeProposalVars: vars }));
  }, []);

  const registerLoadingHook = useCallback((name: string) => {
    setState((s) => ({
      ...s,
      loadingHooks: s.loadingHooks.includes(name) ? s.loadingHooks : [...s.loadingHooks, name],
    }));
  }, []);

  const unregisterLoadingHook = useCallback((name: string) => {
    setState((s) => ({
      ...s,
      loadingHooks: s.loadingHooks.filter((h) => h !== name),
    }));
  }, []);

  return (
    <DevToolsContext.Provider
      value={{
        ...state,
        isSuperAdmin,
        toggle,
        setHoveredElement,
        setActiveProposalVars,
        registerLoadingHook,
        unregisterLoadingHook,
      }}
    >
      {children}
    </DevToolsContext.Provider>
  );
}

export function useDevToolsContext() {
  const ctx = useContext(DevToolsContext);
  if (!ctx) throw new Error("useDevToolsContext must be inside DevToolsProvider");
  return ctx;
}
