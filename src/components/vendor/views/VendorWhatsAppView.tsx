import { useNavigate } from "react-router-dom";
import { ArrowLeft, MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WaInbox } from "@/components/admin/inbox/WaInbox";

interface Props {
  portal: ReturnType<typeof import("@/hooks/useVendedorPortal").useVendedorPortal>;
}

export default function VendorWhatsAppView({ portal }: Props) {
  const navigate = useNavigate();

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-primary/10">
            <MessageCircle className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-foreground">Atendimento</h1>
            <p className="text-sm text-muted-foreground">Conversas e mensagens dos seus clientes</p>
          </div>
        </div>
        <div className="flex md:hidden">
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
      </div>
      <div style={{ height: "calc(100vh - 200px)", minHeight: "500px" }} className="md:!h-[calc(100vh-140px)]">
        <WaInbox vendorMode vendorUserId={portal.vendedor?.user_id || undefined} />
      </div>
    </div>
  );
}
