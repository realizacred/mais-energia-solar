/**
 * Wrapper fino — Admin → Integrações → IA → Features
 * Reaproveita: AiFeaturesPanel (tabela ai_features_config)
 * Não duplica painel nem cria nova tabela. (RB-76 / DA-48)
 */
import { AiFeaturesPanel } from "@/components/admin/ai/AiFeaturesPanel";
import { PageHeader } from "@/components/ui-kit";
import { Sparkles } from "lucide-react";

export default function IaFeaturesPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        icon={Sparkles}
        title="Features de IA"
        description="Ativar/desativar recursos de IA por área do sistema"
      />
      <AiFeaturesPanel />
    </div>
  );
}
