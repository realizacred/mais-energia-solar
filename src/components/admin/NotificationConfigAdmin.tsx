import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  Users,
  FileText,
  MessageCircle,
  Clock,
  MessageSquare,
  Save,
  Info,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { motion } from "framer-motion";
import { WeeklySummaryConfig } from "./WeeklySummaryConfig";

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
    description: "Alerta push quando um novo lead entra pelo formulário de captação (/v/:slug) ou é cadastrado manualmente.",
    howItWorks: "Consultor responsável e admins recebem notificação instantânea. O lead já aparece no pipeline.",
    icon: Users,
    category: "Eventos Comerciais",
  },
  {
    key: "notify_new_orcamento" as const,
    label: "Novo Orçamento / Proposta",
    description: "Alerta quando uma proposta comercial é gerada ou atualizada no sistema.",
    howItWorks: "O consultor dono do lead e os admins recebem push. Útil para acompanhar o fluxo de vendas.",
    icon: FileText,
    category: "Eventos Comerciais",
  },
  {
    key: "notify_wa_message" as const,
    label: "Mensagem WhatsApp Recebida",
    description: "Push notification quando o cliente envia uma mensagem pelo WhatsApp.",
    howItWorks: "Apenas o consultor responsável pela conversa recebe. Se não houver responsável, admins são notificados.",
    icon: MessageCircle,
    category: "Comunicação",
  },
  {
    key: "notify_lead_idle" as const,
    label: "Lead Parado (Sem Contato)",
    description: "Alerta quando um lead está há mais de 2 horas sem receber nenhum contato da equipe.",
    howItWorks: "Ajuda a evitar que leads fiquem esquecidos no funil. O consultor responsável é notificado.",
    icon: Clock,
    category: "Inteligência Operacional",
  },
  {
    key: "notify_conversation_idle" as const,
    label: "Conversa Sem Resposta",
    description: "Alerta quando um cliente enviou mensagem no WhatsApp e ninguém da equipe respondeu.",
    howItWorks: "Monitora SLA de atendimento. Se ultrapassar o tempo configurado, o responsável e o gerente recebem alerta.",
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
        .select("id, tenant_id, notify_new_lead, notify_new_orcamento, notify_wa_message, notify_lead_idle, notify_conversation_idle, created_at, updated_at")
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
      <div className="p-4 md:p-6 space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="w-10 h-10 rounded-lg" />
          <div>
            <Skeleton className="h-6 w-64" />
            <Skeleton className="h-4 w-48 mt-1" />
          </div>
        </div>
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-32 w-full rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <motion.div
      className="p-4 md:p-6 space-y-6"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* §26 Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Bell className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Notificações</h1>
            <p className="text-sm text-muted-foreground">Controle quais eventos geram notificações push para a equipe</p>
          </div>
        </div>
        <Badge variant="outline" className="text-sm px-3 py-1">
          {enabledCount}/{NOTIFICATION_TYPES.length} ativos
        </Badge>
      </div>

      {/* Notification Types by Category */}
      {categories.map((category, catIdx) => (
        <motion.div
          key={category}
          custom={catIdx}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: catIdx * 0.06, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <Card className="bg-card border-border shadow-sm">
            <CardHeader className="pb-3 border-b border-border">
              <CardTitle className="text-base font-semibold text-foreground">{category}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 pt-2">
              {NOTIFICATION_TYPES.filter((t) => t.category === category).map((type, idx, arr) => {
                const Icon = type.icon;
                return (
                  <div key={type.key}>
                    <div className="flex items-center justify-between py-3 px-1">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5 p-2 rounded-lg bg-primary/10 shrink-0">
                          <Icon className="h-4 w-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <Label htmlFor={type.key} className="text-sm font-medium text-foreground cursor-pointer">
                            {type.label}
                          </Label>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {type.description}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1 italic">
                            💡 {type.howItWorks}
                          </p>
                        </div>
                      </div>
                      <Switch
                        id={type.key}
                        checked={config[type.key] as boolean}
                        onCheckedChange={() => handleToggle(type.key)}
                        className="shrink-0 ml-3"
                      />
                    </div>
                    {idx < arr.length - 1 && <Separator />}
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      ))}

      {/* Info — Como funciona */}
      <Card className="bg-info/5 border-info/20">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-info shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Como funciona o sistema de notificações?</p>
              <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
                <li>As configurações acima controlam <strong>notificações push</strong> para toda a equipe do tenant.</li>
                <li><strong>Consultores</strong> recebem apenas alertas dos seus próprios leads e conversas.</li>
                <li><strong>Admins e Gerentes</strong> recebem visibilidade global de todos os alertas.</li>
                <li>Push notifications funcionam no <strong>app PWA instalado</strong> — no navegador, aparecem como notificações do sistema.</li>
                <li>Desativar uma notificação aqui <strong>desativa para toda a empresa</strong>, não apenas para você.</li>
              </ul>
            </div>
          </div>

          <Separator className="bg-info/20" />

          <div className="flex items-start gap-3">
            <Bell className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
            <div className="space-y-2">
              <p className="text-sm font-medium text-foreground">Notificações automáticas (sempre ativas)</p>
              <p className="text-xs text-muted-foreground">Além das configuráveis acima, o sistema envia automaticamente:</p>
              <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                <li><strong>Parcelas vencidas</strong> — alerta WhatsApp diário (09h) para clientes com parcelas em atraso</li>
                <li><strong>Agendamentos</strong> — lembrete automático antes de compromissos</li>
                <li><strong>Alertas de usina</strong> — notificação quando uma usina solar para de gerar</li>
                <li><strong>SLA de atendimento</strong> — alerta quando tempo de resposta ultrapassa o configurado</li>
              </ul>
              <p className="text-xs text-muted-foreground/70 italic">Essas notificações não podem ser desativadas individualmente nesta tela.</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      {hasChanges && (
        <div className="sticky bottom-4 flex justify-end">
          <Button onClick={handleSave} disabled={saving} className="gap-2 shadow-lg">
            {saving ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
            Salvar configurações
          </Button>
        </div>
      )}
    </motion.div>
  );
}
