/**
 * WhatsApp → Auto Respostas (alias dentro da Central de Integrações).
 * Reaproveita tabelas: wa_auto_reply_config, wa_auto_reply_log,
 *   whatsapp_automation_config (legado, fallback no hook existente).
 * Reaproveita componente existente: WaAutoReplyConfig.
 * RB-76 / DA-48 — wrapper fino, sem duplicação.
 */
import { WaAutoReplyConfig } from "@/components/admin/WaAutoReplyConfig";
import { PageHeader } from "@/components/ui-kit";
import { MessageCircle } from "lucide-react";

export default function WhatsappAutoRespostasPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={MessageCircle}
        title="Auto Respostas"
        description="Configuração de respostas automáticas do WhatsApp fora do horário e em feriados."
      />
      <WaAutoReplyConfig />
    </div>
  );
}
