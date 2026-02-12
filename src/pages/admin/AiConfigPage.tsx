import { AiFollowupSettingsPanel } from "@/components/admin/AiFollowupSettingsPanel";

export default function AiConfigPage() {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Configuração de IA</h2>
        <p className="text-muted-foreground">
          Modelo, temperatura, limites e gate inteligente de follow-up
        </p>
      </div>
      <AiFollowupSettingsPanel />
    </div>
  );
}
