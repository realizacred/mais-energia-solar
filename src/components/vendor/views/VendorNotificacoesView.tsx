import { lazy, Suspense } from "react";
import { Bell } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";

const PushNotificationSettings = lazy(() =>
  import("@/components/admin/PushNotificationSettings").then((m) => ({
    default: m.PushNotificationSettings,
  }))
);

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorNotificacoesView({ portal }: Props) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <Bell className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Notificações</h1>
            <p className="text-sm text-muted-foreground">Seus alertas e atualizações</p>
          </div>
        </div>
      </div>
      <Suspense fallback={<Spinner size="sm" />}>
        <PushNotificationSettings />
      </Suspense>
    </div>
  );
}
