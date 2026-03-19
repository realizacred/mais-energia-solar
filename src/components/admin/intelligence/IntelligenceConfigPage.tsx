import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Settings2, Brain, Flame, MessageSquare, Bell, Save, Loader2, AlertTriangle, Clock, Shield, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useIntelligenceConfig, type IntelligenceConfig } from "@/hooks/useIntelligenceConfig";
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

  const val = <K extends keyof IntelligenceConfig>(key: K, fallback?: IntelligenceConfig[K]): IntelligenceConfig[K] =>
    (local[key] ?? config?.[key] ?? fallback) as IntelligenceConfig[K];

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
      {/* Header §26 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Settings2 className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Configuração de Inteligência</h1>
            <p className="text-sm text-muted-foreground">Ative e configure cada funcionalidade do módulo</p>
          </div>
        </div>
        {dirty && (
          <Button onClick={handleSave} disabled={updateConfig.isPending} className="gap-2">
            {updateConfig.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salvar
          </Button>
        )}
      </div>

      <Tabs defaultValue="geral" className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-5">
          <TabsTrigger value="geral">Geral</TabsTrigger>
          <TabsTrigger value="ia">Análise IA</TabsTrigger>
          <TabsTrigger value="reaquecimento">Reaquecimento</TabsTrigger>
          <TabsTrigger value="whatsapp">WhatsApp</TabsTrigger>
          <TabsTrigger value="notificacoes">Notificações</TabsTrigger>
        </TabsList>

        {/* ═══════ ABA GERAL ═══════ */}
        <TabsContent value="geral" className="space-y-4 mt-4">
          {/* Feature master toggles */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary" /> Ativação de Funcionalidades
              </CardTitle>
              <CardDescription>Ative apenas o que precisa. Cada feature tem custo/complexidade diferente.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Análise de Sentimento com IA</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Usa OpenAI/Gemini para analisar mensagens. Custo: ~R$ 0,02 por análise.</p>
                </div>
                <Switch checked={val("ia_analise_sentimento_habilitada", false)} onCheckedChange={(v) => set("ia_analise_sentimento_habilitada", v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium">Reaquecimento Automático</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Analisa leads inativos diariamente. Não envia mensagens automaticamente.</p>
                </div>
                <Switch checked={val("reaquecimento_habilitado", false)} onCheckedChange={(v) => set("reaquecimento_habilitado", v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div className="flex-1">
                  <Label className="text-sm font-medium">WhatsApp em Tempo Real</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Analisa conversas enquanto acontecem. Requer mais processamento.</p>
                </div>
                <Switch checked={val("whatsapp_realtime_habilitado", false)} onCheckedChange={(v) => set("whatsapp_realtime_habilitado", v)} />
              </div>
            </CardContent>
          </Card>

          {/* Existing toggles */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Zap className="w-4 h-4 text-primary" /> Análise Base
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              <div className="flex items-center justify-between">
                <div><Label>Análise IA habilitada (heurística)</Label><p className="text-xs text-muted-foreground">Análise automática de temperamento e dor</p></div>
                <Switch checked={val("ia_analise_habilitada", true)} onCheckedChange={(v) => set("ia_analise_habilitada", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div><Label>Alertas habilitados</Label><p className="text-xs text-muted-foreground">Notificações para consultores/gerentes</p></div>
                <Switch checked={val("alertas_habilitados", true)} onCheckedChange={(v) => set("alertas_habilitados", v)} />
              </div>
            </CardContent>
          </Card>

          {/* Thresholds */}
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Flame className="w-4 h-4 text-primary" /> Thresholds de Temperamento
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              {(["quente", "morno", "frio"] as const).map((temp) => {
                const key = `threshold_${temp}` as keyof IntelligenceConfig;
                const defaults = { quente: 80, morno: 50, frio: 20 };
                const v = (val(key, defaults[temp]) as number);
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
              <div className="space-y-3 bg-muted/30 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">💰 Preço</Label>
                  <Switch checked={val("alerta_preco_habilitado", true)} onCheckedChange={(v) => set("alerta_preco_habilitado", v)} />
                </div>
                <TagInput
                  value={val("alerta_preco_palavras", ["caro", "dinheiro", "pagar", "investimento"])}
                  onChange={(v) => set("alerta_preco_palavras", v)}
                  placeholder="Palavra de preço..."
                />
                <div className="space-y-1">
                  <div className="flex justify-between">
                    <Label className="text-xs">Confiança mínima</Label>
                    <span className="text-xs text-muted-foreground">{(val("alerta_preco_min_confidence", 0.85) as number).toFixed(2)}</span>
                  </div>
                  <Slider
                    value={[(val("alerta_preco_min_confidence", 0.85) as number) * 100]}
                    onValueChange={([n]) => set("alerta_preco_min_confidence", n / 100)}
                    min={50} max={100} step={5}
                  />
                </div>
              </div>

              <div className="space-y-3 bg-muted/30 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">⏰ Tempo/Urgência</Label>
                  <Switch checked={val("alerta_tempo_habilitado", true)} onCheckedChange={(v) => set("alerta_tempo_habilitado", v)} />
                </div>
                <TagInput
                  value={val("alerta_tempo_palavras", ["demora", "rápido", "urgente", "prazo"])}
                  onChange={(v) => set("alerta_tempo_palavras", v)}
                  placeholder="Palavra de urgência..."
                />
              </div>

              <div className="space-y-3 bg-muted/30 border border-border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <Label className="font-medium">🏢 Concorrência</Label>
                  <Switch checked={val("alerta_concorrencia_habilitado", true)} onCheckedChange={(v) => set("alerta_concorrencia_habilitado", v)} />
                </div>
                <TagInput
                  value={val("alerta_concorrencia_palavras", ["outro", "concorrente", "empresa", "orçamento"])}
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
                    <Slider value={[val("consultor_autoriza_ate", 3) as number]} onValueChange={([n]) => set("consultor_autoriza_ate", n)} min={0} max={20} step={0.5} className="flex-1" />
                    <Badge variant="outline" className="min-w-[48px] text-center">{(val("consultor_autoriza_ate", 3) as number).toFixed(1)}%</Badge>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Gerente autoriza até (%)</Label>
                  <div className="flex items-center gap-3">
                    <Slider value={[val("gerente_autoriza_ate", 8) as number]} onValueChange={([n]) => set("gerente_autoriza_ate", n)} min={0} max={30} step={0.5} className="flex-1" />
                    <Badge variant="outline" className="min-w-[48px] text-center">{(val("gerente_autoriza_ate", 8) as number).toFixed(1)}%</Badge>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label>Alertar gerente se projeto acima de (R$)</Label>
                <Input type="number" value={val("sempre_alertar_gerente_se_valor_acima", 50000) as number} onChange={(e) => set("sempre_alertar_gerente_se_valor_acima", Number(e.target.value))} className="max-w-xs" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════ ABA ANÁLISE IA ═══════ */}
        <TabsContent value="ia" className="space-y-4 mt-4">
          {!val("ia_analise_sentimento_habilitada", false) ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Brain className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Análise de Sentimento com IA está desativada</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Ative na aba "Geral" para configurar</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Brain className="w-4 h-4 text-primary" /> Configuração da IA
                </CardTitle>
                <CardDescription>Configure provedor, limites e fallback.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                <div className="space-y-2">
                  <Label>Provedor de IA</Label>
                  <Select value={val("ia_provedor", "openai") as string} onValueChange={(v) => set("ia_provedor", v)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI (GPT-4 Mini)</SelectItem>
                      <SelectItem value="gemini">Google Gemini Flash</SelectItem>
                      <SelectItem value="local">Modelo Local (mais lento, sem custo)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {val("ia_provedor", "openai") !== "local" && (
                  <div className="space-y-2">
                    <Label>Chave API</Label>
                    <p className="text-xs text-muted-foreground">Configure na página de integrações (/admin/openai-config ou /admin/gemini-config)</p>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Timeout (ms)</Label>
                    <Input type="number" value={val("ia_timeout_ms", 10000) as number} onChange={(e) => set("ia_timeout_ms", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Max Tokens</Label>
                    <Input type="number" value={val("ia_max_tokens", 500) as number} onChange={(e) => set("ia_max_tokens", Number(e.target.value))} />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Fallback para heurística se IA falhar</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Usa regras simples quando a IA não responde</p>
                  </div>
                  <Switch checked={val("ia_fallback_heuristica", true)} onCheckedChange={(v) => set("ia_fallback_heuristica", v)} />
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Custo máximo por mês (R$)</Label>
                  <Input type="number" value={val("ia_custo_maximo_mes", 500) as number} onChange={(e) => set("ia_custo_maximo_mes", Number(e.target.value))} className="max-w-xs" />
                  <p className="text-xs text-muted-foreground">Se ultrapassar, IA é desativada automaticamente e admin é notificado.</p>
                </div>

                {/* Modelo e temperatura (existentes) */}
                <Separator />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Modelo de análise</Label>
                    <Select value={val("ia_modelo", "gemini-flash") as string} onValueChange={(v) => set("ia_modelo", v)}>
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
                      <Slider value={[(val("ia_temperatura", 0.7) as number) * 100]} onValueChange={([n]) => set("ia_temperatura", n / 100)} min={0} max={100} step={5} className="flex-1" />
                      <Badge variant="outline">{(val("ia_temperatura", 0.7) as number).toFixed(2)}</Badge>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════ ABA REAQUECIMENTO ═══════ */}
        <TabsContent value="reaquecimento" className="space-y-4 mt-4">
          {!val("reaquecimento_habilitado", false) ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <Clock className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">Reaquecimento Automático está desativado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Ative na aba "Geral" para configurar</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" /> Configuração de Reaquecimento
                </CardTitle>
                <CardDescription>Análise de leads inativos. Nunca envia mensagens automaticamente.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                <div className="space-y-2">
                  <Label>Horário de execução (cron)</Label>
                  <Input value={val("reaquecimento_horario_cron", "0 9 * * *") as string} onChange={(e) => set("reaquecimento_horario_cron", e.target.value)} placeholder="0 9 * * *" />
                  <p className="text-xs text-muted-foreground">Formato cron. Padrão: 9h da manhã todos os dias.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Leads por análise (batch)</Label>
                    <Input type="number" value={val("reaquecimento_batch_size", 50) as number} onChange={(e) => set("reaquecimento_batch_size", Number(e.target.value))} />
                  </div>
                  <div className="space-y-2">
                    <Label>Dias inativo para considerar</Label>
                    <Input type="number" value={val("reaquecimento_dias_inativo", 180) as number} onChange={(e) => set("reaquecimento_dias_inativo", Number(e.target.value))} />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Máximo tentativas</Label>
                    <Input type="number" value={val("reaquecimento_max_mensagens", 3) as number} onChange={(e) => set("reaquecimento_max_mensagens", Number(e.target.value))} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Template de mensagem sugerida</Label>
                  <Textarea
                    value={val("reaquecimento_template_mensagem", "Olá {{nome}}, desde nossa conversa você deixou de economizar {{valor_perdido}}. Posso rever seu projeto de {{potencia}}kWp?") as string}
                    onChange={(e) => set("reaquecimento_template_mensagem", e.target.value)}
                    rows={4}
                  />
                  <div className="text-xs text-muted-foreground space-y-1">
                    <p>Variáveis disponíveis:</p>
                    <code className="text-[11px] bg-muted px-1.5 py-0.5 rounded">{"{{nome}} {{valor_perdido}} {{potencia}} {{novo_valor}} {{data_primeiro_contato}}"}</code>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 bg-muted/30 border border-border rounded-lg p-3">
                  <div>
                    <Label className="text-sm">Apenas criar rascunho (nunca enviar automaticamente)</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Por segurança, esta opção é sempre ativada.</p>
                  </div>
                  <Switch checked={true} disabled />
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════ ABA WHATSAPP ═══════ */}
        <TabsContent value="whatsapp" className="space-y-4 mt-4">
          {!val("whatsapp_realtime_habilitado", false) ? (
            <Card className="bg-card border-border">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="w-10 h-10 text-muted-foreground/40 mb-3" />
                <p className="text-sm font-medium text-muted-foreground">WhatsApp em Tempo Real está desativado</p>
                <p className="text-xs text-muted-foreground/70 mt-1">Ative na aba "Geral" para configurar</p>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-card border-border">
              <CardHeader className="pb-3 border-b border-border">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-primary" /> WhatsApp em Tempo Real
                </CardTitle>
                <CardDescription>Analisa conversas enquanto acontecem.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-5">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <Label>Analisar TODAS as mensagens</Label>
                    <p className="text-xs text-muted-foreground mt-0.5">Se desligado, analisa a cada 5 minutos por lead (economiza processamento).</p>
                  </div>
                  <Switch checked={val("wa_analisar_toda_mensagem", false)} onCheckedChange={(v) => set("wa_analisar_toda_mensagem", v)} />
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-sm font-medium">Notificações</Label>
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm font-normal">Notificar quando temperamento mudar</Label>
                    <Switch checked={val("wa_notificar_mudanca_temperamento", true)} onCheckedChange={(v) => set("wa_notificar_mudanca_temperamento", v)} />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <Label className="text-sm font-normal">Notificar quando nova dor detectada</Label>
                    <Switch checked={val("wa_notificar_nova_dor", true)} onCheckedChange={(v) => set("wa_notificar_nova_dor", v)} />
                  </div>
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <Label className="text-sm font-normal">Auto-sugerir resposta no chat</Label>
                      <p className="text-xs text-muted-foreground mt-0.5">Nunca envia automaticamente, só preenche o campo.</p>
                    </div>
                    <Switch checked={val("wa_auto_sugerir_resposta", false)} onCheckedChange={(v) => set("wa_auto_sugerir_resposta", v)} />
                  </div>
                </div>

                <Separator />

                <div className="space-y-4">
                  <Label className="text-sm font-medium">Limiares de Urgência</Label>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-sm font-normal">Notificar consultor se urgência &gt;</Label>
                      <Badge variant="outline" className="text-xs">{val("wa_notificar_consultor_se_urgencia_acima", 70) as number}</Badge>
                    </div>
                    <Slider
                      value={[val("wa_notificar_consultor_se_urgencia_acima", 70) as number]}
                      onValueChange={([v]) => set("wa_notificar_consultor_se_urgencia_acima", v)}
                      min={0} max={100} step={5}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <Label className="text-sm font-normal">Notificar gerente se urgência &gt;</Label>
                      <Badge variant="outline" className="text-xs">{val("wa_notificar_gerente_se_urgencia_acima", 90) as number}</Badge>
                    </div>
                    <Slider
                      value={[val("wa_notificar_gerente_se_urgencia_acima", 90) as number]}
                      onValueChange={([v]) => set("wa_notificar_gerente_se_urgencia_acima", v)}
                      min={0} max={100} step={5}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* ═══════ ABA NOTIFICAÇÕES ═══════ */}
        <TabsContent value="notificacoes" className="space-y-4 mt-4">
          <Card className="bg-card border-border">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" /> Canais de Notificação
              </CardTitle>
              <CardDescription>Configure como e quando receber alertas do módulo de inteligência.</CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Email quando alerta criado</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Consultor recebe email para cada novo alerta</p>
                </div>
                <Switch checked={val("notificacao_email_alertas", true)} onCheckedChange={(v) => set("notificacao_email_alertas", v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Push no app quando lead esquentar</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Notificação em tempo real quando temperatura sobe</p>
                </div>
                <Switch checked={val("notificacao_push_temperamento", true)} onCheckedChange={(v) => set("notificacao_push_temperamento", v)} />
              </div>
              <Separator />
              <div className="flex items-center justify-between gap-4">
                <div>
                  <Label className="text-sm font-medium">Resumo diário para gerente</Label>
                  <p className="text-xs text-muted-foreground mt-0.5">Email consolidado com métricas do dia</p>
                </div>
                <Switch checked={val("notificacao_resumo_diario_gerente", false)} onCheckedChange={(v) => set("notificacao_resumo_diario_gerente", v)} />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

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
