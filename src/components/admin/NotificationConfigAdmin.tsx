import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  Users,
  FileText,
  MessageCircle,
  Clock,
  MessageSquare,
  Loader2,
  Save,
  Info,
} from "lucide-react";

interface NotificationConfig {
  id?: string;
  notify_new_lead: boolean;
  notify_new_orcamento: boolean;
  notify_wa_message: boolean;
  notify_lead_idle: boolean;
  notify_conversation_idle: boolean;
}

const DEFAULT_CONFIG: NotificationConfig = {
  notify_new_lead: true,
  notify_new_orcamento: true,
  notify_wa_message: true,
  notify_lead_idle: true,
  notify_conversation_idle: true,
};

const NOTIFICATION_TYPES = [
  {
    key: "notify_new_lead" as const,
    label: "Novo Lead",
    description: "Notificar quando um novo lead é cadastrado no sistema.",
    icon: Users,
    category: "Eventos Comerciais",
  },
  {
    key: "notify_new_orcamento" as const,
    label: "Novo Orçamento",
    description: "Notificar quando uma nova proposta/orçamento é gerada.",
    icon: FileText,
    category: "Eventos Comerciais",
  },
  {
    key: "notify_wa_message" as const,
    label: "Mensagem WhatsApp",
    description: "Notificar quando uma nova mensagem é recebida no WhatsApp.",
    icon: MessageCircle,
    category: "Comunicação",
  },
  {
    key: "notify_lead_idle" as const,
    label: "Lead Parado",
    description: "Alertar quando um lead não recebeu contato há mais de 2 horas.",
    icon: Clock,
    category: "Inteligência Operacional",
  },
  {
    key: "notify_conversation_idle" as const,
    label: "Conversa Esquecida",
    description: "Alertar quando um cliente enviou mensagem e ninguém respondeu.",
    icon: MessageSquare,
    category: "Inteligência Operacional",
  },
];

export function NotificationConfigAdmin() {
  const [config, setConfig] = useState<NotificationConfig>(DEFAULT_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [originalConfig, setOriginalConfig] = useState<NotificationConfig>(DEFAULT_CONFIG);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("notification_config")
        .select("*")
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const loaded: NotificationConfig = {
          id: data.id,
          notify_new_lead: data.notify_new_lead,
          notify_new_orcamento: data.notify_new_orcamento,
          notify_wa_message: data.notify_wa_message,
          notify_lead_idle: data.notify_lead_idle,
          notify_conversation_idle: data.notify_conversation_idle,
        };
        setConfig(loaded);
        setOriginalConfig(loaded);
      }
    } catch (e) {
      console.error("Failed to load notification config:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConfig();
  }, [loadConfig]);

  const handleToggle = (key: keyof NotificationConfig) => {
    setConfig((prev) => {
      const updated = { ...prev, [key]: !prev[key] };
      setHasChanges(JSON.stringify(updated) !== JSON.stringify(originalConfig));
      return updated;
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (config.id) {
        const { error } = await supabase
          .from("notification_config")
          .update({
            notify_new_lead: config.notify_new_lead,
            notify_new_orcamento: config.notify_new_orcamento,
            notify_wa_message: config.notify_wa_message,
            notify_lead_idle: config.notify_lead_idle,
            notify_conversation_idle: config.notify_conversation_idle,
          })
          .eq("id", config.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("notification_config")
          .insert([{
            notify_new_lead: config.notify_new_lead,
            notify_new_orcamento: config.notify_new_orcamento,
            notify_wa_message: config.notify_wa_message,
            notify_lead_idle: config.notify_lead_idle,
            notify_conversation_idle: config.notify_conversation_idle,
          } as any]);
        if (error) throw error;
      }

      toast({ title: "Configurações salvas com sucesso" });
      setHasChanges(false);
      setOriginalConfig({ ...config });
      loadConfig();
    } catch (e: any) {
      console.error("Failed to save notification config:", e);
      toast({
        title: "Erro ao salvar",
        description: e?.message || "Tente novamente",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const enabledCount = NOTIFICATION_TYPES.filter((t) => config[t.key]).length;

  const categories = [...new Set(NOTIFICATION_TYPES.map((t) => t.category))];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-primary" />
                Configurações de Notificações
              </CardTitle>
              <CardDescription className="mt-1">
                Controle quais eventos geram notificações push para toda a equipe.
                Configurações individuais (dispositivos, horários silenciosos) ficam no perfil de cada usuário.
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-sm px-3 py-1">
              {enabledCount}/{NOTIFICATION_TYPES.length} ativos
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Notification Types by Category */}
      {categories.map((category) => (
        <Card key={category}>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">{category}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {NOTIFICATION_TYPES.filter((t) => t.category === category).map((type, idx, arr) => {
              const Icon = type.icon;
              return (
                <div key={type.key}>
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 p-2 rounded-lg bg-muted">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <Label htmlFor={type.key} className="text-sm font-medium cursor-pointer">
                          {type.label}
                        </Label>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {type.description}
                        </p>
                      </div>
                    </div>
                    <Switch
                      id={type.key}
                      checked={config[type.key] as boolean}
                      onCheckedChange={() => handleToggle(type.key)}
                    />
                  </div>
                  {idx < arr.length - 1 && <Separator />}
                </div>
              );
            })}
          </CardContent>
        </Card>
      ))}

      {/* Info */}
      <div className="flex items-start gap-3 p-4 rounded-lg bg-info/5 border border-info/20">
        <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Como funciona?</p>
          <p className="text-xs text-muted-foreground mt-1">
            Estas configurações controlam quais eventos geram push notifications para a equipe.
            Cada membro pode ainda configurar seus próprios dispositivos e horários silenciosos
            individualmente nas configurações de WhatsApp ou no portal do vendedor.
          </p>
        </div>
      </div>

      {/* Save */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-lg">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Salvar configurações
          </Button>
        </div>
      )}
    </div>
  );
}
