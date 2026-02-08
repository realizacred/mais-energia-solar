import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Settings, Save, RotateCcw } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import type { ScoringConfig } from "@/hooks/useLeadScoring";

interface ScoringConfigPanelProps {
  config: ScoringConfig | undefined;
  onSave: (updates: Partial<ScoringConfig>) => void;
  isLoading: boolean;
}

const PESO_LABELS: Record<string, string> = {
  peso_consumo: "Consumo (kWh)",
  peso_recencia: "Recência do Lead",
  peso_engajamento: "Engajamento",
  peso_perfil_tecnico: "Perfil Técnico",
  peso_localizacao: "Localização",
  peso_tempo_resposta: "Tempo de Resposta",
};

export function ScoringConfigPanel({ config, onSave, isLoading }: ScoringConfigPanelProps) {
  const [localConfig, setLocalConfig] = useState<Partial<ScoringConfig>>({});
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (config) setLocalConfig(config);
  }, [config]);

  if (!config) return null;

  const pesoKeys = Object.keys(PESO_LABELS) as (keyof ScoringConfig)[];
  const somaTotal = pesoKeys.reduce((sum, key) => sum + (Number(localConfig[key]) || 0), 0);

  const handlePesoChange = (key: string, value: number) => {
    setLocalConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = () => {
    onSave(localConfig);
  };

  const handleReset = () => {
    setLocalConfig({
      ...config,
      peso_consumo: 25,
      peso_recencia: 20,
      peso_engajamento: 15,
      peso_perfil_tecnico: 15,
      peso_localizacao: 10,
      peso_tempo_resposta: 15,
    });
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors rounded-t-lg">
            <CardTitle className="text-sm flex items-center gap-2">
              <Settings className="h-4 w-4 text-muted-foreground" />
              Configuração do Motor de Scoring
              <span className="text-xs text-muted-foreground font-normal ml-auto">
                {isOpen ? "Recolher" : "Expandir"}
              </span>
            </CardTitle>
          </CardHeader>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <CardContent className="space-y-6">
            {/* Pesos */}
            <div>
              <h4 className="text-sm font-medium mb-3">
                Pesos dos Critérios
                <span className={`text-xs ml-2 ${somaTotal === 100 ? "text-success" : "text-warning"}`}>
                  (Total: {somaTotal}/100)
                </span>
              </h4>
              <div className="grid gap-4">
                {pesoKeys.map(key => (
                  <div key={key} className="flex items-center gap-4">
                    <Label className="w-40 text-xs text-muted-foreground">{PESO_LABELS[key]}</Label>
                    <Slider
                      value={[Number(localConfig[key]) || 0]}
                      onValueChange={([v]) => handlePesoChange(key, v)}
                      min={0}
                      max={50}
                      step={5}
                      className="flex-1"
                    />
                    <span className="text-sm font-mono w-8 text-right">{Number(localConfig[key]) || 0}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Thresholds */}
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Consumo Alto (kWh ≥)</Label>
                <Input
                  type="number"
                  value={localConfig.consumo_alto_min || 400}
                  onChange={e => setLocalConfig(prev => ({ ...prev, consumo_alto_min: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Consumo Médio (kWh ≥)</Label>
                <Input
                  type="number"
                  value={localConfig.consumo_medio_min || 200}
                  onChange={e => setLocalConfig(prev => ({ ...prev, consumo_medio_min: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Ticket Médio (R$)</Label>
                <Input
                  type="number"
                  value={localConfig.ticket_medio || 25000}
                  onChange={e => setLocalConfig(prev => ({ ...prev, ticket_medio: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Threshold Hot (≥)</Label>
                <Input
                  type="number"
                  value={localConfig.threshold_hot || 70}
                  onChange={e => setLocalConfig(prev => ({ ...prev, threshold_hot: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Threshold Warm (≥)</Label>
                <Input
                  type="number"
                  value={localConfig.threshold_warm || 40}
                  onChange={e => setLocalConfig(prev => ({ ...prev, threshold_warm: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
              <div>
                <Label className="text-xs">Lead Quente (≤ dias)</Label>
                <Input
                  type="number"
                  value={localConfig.recencia_quente_max || 3}
                  onChange={e => setLocalConfig(prev => ({ ...prev, recencia_quente_max: Number(e.target.value) }))}
                  className="mt-1"
                />
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2 justify-end">
              <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Restaurar Padrão
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isLoading} className="gap-1.5">
                <Save className="h-3.5 w-3.5" />
                Salvar Configuração
              </Button>
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
