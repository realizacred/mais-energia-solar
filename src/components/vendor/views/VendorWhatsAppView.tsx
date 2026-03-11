import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WaInbox } from "@/components/admin/inbox/WaInbox";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorWhatsAppView({ portal }: Props) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex md:hidden items-center gap-2 mb-3">
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-muted-foreground min-h-[44px]"
          onClick={() => navigate("/consultor/dashboard")}
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Button>
      </div>
      <div style={{ height: "calc(100vh - 200px)", minHeight: "500px" }} className="md:!h-[calc(100vh-140px)]">
        <WaInbox vendorMode vendorUserId={portal.vendedor?.user_id || undefined} />
      </div>
    </div>
  );
}
