import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { formatDateTime } from "@/lib/dateUtils";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Zap,
  Plus,
  Clock,
  ArrowRight,
  Edit2,
  Trash2,
  Lightbulb,
} from "lucide-react";

// ─── Types ──────────────────────────────────────────────

interface PipelineAutomation {
  id: string;
  tenant_id: string;
  pipeline_id: string;
  stage_id: string;
  nome: string;
  ativo: boolean;
  tipo_gatilho: string;
  tempo_horas: number;
  tipo_acao: string;
  destino_stage_id: string | null;
  notificar_responsavel: boolean;
  mensagem_notificacao: string | null;
  execucoes_total: number;
  ultima_execucao: string | null;
  created_at: string;
  updated_at: string;
  // Joined
  stage_name?: string;
  destino_name?: string;
  pipeline_name?: string;
}

interface PipelineOption {
  id: string;
  name: string;
}

interface StageOption {
  id: string;
  name: string;
  position: number;
}

// ─── Constants ──────────────────────────────────────────

const STALE_TIME = 1000 * 60 * 5;
const QUERY_KEY = "pipeline_automations" as const;

// ─── Hooks ──────────────────────────────────────────────

function usePipelines() {
  return useQuery({
    queryKey: ["pipelines_for_automations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipelines")
        .select("id, name")
        .order("name");
      if (error) throw error;
      return data as PipelineOption[];
    },
    staleTime: STALE_TIME,
  });
}

function usePipelineStages(pipelineId: string | null) {
  return useQuery({
    queryKey: ["pipeline_stages_for_automations", pipelineId],
    queryFn: async () => {
      if (!pipelineId) return [];
      const { data, error } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("pipeline_id", pipelineId)
        .order("position");
      if (error) throw error;
      return data as StageOption[];
    },
    staleTime: STALE_TIME,
    enabled: !!pipelineId,
  });
}

function useAutomations() {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      // Fetch automations with joined stage/pipeline names
      const { data, error } = await supabase
        .from("pipeline_automations")
        .select(`
          *,
          pipeline_stages!pipeline_automations_stage_id_fkey(name),
          destino:pipeline_stages!pipeline_automations_destino_stage_id_fkey(name),
          pipelines!pipeline_automations_pipeline_id_fkey(name)
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;

      return (data || []).map((row: any) => ({
        ...row,
        stage_name: row.pipeline_stages?.name ?? "—",
        destino_name: row.destino?.name ?? "—",
        pipeline_name: row.pipelines?.name ?? "—",
      })) as PipelineAutomation[];
    },
    staleTime: STALE_TIME,
  });
}

function useCreateAutomation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  return useMutation({
    mutationFn: async (payload: {
      nome: string;
      pipeline_id: string;
      stage_id: string;
      tempo_horas: number;
      destino_stage_id: string;
      notificar_responsavel: boolean;
      mensagem_notificacao: string | null;
      ativo: boolean;
    }) => {
      const { tenantId } = await getCurrentTenantId();
      const { data, error } = await supabase
        .from("pipeline_automations")
        .insert({
          tenant_id: tenantId,
          pipeline_id: payload.pipeline_id,
          stage_id: payload.stage_id,
          nome: payload.nome,
          tipo_gatilho: "tempo_parado",
          tempo_horas: payload.tempo_horas,
          tipo_acao: "mover_etapa",
          destino_stage_id: payload.destino_stage_id,
          notificar_responsavel: payload.notificar_responsavel,
          mensagem_notificacao: payload.mensagem_notificacao,
          ativo: payload.ativo,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "Automação criada", description: "A regra foi salva com sucesso." });
    },
    onError: (err: any) => {
      toast({ title: "Erro ao criar automação", description: err.message, variant: "destructive" });
    },
  });
}

function useToggleAutomation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ativo }: { id: string; ativo: boolean }) => {
      const { error } = await supabase
        .from("pipeline_automations")
        .update({ ativo, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
}

function useDeleteAutomation() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipeline_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
      toast({ title: "Automação removida" });
    },
  });
}

// ─── Suggested Automations ──────────────────────────────

interface SuggestedAutomation {
  nome: string;
  description: string;
  pipelineName: string;
  stageNameOrigin: string;
  stageNameDest: string;
  dias: number;
}

const SUGGESTIONS: SuggestedAutomation[] = [
  {
    nome: "Prospecção esquecida",
    description: "15 dias parado em Prospecção → Perdido",
    pipelineName: "Comercial",
    stageNameOrigin: "Prospecção",
    stageNameDest: "Perdido",
    dias: 15,
  },
  {
    nome: "Proposta sem resposta",
    description: "10 dias parado em Proposta Enviada → Prospecção",
    pipelineName: "Comercial",
    stageNameOrigin: "Proposta Enviada",
    stageNameDest: "Prospecção",
    dias: 10,
  },
  {
    nome: "Documentos atrasados",
    description: "5 dias parado em Falta Documentos → notificar",
    pipelineName: "Engenharia",
    stageNameOrigin: "Falta Documentos",
    stageNameDest: "Falta Documentos",
    dias: 5,
  },
];

// ─── Component ──────────────────────────────────────────

export function PipelineAutomations() {
  const { data: automations, isLoading } = useAutomations();
  const { data: pipelines } = usePipelines();
  const toggleMutation = useToggleAutomation();
  const deleteMutation = useDeleteAutomation();
  const createMutation = useCreateAutomation();

  const [isDialogOpen, setIsDialogOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formPipelineId, setFormPipelineId] = useState<string>("");
  const [formStageId, setFormStageId] = useState<string>("");
  const [formDays, setFormDays] = useState("3");
  const [formDestinoId, setFormDestinoId] = useState<string>("");
  const [formNotify, setFormNotify] = useState(false);
  const [formMessage, setFormMessage] = useState("");
  const [formActive, setFormActive] = useState(true);

  const { data: stages } = usePipelineStages(formPipelineId || null);

  // Reset stage selects when pipeline changes
  useEffect(() => {
    setFormStageId("");
    setFormDestinoId("");
  }, [formPipelineId]);

  const resetForm = () => {
    setFormName("");
    setFormPipelineId("");
    setFormStageId("");
    setFormDays("3");
    setFormDestinoId("");
    setFormNotify(false);
    setFormMessage("");
    setFormActive(true);
  };

  const handleSave = () => {
    createMutation.mutate(
      {
        nome: formName,
        pipeline_id: formPipelineId,
        stage_id: formStageId,
        tempo_horas: parseInt(formDays) * 24,
        destino_stage_id: formDestinoId,
        notificar_responsavel: formNotify,
        mensagem_notificacao: formMessage || null,
        ativo: formActive,
      },
      {
        onSuccess: () => {
          resetForm();
          setIsDialogOpen(false);
        },
      }
    );
  };

  const handleSuggestion = (s: SuggestedAutomation) => {
    if (!pipelines) return;
    const pipeline = pipelines.find((p) => p.name === s.pipelineName);
    if (!pipeline) return;

    setFormName(s.nome);
    setFormPipelineId(pipeline.id);
    setFormDays(String(s.dias));
    setFormNotify(s.nome.includes("atrasados"));
    setFormActive(true);

    // Stages will load after pipeline is set — pre-fill via effect
    setTimeout(() => {
      // We open the dialog and let the user confirm stages
      setIsDialogOpen(true);
    }, 100);
  };

  // When stages load and we have a suggestion prefill pending, try to auto-select
  useEffect(() => {
    if (!stages || !formPipelineId || !formName) return;
    const suggestion = SUGGESTIONS.find((s) => s.nome === formName);
    if (!suggestion) return;

    const origin = stages.find((st) => st.name === suggestion.stageNameOrigin);
    const dest = stages.find((st) => st.name === suggestion.stageNameDest);
    if (origin) setFormStageId(origin.id);
    if (dest) setFormDestinoId(dest.id);
  }, [stages, formPipelineId, formName]);

  const canSave = formName && formPipelineId && formStageId && formDestinoId && parseInt(formDays) > 0;

  // ─── Render ──────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header §26 */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <Zap className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">Automações de Pipeline</h2>
            <p className="text-sm text-muted-foreground">Regras automáticas para mover deals entre etapas</p>
          </div>
        </div>
        <Button size="sm" className="gap-1" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
          <Plus className="h-4 w-4" />
          Nova Automação
        </Button>
      </div>

      {/* Loading skeleton §12 */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      )}

      {/* Empty state */}
      {!isLoading && (!automations || automations.length === 0) && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-10 text-center">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-3">
              <Zap className="w-6 h-6 text-primary" />
            </div>
            <p className="font-medium text-foreground mb-1">Nenhuma automação configurada</p>
            <p className="text-sm text-muted-foreground mb-4">
              Crie regras para mover leads automaticamente entre etapas
            </p>
            <Button size="sm" onClick={() => { resetForm(); setIsDialogOpen(true); }}>
              <Plus className="h-4 w-4 mr-1" />
              Criar primeira automação
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Table §4 */}
      {!isLoading && automations && automations.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground w-[50px]">Status</TableHead>
                <TableHead className="font-semibold text-foreground">Nome</TableHead>
                <TableHead className="font-semibold text-foreground">Funil</TableHead>
                <TableHead className="font-semibold text-foreground">Gatilho</TableHead>
                <TableHead className="font-semibold text-foreground">Destino</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Execuções</TableHead>
                <TableHead className="w-[80px]" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {automations.map((a) => (
                <TableRow key={a.id} className="hover:bg-muted/30 transition-colors">
                  <TableCell>
                    <Switch
                      checked={a.ativo}
                      onCheckedChange={(v) => toggleMutation.mutate({ id: a.id, ativo: v })}
                    />
                  </TableCell>
                  <TableCell className="font-medium text-foreground">{a.nome}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="text-xs">{a.pipeline_name}</Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      <span>{Math.round(a.tempo_horas / 24)}d em {a.stage_name}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1.5 text-sm">
                      <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-foreground">{a.destino_name}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-mono">{a.execucoes_total}</div>
                    {a.ultima_execucao && (
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(a.ultima_execucao)}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => deleteMutation.mutate(a.id)}
                        aria-label={`Excluir automação ${a.nome}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Suggested automations */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-warning" />
          <p className="text-sm font-medium text-foreground">Automações recomendadas</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {SUGGESTIONS.map((s) => (
            <Card key={s.nome} className="bg-muted/30 border-border">
              <CardContent className="p-4">
                <p className="text-sm font-medium text-foreground mb-1">{s.nome}</p>
                <p className="text-xs text-muted-foreground mb-3">{s.description}</p>
                <Button variant="outline" size="sm" onClick={() => handleSuggestion(s)}>
                  Criar esta automação
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Cron info */}
      <Card className="bg-muted/20 border-border">
        <CardContent className="flex items-center gap-3 p-4">
          <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
          <p className="text-xs text-muted-foreground">
            Automações são executadas automaticamente a cada 5 minutos pelo sistema
          </p>
        </CardContent>
      </Card>

      {/* Dialog — RB-07: w-[90vw] */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="w-[90vw] max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Nova Automação
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Configure uma regra para mover deals automaticamente
              </p>
            </div>
          </DialogHeader>

          <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
            {/* Nome */}
            <div className="space-y-2">
              <Label>Nome da automação</Label>
              <Input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Prospecção esquecida"
              />
            </div>

            {/* Funil */}
            <div className="space-y-2">
              <Label>Funil</Label>
              <Select value={formPipelineId} onValueChange={setFormPipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o funil" />
                </SelectTrigger>
                <SelectContent>
                  {(pipelines || []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stage origin + days */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Estágio de origem</Label>
                <Select value={formStageId} onValueChange={setFormStageId} disabled={!formPipelineId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(stages || []).map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tempo parado (dias)</Label>
                <Input
                  type="number"
                  min={1}
                  max={90}
                  value={formDays}
                  onChange={(e) => setFormDays(e.target.value)}
                />
              </div>
            </div>

            {/* Destino */}
            <div className="space-y-2">
              <Label>Estágio de destino</Label>
              <Select value={formDestinoId} onValueChange={setFormDestinoId} disabled={!formPipelineId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(stages || []).filter((s) => s.id !== formStageId).map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Notify */}
            <div className="flex items-center justify-between">
              <Label>Notificar responsável</Label>
              <Switch checked={formNotify} onCheckedChange={setFormNotify} />
            </div>

            {formNotify && (
              <div className="space-y-2">
                <Label>Mensagem de notificação</Label>
                <Textarea
                  value={formMessage}
                  onChange={(e) => setFormMessage(e.target.value)}
                  placeholder="Ex: Deal parado há muitos dias, verificar andamento"
                  rows={2}
                />
              </div>
            )}

            {/* Active */}
            <div className="flex items-center justify-between">
              <Label>Ativar imediatamente</Label>
              <Switch checked={formActive} onCheckedChange={setFormActive} />
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="ghost" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSave}
              disabled={!canSave || createMutation.isPending}
            >
              {createMutation.isPending ? "Salvando..." : "Salvar automação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
