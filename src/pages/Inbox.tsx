import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { WaInbox } from "@/components/admin/inbox/WaInbox";
import { LoadingSpinner } from "@/components/ui/loading-spinner";

/**
 * Standalone fullscreen WhatsApp Inbox page — designed as the PWA entry point.
 * Renders the WaInbox in vendor mode for the logged-in user.
 */
export default function Inbox() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth", { replace: true });
    }
  }, [user, loading, navigate]);

  if (loading) return <LoadingSpinner />;
  if (!user) return null;

  return (
    <div className="h-[100dvh] flex flex-col bg-background">
      <WaInbox vendorMode vendorUserId={user.id} />
    </div>
  );
}
