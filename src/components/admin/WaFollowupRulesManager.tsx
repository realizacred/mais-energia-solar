import { useState } from "react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { Play } from "lucide-react";
import {
  Bell,
  Plus,
  Pencil,
  Trash2,
  
  Clock,
  MessageCircle,
  UserX,
  Pause,
  Save,
  X,
  Zap,
  AlertTriangle,
  ArrowUpDown,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface FollowupRule {
  id: string;
  tenant_id: string;
  nome: string;
  descricao: string | null;
  cenario: string;
  prazo_minutos: number;
  prioridade: string;
  mensagem_template: string | null;
  envio_automatico: boolean;
  max_tentativas: number;
  status_conversa: string[] | null;
  ativo: boolean;
  ordem: number;
  created_at: string;
  updated_at: string;
}

type RuleFormData = Omit<FollowupRule, "id" | "tenant_id" | "created_at" | "updated_at">;
type TimeUnit = "minutos" | "horas" | "dias";

function minutesToBestUnit(mins: number): { value: number; unit: TimeUnit } {
  if (mins >= 1440 && mins % 1440 === 0) return { value: mins / 1440, unit: "dias" };
  if (mins >= 60 && mins % 60 === 0) return { value: mins / 60, unit: "horas" };
  return { value: mins, unit: "minutos" };
}

function toMinutes(value: number, unit: TimeUnit): number {
  if (unit === "dias") return value * 1440;
  if (unit === "horas") return value * 60;
  return value;
}

const CENARIO_CONFIG = {
  cliente_sem_resposta: {
    label: "Cliente sem resposta",
    description: "Enviamos mensagem e o cliente não respondeu",
    icon: UserX,
    color: "text-warning",
    bg: "bg-warning/10",
  },
  equipe_sem_resposta: {
    label: "Equipe sem resposta",
    description: "Cliente mandou mensagem e ninguém respondeu",
    icon: AlertTriangle,
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
  conversa_parada: {
    label: "Conversa parada",
    description: "Nenhuma interação após um período",
    icon: Pause,
    color: "text-muted-foreground",
    bg: "bg-muted/50",
  },
};

const PRIORIDADE_CONFIG: Record<string, { label: string; color: string }> = {
  baixa: { label: "Baixa", color: "bg-muted text-muted-foreground" },
  media: { label: "Média", color: "bg-info/20 text-info" },
  alta: { label: "Alta", color: "bg-warning/20 text-warning" },
  urgente: { label: "Urgente", color: "bg-destructive/20 text-destructive" },
};

const DEFAULT_FORM: RuleFormData = {
  nome: "",
  descricao: null,
  cenario: "cliente_sem_resposta",
  prazo_minutos: 1440,
  prioridade: "media",
  mensagem_template: null,
  envio_automatico: false,
  max_tentativas: 3,
  status_conversa: ["open"],
  ativo: true,
  ordem: 0,
};

export function WaFollowupRulesManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [editingRule, setEditingRule] = useState<FollowupRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FollowupRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(DEFAULT_FORM);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("horas");

  // Manual trigger mutation
  const processNowMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("process-wa-followups");
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["wa-followup-queue-stats"] });
      queryClient.invalidateQueries({ queryKey: ["wa-followup-pending-widget"] });
      toast({
        title: "Processamento concluído!",
        description: `${data?.created || 0} follow-ups criados, ${data?.sent || 0} enviados.`,
      });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao processar", description: err.message, variant: "destructive" });
    },
  });

  const { data: rules = [], isLoading } = useQuery({
    queryKey: ["wa-followup-rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_followup_rules")
        .select("*")
        .order("ordem", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as FollowupRule[];
    },
  });

  // Stats from queue
  const { data: queueStats } = useQuery({
    queryKey: ["wa-followup-queue-stats"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wa_followup_queue")
        .select("status, rule_id");
      if (error) throw error;
      const pendentes = (data || []).filter((q) => q.status === "pendente").length;
      const enviados = (data || []).filter((q) => q.status === "enviado").length;
      const respondidos = (data || []).filter((q) => q.status === "respondido").length;
      return { pendentes, enviados, respondidos, total: data?.length || 0 };
    },
    staleTime: 30 * 1000,
  });

  const saveMutation = useMutation({
    mutationFn: async (data: { rule?: FollowupRule; form: RuleFormData }) => {
      const { data: profileData } = await supabase
        .from("profiles")
        .select("tenant_id")
        .eq("user_id", (await supabase.auth.getUser()).data.user?.id || "")
        .single();
      const tenantId = profileData?.tenant_id;
      if (!tenantId) throw new Error("Tenant não encontrado");
      if (data.rule) {
        const { error } = await supabase
          .from("wa_followup_rules")
          .update({
            nome: data.form.nome,
            descricao: data.form.descricao,
            cenario: data.form.cenario,
            prazo_minutos: data.form.prazo_minutos,
            prioridade: data.form.prioridade,
            mensagem_template: data.form.mensagem_template,
            envio_automatico: data.form.envio_automatico,
            max_tentativas: data.form.max_tentativas,
            status_conversa: data.form.status_conversa,
            ativo: data.form.ativo,
            ordem: data.form.ordem,
          })
          .eq("id", data.rule.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wa_followup_rules").insert([{
          tenant_id: tenantId,
          nome: data.form.nome,
          descricao: data.form.descricao,
          cenario: data.form.cenario,
          prazo_minutos: data.form.prazo_minutos,
          prioridade: data.form.prioridade,
          mensagem_template: data.form.mensagem_template,
          envio_automatico: data.form.envio_automatico,
          max_tentativas: data.form.max_tentativas,
          status_conversa: data.form.status_conversa,
          ativo: data.form.ativo,
          ordem: data.form.ordem,
        }]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-followup-rules"] });
      toast({ title: editingRule ? "Regra atualizada!" : "Regra criada!" });
      closeForm();
    },
    onError: (err: any) => {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("wa_followup_rules").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-followup-rules"] });
      toast({ title: "Regra excluída!" });
      setDeleteTarget(null);
    },
    onError: (err: any) => {
      toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
    },
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase.from("wa_followup_rules").update({ ativo }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["wa-followup-rules"] });
    },
  });

  const openCreate = () => {
    setEditingRule(null);
    setFormData({ ...DEFAULT_FORM, ordem: rules.length });
    setShowForm(true);
  };

  const openEdit = (rule: FollowupRule) => {
    setEditingRule(rule);
    const best = minutesToBestUnit(rule.prazo_minutos);
    setTimeUnit(best.unit);
    setFormData({
      nome: rule.nome,
      descricao: rule.descricao,
      cenario: rule.cenario,
      prazo_minutos: rule.prazo_minutos,
      prioridade: rule.prioridade,
      mensagem_template: rule.mensagem_template,
      envio_automatico: rule.envio_automatico,
      max_tentativas: rule.max_tentativas,
      status_conversa: rule.status_conversa,
      ativo: rule.ativo,
      ordem: rule.ordem,
    });
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingRule(null);
    setFormData(DEFAULT_FORM);
  };

  const handleSave = () => {
    if (!formData.nome.trim()) {
      toast({ title: "Nome obrigatório", variant: "destructive" });
      return;
    }
    saveMutation.mutate({ rule: editingRule || undefined, form: formData });
  };

  const formatPrazo = (minutos: number) => {
    if (minutos < 60) return `${minutos}min`;
    if (minutos < 1440) {
      const h = Math.floor(minutos / 60);
      const m = minutos % 60;
      return m ? `${h}h ${m}min` : `${h}h`;
    }
    const dias = Math.floor(minutos / 1440);
    const resto = Math.floor((minutos % 1440) / 60);
    return resto ? `${dias}d ${resto}h` : `${dias}d`;
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-gradient-to-br from-warning/20 to-warning/5 border border-warning/10">
            <Bell className="h-6 w-6 text-warning" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Regras de Follow-up</h2>
            <p className="text-sm text-muted-foreground">
              Configure quando e como acompanhar conversas sem resposta
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => processNowMutation.mutate()}
            disabled={processNowMutation.isPending}
            className="gap-2"
          >
            {processNowMutation.isPending ? (
              <Spinner size="sm" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Processar Agora
          </Button>
          <Button onClick={openCreate} className="gap-2">
            <Plus className="h-4 w-4" />
            Nova Regra
          </Button>
        </div>
      </div>

      {/* Stats */}
      {queueStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-warning/10 border border-border/20">
            <Clock className="h-4 w-4 text-warning shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{queueStats.pendentes}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Pendentes</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-info/10 border border-border/20">
            <Zap className="h-4 w-4 text-info shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{queueStats.enviados}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Enviados</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-success/10 border border-border/20">
            <MessageCircle className="h-4 w-4 text-success shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{queueStats.respondidos}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Respondidos</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/50 border border-border/20">
            <ArrowUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{rules.filter(r => r.ativo).length}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">Regras ativas</p>
            </div>
          </div>
        </div>
      )}

      {/* Rules List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : rules.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Bell className="h-10 w-10 text-muted-foreground/30 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhuma regra configurada</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Crie regras para acompanhar conversas sem resposta automaticamente.
            </p>
            <Button onClick={openCreate} variant="outline" className="mt-4 gap-2">
              <Plus className="h-4 w-4" />
              Criar primeira regra
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const cenario = CENARIO_CONFIG[rule.cenario as keyof typeof CENARIO_CONFIG] || CENARIO_CONFIG.cliente_sem_resposta;
            const prio = PRIORIDADE_CONFIG[rule.prioridade] || PRIORIDADE_CONFIG.media;
            const CenarioIcon = cenario.icon;

            return (
              <Card key={rule.id} className={`transition-opacity ${!rule.ativo ? "opacity-50" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className={`p-2 rounded-lg ${cenario.bg} shrink-0`}>
                      <CenarioIcon className={`h-5 w-5 ${cenario.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm truncate">{rule.nome}</h3>
                        <Badge className={`text-[10px] px-1.5 py-0 ${prio.color}`}>{prio.label}</Badge>
                        {rule.envio_automatico && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <Zap className="h-2.5 w-2.5" />
                            Auto
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-2">
                        {cenario.label} · Prazo: <strong>{formatPrazo(rule.prazo_minutos)}</strong>
                        {rule.max_tentativas > 1 && ` · Até ${rule.max_tentativas} tentativas`}
                      </p>
                      {rule.descricao && (
                        <p className="text-xs text-muted-foreground/70 line-clamp-1">{rule.descricao}</p>
                      )}
                      {rule.mensagem_template && (
                        <p className="text-xs text-muted-foreground/60 mt-1 line-clamp-1 italic">
                          "{rule.mensagem_template}"
                        </p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Switch
                        checked={rule.ativo}
                        onCheckedChange={(v) => toggleMutation.mutate({ id: rule.id, ativo: v })}
                      />
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(rule)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Editar</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setDeleteTarget(rule)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Excluir</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Form Dialog */}
      <Dialog open={showForm} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingRule ? "Editar Regra" : "Nova Regra de Follow-up"}</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome *</Label>
              <Input
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Follow-up cliente 24h"
              />
            </div>

            <div className="space-y-2">
              <Label>Descrição</Label>
              <Input
                value={formData.descricao || ""}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value || null })}
                placeholder="Descrição opcional da regra"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cenário</Label>
                <Select value={formData.cenario} onValueChange={(v) => setFormData({ ...formData, cenario: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(CENARIO_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>
                        <span className="flex items-center gap-2">
                          <cfg.icon className={`h-3.5 w-3.5 ${cfg.color}`} />
                          {cfg.label}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Prioridade</Label>
                <Select value={formData.prioridade} onValueChange={(v) => setFormData({ ...formData, prioridade: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(PRIORIDADE_CONFIG).map(([key, cfg]) => (
                      <SelectItem key={key} value={key}>{cfg.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Prazo</Label>
                <div className="flex gap-2">
                  <Input
                    type="number"
                    min={1}
                    className="flex-1"
                    value={minutesToBestUnit(formData.prazo_minutos).value}
                    onChange={(e) => {
                      const val = parseInt(e.target.value) || 1;
                      setFormData({ ...formData, prazo_minutos: toMinutes(val, timeUnit) });
                    }}
                  />
                  <Select
                    value={timeUnit}
                    onValueChange={(v: TimeUnit) => {
                      const currentDisplay = minutesToBestUnit(formData.prazo_minutos).value;
                      setTimeUnit(v);
                      setFormData({ ...formData, prazo_minutos: toMinutes(currentDisplay, v) });
                    }}
                  >
                    <SelectTrigger className="w-[110px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="minutos">Minutos</SelectItem>
                      <SelectItem value="horas">Horas</SelectItem>
                      <SelectItem value="dias">Dias</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <p className="text-[10px] text-muted-foreground">= {formatPrazo(formData.prazo_minutos)}</p>
              </div>

              <div className="space-y-2">
                <Label>Máx. tentativas</Label>
                <Input
                  type="number"
                  min={1}
                  max={10}
                  value={formData.max_tentativas}
                  onChange={(e) => setFormData({ ...formData, max_tentativas: parseInt(e.target.value) || 3 })}
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-3 rounded-lg border">
              <div>
                <Label className="text-sm font-medium">Envio automático</Label>
                <p className="text-xs text-muted-foreground">Enviar mensagem automaticamente após o prazo</p>
              </div>
              <Switch
                checked={formData.envio_automatico}
                onCheckedChange={(v) => setFormData({ ...formData, envio_automatico: v })}
              />
            </div>

            {formData.envio_automatico && (
              <div className="space-y-2">
                <Label>Template da mensagem</Label>
                <Textarea
                  value={formData.mensagem_template || ""}
                  onChange={(e) => setFormData({ ...formData, mensagem_template: e.target.value || null })}
                  placeholder="Olá {nome}! Gostaria de saber se ainda tem interesse no projeto de energia solar..."
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground">
                  Use {"{nome}"} para o nome do cliente e {"{vendedor}"} para o consultor
                </p>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
              {editingRule ? "Salvar" : "Criar Regra"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            <AlertDialogDescription>
              A regra "{deleteTarget?.nome}" e todos os follow-ups associados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
