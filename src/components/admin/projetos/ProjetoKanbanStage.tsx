import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Zap, Plus, FileText, MessageSquare, TrendingDown, Settings2, Clock, Phone, MapPin, Palette, Eye, Workflow } from "lucide-react";
import type { DealKanbanCard, PipelineStage } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ProjetoAutomacaoConfig } from "./ProjetoAutomacaoConfig";
import { differenceInDays, differenceInHours } from "date-fns";

interface AutomationRule {
  id: string;
  nome: string;
  ativo: boolean;
  stage_id: string;
  tipo_gatilho: string;
  tempo_horas: number;
  tipo_acao: string;
  destino_stage_id: string | null;
}

interface Props {
  stages: PipelineStage[];
  deals: DealKanbanCard[];
  onMoveToStage: (dealId: string, stageId: string) => void;
  onViewProjeto?: (deal: DealKanbanCard) => void;
  onNewProject?: () => void;
}

const formatBRL = (v: number) => {
  if (!v) return "R$ -";
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `R$ ${Math.round(v / 1_000)}K`;
  return `R$ ${v}`;
};

const formatKwp = (v: number) => {
  if (!v) return "- kWp";
  return `${v.toFixed(1).replace(".", ",")} kWp`;
};

const ETIQUETA_LABELS: Record<string, string> = {
  residencial: "R",
  comercial: "C",
  industrial: "I",
  rural: "A",
};

const PROPOSTA_STATUS_MAP: Record<string, { label: string; className: string }> = {
  rascunho: { label: "Rascunho", className: "bg-muted text-muted-foreground" },
  gerada: { label: "Gerada", className: "bg-amber-100 text-amber-700" },
  generated: { label: "Gerada", className: "bg-amber-100 text-amber-700" },
  enviada: { label: "Enviada", className: "bg-blue-100 text-blue-700" },
  sent: { label: "Enviada", className: "bg-blue-100 text-blue-700" },
  aceita: { label: "Aceita", className: "bg-green-100 text-green-700" },
  accepted: { label: "Aceita", className: "bg-green-100 text-green-700" },
  recusada: { label: "Recusada", className: "bg-destructive/10 text-destructive" },
  rejected: { label: "Recusada", className: "bg-destructive/10 text-destructive" },
  expirada: { label: "Expirada", className: "bg-muted text-muted-foreground" },
  expired: { label: "Expirada", className: "bg-muted text-muted-foreground" },
};

function getTimeInStage(lastChange: string) {
  const hours = differenceInHours(new Date(), new Date(lastChange));
  if (hours < 1) return "agora";
  if (hours < 24) return `${hours}h`;
  const days = differenceInDays(new Date(), new Date(lastChange));
  return `${days}d`;
}

function getStagnationLevel(lastChange: string) {
  const hours = differenceInHours(new Date(), new Date(lastChange));
  if (hours >= 168) return "critical"; // 7d
  if (hours >= 72) return "warning";   // 3d
  return null;
}

export function ProjetoKanbanStage({ stages, deals, onMoveToStage, onViewProjeto, onNewProject }: Props) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [automationDialogStageId, setAutomationDialogStageId] = useState<string | null>(null);

  // Fetch automations for visual indicators
  useEffect(() => {
    const pipelineId = stages[0]?.pipeline_id;
    if (!pipelineId) return;
    supabase
      .from("pipeline_automations")
      .select("id, nome, ativo, stage_id, tipo_gatilho, tempo_horas, tipo_acao, destino_stage_id")
      .eq("pipeline_id", pipelineId)
      .eq("ativo", true)
      .then(({ data }) => {
        if (data) setAutomations(data as AutomationRule[]);
      });
  }, [stages]);

  const automationsByStage = useMemo(() => {
    const map = new Map<string, AutomationRule[]>();
    automations.forEach(a => {
      const arr = map.get(a.stage_id) || [];
      arr.push(a);
      map.set(a.stage_id, arr);
    });
    return map;
  }, [automations]);

  const getStageNameById = (id: string | null) => stages.find(s => s.id === id)?.name || "—";

  const handleDragStart = (e: React.DragEvent, dealId: string) => {
    setDraggedId(dealId);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDrop = (e: React.DragEvent, stageId: string) => {
    e.preventDefault();
    if (draggedId) {
      onMoveToStage(draggedId, stageId);
      setDraggedId(null);
      setDragOverCol(null);
    }
  };

  const sortedStages = [...stages].sort((a, b) => a.position - b.position);
  const pipelineId = stages[0]?.pipeline_id;

  if (sortedStages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
        <p className="font-medium">Nenhuma etapa configurada</p>
        <p className="text-sm mt-1">Configure as etapas do funil primeiro.</p>
      </div>
    );
  }

  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-3 pb-4 px-1" style={{ minWidth: "max-content" }}>
          {sortedStages.map(stage => {
            const stageDeals = deals.filter(d => d.stage_id === stage.id);
            const totalValue = stageDeals.reduce((s, d) => s + (d.deal_value || 0), 0);
            const totalKwp = stageDeals.reduce((s, d) => s + (d.deal_kwp || 0), 0);
            const isOver = dragOverCol === stage.id;
            const stageAutomations = automationsByStage.get(stage.id) || [];
            const hasActiveAutomation = stageAutomations.length > 0;

            return (
              <div
                key={stage.id}
                className={cn(
                  "w-[290px] flex-shrink-0 rounded-xl border border-border/60 transition-all flex flex-col",
                  "bg-muted/30",
                  isOver && "ring-2 ring-primary/30 bg-primary/5"
                )}
                onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; setDragOverCol(stage.id); }}
                onDragLeave={() => setDragOverCol(null)}
                onDrop={e => handleDrop(e, stage.id)}
              >
                {/* Column Header */}
                <div className="px-4 pt-3.5 pb-2.5">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-bold text-foreground leading-tight truncate">
                        {stage.name}
                      </h3>
                      {hasActiveAutomation && (
                        <Tooltip>
                          <TooltipTrigger>
                            <Zap className="h-3.5 w-3.5 text-primary animate-pulse shrink-0" />
                          </TooltipTrigger>
                          <TooltipContent className="text-xs">
                            {stageAutomations.length} automação(ões) ativa(s)
                          </TooltipContent>
                        </Tooltip>
                      )}
                    </div>

                    {/* Gear DropdownMenu */}
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0">
                          <Settings2 className="h-3.5 w-3.5" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end" className="w-52 bg-popover">
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Visual</DropdownMenuLabel>
                        <DropdownMenuItem disabled className="text-xs gap-2">
                          <Palette className="h-3.5 w-3.5" />
                          Personalizar cor da etapa
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled className="text-xs gap-2">
                          <Eye className="h-3.5 w-3.5" />
                          Campos visíveis no card
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuLabel className="text-[10px] uppercase tracking-wider text-muted-foreground">Inteligência</DropdownMenuLabel>
                        <DropdownMenuItem
                          className="text-xs gap-2"
                          onClick={() => setAutomationDialogStageId(stage.id)}
                        >
                          <Zap className="h-3.5 w-3.5" />
                          Configurar Automação
                        </DropdownMenuItem>
                        <DropdownMenuItem disabled className="text-xs gap-2">
                          <Workflow className="h-3.5 w-3.5" />
                          Construtor de Fluxos
                          <Badge variant="outline" className="text-[8px] h-4 px-1 ml-auto">BETA</Badge>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground flex-wrap">
                    <span className="font-semibold font-mono text-foreground">{formatBRL(totalValue)}</span>
                    <span className="flex items-center gap-0.5 font-mono">
                      <Zap className="h-3 w-3 text-warning" />
                      {formatKwp(totalKwp)}
                    </span>
                    <span>{stageDeals.length} projeto{stageDeals.length !== 1 ? "s" : ""}</span>
                  </div>
                </div>

                {/* New Project Button */}
                <div className="px-3 pb-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs font-medium border-dashed border-primary/40 text-primary hover:bg-primary/5"
                    onClick={() => onNewProject?.()}
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" />
                    Novo projeto
                  </Button>
                </div>

                {/* Cards */}
                <div className="px-3 pb-2 min-h-[80px] space-y-2 flex-1">
                  {stageDeals.length === 0 && (
                    <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/40 italic">
                      Arraste projetos aqui
                    </div>
                  )}
                  {stageDeals.map(deal => (
                    <StageDealCard
                      key={deal.deal_id}
                      deal={deal}
                      isDragging={draggedId === deal.deal_id}
                      onDragStart={handleDragStart}
                      onClick={() => onViewProjeto?.(deal)}
                      hasAutomation={hasActiveAutomation}
                    />
                  ))}
                </div>

                {/* Automation Alert at Column Base */}
                {stageAutomations.length > 0 && (
                  <div className="px-3 pb-3">
                    {stageAutomations.slice(0, 1).map(auto => (
                      <Alert key={auto.id} className="bg-muted/40 border-border/30 py-2 px-3">
                        <Zap className="h-3 w-3 text-primary" />
                        <AlertDescription className="text-[10px] text-muted-foreground leading-tight">
                          {auto.tipo_gatilho === "tempo_parado"
                            ? `Se parado por ${auto.tempo_horas}h → ${auto.tipo_acao === "mover_etapa" ? `Mover para "${getStageNameById(auto.destino_stage_id)}"` : "Notificar"}`
                            : `Ao entrar → ${auto.tipo_acao === "mover_etapa" ? `Mover para "${getStageNameById(auto.destino_stage_id)}"` : "Notificar"}`
                          }
                        </AlertDescription>
                      </Alert>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Automation Config Dialog */}
      {automationDialogStageId && pipelineId && (
        <Dialog open={true} onOpenChange={(open) => { if (!open) setAutomationDialogStageId(null); }}>
          <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
            <DialogHeader className="pb-2 border-b border-border/40">
              <DialogTitle className="flex items-center gap-2 text-base">
                <Zap className="h-4 w-4 text-primary" />
                Automações — {getStageNameById(automationDialogStageId)}
              </DialogTitle>
            </DialogHeader>
            <div className="flex-1 overflow-y-auto py-4">
              <ProjetoAutomacaoConfig
                pipelineId={pipelineId}
                stages={sortedStages.map(s => ({ id: s.id, name: s.name, position: s.position }))}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}
    </>
  );
}

// ── Deal Card ──────────────────────────────────────────

interface StageDealCardProps {
  deal: DealKanbanCard;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent, id: string) => void;
  onClick: () => void;
  hasAutomation?: boolean;
}

function StageDealCard({ deal, isDragging, onDragStart, onClick, hasAutomation }: StageDealCardProps) {
  const etiquetaLabel = deal.etiqueta ? ETIQUETA_LABELS[deal.etiqueta] || deal.etiqueta?.[0]?.toUpperCase() : null;
  const isInactive = deal.deal_status === "perdido" || deal.deal_status === "cancelado";
  const propostaInfo = deal.proposta_status ? PROPOSTA_STATUS_MAP[deal.proposta_status] : null;
  const timeInStage = getTimeInStage(deal.last_stage_change);
  const stagnation = getStagnationLevel(deal.last_stage_change);

  const handleSendWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.customer_phone) {
      const phone = deal.customer_phone.replace(/\D/g, "");
      window.open(`https://wa.me/55${phone}`, "_blank");
    }
  };

  const handleCall = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (deal.customer_phone) {
      window.open(`tel:${deal.customer_phone}`, "_self");
    }
  };

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, deal.deal_id)}
      onClick={onClick}
      className={cn(
        "bg-card rounded-lg border-l-[3px] border border-border/40 p-2.5 cursor-grab active:cursor-grabbing",
        "hover:shadow-md transition-all duration-150 relative group",
        "border-l-primary",
        isInactive && "opacity-50",
        isDragging && "opacity-30 scale-95",
        stagnation === "critical" && "ring-1 ring-destructive/30",
        stagnation === "warning" && "ring-1 ring-warning/30"
      )}
      style={{ boxShadow: "0 1px 3px hsl(var(--foreground) / 0.04)" }}
    >
      {/* Row 1: Name + badges */}
      <div className="flex items-start justify-between gap-1.5 mb-1.5">
        <p className={cn(
          "text-[12px] font-semibold leading-snug line-clamp-1",
          isInactive ? "text-muted-foreground" : "text-foreground"
        )}>
          {deal.customer_name || deal.deal_title || "Sem nome"}
        </p>
        <div className="flex items-center gap-1 shrink-0">
          {hasAutomation && stagnation && (
            <Zap className="h-3 w-3 text-primary animate-pulse" />
          )}
          {propostaInfo && (
            <Badge className={cn("text-[8px] h-4 px-1 font-semibold", propostaInfo.className)}>
              {propostaInfo.label}
            </Badge>
          )}
          {etiquetaLabel && (
            <span className="text-[9px] font-bold text-muted-foreground bg-muted rounded px-1 py-0.5">
              {etiquetaLabel}
            </span>
          )}
        </div>
      </div>

      {/* Row 2: Technical badges */}
      <div className="flex items-center gap-1 flex-wrap mb-1.5">
        {deal.deal_kwp > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-mono bg-secondary/10 text-secondary-foreground rounded px-1 py-0.5">
            <Zap className="h-2.5 w-2.5 text-warning" />
            {deal.deal_kwp.toFixed(2).replace(".", ",")} kWp
          </span>
        )}
        {deal.proposta_economia_mensal && deal.proposta_economia_mensal > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-mono bg-success/10 text-success rounded px-1 py-0.5">
            <TrendingDown className="h-2.5 w-2.5" />
            R$ {deal.proposta_economia_mensal.toFixed(0)}/mês
          </span>
        )}
        {deal.deal_value > 0 && (
          <span className="text-[10px] font-bold font-mono text-primary">
            {formatBRL(deal.deal_value)}
          </span>
        )}
      </div>

      {/* Row 3: Time in stage + location */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
        <span className={cn(
          "flex items-center gap-0.5",
          stagnation === "critical" && "text-destructive font-semibold",
          stagnation === "warning" && "text-warning font-semibold"
        )}>
          <Clock className="h-2.5 w-2.5" />
          {timeInStage} na etapa
        </span>
      </div>

      {/* Row 4: Quick actions (hover) */}
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-1.5 text-[10px] text-muted-foreground hover:text-foreground"
              onClick={(e) => { e.stopPropagation(); onClick(); }}
            >
              <FileText className="h-3 w-3 mr-0.5" />
              Proposta
            </Button>
          </TooltipTrigger>
          <TooltipContent className="text-xs">Ver propostas</TooltipContent>
        </Tooltip>
        {deal.customer_phone && (
          <>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="default"
                  size="sm"
                  className="h-6 px-1.5 text-[10px]"
                  onClick={handleSendWhatsApp}
                >
                  <MessageSquare className="h-3 w-3 mr-0.5" />
                  WhatsApp
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Enviar WhatsApp</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 text-muted-foreground hover:text-foreground"
                  onClick={handleCall}
                >
                  <Phone className="h-3 w-3" />
                </Button>
              </TooltipTrigger>
              <TooltipContent className="text-xs">Ligar</TooltipContent>
            </Tooltip>
          </>
        )}
      </div>
    </div>
  );
}
