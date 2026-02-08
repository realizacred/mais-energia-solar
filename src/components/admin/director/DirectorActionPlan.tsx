import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ClipboardList,
  RefreshCw,
  Loader2,
  Phone,
  MessageCircle,
  MapPin,
  FileText,
  Clock,
  Target,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import type { useAiInsights } from "@/hooks/useAiInsights";

interface Props {
  insights: ReturnType<typeof useAiInsights>;
}

const priorityConfig = {
  P0: { label: "P0 - Urgente", color: "bg-destructive text-destructive-foreground" },
  P1: { label: "P1 - Alto", color: "bg-warning text-warning-foreground" },
  P2: { label: "P2 - Médio", color: "bg-info text-info-foreground" },
};

const actionIcons: Record<string, any> = {
  ligar: Phone,
  whatsapp: MessageCircle,
  visita: MapPin,
  enviar_proposta: FileText,
  follow_up: Clock,
  outro: Target,
};

export function DirectorActionPlan({ insights }: Props) {
  const { getLatestByType, generateInsight, generating } = insights;
  const latest = getLatestByType("action_plan");
  const payload = latest?.payload;
  const isGenerating = generating === "action_plan";

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-5 w-5 text-info" />
          <h3 className="text-base font-semibold">Plano de Ação</h3>
          {latest && (
            <Badge variant="outline" className="text-xs">
              {format(new Date(latest.created_at), "dd/MM HH:mm", { locale: ptBR })}
            </Badge>
          )}
        </div>
        <Button
          onClick={() => generateInsight("action_plan")}
          disabled={isGenerating}
          size="sm"
          className="gap-2"
        >
          {isGenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {isGenerating ? "Gerando plano..." : "Gerar Plano de Ação"}
        </Button>
      </div>

      {isGenerating && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Loader2 className="h-10 w-10 text-info animate-spin mb-4" />
            <p className="text-sm font-medium text-muted-foreground">Criando plano de ação...</p>
          </CardContent>
        </Card>
      )}

      {!payload && !isGenerating && (
        <Card className="border-dashed border-2 border-muted-foreground/20">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="p-4 rounded-2xl bg-info/10 mb-4">
              <ClipboardList className="h-8 w-8 text-info" />
            </div>
            <h3 className="text-lg font-semibold mb-1">Nenhum plano gerado</h3>
            <p className="text-sm text-muted-foreground max-w-sm">
              Clique em "Gerar Plano de Ação" para criar tarefas priorizadas.
            </p>
          </CardContent>
        </Card>
      )}

      {payload && !payload.parse_error && !isGenerating && (
        <>
          {/* Goals */}
          <div className="grid md:grid-cols-2 gap-3">
            {payload.meta_dia && (
              <Card className="border-primary/20">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-primary mb-1">🎯 Meta do Dia</p>
                  <p className="text-sm text-foreground">{payload.meta_dia}</p>
                </CardContent>
              </Card>
            )}
            {payload.meta_semana && (
              <Card className="border-secondary/20">
                <CardContent className="p-4">
                  <p className="text-xs font-semibold text-secondary mb-1">📅 Meta da Semana</p>
                  <p className="text-sm text-foreground">{payload.meta_semana}</p>
                </CardContent>
              </Card>
            )}
          </div>

          {/* General plan */}
          {payload.plano_geral && (
            <Card>
              <CardContent className="p-4">
                <p className="text-sm text-muted-foreground leading-relaxed">{payload.plano_geral}</p>
              </CardContent>
            </Card>
          )}

          {/* Tasks per vendor */}
          {payload.tarefas_por_vendedor && (
            <Accordion type="multiple" defaultValue={Object.keys(payload.tarefas_por_vendedor)} className="space-y-2">
              {Object.entries(payload.tarefas_por_vendedor).map(([vendedor, tarefas]: [string, any]) => (
                <AccordionItem key={vendedor} value={vendedor} className="border rounded-xl overflow-hidden bg-card">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/30">
                    <div className="flex items-center gap-3">
                      <div className="p-1.5 rounded-lg bg-primary/10">
                        <User className="h-4 w-4 text-primary" />
                      </div>
                      <span className="font-semibold text-sm">{vendedor}</span>
                      <Badge variant="secondary" className="text-xs">
                        {(tarefas as any[]).length} tarefas
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    <div className="space-y-2">
                      {(tarefas as any[]).map((tarefa: any, idx: number) => {
                        const priority = priorityConfig[tarefa.prioridade as keyof typeof priorityConfig] || priorityConfig.P2;
                        const ActionIcon = actionIcons[tarefa.acao] || Target;

                        return (
                          <div
                            key={idx}
                            className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/40"
                          >
                            <div className="flex flex-col items-center gap-1 shrink-0">
                              <Badge className={`${priority.color} text-[10px]`}>
                                {tarefa.prioridade}
                              </Badge>
                              <ActionIcon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="flex-1 min-w-0">
                              {tarefa.lead_nome && (
                                <p className="text-sm font-medium text-foreground">{tarefa.lead_nome}</p>
                              )}
                              <p className="text-xs text-muted-foreground mt-0.5">{tarefa.motivo}</p>
                              <div className="mt-2 px-3 py-1.5 rounded-lg bg-card border border-border/40">
                                <p className="text-xs">
                                  <span className="font-semibold text-foreground">Ação:</span>{" "}
                                  <span className="text-muted-foreground">{tarefa.acao_detalhada}</span>
                                </p>
                              </div>
                              {tarefa.urgencia_horas && (
                                <p className="text-[10px] text-warning mt-1 flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  Fazer em até {tarefa.urgencia_horas}h
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          )}
        </>
      )}
    </div>
  );
}
