/**
 * Aba de Configuração de IA para migração SolarMarket.
 * Permite editar o System Prompt e ativar/desativar a classificação por IA.
 */
import { useState, useEffect } from "react";
import { Brain, Save, RotateCcw, Sparkles, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useSmAiConfig, useSaveSmAiConfig, DEFAULT_PROMPT } from "@/hooks/useSmAiConfig";
import { InlineLoader } from "@/components/loading/InlineLoader";

export function SmAiConfigTab() {
  const { data: config, isLoading } = useSmAiConfig();
  const saveMutation = useSaveSmAiConfig();

  const [prompt, setPrompt] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (config) {
      setPrompt(config.systemPrompt);
      setIsActive(config.isActive);
      setIsDirty(false);
    }
  }, [config]);

  const handleSave = () => {
    saveMutation.mutate({ systemPrompt: prompt, isActive });
    setIsDirty(false);
  };

  const handleReset = () => {
    setPrompt(DEFAULT_PROMPT);
    setIsDirty(true);
  };

  if (isLoading) return <InlineLoader context="data_load" />;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="flex items-start gap-3 rounded-lg border border-border bg-card p-4">
        <Brain className="h-5 w-5 text-primary shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">
            Classificação Inteligente de Propostas
          </p>
          <p className="text-xs text-muted-foreground">
            Quando ativada, a IA analisa o histórico de cada proposta durante a migração e sugere
            a etapa correta no funil, tags e um resumo executivo. Se a IA falhar ou estiver
            desativada, o mapeamento manual padrão será utilizado automaticamente.
          </p>
        </div>
      </div>

      {/* Toggle + Status */}
      <Card className="border-border bg-card shadow-sm">
        <CardContent className="p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Switch
                  id="ai-active"
                  checked={isActive}
                  onCheckedChange={(v) => { setIsActive(v); setIsDirty(true); }}
                />
                <Label htmlFor="ai-active" className="text-sm font-medium text-foreground cursor-pointer">
                  Classificação por IA
                </Label>
              </div>
              <Badge
                variant="outline"
                className={isActive
                  ? "border-success/20 bg-success/10 text-success"
                  : "border-border bg-muted text-muted-foreground"
                }
              >
                {isActive ? "Ativa" : "Inativa"}
              </Badge>
            </div>
            {!isActive && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <AlertTriangle className="h-3.5 w-3.5" />
                Usando mapeamento manual padrão
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Prompt Editor */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            System Prompt (Diretrizes de Interpretação)
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Textarea
            value={prompt}
            onChange={(e) => { setPrompt(e.target.value); setIsDirty(true); }}
            placeholder="Escreva as diretrizes de classificação para a IA..."
            className="min-h-[280px] font-mono text-xs bg-background border-border"
            disabled={saveMutation.isPending}
          />
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              {prompt.length} caracteres
            </p>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={handleReset}
                disabled={saveMutation.isPending}
                className="text-xs h-8 gap-1.5"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Restaurar Padrão
              </Button>
              <Button
                size="sm"
                onClick={handleSave}
                disabled={!isDirty || saveMutation.isPending}
                className="gap-1.5 h-8"
              >
                <Save className="h-3.5 w-3.5" />
                {saveMutation.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Expected output format */}
      <Card className="border-border bg-card shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold text-foreground">
            Formato de Saída Esperado da IA
          </CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-muted p-3 text-xs font-mono text-muted-foreground overflow-x-auto">
{`{
  "sugestao_etapa_id": "fechado",
  "tags_identificadas": ["residencial", "alto_valor", "recorrente"],
  "resumo_executivo": "Cliente solicitou proposta de 10kWp para residência. Proposta aprovada após 2 revisões..."
}`}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
