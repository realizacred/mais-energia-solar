import { useState } from "react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { WaAutoReplyConfig } from "./WaAutoReplyConfig";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "@/hooks/use-toast";
import { useTenantPlan } from "@/hooks/useTenantPlan";
import { usePlanGuard } from "@/components/plan/PlanGuard";
import { PageHeader } from "@/components/ui-kit";
import {
  Bell, Plus, Pencil, Trash2, Clock, MessageCircle, UserX, Pause, Save, X,
  Zap, AlertTriangle, ArrowUpDown, Play, Lock, Brain,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

import {
  useFollowupRules,
  useFollowupQueueStats,
  useProcessFollowupsNow,
  useSaveFollowupRule,
  useDeleteFollowupRule,
  useToggleFollowupRule,
  type FollowupRule,
  type FollowupRuleFormData,
} from "@/hooks/useWaFollowup";

type RuleFormData = FollowupRuleFormData;
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
  },
  equipe_sem_resposta: {
    label: "Equipe sem resposta",
    description: "Cliente mandou mensagem e ninguém respondeu",
    icon: AlertTriangle,
    color: "text-destructive",
  },
  conversa_parada: {
    label: "Conversa parada",
    description: "Nenhuma interação após um período",
    icon: Pause,
    color: "text-muted-foreground",
  },
};

const PRIORIDADE_CONFIG: Record<string, { label: string; className: string }> = {
  baixa: { label: "Baixa", className: "bg-muted/10 text-muted-foreground border-muted-foreground/20" },
  media: { label: "Média", className: "bg-info/10 text-info border-info/20" },
  alta: { label: "Alta", className: "bg-warning/10 text-warning border-warning/20" },
  urgente: { label: "Urgente", className: "bg-destructive/10 text-destructive border-destructive/20" },
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
  const { hasFeature } = useTenantPlan();
  const { guardLimit, LimitDialog } = usePlanGuard();
  const hasAiFollowup = hasFeature("ai_followup");
  const [editingRule, setEditingRule] = useState<FollowupRule | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<FollowupRule | null>(null);
  const [formData, setFormData] = useState<RuleFormData>(DEFAULT_FORM);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>("horas");

  const processNowMutation = useProcessFollowupsNow();
  const { data: rules = [], isLoading } = useFollowupRules();
  const { data: queueStats } = useFollowupQueueStats();
  const saveMutation = useSaveFollowupRule();
  const deleteMutation = useDeleteFollowupRule();
  const toggleMutation = useToggleFollowupRule();

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
    saveMutation.mutate(
      { rule: editingRule || undefined, form: formData },
      {
        onSuccess: () => {
          toast({ title: editingRule ? "Regra atualizada!" : "Regra criada!" });
          closeForm();
        },
        onError: (err: any) => {
          toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
        },
      }
    );
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
    <div className="space-y-6">
      {/* Auto-Reply Config */}
      <WaAutoReplyConfig />

      {/* §26 Header */}
      <PageHeader
        icon={Bell}
        title="Regras de Retorno"
        description="Configure quando e como acompanhar conversas sem resposta"
        actions={
          <div className="flex items-center gap-2">
            {hasAiFollowup && (
              <Badge variant="outline" className="text-[10px] gap-0.5">
                <Brain className="h-2.5 w-2.5" />
                IA Ativa
              </Badge>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => processNowMutation.mutate(undefined, {
                onSuccess: (data) => {
                  toast({
                    title: "Processamento concluído!",
                    description: `${data?.created || 0} follow-ups criados, ${data?.sent || 0} enviados.`,
                  });
                },
                onError: (err: any) => {
                  toast({ title: "Erro ao processar", description: err.message, variant: "destructive" });
                },
              })}
              disabled={processNowMutation.isPending}
              className="gap-2"
            >
              {processNowMutation.isPending ? <Spinner size="sm" /> : <Play className="h-4 w-4" />}
              Processar Agora
            </Button>
            <Button size="sm" onClick={openCreate} className="gap-2">
              <Plus className="h-4 w-4" />
              Nova Regra
            </Button>
          </div>
        }
      />

      {/* §27 KPI Cards */}
      {queueStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="border-l-[3px] border-l-warning bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-warning/10 shrink-0">
                <Clock className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{queueStats.pendentes}</p>
                <p className="text-sm text-muted-foreground mt-1">Pendentes</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-info bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-info/10 shrink-0">
                <Zap className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{queueStats.enviados}</p>
                <p className="text-sm text-muted-foreground mt-1">Enviados</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-success bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 shrink-0">
                <MessageCircle className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{queueStats.respondidos}</p>
                <p className="text-sm text-muted-foreground mt-1">Respondidos</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border-l-[3px] border-l-primary bg-card shadow-sm hover:shadow-md transition-shadow">
            <CardContent className="flex items-center gap-4 p-5">
              <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                <ArrowUpDown className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold tracking-tight text-foreground leading-none">{rules.filter(r => r.ativo).length}</p>
                <p className="text-sm text-muted-foreground mt-1">Regras ativas</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Rules List */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Spinner size="md" />
        </div>
      ) : rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <Bell className="w-10 h-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-muted-foreground">Nenhuma regra configurada</p>
          <p className="text-xs text-muted-foreground/70 mt-1">Crie regras para acompanhar conversas sem resposta automaticamente.</p>
          <Button onClick={openCreate} className="mt-4 gap-2">
            <Plus className="h-4 w-4" />
            Criar primeira regra
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => {
            const cenario = CENARIO_CONFIG[rule.cenario as keyof typeof CENARIO_CONFIG] || CENARIO_CONFIG.cliente_sem_resposta;
            const prio = PRIORIDADE_CONFIG[rule.prioridade] || PRIORIDADE_CONFIG.media;
            const CenarioIcon = cenario.icon;

            return (
              <Card key={rule.id} className={`bg-card border-border shadow-sm transition-opacity ${!rule.ativo ? "opacity-50" : ""}`}>
                <CardContent className="p-4">
                  <div className="flex items-start gap-4">
                    <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
                      <CenarioIcon className={`h-5 w-5 ${cenario.color}`} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-semibold text-sm text-foreground truncate">{rule.nome}</h3>
                        <Badge variant="outline" className={`text-[10px] px-1.5 ${prio.className}`}>{prio.label}</Badge>
                        {rule.envio_automatico && (
                          <Badge variant="outline" className="text-[10px] px-1.5 gap-0.5">
                            <Zap className="h-2.5 w-2.5" />
                            Auto
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mb-1">
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

                    <div className="flex items-center gap-1.5 shrink-0 px-1">
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

      {/* §25 Form Dialog — max-w-2xl, no scroll interno */}
      <Dialog open={showForm} onOpenChange={(open) => !open && closeForm()}>
        <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Bell className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                {editingRule ? "Editar Regra" : "Nova Regra de Follow-up"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure quando e como acompanhar conversas sem resposta
              </p>
            </div>
          </DialogHeader>

          <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

            {/* §28 Switch container — px-3 py-2, sem overflow-hidden */}
            <div className={`flex items-center justify-between px-3 py-2 rounded-lg border border-border ${!hasAiFollowup ? "opacity-60" : ""}`}>
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  Envio automático
                  {!hasAiFollowup && <Lock className="h-3.5 w-3.5 text-muted-foreground" />}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {hasAiFollowup
                    ? "Enviar mensagem automaticamente após o prazo"
                    : "Disponível nos planos Pro e Enterprise"}
                </p>
              </div>
              <Switch
                checked={formData.envio_automatico}
                disabled={!hasAiFollowup}
                onCheckedChange={(v) => setFormData({ ...formData, envio_automatico: v })}
              />
            </div>

            {formData.envio_automatico && (
              <div className="space-y-2">
                <Label>Template da mensagem</Label>
                <Textarea
                  value={formData.mensagem_template || ""}
                  onChange={(e) => setFormData({ ...formData, mensagem_template: e.target.value || null })}
                  placeholder="Olá {{nome}}! Gostaria de saber se ainda tem interesse no projeto de energia solar..."
                  rows={3}
                />
                <p className="text-[10px] text-muted-foreground">
                  Use {`{{nome}}`} para o nome do cliente e {`{{vendedor}}`} para o consultor
                </p>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
            <Button variant="outline" onClick={closeForm}>Cancelar</Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Spinner size="sm" /> : <Save className="h-4 w-4" />}
              {editingRule ? "Salvar" : "Criar Regra"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent className="w-[90vw] max-w-md">
          <AlertDialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
                <Trash2 className="w-5 h-5 text-destructive" />
              </div>
              <AlertDialogTitle>Excluir regra?</AlertDialogTitle>
            </div>
            <AlertDialogDescription>
              A regra "{deleteTarget?.nome}" e todos os follow-ups associados serão removidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id, {
                onSuccess: () => {
                  toast({ title: "Regra excluída!" });
                  setDeleteTarget(null);
                },
                onError: (err: any) => {
                  toast({ title: "Erro ao excluir", description: err.message, variant: "destructive" });
                },
              })}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {LimitDialog}
    </div>
  );
}
