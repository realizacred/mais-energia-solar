import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectTrigger, SelectValue, SelectContent, SelectItem,
} from "@/components/ui/select";
import { Send, Save, CalendarClock, Info } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";

const DAYS = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda" },
  { value: 2, label: "Terça" },
  { value: 3, label: "Quarta" },
  { value: 4, label: "Quinta" },
  { value: 5, label: "Sexta" },
  { value: 6, label: "Sábado" },
];

const HOURS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${String(h).padStart(2, "0")}:00`,
}));

const DEFAULT_TEMPLATE = `Bom dia, {{primeiro_nome}}! 👋☀️

Aqui está seu resumo semanal:

📊 *Seus leads esta semana:*
• Total: {{total_leads}} leads
• 🔥 Hot (alta prioridade): {{hot_leads}}
• ⚠️ Sem classificação: {{sem_status}}
• ⏰ Follow-ups atrasados: {{followups_atrasados}}

{{cta_hot}}{{cta_sem_status}}
Bom trabalho! 💪
Mais Energia Solar 🌞`;

interface Config {
  id?: string;
  enabled: boolean;
  day_of_week: number;
  hour_local: number;
  template: string;
}

const DEFAULTS: Config = {
  enabled: true,
  day_of_week: 1,
  hour_local: 8,
  template: DEFAULT_TEMPLATE,
};

export function WeeklySummaryConfig() {
  const [cfg, setCfg] = useState<Config>(DEFAULTS);
  const [original, setOriginal] = useState<Config>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("weekly_summary_config")
        .select("*")
        .maybeSingle();
      if (error) throw error;
      if (data) {
        const c: Config = {
          id: data.id,
          enabled: data.enabled,
          day_of_week: data.day_of_week,
          hour_local: data.hour_local,
          template: data.template || DEFAULT_TEMPLATE,
        };
        setCfg(c);
        setOriginal(c);
      }
    } catch (e) {
      console.error("Failed to load weekly summary config:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const dirty = JSON.stringify(cfg) !== JSON.stringify(original);

  const handleSave = async () => {
    setSaving(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      if (!userData.user) throw new Error("Não autenticado");

      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userData.user.id)
        .maybeSingle();
      if (!profile?.tenant_id) throw new Error("Tenant não encontrado");

      const payload = {
        tenant_id: profile.tenant_id,
        enabled: cfg.enabled,
        day_of_week: cfg.day_of_week,
        hour_local: cfg.hour_local,
        template: cfg.template,
      };

      if (cfg.id) {
        const { error } = await supabase
          .from("weekly_summary_config")
          .update(payload)
          .eq("id", cfg.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("weekly_summary_config")
          .insert(payload);
        if (error) throw error;
      }

      toast({ title: "Configuração salva" });
      await load();
    } catch (e: any) {
      console.error(e);
      toast({ title: "Erro ao salvar", description: e?.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleSendTest = async () => {
    setTesting(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", userData.user!.id)
        .maybeSingle();

      const { data, error } = await supabase.functions.invoke(
        "notify-consultores-weekly",
        { body: { force: true, tenant_id: profile?.tenant_id } }
      );
      if (error) throw error;
      toast({
        title: "Disparo de teste enviado",
        description: `Consultores: ${data?.consultores ?? 0} • Enviados: ${data?.enviados ?? 0}`,
      });
    } catch (e: any) {
      toast({ title: "Erro no teste", description: e?.message, variant: "destructive" });
    } finally {
      setTesting(false);
    }
  };

  if (loading) return <Skeleton className="h-96 w-full rounded-lg" />;

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-base font-semibold text-foreground flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-primary" />
          Resumo Semanal por WhatsApp
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Mensagem automática enviada aos consultores ativos com o resumo de leads da semana.
        </p>
      </CardHeader>
      <CardContent className="space-y-5 pt-4">
        {/* Toggle ON/OFF */}
        <div className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
          <div>
            <Label className="text-sm font-medium text-foreground">Envio automático</Label>
            <p className="text-xs text-muted-foreground">Quando desligado, nenhuma mensagem é enviada.</p>
          </div>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) => setCfg({ ...cfg, enabled: v })}
          />
        </div>

        {/* Dia + hora */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Dia da semana</Label>
            <Select
              value={String(cfg.day_of_week)}
              onValueChange={(v) => setCfg({ ...cfg, day_of_week: Number(v) })}
              disabled={!cfg.enabled}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DAYS.map((d) => (
                  <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">Horário (Brasília)</Label>
            <Select
              value={String(cfg.hour_local)}
              onValueChange={(v) => setCfg({ ...cfg, hour_local: Number(v) })}
              disabled={!cfg.enabled}
            >
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent className="max-h-72">
                {HOURS.map((h) => (
                  <SelectItem key={h.value} value={String(h.value)}>{h.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Template */}
        <div>
          <Label className="text-xs text-muted-foreground mb-1.5 block">
            Template da mensagem
          </Label>
          <Textarea
            value={cfg.template}
            onChange={(e) => setCfg({ ...cfg, template: e.target.value })}
            disabled={!cfg.enabled}
            rows={14}
            className="font-mono text-xs"
          />
          <div className="mt-2 p-3 rounded-md bg-info/5 border border-info/20 flex gap-2">
            <Info className="w-4 h-4 text-info shrink-0 mt-0.5" />
            <div className="text-xs text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Variáveis disponíveis:</p>
              <code className="text-[11px]">
                {"{{primeiro_nome}}"} {"{{nome}}"} {"{{total_leads}}"} {"{{hot_leads}}"}{" "}
                {"{{sem_status}}"} {"{{followups_atrasados}}"} {"{{cta_hot}}"} {"{{cta_sem_status}}"}
              </code>
            </div>
          </div>
        </div>

        {/* Ações */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border">
          <Button
            variant="outline"
            size="sm"
            onClick={handleSendTest}
            disabled={testing || !cfg.enabled || dirty}
            className="gap-2"
          >
            {testing ? <Spinner size="sm" /> : <Send className="w-3.5 h-3.5" />}
            Disparar teste agora
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !dirty}
            size="sm"
            className="gap-2"
          >
            {saving ? <Spinner size="sm" /> : <Save className="w-3.5 h-3.5" />}
            Salvar
          </Button>
        </div>
        {dirty && (
          <p className="text-xs text-amber-600 -mt-2">
            Salve as alterações antes de disparar o teste.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
