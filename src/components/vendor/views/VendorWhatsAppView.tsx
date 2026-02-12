import { WaInbox } from "@/components/admin/inbox/WaInbox";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorWhatsAppView({ portal }: Props) {
  return (
    <div style={{ height: "calc(100vh - 140px)", minHeight: "500px" }}>
      <WaInbox vendorMode vendorUserId={portal.vendedor?.user_id || undefined} />
    </div>
  );
}
