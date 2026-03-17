import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Brain, AlertTriangle, Clock, Shield, Zap, Save, Loader2 } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntelligenceConfig, IntelligenceConfig } from "@/hooks/useIntelligenceConfig";
import { toast } from "sonner";

function TagInput({ value, onChange, placeholder }: { value: string[]; onChange: (v: string[]) => void; placeholder?: string }) {
  const [input, setInput] = useState("");
  const handleAdd = () => {
    const trimmed = input.trim().toLowerCase();
    if (trimmed && !value.includes(trimmed)) {
      onChange([...value, trimmed]);
    }
    setInput("");
  };
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-1.5">
        {value.map((tag) => (
          <Badge key={tag} variant="secondary" className="gap-1 text-xs cursor-pointer" onClick={() => onChange(value.filter((t) => t !== tag))}>
            {tag} ×
          </Badge>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAdd())}
          placeholder={placeholder || "Adicionar palavra..."}
          className="text-sm"
        />
        <Button variant="outline" size="sm" onClick={handleAdd} type="button">+</Button>
      </div>
    </div>
  );
}

export function IntelligenceConfigPage() {
  const { config, isLoading, updateConfig } = useIntelligenceConfig();
  const [local, setLocal] = useState<Partial<IntelligenceConfig>>({});
  const [dirty, setDirty] = useState(false);

  const val = <K extends keyof IntelligenceConfig>(key: K): IntelligenceConfig[K] =>
    (local[key] ?? config?.[key]) as IntelligenceConfig[K];

  const set = <K extends keyof IntelligenceConfig>(key: K, v: IntelligenceConfig[K]) => {
    setLocal((prev) => ({ ...prev, [key]: v }));
    setDirty(true);
  };

  const handleSave = () => {
    updateConfig.mutate(local, {
      onSuccess: () => {
        toast.success("Configuração salva!");
        setLocal({});
        setDirty(false);
      },
      onError: () => toast.error("Erro ao salvar"),
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-4 p-4 md:p-6">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-32 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Configuração de Inteligência</h1>
            <p className="text-sm text-muted-foreground">Ajuste thresholds, detecção e direcionamento</p>
          </div>
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={updateConfig.isPending} className="gap-2">
            {updateConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </Button>
        )}
      </div>

      {/* Ativações */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> Ativações
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="flex items-center justify-between">
            <div><Label>Análise IA habilitada</Label><p className="text-xs text-muted-foreground">Análise automática de temperamento e dor</p></div>
            <Switch checked={val("ia_analise_habilitada") ?? true} onCheckedChange={(v) => set("ia_analise_habilitada", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Alertas habilitados</Label><p className="text-xs text-muted-foreground">Notificações para consultores/gerentes</p></div>
            <Switch checked={val("alertas_habilitados") ?? true} onCheckedChange={(v) => set("alertas_habilitados", v)} />
          </div>
          <div className="flex items-center justify-between">
            <div><Label>Reaquecimento automático</Label><p className="text-xs text-muted-foreground">Analisa leads inativos (não envia nada)</p></div>
            <Switch checked={val("reaquecimento_automatico") ?? false} onCheckedChange={(v) => set("reaquecimento_automatico", v)} />
          </div>
        </CardContent>
      </Card>

      {/* Thresholds */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Thresholds de Temperamento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          {(["quente", "morno", "frio"] as const).map((temp) => {
            const key = `threshold_${temp}` as keyof IntelligenceConfig;
            const v = (val(key) as number) ?? (temp === "quente" ? 80 : temp === "morno" ? 50 : 20);
            const colors = { quente: "text-destructive", morno: "text-warning", frio: "text-info" };
            return (
              <div key={temp} className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label className={`capitalize font-medium ${colors[temp]}`}>{temp}</Label>
                  <Badge variant="outline" className="text-xs">{`≥ ${v}`}</Badge>
                </div>
                <Slider value={[v]} onValueChange={([n]) => set(key, n as any)} min={0} max={100} step={5} />
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Detecção de Intenção */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-primary" /> Detecção de Intenção
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-6">
          {/* Preço */}
          <div className="space-y-3 bg-muted/30 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Label className="font-medium">💰 Preço</Label>
              <Switch checked={val("alerta_preco_habilitado") ?? true} onCheckedChange={(v) => set("alerta_preco_habilitado", v)} />
            </div>
            <TagInput
              value={val("alerta_preco_palavras") ?? ["caro", "dinheiro", "pagar", "investimento"]}
              onChange={(v) => set("alerta_preco_palavras", v)}
              placeholder="Palavra de preço..."
            />
            <div className="space-y-1">
              <div className="flex justify-between">
                <Label className="text-xs">Confiança mínima</Label>
                <span className="text-xs text-muted-foreground">{((val("alerta_preco_min_confidence") as number) ?? 0.85).toFixed(2)}</span>
              </div>
              <Slider
                value={[((val("alerta_preco_min_confidence") as number) ?? 0.85) * 100]}
                onValueChange={([n]) => set("alerta_preco_min_confidence", n / 100)}
                min={50} max={100} step={5}
              />
            </div>
          </div>

          {/* Tempo */}
          <div className="space-y-3 bg-muted/30 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Label className="font-medium">⏰ Tempo/Urgência</Label>
              <Switch checked={val("alerta_tempo_habilitado") ?? true} onCheckedChange={(v) => set("alerta_tempo_habilitado", v)} />
            </div>
            <TagInput
              value={val("alerta_tempo_palavras") ?? ["demora", "rápido", "urgente", "prazo"]}
              onChange={(v) => set("alerta_tempo_palavras", v)}
              placeholder="Palavra de urgência..."
            />
          </div>

          {/* Concorrência */}
          <div className="space-y-3 bg-muted/30 border border-border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <Label className="font-medium">🏢 Concorrência</Label>
              <Switch checked={val("alerta_concorrencia_habilitado") ?? true} onCheckedChange={(v) => set("alerta_concorrencia_habilitado", v)} />
            </div>
            <TagInput
              value={val("alerta_concorrencia_palavras") ?? ["outro", "concorrente", "empresa", "orçamento"]}
              onChange={(v) => set("alerta_concorrencia_palavras", v)}
              placeholder="Palavra de concorrência..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Direcionamento */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Direcionamento & Autorização
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Consultor autoriza até (%)</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[(val("consultor_autoriza_ate") as number) ?? 3]}
                  onValueChange={([n]) => set("consultor_autoriza_ate", n)}
                  min={0} max={20} step={0.5}
                  className="flex-1"
                />
                <Badge variant="outline" className="min-w-[48px] text-center">{((val("consultor_autoriza_ate") as number) ?? 3).toFixed(1)}%</Badge>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Gerente autoriza até (%)</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[(val("gerente_autoriza_ate") as number) ?? 8]}
                  onValueChange={([n]) => set("gerente_autoriza_ate", n)}
                  min={0} max={30} step={0.5}
                  className="flex-1"
                />
                <Badge variant="outline" className="min-w-[48px] text-center">{((val("gerente_autoriza_ate") as number) ?? 8).toFixed(1)}%</Badge>
              </div>
            </div>
          </div>
          <div className="space-y-2">
            <Label>Alertar gerente se projeto acima de (R$)</Label>
            <Input
              type="number"
              value={(val("sempre_alertar_gerente_se_valor_acima") as number) ?? 50000}
              onChange={(e) => set("sempre_alertar_gerente_se_valor_acima", Number(e.target.value))}
              className="max-w-xs"
            />
          </div>
        </CardContent>
      </Card>

      {/* Reaquecimento */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Reaquecimento
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Dias inativo para considerar</Label>
              <Input
                type="number"
                value={(val("reaquecimento_dias_inativo") as number) ?? 180}
                onChange={(e) => set("reaquecimento_dias_inativo", Number(e.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label>Máximo tentativas</Label>
              <Input
                type="number"
                value={(val("reaquecimento_max_mensagens") as number) ?? 3}
                onChange={(e) => set("reaquecimento_max_mensagens", Number(e.target.value))}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modelo IA */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 border-b border-border">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> Modelo de IA
          </CardTitle>
        </CardHeader>
        <CardContent className="pt-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={(val("ia_modelo") as string) ?? "gemini-flash"} onValueChange={(v) => set("ia_modelo", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="gemini-flash">Gemini Flash</SelectItem>
                  <SelectItem value="gemini-pro">Gemini Pro</SelectItem>
                  <SelectItem value="gpt-5-mini">GPT-5 Mini</SelectItem>
                  <SelectItem value="gpt-5">GPT-5</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Temperatura (criatividade)</Label>
              <div className="flex items-center gap-3">
                <Slider
                  value={[((val("ia_temperatura") as number) ?? 0.7) * 100]}
                  onValueChange={([n]) => set("ia_temperatura", n / 100)}
                  min={0} max={100} step={5}
                  className="flex-1"
                />
                <Badge variant="outline">{((val("ia_temperatura") as number) ?? 0.7).toFixed(2)}</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save footer */}
      {dirty && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={updateConfig.isPending} size="lg" className="gap-2 shadow-lg">
            {updateConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar Configurações
          </Button>
        </div>
      )}
    </div>
  );
}
