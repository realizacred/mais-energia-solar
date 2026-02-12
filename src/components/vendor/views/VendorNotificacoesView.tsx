import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import NotificationSettings from "@/components/vendor/NotificationSettings";

const PushNotificationSettings = lazy(() =>
  import("@/components/admin/PushNotificationSettings").then((m) => ({
    default: m.PushNotificationSettings,
  }))
);

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorNotificacoesView({ portal }: Props) {
  const { vendedor } = portal;

  return (
    <div className="space-y-4 sm:space-y-6">
      {vendedor && <NotificationSettings vendedorNome={vendedor.nome} />}

      <Suspense fallback={<Loader2 className="h-5 w-5 animate-spin" />}>
        <PushNotificationSettings />
      </Suspense>
    </div>
  );
}
