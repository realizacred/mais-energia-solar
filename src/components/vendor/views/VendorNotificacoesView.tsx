import { lazy, Suspense } from "react";
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
      <Suspense fallback={<Spinner size="sm" />}>
        <PushNotificationSettings />
      </Suspense>
    </div>
  );
}
