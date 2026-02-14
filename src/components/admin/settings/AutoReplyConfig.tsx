import { useState, useEffect } from "react";
import { MessageSquareOff, Loader2, Save } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

type AutoReplyData = {
  ativo: boolean;
  mensagem_fora_horario: string;
  mensagem_feriado: string;
  cooldown_minutos: number;
  silenciar_sla: boolean;
  silenciar_alertas: boolean;
};

const DEFAULTS: AutoReplyData = {
  ativo: false,
  mensagem_fora_horario: "Olá! Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Retornaremos assim que possível. 😊",
  mensagem_feriado: "Olá! Hoje estamos em recesso por feriado. Retornaremos no próximo dia útil. 😊",
  cooldown_minutos: 1440,
  silenciar_sla: true,
  silenciar_alertas: true,
};

export function AutoReplyConfig({ tenantId }: { tenantId: string }) {
  const [config, setConfig] = useState<AutoReplyData>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exists, setExists] = useState(false);

  useEffect(() => { loadConfig(); }, [tenantId]);

  const loadConfig = async () => {
    const { data, error } = await supabase
      .from("wa_auto_reply_config")
      .select("ativo, mensagem_fora_horario, mensagem_feriado, cooldown_minutos, silenciar_sla, silenciar_alertas")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (data) {
      setConfig(data);
      setExists(true);
    }
    setLoading(false);
  };

  const updateField = <K extends keyof AutoReplyData>(key: K, value: AutoReplyData[K]) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    const payload = { tenant_id: tenantId, ...config };

    const { error } = exists
      ? await supabase.from("wa_auto_reply_config").update(config).eq("tenant_id", tenantId)
      : await supabase.from("wa_auto_reply_config").insert(payload);

    if (error) {
      toast({ title: "Erro ao salvar", description: error.message, variant: "destructive" });
    } else {
      setExists(true);
      toast({ title: "Configuração de auto-resposta salva!" });
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareOff className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Auto-resposta Fora do Horário</CardTitle>
          </div>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
            Salvar
          </Button>
        </div>
        <CardDescription>
          Resposta automática via WhatsApp quando o cliente envia mensagem fora do horário ou em feriados
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Ativar */}
        <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50 border border-border/60">
          <div className="space-y-0.5">
            <p className="text-sm font-medium">Ativar auto-resposta</p>
            <p className="text-xs text-muted-foreground">
              Envia mensagem automática quando cliente manda msg fora do horário
            </p>
          </div>
          <Switch checked={config.ativo} onCheckedChange={v => updateField("ativo", v)} />
        </div>

        {config.ativo && (
          <>
            {/* Mensagem fora do horário */}
            <div className="space-y-2">
              <Label>Mensagem fora do horário</Label>
              <Textarea
                value={config.mensagem_fora_horario}
                onChange={e => updateField("mensagem_fora_horario", e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            {/* Mensagem feriado */}
            <div className="space-y-2">
              <Label>Mensagem em feriados</Label>
              <Textarea
                value={config.mensagem_feriado}
                onChange={e => updateField("mensagem_feriado", e.target.value)}
                rows={3}
                className="text-sm"
              />
            </div>

            {/* Cooldown */}
            <div className="space-y-2">
              <Label>Cooldown entre envios (minutos)</Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  value={config.cooldown_minutos}
                  onChange={e => updateField("cooldown_minutos", parseInt(e.target.value) || 60)}
                  className="w-28 h-8 text-sm"
                  min={60}
                />
                <span className="text-xs text-muted-foreground">
                  {config.cooldown_minutos >= 1440
                    ? `${Math.floor(config.cooldown_minutos / 1440)} dia(s)`
                    : `${Math.floor(config.cooldown_minutos / 60)}h`}
                  {" por conversa"}
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Evita enviar a mesma mensagem repetidamente ao mesmo cliente
              </p>
            </div>

            {/* SLA + Alertas */}
            <div className="space-y-3 pt-2 border-t border-border/60">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Comportamento fora do horário</p>
              
              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60">
                <div className="space-y-0.5">
                  <p className="text-sm">Silenciar alertas de SLA</p>
                  <p className="text-[11px] text-muted-foreground">Não gera alertas de tempo de resposta fora do horário</p>
                </div>
                <Switch checked={config.silenciar_sla} onCheckedChange={v => updateField("silenciar_sla", v)} />
              </div>

              <div className="flex items-center justify-between p-2.5 rounded-lg border border-border/60">
                <div className="space-y-0.5">
                  <p className="text-sm">Silenciar notificações</p>
                  <p className="text-[11px] text-muted-foreground">Não notifica atendentes sobre novas mensagens fora do horário</p>
                </div>
                <Switch checked={config.silenciar_alertas} onCheckedChange={v => updateField("silenciar_alertas", v)} />
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
