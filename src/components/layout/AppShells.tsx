
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

/**
 * Shell for public pages. No auth required.
 * Removes internal navigation components like Sidebar or BottomNav.
 */
export function PublicLeadShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background flex flex-col overflow-x-hidden">
      {children}
    </div>
  );
}

/**
 * Shell for authenticated internal app.
 * Includes RBAC, Sidebar (desktop) and BottomNav (mobile).
 */
export function InternalAppShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  
  if (!user) {
    return <Navigate to={`/auth?from=sistema&redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col md:flex-row overflow-hidden">
      {children}
    </div>
  );
}

/**
 * Shell for consultant mobile field experience.
 * Tailored for field use with specialized BottomNav.
 */
export function ConsultantFieldShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <LoadingSpinner />;
  
  if (!user) {
    return <Navigate to={`/auth?from=consultor&redirect=${encodeURIComponent(location.pathname)}`} replace />;
  }

  return (
    <div className="min-h-screen bg-background flex flex-col overflow-hidden">
      {children}
    </div>
  );
}
