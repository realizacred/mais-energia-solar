import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Plus, X, Check, ChevronDown, ChevronRight, Trash2, Loader2, GripVertical
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { useUserFunnelOrder } from "@/hooks/useUserFunnelOrder";
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  horizontalListSortingStrategy,
  useSortable,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

// Aba arrastável de pipeline (funil) no detalhe do projeto.
function SortablePipelineTab({
  membershipId,
  pipelineName,
  active,
  onSelect,
}: {
  membershipId: string;
  pipelineName: string;
  active: boolean;
  onSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: membershipId });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.6 : 1,
    zIndex: isDragging ? 20 : undefined,
  };
  return (
    <div ref={setNodeRef} style={style} className="flex items-center shrink-0">
      <button
        type="button"
        aria-label="Arrastar para reordenar"
        className="p-1 -mr-1 cursor-grab active:cursor-grabbing text-muted-foreground/60 hover:text-foreground touch-none"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="h-3 w-3" />
      </button>
      <button
        onClick={onSelect}
        className={cn(
          "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
          active
            ? "bg-secondary/10 text-secondary border border-secondary/30 shadow-sm"
            : "bg-muted/40 text-muted-foreground hover:bg-muted/80 border border-transparent",
        )}
      >
        {pipelineName}
      </button>
    </div>
  );
}

interface PipelineInfo {
  id: string;
  name: string;
}

interface StageInfo {
  id: string;
  name: string;
  position: number;
  is_closed: boolean;
  is_won: boolean;
  probability: number;
}

interface DealPipelineMembership {
  id: string;
  pipeline_id: string;
  stage_id: string;
  pipeline_name: string;
  stage_name: string;
}

interface Props {
  dealId: string;
  dealStatus?: string;
  pipelines: PipelineInfo[];
  allStagesMap: Map<string, StageInfo[]>;
  onMembershipChange?: () => void;
  /** ID do pipeline a selecionar por default (ex: quando vem do kanban) */
  initialPipelineId?: string;
  /** Nome do funil selecionado no kanban, usado quando IDs não batem */
  initialPipelineName?: string;
}

export function ProjetoMultiPipelineManager({ dealId, dealStatus, pipelines, allStagesMap, onMembershipChange, initialPipelineId, initialPipelineName }: Props) {
  const isLocked = dealStatus === "lost" || dealStatus === "won";
  const [memberships, setMemberships] = useState<DealPipelineMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [activePipelineId, setActivePipelineId] = useState<string | null>(initialPipelineId || null);
  const [expandedPipeline, setExpandedPipeline] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  // Load memberships
  const fetchMemberships = async () => {
    const { data } = await supabase
      .from("deal_pipeline_stages")
      .select("id, pipeline_id, stage_id")
      .eq("deal_id", dealId);

    if (data) {
      const mapped: DealPipelineMembership[] = (data as any[]).map(m => {
        const pipeline = pipelines.find(p => p.id === m.pipeline_id);
        const stages = allStagesMap.get(m.pipeline_id) || [];
        const stage = stages.find(s => s.id === m.stage_id);
        return {
          id: m.id,
          pipeline_id: m.pipeline_id,
          stage_id: m.stage_id,
          pipeline_name: pipeline?.name || "—",
          stage_name: stage?.name || "—",
        };
      });
      setMemberships(mapped);
    }
    setLoading(false);
  };

  useEffect(() => { fetchMemberships(); }, [dealId, pipelines.length]);

  // Auto-select first pipeline tab when memberships load
  useEffect(() => {
    if (memberships.length === 0) return;

    const hasCurrent = activePipelineId && memberships.some(m => m.pipeline_id === activePipelineId);
    if (hasCurrent) return;

    const normalizedInitialName = (initialPipelineName || "").trim().toLowerCase();
    const byId = initialPipelineId && memberships.find(m => m.pipeline_id === initialPipelineId)?.pipeline_id;
    const byName = normalizedInitialName
      ? memberships.find(m => m.pipeline_name.trim().toLowerCase() === normalizedInitialName)?.pipeline_id
      : null;

    setActivePipelineId(byId || byName || memberships[0].pipeline_id);
  }, [memberships, activePipelineId, initialPipelineId, initialPipelineName]);

  // Ordem: (1) canônica via pipelines.position (ordem exibida na aba Projetos),
  // (2) sobrescrita pela preferência pessoal do usuário via drag-and-drop.
  const { sortByUserOrder, setOrder } = useUserFunnelOrder("deal-pipelines");
  const pipelineOrderIndex = useMemo(() => {
    const m = new Map<string, number>();
    pipelines.forEach((p, i) => m.set(p.id, i));
    return m;
  }, [pipelines]);
  const orderedMemberships = useMemo(() => {
    const canonical = [...memberships].sort((a, b) => {
      const pa = pipelineOrderIndex.get(a.pipeline_id) ?? Number.POSITIVE_INFINITY;
      const pb = pipelineOrderIndex.get(b.pipeline_id) ?? Number.POSITIVE_INFINITY;
      return pa - pb;
    });
    // sortByUserOrder usa `id`; para pipelines, chave estável é pipeline_id.
    return sortByUserOrder(canonical.map((m) => ({ ...m, id: m.pipeline_id }))) as typeof canonical;
  }, [memberships, pipelineOrderIndex, sortByUserOrder]);

  const activeMembership = orderedMemberships.find(m => m.pipeline_id === activePipelineId) || null;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  );
  const handleTabDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const ids = orderedMemberships.map((m) => m.pipeline_id);
    const oldIndex = ids.indexOf(String(active.id));
    const newIndex = ids.indexOf(String(over.id));
    if (oldIndex < 0 || newIndex < 0) return;
    setOrder(arrayMove(ids, oldIndex, newIndex));
  };

  const availablePipelines = useMemo(() =>
    pipelines.filter(p => !memberships.some(m => m.pipeline_id === p.id)),
    [pipelines, memberships]
  );

  const addToPipeline = async (pipelineId: string, stageId: string) => {
    if (isLocked) { toast({ title: "Projeto bloqueado", description: "Não é possível alterar funis de um projeto ganho/perdido.", variant: "destructive" }); return; }
    setSaving(pipelineId);
    try {
      const { error } = await supabase.from("deal_pipeline_stages").insert({
        deal_id: dealId,
        pipeline_id: pipelineId,
        stage_id: stageId,
      } as any);
      if (error) throw error;
      toast({ title: "Projeto adicionado ao funil" });
      await fetchMemberships();
      onMembershipChange?.();
      setExpandedPipeline(null);
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const changeStage = async (membershipId: string, newStageId: string) => {
    if (isLocked) { toast({ title: "Projeto bloqueado", description: "Não é possível alterar etapas de um projeto ganho/perdido.", variant: "destructive" }); return; }
    setSaving(membershipId);
    try {
      const { error } = await supabase
        .from("deal_pipeline_stages")
        .update({ stage_id: newStageId })
        .eq("id", membershipId);
      if (error) throw error;
      toast({ title: "Etapa atualizada" });
      await fetchMemberships();
      onMembershipChange?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  const removeFromPipeline = async (membershipId: string) => {
    if (isLocked) { toast({ title: "Projeto bloqueado", description: "Não é possível remover funis de um projeto ganho/perdido.", variant: "destructive" }); return; }
    setSaving(membershipId);
    try {
      const { error } = await supabase
        .from("deal_pipeline_stages")
        .delete()
        .eq("id", membershipId);
      if (error) throw error;
      toast({ title: "Removido do funil" });
      await fetchMemberships();
      onMembershipChange?.();
    } catch (err: any) {
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        <span className="text-xs text-muted-foreground">Carregando funis...</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Layers className="h-4 w-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            Funis do Projeto
          </span>
          <Badge variant="secondary" className="text-[10px] h-5 px-1.5">
            {memberships.length}
          </Badge>
        </div>

        {/* Add to pipeline popover */}
        {availablePipelines.length > 0 && (
          <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
            <PopoverTrigger asChild>
              <Button variant="default" size="sm" className="h-7 text-xs gap-1">
                <Plus className="h-3 w-3" />
                Adicionar a funil
              </Button>
            </PopoverTrigger>
            <PopoverContent align="end" className="w-72 p-0">
              <div className="p-3 border-b border-border/40">
                <p className="text-sm font-medium">Adicionar a um funil</p>
                <p className="text-xs text-muted-foreground mt-0.5">Selecione o funil e a etapa inicial</p>
              </div>
              <div className="max-h-64 overflow-y-auto p-1">
                {availablePipelines.map(pipeline => {
                  const pStages = (allStagesMap.get(pipeline.id) || []).sort((a, b) => a.position - b.position);
                  const isExpanded = expandedPipeline === pipeline.id;
                  return (
                    <div key={pipeline.id}>
                      <button
                        onClick={() => setExpandedPipeline(isExpanded ? null : pipeline.id)}
                        className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-muted/50 rounded-md transition-colors"
                      >
                        <span className="font-medium">{pipeline.name}</span>
                        <ChevronRight className={cn("h-3.5 w-3.5 text-muted-foreground transition-transform", isExpanded && "rotate-90")} />
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.15 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 pr-2 pb-1 space-y-0.5">
                              {pStages.map(stage => (
                                <button
                                  key={stage.id}
                                  onClick={() => addToPipeline(pipeline.id, stage.id)}
                                  disabled={saving === pipeline.id}
                                  className="w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-primary/5 rounded-md transition-colors text-left disabled:opacity-50"
                                >
                                  {saving === pipeline.id ? (
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                  ) : (
                                    <div className={cn(
                                      "w-2 h-2 rounded-full shrink-0",
                                      stage.is_won ? "bg-success" : stage.is_closed ? "bg-destructive" : "bg-info"
                                    )} />
                                  )}
                                  <span>{stage.name}</span>
                                  <span className="text-muted-foreground ml-auto">{stage.probability}%</span>
                                </button>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            </PopoverContent>
          </Popover>
        )}
      </div>

      {/* Tabs for pipeline memberships */}
      {memberships.length > 0 && (
        <div className="space-y-2">
          {/* Tab bar — ordem canônica (pipelines.position) sobrescrita por preferência pessoal */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleTabDragEnd}>
            <SortableContext
              items={orderedMemberships.map((m) => m.pipeline_id)}
              strategy={horizontalListSortingStrategy}
            >
              <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
                {orderedMemberships.map((membership) => (
                  <SortablePipelineTab
                    key={membership.id}
                    membershipId={membership.pipeline_id}
                    pipelineName={membership.pipeline_name}
                    active={activePipelineId === membership.pipeline_id}
                    onSelect={() => setActivePipelineId(membership.pipeline_id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          {/* Active pipeline stepper */}
          {activeMembership && (() => {
            const allPStages = (allStagesMap.get(activeMembership.pipeline_id) || []).sort((a, b) => a.position - b.position);
            // Separate linear stages from terminal "lost" stages (is_closed && !is_won)
            const linearStages = allPStages.filter(s => !(s.is_closed && !s.is_won));
            const terminalLostStages = allPStages.filter(s => s.is_closed && !s.is_won);
            const currentLinearIndex = linearStages.findIndex(s => s.id === activeMembership.stage_id);
            const isOnTerminal = terminalLostStages.some(s => s.id === activeMembership.stage_id);
            const isComercial = activeMembership.pipeline_name.toLowerCase() === "comercial";

            return (
              <div className="rounded-xl border border-border/60 bg-card p-3 space-y-2 min-h-[100px]">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground">{activeMembership.pipeline_name}</span>
                  {!isComercial && (
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => removeFromPipeline(activeMembership.id)}
                          disabled={saving === activeMembership.id || isLocked}
                        >
                          {saving === activeMembership.id ? (
                            <Loader2 className="h-3 w-3 animate-spin" />
                          ) : (
                            <X className="h-3 w-3" />
                          )}
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent side="left" className="text-xs">
                        Remover deste funil
                      </TooltipContent>
                    </Tooltip>
                  )}
                </div>

                {/* Mini stepper — linear stages only */}
                <div className="relative pt-1">
                  <div className="absolute top-[14px] left-0 right-0 h-0.5 bg-border rounded-full" />
                  {linearStages.length > 1 && !isOnTerminal && currentLinearIndex >= 0 && (
                    <motion.div
                      className="absolute top-[14px] left-0 h-0.5 bg-success rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${(currentLinearIndex / (linearStages.length - 1)) * 100}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  )}
                  <div className="relative flex justify-between">
                    {linearStages.map((stage, i) => {
                      const isPast = !isOnTerminal && i < currentLinearIndex;
                      const isCurrent = !isOnTerminal && i === currentLinearIndex;
                      const isFuture = isOnTerminal || i > currentLinearIndex;

                      return (
                        <Tooltip key={stage.id}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                if (stage.id !== activeMembership.stage_id) {
                                  changeStage(activeMembership.id, stage.id);
                                }
                              }}
                              className="flex flex-col items-center z-10 group cursor-pointer gap-1"
                            >
                              <motion.div
                                className={cn(
                                  "w-4 h-4 rounded-full border-2 flex items-center justify-center transition-all",
                                  isPast && "bg-success border-success",
                                  isCurrent && "bg-secondary border-secondary ring-2 ring-secondary/30 ring-offset-1 ring-offset-card",
                                  isFuture && "bg-card border-border",
                                  !isCurrent && "group-hover:ring-1 group-hover:ring-primary/20"
                                )}
                                animate={{ scale: isCurrent ? 1.15 : 1 }}
                                transition={{ duration: 0.3 }}
                              >
                                {isPast && <Check className="h-2.5 w-2.5 text-success-foreground" />}
                              </motion.div>
                              <span className={cn(
                                "text-[9px] font-medium max-w-[60px] text-center leading-tight",
                                isPast && "text-success",
                                isCurrent && "text-secondary font-bold",
                                isFuture && "text-muted-foreground"
                              )}>
                                {stage.name}
                              </span>
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {stage.name} • {stage.probability}%
                            {isCurrent && " (atual)"}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                </div>

                {/* Terminal stages (e.g. "Perdido") — shown separately below the line */}
                {terminalLostStages.length > 0 && (
                  <div className="flex items-center gap-2 pt-1">
                    {terminalLostStages.map(stage => {
                      const isCurrent = stage.id === activeMembership.stage_id;
                      return (
                        <Tooltip key={stage.id}>
                          <TooltipTrigger asChild>
                            <button
                              onClick={() => {
                                if (stage.id !== activeMembership.stage_id) {
                                  changeStage(activeMembership.id, stage.id);
                                }
                              }}
                              className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[9px] font-medium border transition-all cursor-pointer",
                                isCurrent
                                  ? "bg-destructive/10 text-destructive border-destructive/30"
                                  : "bg-muted/40 text-muted-foreground border-border hover:bg-destructive/5 hover:text-destructive"
                              )}
                            >
                              <X className="h-2.5 w-2.5" />
                              {stage.name}
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" className="text-xs">
                            {stage.name} • {stage.probability}%
                            {isCurrent && " (atual)"}
                          </TooltipContent>
                        </Tooltip>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
