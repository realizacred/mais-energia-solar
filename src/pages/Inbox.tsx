import { useEffect, useState, lazy, Suspense } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { WaInbox } from "@/components/admin/inbox/WaInbox";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Bell, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";

const PushNotificationSettings = lazy(() =>
  import("@/components/admin/PushNotificationSettings").then((m) => ({
    default: m.PushNotificationSettings,
  }))
);

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
    <div className="h-[100dvh] flex flex-col bg-background w-full max-w-full overflow-x-hidden">
      {/* Floating settings button */}
      <div className="absolute top-2 right-2 z-50">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full bg-background/80 backdrop-blur shadow-md">
              <Bell className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
            <SheetHeader>
              <SheetTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5" />
                Configurações Push
              </SheetTitle>
            </SheetHeader>
            <div className="mt-4">
              <Suspense fallback={<LoadingSpinner />}>
                <PushNotificationSettings />
              </Suspense>
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <WaInbox vendorMode vendorUserId={user.id} />
    </div>
  );
}
