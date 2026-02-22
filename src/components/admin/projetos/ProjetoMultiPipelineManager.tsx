import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Layers, Plus, X, Check, ChevronDown, ChevronRight, Trash2, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

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
}

export function ProjetoMultiPipelineManager({ dealId, dealStatus, pipelines, allStagesMap, onMembershipChange, initialPipelineId }: Props) {
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
    if (memberships.length > 0 && !activePipelineId) {
      const initial = initialPipelineId && memberships.some(m => m.pipeline_id === initialPipelineId)
        ? initialPipelineId
        : memberships[0].pipeline_id;
      setActivePipelineId(initial);
    }
  }, [memberships, initialPipelineId]);

  const activeMembership = memberships.find(m => m.pipeline_id === activePipelineId) || null;

  const availablePipelines = useMemo(() =>
    pipelines.filter(p => !memberships.some(m => m.pipeline_id === p.id)),
    [pipelines, memberships]
  );

  const addToPipeline = async (pipelineId: string, stageId: string) => {
    if (isLocked) { toast({ title: "Projeto fechado", description: "Não é possível alterar funis de um projeto ganho/perdido.", variant: "destructive" }); return; }
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
    if (isLocked) { toast({ title: "Projeto fechado", description: "Não é possível alterar etapas de um projeto ganho/perdido.", variant: "destructive" }); return; }
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
    if (isLocked) { toast({ title: "Projeto fechado", description: "Não é possível remover funis de um projeto ganho/perdido.", variant: "destructive" }); return; }
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
              <Button variant="outline" size="sm" className="h-7 text-xs gap-1">
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
          {/* Tab bar */}
          <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
            {memberships.map(membership => (
              <button
                key={membership.id}
                onClick={() => setActivePipelineId(membership.pipeline_id)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all whitespace-nowrap",
                  activePipelineId === membership.pipeline_id
                    ? "bg-secondary/10 text-secondary border border-secondary/30 shadow-sm"
                    : "bg-muted/40 text-muted-foreground hover:bg-muted/80 border border-transparent"
                )}
              >
                {membership.pipeline_name}
                <Badge variant="outline" className="text-[9px] h-4 px-1 border-current/20">
                  {membership.stage_name}
                </Badge>
              </button>
            ))}
          </div>

          {/* Active pipeline stepper */}
          {activeMembership && (() => {
            const pStages = (allStagesMap.get(activeMembership.pipeline_id) || []).sort((a, b) => a.position - b.position);
            const currentIndex = pStages.findIndex(s => s.id === activeMembership.stage_id);
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

                {/* Mini stepper */}
                <div className="relative pt-1">
                  <div className="absolute top-[14px] left-0 right-0 h-0.5 bg-border rounded-full" />
                  {pStages.length > 1 && (
                    <motion.div
                      className="absolute top-[14px] left-0 h-0.5 bg-success rounded-full"
                      initial={{ width: "0%" }}
                      animate={{ width: `${(currentIndex / (pStages.length - 1)) * 100}%` }}
                      transition={{ duration: 0.5, ease: "easeOut" }}
                    />
                  )}
                  <div className="relative flex justify-between">
                    {pStages.map((stage, i) => {
                      const isPast = i < currentIndex;
                      const isCurrent = i === currentIndex;
                      const isFuture = i > currentIndex;

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
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
}
