import { useState, useEffect } from "react";
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
  Loader2,
  RefreshCw,
  ShieldCheck,
  Zap,
  Info,
} from "lucide-react";

interface AiSettings {
  id?: string;
  modo: string;
  modelo_preferido: string;
  max_sugestoes_dia: number;
  templates: Record<string, any>;
}

const DEFAULT_SETTINGS: AiSettings = {
  modo: "assistido",
  modelo_preferido: "gpt-4o-mini",
  max_sugestoes_dia: 100,
  templates: {},
};

const MODELOS = [
  { value: "gpt-4o-mini", label: "GPT-4o Mini (rápido, econômico)" },
  { value: "gpt-4o", label: "GPT-4o (alta qualidade)" },
  { value: "gpt-4.1-mini", label: "GPT-4.1 Mini (mais recente)" },
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
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="gap-2">
        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
        Salvar Configurações de IA
      </Button>
    </div>
  );
}
