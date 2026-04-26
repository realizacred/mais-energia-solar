/**
 * AiFeaturesPanel — Liga/desliga e seleção de modelo por feature de IA.
 *
 * Cada uso de IA do sistema (followup, coerência de funis, resumo de proposta...)
 * pode ser ativado/desativado individualmente, com escolha opcional de modelo.
 *
 * Governança:
 *  - RB-04: dados via hook
 *  - SRP: só renderização
 */
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { LoadingState } from "@/components/ui-kit";
import { useAiFeatures, useUpdateAiFeature } from "@/hooks/useFunnelGovernance";
import { toast } from "sonner";

const MODELOS = [
  { value: "global", label: "Usar modelo global" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash (rápido)" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro (preciso)" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash (balanceado)" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini" },
  { value: "openai/gpt-5", label: "GPT-5 (avançado)" },
];

export function AiFeaturesPanel() {
  const { data, isLoading } = useAiFeatures();
  const update = useUpdateAiFeature();

  if (isLoading) return <LoadingState />;
  const features = data ?? [];

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await update.mutateAsync({ id, patch: { enabled } });
      toast.success(enabled ? "Feature ativada" : "Feature desativada");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
    }
  };

  const handleModel = async (id: string, model: string) => {
    try {
      await update.mutateAsync({
        id,
        patch: { model: model === "global" ? null : model },
      });
      toast.success("Modelo atualizado");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recursos de IA</CardTitle>
          <CardDescription>
            Ative ou desative cada uso de IA do sistema individualmente. Escolha um modelo
            específico por recurso ou use o modelo global definido em "Provedor & Consumo".
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {features.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum recurso de IA cadastrado ainda.
            </p>
          ) : (
            features.map((f) => (
              <div
                key={f.id}
                className="flex items-center justify-between gap-3 p-3 rounded-md border bg-card"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{f.feature_label}</p>
                  {f.feature_description && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {f.feature_description}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <Select
                    value={f.model ?? "global"}
                    onValueChange={(v) => handleModel(f.id, v)}
                    disabled={!f.enabled}
                  >
                    <SelectTrigger className="w-[220px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {MODELOS.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          {m.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Switch
                    checked={f.enabled}
                    onCheckedChange={(v) => handleToggle(f.id, v)}
                  />
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
