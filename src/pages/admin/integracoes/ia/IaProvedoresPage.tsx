/**
 * Wrapper fino — Admin → Integrações → IA → Provedores
 * Reaproveita: AiProviderPanel (tabela ai_provider_config via useAIProviderConfig)
 * Não duplica configuração nem cria nova tabela. (RB-76 / DA-48)
 */
import { AiProviderPanel } from "@/components/admin/AiProviderPanel";
import { PageHeader } from "@/components/ui-kit";
import { Bot } from "lucide-react";

export default function IaProvedoresPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Bot}
        title="Provedores de IA"
        description="Provedor e modelo ativos, fallback e consumo"
      />
      <AiProviderPanel />
    </div>
  );
}
