import { MessageCircle } from "lucide-react";
import { WaInbox } from "@/components/admin/inbox/WaInbox";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorWhatsAppView({ portal }: Props) {
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Atendimento</h1>
            <p className="text-sm text-muted-foreground">Conversas e mensagens dos seus clientes</p>
          </div>
        </div>
      </div>
      <div className="flex-1 min-h-0 overflow-hidden">
        <WaInbox vendorMode vendorUserId={portal.vendedor?.user_id || undefined} />
      </div>
    </div>
  );
}
