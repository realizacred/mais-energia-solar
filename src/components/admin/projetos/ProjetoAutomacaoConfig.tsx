import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Zap, Plus, Trash2, Power, PowerOff, Clock, ArrowRight, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { cn } from "@/lib/utils";

interface StageOption {
  id: string;
  name: string;
  position: number;
}

interface Automation {
  id: string;
  nome: string;
  ativo: boolean;
  tipo_gatilho: string;
  tempo_horas: number;
  tipo_acao: string;
  destino_stage_id: string | null;
  notificar_responsavel: boolean;
  mensagem_notificacao: string | null;
  stage_id: string;
  pipeline_id: string;
  execucoes_total: number;
  ultima_execucao: string | null;
}

interface Props {
  pipelineId: string;
  stages: StageOption[];
}

export function ProjetoAutomacaoConfig({ pipelineId, stages }: Props) {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAutomations = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("pipeline_automations")
      .select("*")
      .eq("pipeline_id", pipelineId)
      .order("created_at");
    
    if (!error && data) setAutomations(data as any[]);
    setLoading(false);
  };

  useEffect(() => { fetchAutomations(); }, [pipelineId]);

  const handleCreate = async () => {
    const firstStage = stages[0];
    if (!firstStage) return;

    const { error } = await supabase.from("pipeline_automations").insert({
      pipeline_id: pipelineId,
      stage_id: firstStage.id,
      nome: "Nova automação",
      tempo_horas: 48,
      tipo_gatilho: "tempo_parado",
      tipo_acao: "mover_etapa",
    } as any);

    if (error) {
      toast({ title: "Erro ao criar automação", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Automação criada!" });
      fetchAutomations();
    }
  };

  const handleUpdate = async (id: string, patch: Partial<Automation>) => {
    const { error } = await supabase
      .from("pipeline_automations")
      .update(patch as any)
      .eq("id", id);

    if (error) {
      toast({ title: "Erro ao atualizar", description: error.message, variant: "destructive" });
    } else {
      setAutomations(prev => prev.map(a => a.id === id ? { ...a, ...patch } : a));
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta automação?")) return;
    const { error } = await supabase.from("pipeline_automations").delete().eq("id", id);
    if (!error) {
      setAutomations(prev => prev.filter(a => a.id !== id));
      toast({ title: "Automação excluída" });
    }
  };

  const getStageNameById = (id: string | null) => stages.find(s => s.id === id)?.name || "—";

  if (loading) {
    return <div className="py-8 text-center text-sm text-muted-foreground">Carregando automações...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold text-foreground flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            Automações do Funil
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Configure ações automáticas baseadas em tempo ou eventos.
          </p>
        </div>
        <Button onClick={handleCreate} size="sm" className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />
          Nova Automação
        </Button>
      </div>

      {automations.length === 0 && (
        <div className="py-12 text-center">
          <Zap className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Nenhuma automação configurada</p>
          <p className="text-xs text-muted-foreground mt-1">Crie regras para mover projetos automaticamente.</p>
        </div>
      )}

      <div className="space-y-3">
        {automations.map(auto => (
          <Card key={auto.id} className={cn("transition-all", !auto.ativo && "opacity-60")}>
            <CardContent className="p-4 space-y-3">
              {/* Header: Name + Toggle + Delete */}
              <div className="flex items-center justify-between gap-3">
                <Input
                  value={auto.nome}
                  onChange={e => handleUpdate(auto.id, { nome: e.target.value })}
                  className="h-8 text-sm font-medium border-none bg-transparent px-0 focus-visible:ring-0 max-w-[250px]"
                />
                <div className="flex items-center gap-2 shrink-0">
                  {auto.execucoes_total > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      {auto.execucoes_total} execuções
                    </Badge>
                  )}
                  <Switch
                    checked={auto.ativo}
                    onCheckedChange={v => handleUpdate(auto.id, { ativo: v })}
                  />
                  <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(auto.id)}>
                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                  </Button>
                </div>
              </div>

              <Separator className="opacity-40" />

              {/* Trigger config */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Quando</Label>
                  <Select
                    value={auto.tipo_gatilho}
                    onValueChange={v => handleUpdate(auto.id, { tipo_gatilho: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="tempo_parado">Projeto parado por</SelectItem>
                      <SelectItem value="entrada_etapa">Ao entrar na etapa</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Na etapa</Label>
                  <Select
                    value={auto.stage_id}
                    onValueChange={v => handleUpdate(auto.id, { stage_id: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {stages.map(s => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {auto.tipo_gatilho === "tempo_parado" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Tempo (horas)</Label>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                      <Input
                        type="number"
                        min={1}
                        value={auto.tempo_horas}
                        onChange={e => handleUpdate(auto.id, { tempo_horas: parseInt(e.target.value) || 48 })}
                        className="h-8 text-xs w-20"
                      />
                      <span className="text-xs text-muted-foreground">h</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Action config */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Ação</Label>
                  <Select
                    value={auto.tipo_acao}
                    onValueChange={v => handleUpdate(auto.id, { tipo_acao: v })}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="mover_etapa">Mover para etapa</SelectItem>
                      <SelectItem value="notificar">Apenas notificar</SelectItem>
                      <SelectItem value="alterar_status">Alterar status</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {auto.tipo_acao === "mover_etapa" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Destino</Label>
                    <Select
                      value={auto.destino_stage_id || ""}
                      onValueChange={v => handleUpdate(auto.id, { destino_stage_id: v })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {stages.filter(s => s.id !== auto.stage_id).map(s => (
                          <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Notificar responsável</Label>
                  <div className="flex items-center gap-2 pt-1">
                    <Switch
                      checked={auto.notificar_responsavel}
                      onCheckedChange={v => handleUpdate(auto.id, { notificar_responsavel: v })}
                    />
                    <Bell className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                </div>
              </div>

              {/* Visual summary */}
              <Alert className="bg-muted/50 border-border/40">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <AlertDescription className="text-xs text-muted-foreground">
                  {auto.tipo_gatilho === "tempo_parado"
                    ? `Se projeto parado por ${auto.tempo_horas}h na etapa "${getStageNameById(auto.stage_id)}"`
                    : `Ao entrar na etapa "${getStageNameById(auto.stage_id)}"`
                  }
                  {" → "}
                  {auto.tipo_acao === "mover_etapa" && auto.destino_stage_id
                    ? `Mover para "${getStageNameById(auto.destino_stage_id)}"`
                    : auto.tipo_acao === "notificar"
                    ? "Notificar responsável"
                    : "Alterar status"
                  }
                </AlertDescription>
              </Alert>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
