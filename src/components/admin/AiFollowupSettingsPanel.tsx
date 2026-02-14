import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Brain,
  Save,
  RefreshCw,
  ShieldCheck,
  Zap,
  Info,
  Sparkles,
} from "lucide-react";

interface AiSettings {
  id?: string;
  modo: string;
  modelo_preferido: string;
  max_sugestoes_dia: number;
  temperature: number;
  max_tokens: number;
  followup_cooldown_hours: number;
  followup_confidence_threshold: number;
  templates: Record<string, any>;
}

const DEFAULT_SETTINGS: AiSettings = {
  modo: "assistido",
  modelo_preferido: "gpt-4o-mini",
  max_sugestoes_dia: 100,
  temperature: 0.7,
  max_tokens: 500,
  followup_cooldown_hours: 4,
  followup_confidence_threshold: 60,
  templates: {},
};

const MODELOS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (rápido, econômico)" },
  { value: "gpt-4o", label: "GPT-4o (alta qualidade)" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini (mais recente)" },
];

const WRITING_ASSISTANT_MODELS = [
  { value: "google/gemini-2.5-flash-lite", label: "Gemini Flash Lite", cost: "💰", desc: "Mais barato, básico" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", cost: "💰💰", desc: "Bom equilíbrio (padrão)" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", cost: "💰💰", desc: "Mais recente, rápido" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", cost: "💰💰💰", desc: "Premium, alta qualidade" },
];

export function AiFollowupSettingsPanel() {
  const { toast } = useToast();
  const [settings, setSettings] = useState<AiSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasRecord, setHasRecord] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("wa_ai_settings")
      .select("*")
      .maybeSingle();

    if (data) {
      setSettings({
        id: data.id,
        modo: data.modo || "assistido",
        modelo_preferido: data.modelo_preferido || "gpt-4o-mini",
        max_sugestoes_dia: data.max_sugestoes_dia || 100,
        temperature: (data as any).temperature ?? 0.7,
        max_tokens: (data as any).max_tokens ?? 500,
        followup_cooldown_hours: (data as any).followup_cooldown_hours ?? 4,
        followup_confidence_threshold: (data as any).followup_confidence_threshold ?? 60,
        templates: (typeof data.templates === "object" && data.templates !== null)
          ? data.templates as Record<string, any>
          : {},
      });
      setHasRecord(true);
    }
    setLoading(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload = {
        modo: settings.modo,
        modelo_preferido: settings.modelo_preferido,
        max_sugestoes_dia: settings.max_sugestoes_dia,
        temperature: settings.temperature,
        max_tokens: settings.max_tokens,
        followup_cooldown_hours: settings.followup_cooldown_hours,
        followup_confidence_threshold: settings.followup_confidence_threshold,
        templates: settings.templates,
      };

      if (hasRecord && settings.id) {
        const { error } = await supabase
          .from("wa_ai_settings")
          .update(payload as any)
          .eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("wa_ai_settings")
          .insert(payload as any);
        if (error) throw error;
        setHasRecord(true);
      }

      toast({ title: "Configurações de IA salvas" });
      fetchSettings();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="h-5 w-5 animate-spin mr-2" />
        Carregando...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Modo de operação */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Modo de Operação da IA</CardTitle>
          </div>
          <CardDescription>
            Define como a IA de follow-up interage com os consultores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3">
            <button
              type="button"
              onClick={() => setSettings({ ...settings, modo: "assistido" })}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
                settings.modo === "assistido"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <ShieldCheck className={`h-5 w-5 mt-0.5 ${settings.modo === "assistido" ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <p className="font-medium">Modo Assistido</p>
                <p className="text-sm text-muted-foreground">
                  A IA sugere mensagens, mas o consultor precisa aprovar antes do envio. Recomendado.
                </p>
              </div>
              {settings.modo === "assistido" && (
                <Badge variant="default" className="ml-auto shrink-0">Ativo</Badge>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettings({ ...settings, modo: "automatico" })}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
                settings.modo === "automatico"
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <Zap className={`h-5 w-5 mt-0.5 ${settings.modo === "automatico" ? "text-primary" : "text-muted-foreground"}`} />
              <div>
                <p className="font-medium">Modo Automático</p>
                <p className="text-sm text-muted-foreground">
                  A IA envia mensagens automaticamente sem aprovação. Use com cautela.
                </p>
              </div>
              {settings.modo === "automatico" && (
                <Badge variant="default" className="ml-auto shrink-0">Ativo</Badge>
              )}
            </button>

            <button
              type="button"
              onClick={() => setSettings({ ...settings, modo: "desativado" })}
              className={`flex items-start gap-3 p-4 rounded-lg border-2 text-left transition-colors ${
                settings.modo === "desativado"
                  ? "border-destructive bg-destructive/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
            >
              <Info className={`h-5 w-5 mt-0.5 ${settings.modo === "desativado" ? "text-destructive" : "text-muted-foreground"}`} />
              <div>
                <p className="font-medium">Desativado</p>
                <p className="text-sm text-muted-foreground">
                  Nenhuma sugestão será gerada pela IA.
                </p>
              </div>
            </button>
          </div>
        </CardContent>
      </Card>

      {/* Modelo e limites */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Configurações do Modelo</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Modelo preferido</Label>
              <Select
                value={settings.modelo_preferido}
                onValueChange={(v) => setSettings({ ...settings, modelo_preferido: v })}
              >
                <SelectTrigger>
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
            </div>

            <div className="space-y-2">
              <Label>Limite diário de sugestões</Label>
              <Input
                type="number"
                min={1}
                max={1000}
                value={settings.max_sugestoes_dia}
                onChange={(e) =>
                  setSettings({ ...settings, max_sugestoes_dia: parseInt(e.target.value) || 100 })
                }
              />
              <p className="text-xs text-muted-foreground">Máximo de sugestões por dia no tenant</p>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
            <div className="space-y-2">
              <Label>Temperatura (criatividade)</Label>
              <Input
                type="number"
                min={0}
                max={1}
                step={0.1}
                value={settings.temperature}
                onChange={(e) =>
                  setSettings({ ...settings, temperature: parseFloat(e.target.value) || 0.7 })
                }
              />
              <p className="text-xs text-muted-foreground">0 = preciso, 1 = criativo</p>
            </div>

            <div className="space-y-2">
              <Label>Max Tokens</Label>
              <Input
                type="number"
                min={100}
                max={2000}
                value={settings.max_tokens}
                onChange={(e) =>
                  setSettings({ ...settings, max_tokens: parseInt(e.target.value) || 500 })
                }
              />
              <p className="text-xs text-muted-foreground">Tamanho máximo da resposta da IA</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Follow-up Gate */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Gate de Follow-up Inteligente</CardTitle>
          <CardDescription>
            Controles de segurança para follow-ups automáticos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Cooldown (horas)</Label>
              <Input
                type="number"
                min={1}
                max={72}
                value={settings.followup_cooldown_hours}
                onChange={(e) =>
                  setSettings({ ...settings, followup_cooldown_hours: parseInt(e.target.value) || 4 })
                }
              />
              <p className="text-xs text-muted-foreground">Mínimo de horas entre a última msg e o envio de follow-up</p>
            </div>

            <div className="space-y-2">
              <Label>Threshold de Confiança (%)</Label>
              <Input
                type="number"
                min={0}
                max={100}
                value={settings.followup_confidence_threshold}
                onChange={(e) =>
                  setSettings({ ...settings, followup_confidence_threshold: parseInt(e.target.value) || 60 })
                }
              />
              <p className="text-xs text-muted-foreground">
                Abaixo deste valor a IA bloqueia o envio automático (0-59 bloqueia, 60-84 sugere, 85+ envia)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Writing Assistant Model */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            <CardTitle className="text-base">Assistente de Escrita</CardTitle>
          </div>
          <CardDescription>
            Modelo usado pelo assistente de escrita no composer do WhatsApp. Modelos mais caros geram textos melhores.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Modelo do Assistente de Escrita</Label>
            <Select
              value={settings.templates?.writing_assistant?.model || "google/gemini-2.5-flash"}
              onValueChange={(v) =>
                setSettings({
                  ...settings,
                  templates: {
                    ...settings.templates,
                    writing_assistant: {
                      ...(settings.templates?.writing_assistant || {}),
                      model: v,
                    },
                  },
                })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {WRITING_ASSISTANT_MODELS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    <span className="flex items-center gap-2">
                      <span>{m.cost}</span>
                      <span>{m.label}</span>
                      <span className="text-muted-foreground">— {m.desc}</span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Se o modelo primário falhar, o sistema usa automaticamente o Gemini Flash Lite como fallback.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
        Salvar Configurações de IA
      </Button>
    </div>
  );
}
