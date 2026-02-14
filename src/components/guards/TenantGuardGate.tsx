import { lazy, Suspense } from "react";
import { useAuth } from "@/hooks/useAuth";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

const TenantSuspended = lazy(() => import("@/pages/TenantSuspended"));
const TenantDisabled = lazy(() => import("@/pages/TenantDisabled"));
const UserDeactivated = lazy(() => import("@/pages/UserDeactivated"));

/**
 * Wraps authenticated routes. If tenant is suspended/disabled or user deactivated,
 * shows the appropriate blocking screen instead of rendering children.
 * Public routes (/, /v/:id, /auth, /calculadora, etc.) bypass this guard.
 */
export function TenantGuardGate({ children }: { children: React.ReactNode }) {
  const { user, loading, tenantStatus, tenantGuard } = useAuth();

  // Not logged in or still loading — let children handle their own auth redirects
  if (loading || !user) return <>{children}</>;

  // Tenant guard still loading
  if (tenantStatus === "loading") {
    return <LoadingSpinner />;
  }

  // User deactivated
  if (tenantStatus === "user_deactivated") {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <UserDeactivated />
      </Suspense>
    );
  }

  // Tenant suspended
  if (tenantStatus === "suspended") {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <TenantSuspended
          tenantName={tenantGuard.tenantName}
          suspendedAt={tenantGuard.suspendedAt}
          suspendedReason={tenantGuard.suspendedReason}
        />
      </Suspense>
    );
  }

  // Tenant disabled
  if (tenantStatus === "disabled") {
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <TenantDisabled tenantName={tenantGuard.tenantName} />
      </Suspense>
    );
  }

  // Active or no_auth (public pages) — render normally
  return <>{children}</>;
}
