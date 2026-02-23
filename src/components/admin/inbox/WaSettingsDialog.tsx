import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useWaInstances } from "@/hooks/useWaInstances";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import {
  Wifi,
  WifiOff,
  Users,
  Bot,
  RefreshCw,
  Trash2,
  CheckCircle2,
  XCircle,
  History,
} from "lucide-react";

interface WaSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Tab 1: Connection ─────────────────────────────────────────────────
function ConnectionTab() {
  const { instances, loading, checkStatus, checkingStatus, deleteInstance, syncHistory } = useWaInstances();
  const { toast } = useToast();
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSync = async (id: string) => {
    setSyncingId(id);
    try {
      const result = await syncHistory(id);
      toast({
        title: "Histórico sincronizado!",
        description: `${result?.conversations_created || 0} conversas, ${result?.messages_imported || 0} mensagens.`,
      });
    } catch (err: any) {
      toast({ title: "Erro na sincronização", description: err.message, variant: "destructive" });
    } finally {
      setSyncingId(null);
    }
  };

  if (loading) return <div className="py-8 flex justify-center"><LoadingSpinner /></div>;

  if (instances.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <WifiOff className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhuma instância configurada.</p>
        <p className="text-xs mt-1">Adicione uma instância na seção de administração.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {instances.filter((i) => i.status === "connected").length}/{instances.length} online
        </p>
        <Button
          variant="outline"
          size="sm"
          onClick={() => checkStatus(undefined)}
          disabled={checkingStatus}
        >
          <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${checkingStatus ? "animate-spin" : ""}`} />
          Verificar Status
        </Button>
      </div>

      {instances.map((inst) => (
        <div
          key={inst.id}
          className="flex items-center justify-between p-3 rounded-lg border border-border/40 bg-muted/20"
        >
          <div className="flex items-center gap-3 min-w-0">
            {inst.status === "connected" ? (
              <CheckCircle2 className="h-5 w-5 text-success shrink-0" />
            ) : (
              <XCircle className="h-5 w-5 text-destructive shrink-0" />
            )}
            <div className="min-w-0">
              <p className="text-sm font-medium truncate">{inst.nome}</p>
              <p className="text-xs text-muted-foreground truncate">
                {inst.phone_number || inst.evolution_instance_key}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <Button
              variant="ghost"
              size="icon-sm"
              title="Sincronizar histórico"
              onClick={() => handleSync(inst.id)}
              disabled={syncingId === inst.id}
            >
              <History className={`h-3.5 w-3.5 ${syncingId === inst.id ? "animate-spin" : ""}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon-sm"
              title="Remover instância"
              className="text-destructive hover:text-destructive"
              onClick={() => {
                if (confirm(`Remover instância "${inst.nome}"?`)) {
                  deleteInstance(inst.id);
                }
              }}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab 2: Operators ──────────────────────────────────────────────────
function OperatorsTab() {
  const { instances } = useWaInstances();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch all consultores
  const { data: consultores = [], isLoading: loadingConsultores } = useQuery({
    queryKey: ["wa-settings-consultores"],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("consultores")
        .select("id, nome, user_id, ativo")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
  });

  // Fetch current instance-consultor assignments
  const { data: assignments = [], isLoading: loadingAssignments } = useQuery({
    queryKey: ["wa-instance-consultores"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_instance_consultores")
        .select("id, instance_id, consultor_id, tenant_id");
      return data || [];
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ consultorId, add }: { consultorId: string; add: boolean }) => {
      if (!instances[0]) throw new Error("Nenhuma instância disponível");
      const instanceId = instances[0].id;

      if (add) {
        // Need tenant_id — get from instance
        const tenantId = instances[0].tenant_id;
        const { error } = await supabase.from("wa_instance_consultores").insert({
          instance_id: instanceId,
          consultor_id: consultorId,
          tenant_id: tenantId,
        });
        if (error) throw error;
      } else {
        const assignment = assignments.find(
          (a) => a.consultor_id === consultorId && a.instance_id === instanceId
        );
        if (assignment) {
          const { error } = await supabase
            .from("wa_instance_consultores")
            .delete()
            .eq("id", assignment.id);
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-instance-consultores"] });
      toast({ title: "Permissão atualizada" });
    },
    onError: (err: any) => {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    },
  });

  if (loadingConsultores || loadingAssignments) {
    return <div className="py-8 flex justify-center"><LoadingSpinner /></div>;
  }

  if (consultores.length === 0) {
    return (
      <div className="py-12 text-center text-muted-foreground">
        <Users className="h-10 w-10 mx-auto mb-3 opacity-40" />
        <p className="text-sm">Nenhum consultor cadastrado.</p>
      </div>
    );
  }

  const primaryInstance = instances[0];
  const assignedIds = new Set(
    assignments.filter((a) => a.instance_id === primaryInstance?.id).map((a) => a.consultor_id)
  );

  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground mb-3">
        Consultores com acesso ao atendimento WhatsApp
        {primaryInstance && <span className="font-medium"> ({primaryInstance.nome})</span>}
      </p>
      {consultores.map((c: any) => {
        const isAssigned = assignedIds.has(c.id);
        return (
          <div
            key={c.id}
            className="flex items-center justify-between py-2.5 px-3 rounded-lg hover:bg-muted/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary">
                {c.nome?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <span className="text-sm font-medium">{c.nome}</span>
            </div>
            <Switch
              checked={isAssigned}
              onCheckedChange={(checked) =>
                toggleMutation.mutate({ consultorId: c.id, add: checked })
              }
              disabled={toggleMutation.isPending || !primaryInstance}
            />
          </div>
        );
      })}
    </div>
  );
}

// ─── Tab 3: Automation ─────────────────────────────────────────────────
function AutomationTab() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch wa_auto_reply_config (tenant-scoped, 1:1)
  const { data: autoReply, isLoading } = useQuery({
    queryKey: ["wa-auto-reply-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("wa_auto_reply_config")
        .select("id, ativo, mensagem_fora_horario, mensagem_feriado, cooldown_minutos, silenciar_alertas, silenciar_sla")
        .maybeSingle();
      return data;
    },
  });

  // Fetch whatsapp_automation_config for greeting message
  const { data: automationConfig } = useQuery({
    queryKey: ["whatsapp-automation-config"],
    queryFn: async () => {
      const { data } = await supabase
        .from("whatsapp_automation_config")
        .select("id, mensagem_boas_vindas, auto_reply_enabled, auto_reply_message")
        .maybeSingle();
      return data;
    },
  });

  const [greeting, setGreeting] = useState("");
  const [absence, setAbsence] = useState("");
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (automationConfig) {
      setGreeting(automationConfig.mensagem_boas_vindas || "");
    }
    if (autoReply) {
      setAbsence(autoReply.mensagem_fora_horario || "");
      setAutoReplyEnabled(autoReply.ativo ?? false);
    }
  }, [automationConfig, autoReply]);

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save greeting to whatsapp_automation_config
      if (automationConfig?.id) {
        const { error: e1 } = await supabase
          .from("whatsapp_automation_config")
          .update({ mensagem_boas_vindas: greeting || null })
          .eq("id", automationConfig.id);
        if (e1) throw e1;
      }

      // Save absence to wa_auto_reply_config
      if (autoReply?.id) {
        const { error: e2 } = await supabase
          .from("wa_auto_reply_config")
          .update({
            mensagem_fora_horario: absence,
            ativo: autoReplyEnabled,
          })
          .eq("id", autoReply.id);
        if (e2) throw e2;
      }

      queryClient.invalidateQueries({ queryKey: ["wa-auto-reply-config"] });
      queryClient.invalidateQueries({ queryKey: ["whatsapp-automation-config"] });
      toast({ title: "Configurações salvas" });
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  if (isLoading) return <div className="py-8 flex justify-center"><LoadingSpinner /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium">Resposta automática</p>
          <p className="text-xs text-muted-foreground">Responder fora do horário comercial</p>
        </div>
        <Switch
          checked={autoReplyEnabled}
          onCheckedChange={setAutoReplyEnabled}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Mensagem de Saudação</label>
        <p className="text-xs text-muted-foreground">Enviada no primeiro contato do cliente</p>
        <Textarea
          value={greeting}
          onChange={(e) => setGreeting(e.target.value)}
          placeholder="Olá! Seja bem-vindo à Mais Energia Solar ☀️ Como posso te ajudar?"
          className="min-h-[80px]"
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium">Mensagem de Ausência</label>
        <p className="text-xs text-muted-foreground">Enviada fora do horário comercial</p>
        <Textarea
          value={absence}
          onChange={(e) => setAbsence(e.target.value)}
          placeholder="No momento estamos fora do horário de atendimento. Retornaremos em breve!"
          className="min-h-[80px]"
        />
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full">
        {saving ? "Salvando..." : "Salvar Configurações"}
      </Button>
    </div>
  );
}

// ─── Main Dialog ────────────────────────────────────────────────────────
export function WaSettingsDialog({ open, onOpenChange }: WaSettingsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Configurações do WhatsApp</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="connection" className="mt-2">
          <TabsList className="w-full">
            <TabsTrigger value="connection" className="flex-1 gap-1.5">
              <Wifi className="h-3.5 w-3.5" />
              Conexão
            </TabsTrigger>
            <TabsTrigger value="operators" className="flex-1 gap-1.5">
              <Users className="h-3.5 w-3.5" />
              Operadores
            </TabsTrigger>
            <TabsTrigger value="automation" className="flex-1 gap-1.5">
              <Bot className="h-3.5 w-3.5" />
              Automação
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection">
            <ConnectionTab />
          </TabsContent>
          <TabsContent value="operators">
            <OperatorsTab />
          </TabsContent>
          <TabsContent value="automation">
            <AutomationTab />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
