import { formatBRLCompact as formatBRL } from "@/lib/formatters";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Zap, Plus, Settings2, Clock, Eye, Workflow, Lock, Palette, ChevronDown, DollarSign, Filter, Search } from "lucide-react";
import type { DealKanbanCard, PipelineStage } from "@/hooks/useDealPipeline";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuLabel, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ProjetoAutomacaoConfig } from "./ProjetoAutomacaoConfig";
import { StageDealCard } from "./StageDealCard";
import { differenceInHours } from "date-fns";

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

interface DynamicEtiqueta {
  id: string;
  nome: string;
  cor: string;
  grupo: string;
  short: string | null;
  icon: string | null;
}

interface NewProjectContext {
  pipelineId?: string;
  stageId?: string;
  stageName?: string;
  consultorId?: string;
}

interface Props {
  stages: PipelineStage[];
  deals: DealKanbanCard[];
  onMoveToStage: (dealId: string, stageId: string) => void;
  onViewProjeto?: (deal: DealKanbanCard) => void;
  onNewProject?: (ctx?: NewProjectContext) => void;
  dynamicEtiquetas?: DynamicEtiqueta[];
  pipelineName?: string;
}

const formatKwp = (v: number) => {
  if (!v) return "0 kWp";
  return `${v.toFixed(1).replace(".", ",")} kWp`;
};

// ─── Resizable column hook ─────────────────────
function useResizableColumn(initialWidth: number, minWidth = 260, maxWidth = 500) {
  const [width, setWidth] = useState(initialWidth);
  const isResizing = useRef(false);
  const startX = useRef(0);
  const startWidth = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    isResizing.current = true;
    startX.current = e.clientX;
    startWidth.current = width;

    const onMouseMove = (moveEvent: MouseEvent) => {
      if (!isResizing.current) return;
      const delta = moveEvent.clientX - startX.current;
      const newWidth = Math.min(maxWidth, Math.max(minWidth, startWidth.current + delta));
      setWidth(newWidth);
    };

    const onMouseUp = () => {
      isResizing.current = false;
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [width, minWidth, maxWidth]);

  return { width, onMouseDown };
}

export function ProjetoKanbanStage({ stages, deals, onMoveToStage, onViewProjeto, onNewProject, dynamicEtiquetas = [], pipelineName }: Props) {
  const isMobile = useIsMobile();
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const [automations, setAutomations] = useState<AutomationRule[]>([]);
  const [automationDialogStageId, setAutomationDialogStageId] = useState<string | null>(null);
  const [stagePermissions, setStagePermissions] = useState<Map<string, string>>(new Map());
  // Mobile filters
  const [mobileSearch, setMobileSearch] = useState("");
  const [mobileFilterStatus, setMobileFilterStatus] = useState<string>("all");

  // Fetch automations
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

  // Fetch stage permissions
  useEffect(() => {
    const stageIds = stages.map(s => s.id);
    if (stageIds.length === 0) return;
    supabase
      .from("pipeline_stage_permissions")
      .select("stage_id, restricao_tipo")
      .in("stage_id", stageIds)
      .then(({ data }) => {
        const map = new Map<string, string>();
        (data || []).forEach((p: any) => map.set(p.stage_id, p.restricao_tipo));
        setStagePermissions(map);
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

  const dealCountsByStage = useMemo(() => {
    const map = new Map<string, number>();
    deals.forEach(d => map.set(d.stage_id, (map.get(d.stage_id) || 0) + 1));
    return map;
  }, [deals]);

  const dealKwpByStage = useMemo(() => {
    const map = new Map<string, number>();
    deals.forEach(d => map.set(d.stage_id, (map.get(d.stage_id) || 0) + (d.deal_kwp || 0)));
    return map;
  }, [deals]);

  const dealValueByStage = useMemo(() => {
    const map = new Map<string, number>();
    deals.forEach(d => map.set(d.stage_id, (map.get(d.stage_id) || 0) + (d.deal_value || 0)));
    return map;
  }, [deals]);

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

  // ── Mobile List View with Filters ──
  if (isMobile) {
    const filteredDeals = deals.filter(d => {
      if (mobileSearch) {
        const q = mobileSearch.toLowerCase();
        const matchesName = (d.customer_name || "").toLowerCase().includes(q);
        const matchesTitle = (d.deal_title || "").toLowerCase().includes(q);
        if (!matchesName && !matchesTitle) return false;
      }
      if (mobileFilterStatus !== "all") {
        if (mobileFilterStatus === "overdue") {
          const hours = differenceInHours(new Date(), new Date(d.last_stage_change));
          if (hours < 72) return false;
        } else if (mobileFilterStatus === "proposta") {
          if (!d.proposta_status) return false;
        }
      }
      return true;
    });

    return (
      <>
        {/* Mobile Filters */}
        <div className="px-2 pb-3 space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              placeholder="Buscar cliente..."
              value={mobileSearch}
              onChange={(e) => setMobileSearch(e.target.value)}
              className="h-9 pl-9 text-xs"
            />
          </div>
          <div className="flex gap-1.5 overflow-x-auto pb-1">
            {[
              { key: "all", label: "Todos" },
              { key: "overdue", label: "⚠ Atrasados" },
              { key: "proposta", label: "📄 C/ Proposta" },
            ].map(f => (
              <button
                key={f.key}
                onClick={() => setMobileFilterStatus(f.key)}
                className={cn(
                  "shrink-0 px-3 py-1.5 rounded-full text-[11px] font-medium border transition-colors",
                  mobileFilterStatus === f.key
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border/60 hover:border-border"
                )}
              >
                {f.label}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 px-1">
          {sortedStages.map(stage => {
            const stageDeals = filteredDeals.filter(d => d.stage_id === stage.id);
            const totalValue = stageDeals.reduce((s, d) => s + (d.deal_value || 0), 0);
            const totalKwp = stageDeals.reduce((s, d) => s + (d.deal_kwp || 0), 0);
            const stageAutomations = automationsByStage.get(stage.id) || [];
            const hasActiveAutomation = stageAutomations.length > 0;
            const overdueCount = stageDeals.filter(d => differenceInHours(new Date(), new Date(d.last_stage_change)) >= 72).length;

            if (mobileSearch && stageDeals.length === 0) return null;

            return (
              <Collapsible key={stage.id} defaultOpen={stageDeals.length > 0}>
                <CollapsibleTrigger asChild>
                  <button className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-border/60 bg-card hover:bg-muted/30 transition-colors">
                    <div className="flex items-center gap-2 min-w-0">
                      <h3 className="text-sm font-bold text-foreground truncate">{stage.name}</h3>
                      <Badge variant="outline" className="text-[10px] h-5 font-semibold rounded-lg">
                        {stageDeals.length}
                      </Badge>
                      {overdueCount > 0 && (
                        <Badge variant="destructive" className="text-[9px] h-4 px-1.5 font-bold rounded-full">
                          {overdueCount} ⚠
                        </Badge>
                      )}
                      {hasActiveAutomation && <Zap className="h-3 w-3 text-primary animate-pulse shrink-0" />}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        <span className="text-[11px] font-mono font-semibold text-foreground">{formatBRL(totalValue)}</span>
                        {totalKwp > 0 && (
                          <span className="text-[10px] font-mono text-muted-foreground ml-2">{formatKwp(totalKwp)}</span>
                        )}
                      </div>
                      <ChevronDown className="h-4 w-4 text-muted-foreground transition-transform [[data-state=open]>&]:rotate-180" />
                    </div>
                  </button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 pt-2 pb-1">
                    {stageDeals.length === 0 ? (
                      <p className="text-xs text-muted-foreground/50 italic text-center py-4">Nenhum projeto nesta etapa</p>
                    ) : (
                      stageDeals.map(deal => (
                        <StageDealCard
                          key={deal.deal_id}
                          deal={deal}
                          isDragging={false}
                          onDragStart={() => {}}
                          onClick={() => onViewProjeto?.(deal)}
                          hasAutomation={hasActiveAutomation}
                          dynamicEtiquetas={dynamicEtiquetas}
                        />
                      ))
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full h-8 text-xs font-medium border-dashed border-primary/40 text-primary hover:bg-primary/5"
                      onClick={() => onNewProject?.({
                        pipelineId: stage.pipeline_id,
                        stageId: stage.id,
                        stageName: stage.name,
                      })}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" />
                      Novo projeto
                    </Button>
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>

        {/* Automation Config Dialog */}
        <AutomationDialog
          stageId={automationDialogStageId}
          pipelineId={pipelineId}
          sortedStages={sortedStages}
          getStageNameById={getStageNameById}
          onClose={() => setAutomationDialogStageId(null)}
        />
      </>
    );
  }

  // ── Desktop Kanban View with Resizable Columns ──
  return (
    <>
      <ScrollArea className="w-full">
        <div className="flex gap-4 pb-4 px-1" style={{ minWidth: "max-content" }}>
          {sortedStages.map(stage => (
            <ResizableKanbanColumn
              key={stage.id}
              stage={stage}
              deals={deals.filter(d => d.stage_id === stage.id)}
              totalValue={dealValueByStage.get(stage.id) || 0}
              totalKwp={dealKwpByStage.get(stage.id) || 0}
              count={dealCountsByStage.get(stage.id) || 0}
              isOver={dragOverCol === stage.id}
              stageAutomations={automationsByStage.get(stage.id) || []}
              permission={stagePermissions.get(stage.id)}
              draggedId={draggedId}
              onDragOver={(stageId) => setDragOverCol(stageId)}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={(e, stageId) => handleDrop(e, stageId)}
              onDragStart={handleDragStart}
              onViewProjeto={onViewProjeto}
              onNewProject={onNewProject}
              onAutomationConfig={(stageId) => setAutomationDialogStageId(stageId)}
              getStageNameById={getStageNameById}
              dynamicEtiquetas={dynamicEtiquetas}
            />
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      <AutomationDialog
        stageId={automationDialogStageId}
        pipelineId={pipelineId}
        sortedStages={sortedStages}
        getStageNameById={getStageNameById}
        onClose={() => setAutomationDialogStageId(null)}
      />
    </>
  );
}

// ── Resizable Kanban Column ───────────────────────────
interface ResizableKanbanColumnProps {
  stage: PipelineStage;
  deals: DealKanbanCard[];
  totalValue: number;
  totalKwp: number;
  count: number;
  isOver: boolean;
  stageAutomations: AutomationRule[];
  permission?: string;
  draggedId: string | null;
  onDragOver: (stageId: string) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, stageId: string) => void;
  onDragStart: (e: React.DragEvent, dealId: string) => void;
  onViewProjeto?: (deal: DealKanbanCard) => void;
  onNewProject?: (ctx?: NewProjectContext) => void;
  onAutomationConfig: (stageId: string) => void;
  getStageNameById: (id: string | null) => string;
  dynamicEtiquetas: DynamicEtiqueta[];
}

function ResizableKanbanColumn({
  stage, deals, totalValue, totalKwp, count, isOver,
  stageAutomations, permission, draggedId,
  onDragOver, onDragLeave, onDrop, onDragStart,
  onViewProjeto, onNewProject, onAutomationConfig,
  getStageNameById, dynamicEtiquetas,
}: ResizableKanbanColumnProps) {
  const { width, onMouseDown } = useResizableColumn(310);
  const hasActiveAutomation = stageAutomations.length > 0;
  const hasRestriction = permission && permission !== "todos";

  const overdueCount = useMemo(() => {
    return deals.filter(d => differenceInHours(new Date(), new Date(d.last_stage_change)) >= 72).length;
  }, [deals]);

  return (
    <div
      className={cn(
        "flex-shrink-0 rounded-xl border border-border/60 transition-all flex flex-col relative",
        "bg-surface-2",
        isOver && "ring-2 ring-primary/30 bg-primary/5"
      )}
      style={{ width }}
      onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(stage.id); }}
      onDragLeave={() => onDragLeave()}
      onDrop={e => onDrop(e, stage.id)}
    >
      {/* Resize Handle */}
      <div
        className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize z-10 hover:bg-primary/20 active:bg-primary/30 transition-colors rounded-r-xl"
        onMouseDown={onMouseDown}
      />

      {/* ── Column Header ── */}
      <div className="px-3 pt-3 pb-2 border-b-2 border-primary/20">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2 min-w-0">
            <h3 className="text-[11px] font-bold text-secondary leading-tight truncate uppercase tracking-wider">
              {stage.name}
            </h3>
            {hasActiveAutomation && (
              <Tooltip>
                <TooltipTrigger>
                  <Zap className="h-3 w-3 text-primary animate-pulse shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {stageAutomations.length} automação(ões) ativa(s)
                </TooltipContent>
              </Tooltip>
            )}
            {hasRestriction && (
              <Tooltip>
                <TooltipTrigger>
                  <Lock className="h-3 w-3 text-warning shrink-0" />
                </TooltipTrigger>
                <TooltipContent className="text-xs">
                  {permission === "apenas_responsavel" ? "Apenas o consultor pode mover" : "Restrito por papel"}
                </TooltipContent>
              </Tooltip>
            )}
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0">
                <Settings2 className="h-3 w-3" />
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
                onClick={() => onAutomationConfig(stage.id)}
              >
                <Zap className="h-3.5 w-3.5" />
                Configurar Automação
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="text-xs gap-2">
                <Lock className="h-3.5 w-3.5" />
                Permissões da etapa
              </DropdownMenuItem>
              <DropdownMenuItem disabled className="text-xs gap-2">
                <Workflow className="h-3.5 w-3.5" />
                Construtor de Fluxos
                <Badge variant="outline" className="text-[8px] h-4 px-1 ml-auto">BETA</Badge>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* ── Metrics row ── */}
        <div className="flex items-center gap-2.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5 font-bold text-[11px] font-mono text-success">
            <DollarSign className="h-3 w-3" />
            {formatBRL(totalValue)}
          </span>
          {totalKwp > 0 && (
            <span className="flex items-center gap-0.5 font-mono font-bold text-info text-[11px]">
              <Zap className="h-3 w-3" />
              {formatKwp(totalKwp)}
            </span>
          )}
          <Badge variant="secondary" className="text-[9px] h-4 px-1.5 font-bold ml-auto rounded-full bg-primary/10 text-primary border-0">
            {count}
          </Badge>
          {overdueCount > 0 && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1.5 font-bold rounded-full">
              {overdueCount} ⚠
            </Badge>
          )}
        </div>
      </div>

      {/* ── New Project Button ── */}
      <div className="px-2.5 py-1.5">
        <button
          onClick={() => onNewProject?.({
            pipelineId: stage.pipeline_id,
            stageId: stage.id,
            stageName: stage.name,
          })}
          className={cn(
            "w-full h-7 rounded-lg border border-primary/40",
            "flex items-center justify-center gap-1.5",
            "text-[10px] font-semibold text-primary",
            "hover:bg-primary hover:text-primary-foreground hover:border-primary",
            "transition-all duration-200"
          )}
        >
          <Plus className="h-3 w-3" />
          Novo projeto
        </button>
      </div>

      {/* ── Cards ── */}
      <div className="px-2.5 pb-2.5 min-h-[80px] space-y-2.5 flex-1 overflow-y-auto">
        {deals.length === 0 && (
          <div className="flex items-center justify-center h-16 text-xs text-muted-foreground/40 italic">
            Arraste projetos aqui
          </div>
        )}
        {deals.map(deal => (
          <StageDealCard
            key={deal.deal_id}
            deal={deal}
            isDragging={draggedId === deal.deal_id}
            onDragStart={onDragStart}
            onClick={() => onViewProjeto?.(deal)}
            hasAutomation={hasActiveAutomation}
            dynamicEtiquetas={dynamicEtiquetas}
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
}

// ── Automation Dialog (shared) ──────────────────────────
function AutomationDialog({ stageId, pipelineId, sortedStages, getStageNameById, onClose }: {
  stageId: string | null;
  pipelineId?: string;
  sortedStages: PipelineStage[];
  getStageNameById: (id: string | null) => string;
  onClose: () => void;
}) {
  if (!stageId || !pipelineId) return null;
  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader className="pb-2 border-b border-border/40">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="h-4 w-4 text-primary" />
            Automações — {getStageNameById(stageId)}
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
  );
}
