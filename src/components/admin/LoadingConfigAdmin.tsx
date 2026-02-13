import { useState, useCallback, useEffect } from "react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useLoadingConfig, type LoadingConfig } from "@/hooks/useLoadingConfig";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { SunLoader } from "@/components/loading/SunLoader";
import { RotatingLoadingMessage } from "@/components/loading/LoadingMessage";
import { Save, RotateCcw, Sun, MessageCircle, Brain, Eye, Loader2 } from "lucide-react";

const CONTEXT_LABELS: Record<string, string> = {
  general: "Geral",
  submit: "Envio de formulário",
  data_load: "Carregamento de dados",
  upload: "Upload de arquivos",
  whatsapp: "WhatsApp",
  ai_analysis: "Análise com IA",
  calculation: "Cálculos / Simulação",
  login: "Login / Autenticação",
};

const DEFAULT_CATALOG: Record<string, string[]> = {
  general: ["Carregando..."],
  submit: ["Enviando dados...", "Processando..."],
  data_load: ["Carregando dados...", "Buscando informações..."],
  upload: ["Enviando arquivo...", "Processando upload..."],
  whatsapp: ["Enviando mensagem...", "Conectando..."],
  ai_analysis: ["Analisando dados...", "Processando análise..."],
  calculation: ["Calculando economia...", "Simulando cenários..."],
  login: ["Verificando credenciais...", "Autenticando..."],
};

export function LoadingConfigAdmin() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { config: currentConfig, defaults } = useLoadingConfig();

  const [sunEnabled, setSunEnabled] = useState(true);
  const [sunStyle, setSunStyle] = useState("pulse");
  const [showMessages, setShowMessages] = useState(true);
  const [overlayDelay, setOverlayDelay] = useState(400);
  const [overlayMinDuration, setOverlayMinDuration] = useState(300);
  const [catalog, setCatalog] = useState<Record<string, string[]>>(DEFAULT_CATALOG);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [aiMinDuration, setAiMinDuration] = useState(3);
  const [aiTimeout, setAiTimeout] = useState(2000);
  const [aiMaxCalls, setAiMaxCalls] = useState(1);
  const [saving, setSaving] = useState(false);
  const [previewContext, setPreviewContext] = useState("general");
  const [showPreview, setShowPreview] = useState(false);

  // Load from current config
  useEffect(() => {
    if (currentConfig) {
      setSunEnabled(currentConfig.sun_loader_enabled);
      setSunStyle(currentConfig.sun_loader_style);
      setShowMessages(currentConfig.show_messages);
      setOverlayDelay(currentConfig.overlay_delay_ms);
      setOverlayMinDuration(currentConfig.overlay_min_duration_ms);
      setCatalog(currentConfig.messages_catalog || DEFAULT_CATALOG);
      setAiEnabled(currentConfig.ai_messages_enabled);
      setAiMinDuration(currentConfig.ai_min_duration_seconds);
      setAiTimeout(currentConfig.ai_timeout_ms);
      setAiMaxCalls(currentConfig.ai_max_calls_per_flow);
    }
  }, [currentConfig]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      // Validate
      if (overlayDelay < 100 || overlayDelay > 3000) {
        toast({ title: "Delay inválido", description: "Deve ser entre 100ms e 3000ms", variant: "destructive" });
        return;
      }
      if (overlayMinDuration < 100 || overlayMinDuration > 5000) {
        toast({ title: "Duração mínima inválida", description: "Deve ser entre 100ms e 5000ms", variant: "destructive" });
        return;
      }

      const payload = {
        sun_loader_enabled: sunEnabled,
        sun_loader_style: sunStyle,
        show_messages: showMessages,
        overlay_delay_ms: overlayDelay,
        overlay_min_duration_ms: overlayMinDuration,
        messages_catalog: catalog,
        ai_messages_enabled: aiEnabled,
        ai_min_duration_seconds: aiMinDuration,
        ai_timeout_ms: aiTimeout,
        ai_max_calls_per_flow: aiMaxCalls,
      };

      // Upsert
      const { data: existing } = await supabase
        .from("loading_config")
        .select("id")
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from("loading_config")
          .update(payload as any)
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loading_config")
          .insert(payload as any);
        if (error) throw error;
      }

      await queryClient.invalidateQueries({ queryKey: ["loading-config"] });
      toast({ title: "Configurações salvas", description: "As configurações de loading foram atualizadas." });
    } catch (e: any) {
      toast({ title: "Erro ao salvar", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }, [sunEnabled, sunStyle, showMessages, overlayDelay, overlayMinDuration, catalog, aiEnabled, aiMinDuration, aiTimeout, aiMaxCalls, queryClient, toast]);

  const handleReset = useCallback(() => {
    setSunEnabled(true);
    setSunStyle("pulse");
    setShowMessages(true);
    setOverlayDelay(400);
    setOverlayMinDuration(300);
    setCatalog(DEFAULT_CATALOG);
    setAiEnabled(false);
    setAiMinDuration(3);
    setAiTimeout(2000);
    setAiMaxCalls(1);
    toast({ title: "Padrões restaurados", description: "Clique em Salvar para aplicar." });
  }, [toast]);

  const updateCatalogMessages = (context: string, value: string) => {
    const messages = value.split("\n").filter(line => line.trim() !== "");
    setCatalog(prev => ({ ...prev, [context]: messages.length > 0 ? messages : ["Carregando..."] }));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Loading & Mensagens</h2>
          <p className="text-sm text-muted-foreground">Configure a experiência de carregamento do sistema</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleReset} className="gap-2">
            <RotateCcw className="h-4 w-4" />
            Restaurar padrões
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar
          </Button>
        </div>
      </div>

      {/* Loader do Sol */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Sun className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Loader do Sol</CardTitle>
          </div>
          <CardDescription>Animação temática de carregamento com o ícone do sol</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="sun-enabled">Ativar loader do Sol</Label>
            <Switch id="sun-enabled" checked={sunEnabled} onCheckedChange={setSunEnabled} />
          </div>
          {sunEnabled && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label>Estilo da animação</Label>
                <Select value={sunStyle} onValueChange={setSunStyle}>
                  <SelectTrigger className="w-[200px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pulse">Pulsar</SelectItem>
                    <SelectItem value="spin">Girar</SelectItem>
                    <SelectItem value="breathe">Respirar</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-6 py-3 px-4 rounded-lg bg-muted/30 border border-border/30">
                <SunLoader size="sm" style={sunStyle as any} />
                <SunLoader size="md" style={sunStyle as any} />
                <SunLoader size="lg" style={sunStyle as any} />
                <span className="text-xs text-muted-foreground ml-auto">Prévia dos tamanhos</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mensagens */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <MessageCircle className="h-4 w-4 text-info" />
            <CardTitle className="text-base">Mensagens de Loading</CardTitle>
          </div>
          <CardDescription>Textos exibidos durante operações de carregamento</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="show-messages">Mostrar mensagens de loading</Label>
            <Switch id="show-messages" checked={showMessages} onCheckedChange={setShowMessages} />
          </div>

          <Separator />

          <div className="grid gap-2">
            <Label>Delay para mostrar overlay (ms)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={overlayDelay}
                onChange={e => setOverlayDelay(Math.max(100, Math.min(3000, Number(e.target.value))))}
                className="w-[120px]"
                min={100}
                max={3000}
                step={50}
              />
              <span className="text-xs text-muted-foreground">Overlay só aparece após esse tempo (evita flash em ações rápidas)</span>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Duração mínima do overlay (ms)</Label>
            <div className="flex items-center gap-3">
              <Input
                type="number"
                value={overlayMinDuration}
                onChange={e => setOverlayMinDuration(Math.max(100, Math.min(5000, Number(e.target.value))))}
                className="w-[120px]"
                min={100}
                max={5000}
                step={50}
              />
              <span className="text-xs text-muted-foreground">Evita que o overlay apareça e desapareça muito rápido</span>
            </div>
          </div>

          {showMessages && (
            <>
              <Separator />
              <div className="space-y-4">
                <Label className="text-sm font-semibold">Catálogo de mensagens por contexto</Label>
                <p className="text-xs text-muted-foreground">Uma mensagem por linha. O sistema escolhe aleatoriamente.</p>
                {Object.entries(CONTEXT_LABELS).map(([key, label]) => (
                  <div key={key} className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs">{label}</Label>
                      <Badge variant="outline" className="text-[10px] h-4">{key}</Badge>
                    </div>
                    <Textarea
                      value={(catalog[key] || []).join("\n")}
                      onChange={e => updateCatalogMessages(key, e.target.value)}
                      rows={2}
                      className="text-xs resize-none"
                      placeholder="Uma mensagem por linha..."
                    />
                  </div>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* IA Opcional */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-4 w-4 text-sidebar-ai" />
            <CardTitle className="text-base">IA para Mensagens Dinâmicas</CardTitle>
            <Badge variant="outline" className="text-[10px]">Opcional</Badge>
          </div>
          <CardDescription>
            Gera mensagens contextuais usando IA em operações longas. Sempre com fallback automático para mensagens fixas.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label htmlFor="ai-enabled">Ativar mensagens com IA</Label>
              <p className="text-xs text-muted-foreground mt-0.5">Requer configuração de IA ativa na empresa</p>
            </div>
            <Switch id="ai-enabled" checked={aiEnabled} onCheckedChange={setAiEnabled} />
          </div>

          {aiEnabled && (
            <div className="space-y-4 pt-2 pl-4 border-l-2 border-accent dark:border-accent">
              <div className="grid gap-2">
                <Label className="text-xs">Usar IA apenas se duração &gt; (segundos)</Label>
                <Input
                  type="number"
                  value={aiMinDuration}
                  onChange={e => setAiMinDuration(Math.max(1, Math.min(30, Number(e.target.value))))}
                  className="w-[100px]"
                  min={1}
                  max={30}
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Timeout máximo da IA (ms)</Label>
                <Input
                  type="number"
                  value={aiTimeout}
                  onChange={e => setAiTimeout(Math.max(500, Math.min(10000, Number(e.target.value))))}
                  className="w-[120px]"
                  min={500}
                  max={10000}
                  step={100}
                />
                <span className="text-[10px] text-muted-foreground">Se a IA não responder neste tempo, usa mensagem fixa</span>
              </div>
              <div className="grid gap-2">
                <Label className="text-xs">Máximo de chamadas IA por fluxo</Label>
                <Input
                  type="number"
                  value={aiMaxCalls}
                  onChange={e => setAiMaxCalls(Math.max(1, Math.min(5, Number(e.target.value))))}
                  className="w-[80px]"
                  min={1}
                  max={5}
                />
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-info" />
            <CardTitle className="text-base">Prévia</CardTitle>
          </div>
          <CardDescription>Visualize como o loading aparecerá para os usuários</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <Select value={previewContext} onValueChange={setPreviewContext}>
              <SelectTrigger className="w-[200px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(CONTEXT_LABELS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setShowPreview(!showPreview)}>
              {showPreview ? "Ocultar" : "Mostrar"} preview
            </Button>
          </div>

          {showPreview && (
            <div className="relative flex flex-col items-center justify-center gap-3 py-12 rounded-xl bg-muted/20 border border-border/30">
              {sunEnabled ? (
                <SunLoader size="lg" style={sunStyle as any} />
              ) : (
                <div className="h-10 w-10 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              )}
              {showMessages && (
                <RotatingLoadingMessage context={previewContext} catalog={catalog} intervalMs={2500} />
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
