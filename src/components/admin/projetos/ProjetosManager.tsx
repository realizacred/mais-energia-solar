import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { formatKwp } from "@/lib/formatters/index";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FolderKanban, Zap, DollarSign, LayoutGrid, Plus, BarChart3, Layers, Tag, Info, Users, FileCheck, Download, Clock } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { motion } from "framer-motion";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDealPipeline } from "@/hooks/useDealPipeline";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { StatCard } from "@/components/ui-kit/StatCard";
import { ProjetoFilters } from "./ProjetoFilters";
import { ProjetoKanbanStage } from "./ProjetoKanbanStage";
import { ProjetoKanbanConsultor } from "./ProjetoKanbanConsultor";
import { ProjetoListView } from "./ProjetoListView";
import { ProjetoEtapaManagerDialog } from "./ProjetoEtapaManagerDialog";
import { NovoProjetoModal } from "./NovoProjetoModal";
import { ProjetoDetalhe } from "./ProjetoDetalhe";
import { ProjetoKanbanSkeleton } from "./ProjetoKanbanSkeleton";
import { ProjetoPerformanceDashboard } from "./ProjetoPerformanceDashboard";
import { EtiquetasManager } from "./EtiquetasManager";
import { ProjetoPipelineTemplates } from "./ProjetoPipelineTemplates";
import { cn } from "@/lib/utils";
import { toast as sonnerToast } from "sonner";

interface DynamicEtiqueta {
  id: string;
  nome: string;
  cor: string;
  grupo: string;
  short: string | null;
  icon: string | null;
}

export function ProjetosManager() {
  const { toast } = useToast();
  const {
    pipelines, stages, deals, consultores, loading,
    selectedPipelineId, setSelectedPipelineId,
    filters, applyFilters,
    selectedPipelineStages, ownerColumns,
    consultoresFilter,
    createPipeline, renamePipeline, togglePipelineActive, reorderPipelines,
    createStage, renameStage, updateStageProbability, reorderStages, deleteStage,
    moveDealToOwner, moveDealToStage,
    createDeal, fetchAll,
  } = useDealPipeline();

  const [viewMode, setViewModeRaw] = useState<"kanban-etapa" | "kanban-consultor" | "lista">("kanban-consultor");

  // When switching to "Consultores" view, auto-select all funnels
  const setViewMode = (mode: "kanban-etapa" | "kanban-consultor" | "lista") => {
    setViewModeRaw(mode);
    if (mode === "kanban-consultor") {
      setSelectedPipelineId(null);
      applyFilters({ pipelineId: null });
    }
  };
  const [editingEtapasFunilId, setEditingEtapasFunilId] = useState<string | null>(null);
  const [novoProjetoOpen, setNovoProjetoOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [defaultConsultorId, setDefaultConsultorId] = useState<string | undefined>();
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();
  const [defaultModalPipelineId, setDefaultModalPipelineId] = useState<string | undefined>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedDealId = searchParams.get("projeto") || null;
  const setSelectedDealId = useCallback((id: string | null) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      if (id) {
        next.set("projeto", id);
      } else {
        next.delete("projeto");
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);
  const [activeTab, setActiveTab] = useState<string>("kanban");
  const [dynamicEtiquetas, setDynamicEtiquetas] = useState<DynamicEtiqueta[]>([]);
  const [defaultPipelineApplied, setDefaultPipelineApplied] = useState(false);

  // Persist status filter in sessionStorage
  const STORED_STATUS_KEY = "projetos_filter_status";
  const getStoredStatus = () => {
    try { return sessionStorage.getItem(STORED_STATUS_KEY) || "todos"; } catch { return "todos"; }
  };

  // Apply stored status on mount
  useEffect(() => {
    const stored = getStoredStatus();
    if (stored !== "todos" && filters.status !== stored) {
      applyFilters({ status: stored });
    }
  }, []);

  // Fetch dynamic etiquetas from DB
  useEffect(() => {
    supabase
      .from("projeto_etiquetas")
      .select("id, nome, cor, grupo, short, icon")
      .eq("ativo", true)
      .order("grupo")
      .order("ordem")
      .then(({ data }) => { if (data) setDynamicEtiquetas(data as DynamicEtiqueta[]); });
  }, [activeTab]); // refetch when switching back from etiquetas tab

  const handleFilterChange = (key: string, value: any) => {
    if (key === "pipelineId") {
      const pipelineValue = value === "todos" ? null : value;
      setSelectedPipelineId(pipelineValue);
      
      applyFilters({ pipelineId: pipelineValue });
      // Auto-switch view based on pipeline kind (only when specific pipeline selected)
      // DON'T auto-switch when selecting "todos" — keep current view mode
      if (pipelineValue) {
        const pipeline = pipelines.find(p => p.id === pipelineValue);
        if (pipeline?.kind === "owner_board") {
          setViewMode("kanban-consultor");
        } else if (viewMode === "kanban-consultor" && pipeline?.kind === "process") {
          setViewMode("kanban-etapa");
        }
      }
    } else if (key === "ownerId") {
      applyFilters({ ownerId: value });
    } else if (key === "status") {
      applyFilters({ status: value });
      // Persist status filter
      try { sessionStorage.setItem(STORED_STATUS_KEY, value); } catch { /* ignore */ }
    } else if (key === "search") {
      applyFilters({ search: value });
    }
  };

  // Active pipelines only (inactive ones are filtered by the hook)
  const activePipelines = useMemo(
    () => pipelines.filter(p => p.is_active),
    [pipelines]
  );


  useEffect(() => {
    if (!defaultPipelineApplied && activePipelines.length > 0) {
      // Default: "Todos" os funis (sem filtro de pipeline)
      if (!selectedPipelineId) {
        applyFilters({ pipelineId: null });
      }
      setDefaultPipelineApplied(true);
    }
    if (selectedPipelineId) {
      const current = pipelines.find(p => p.id === selectedPipelineId);
      if (current && !current.is_active) {
        setSelectedPipelineId(null);
        applyFilters({ pipelineId: null });
      }
    }
  }, [pipelines, selectedPipelineId, activePipelines, defaultPipelineApplied]);

  const clearFilters = () => {
    applyFilters({ pipelineId: null, ownerId: "todos", status: "todos", search: "" });
    setSelectedPipelineId(null);
    try { sessionStorage.removeItem(STORED_STATUS_KEY); } catch { /* ignore */ }
  };

  const totalValue = useMemo(() => {
    return deals.reduce((sum, d) => sum + (d.deal_value || 0), 0);
  }, [deals]);

  const totalKwp = useMemo(() => {
    return deals.reduce((sum, d) => sum + (d.deal_kwp || 0), 0);
  }, [deals]);

  const totalPropostasAceitas = useMemo(() => {
    return deals
      .filter(d => d.proposta_status === "aceita" || d.proposta_status === "Gerada")
      .reduce((sum, d) => sum + (d.deal_value || 0), 0);
  }, [deals]);

  const qtdPropostasAceitas = useMemo(() => {
    return deals.filter(d => d.proposta_status === "aceita" || d.proposta_status === "Gerada").length;
  }, [deals]);

  // KPI stats
  const kpiStats = useMemo(() => {
    const now = new Date();
    const emAndamento = deals.filter(d => d.deal_status === "open").length;
    const concluidos = deals.filter(d => d.deal_status === "won").length;
    const atrasados = deals.filter(d => {
      if (d.deal_status === "won" || d.deal_status === "lost") return false;
      const lastChange = new Date(d.last_stage_change);
      const diffDays = (now.getTime() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 7;
    }).length;
    return { total: deals.length, emAndamento, concluidos, atrasados };
  }, [deals]);

  // CSV export
  const handleExportCSV = useCallback(() => {
    if (deals.length === 0) return;
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(/[/:\s]/g, "-");
    const header = ["Projeto", "Cliente", "Consultor", "Status", "Valor", "kWp", "Última Movimentação"];
    const rows = deals.map(d => [
      d.deal_title || "",
      d.customer_name || "",
      d.owner_name || "",
      d.deal_status || "",
      String(d.deal_value || 0),
      String(d.deal_kwp || 0),
      d.last_stage_change ? new Date(d.last_stage_change).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projetos_${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    sonnerToast.success(`${deals.length} projetos exportados`);
  }, [deals]);

  // ── Detail View ──
   if (selectedDealId) {
    return (
      <ProjetoDetalhe
        dealId={selectedDealId}
        onBack={() => { setSelectedDealId(null); fetchAll(); }}
        initialPipelineId={selectedPipelineId || undefined}
      />
    );
  }

  return (
    <motion.div className="space-y-4 max-w-full overflow-x-hidden" initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      <PageHeader
        icon={FolderKanban}
        title="Projetos"
        description="Acompanhe cada projeto da documentação à vistoria"
        actions={
          <div className="flex items-center gap-2">
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={deals.length === 0}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Exportar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar projetos filtrados em CSV</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => { setDefaultConsultorId(undefined); setDefaultStageId(undefined); setDefaultModalPipelineId(undefined); setNovoProjetoOpen(true); }}
                  className="gap-1.5 font-semibold"
                >
                  <Plus className="h-4 w-4" />
                  Novo Projeto
                </Button>
              </TooltipTrigger>
              <TooltipContent>Criar novo projeto de instalação</TooltipContent>
            </Tooltip>
          </div>
        }
      />

      {/* KPI mini-chips — rendered inline with TabsList below */}

      {/* ── Novo Projeto Modal ── */}
      <NovoProjetoModal
        open={novoProjetoOpen}
        onOpenChange={setNovoProjetoOpen}
        consultores={consultoresFilter}
        defaultConsultorId={defaultConsultorId}
        defaultPipelineId={defaultModalPipelineId || selectedPipelineId || pipelines[0]?.id}
        defaultStageId={defaultStageId}
        pipelines={activePipelines.map(p => ({ id: p.id, name: p.name }))}
        stages={stages.map(s => ({ id: s.id, name: s.name, pipeline_id: s.pipeline_id, position: s.position, is_closed: s.is_closed }))}
        dynamicEtiquetas={dynamicEtiquetas.map(e => ({ id: e.id, nome: e.nome, cor: e.cor }))}
        onSubmit={async (data) => {
          const customerId = data.clienteId;
          if (!customerId) {
            toast({ title: "Erro", description: "Selecione um cliente.", variant: "destructive" });
            return;
          }

          const result = await createDeal({
            title: data.nome,
            ownerId: data.consultorId || undefined,
            pipelineId: data.pipelineId,
            stageId: data.stageId,
            customerId,
            value: data.valor,
          });

          if (result?.id) {
            setSelectedDealId(result.id);
          }
        }}
      />

      {/* ── Main Tabs: Funil + Performance ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <TabsList className="bg-muted/50 border border-border/40">
            <TabsTrigger value="kanban" className="gap-1.5 text-xs">
              <Layers className="h-4 w-4" />
              <span className="hidden sm:inline">Funil</span>
            </TabsTrigger>
            <TabsTrigger value="performance" className="gap-1.5 text-xs">
              <BarChart3 className="h-4 w-4" />
              <span className="hidden sm:inline">Performance</span>
            </TabsTrigger>
            <TabsTrigger value="etiquetas" className="gap-1.5 text-xs">
              <Tag className="h-4 w-4" />
              <span className="hidden sm:inline">Etiquetas</span>
            </TabsTrigger>
          </TabsList>

          {/* Mini KPI chips */}
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card text-xs">
              <FolderKanban className="h-3.5 w-3.5 text-primary" />
              <span className="font-bold text-foreground">{kpiStats.total}</span>
              <span className="text-muted-foreground hidden sm:inline">projetos</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card text-xs">
              <Zap className="h-3.5 w-3.5 text-info" />
              <span className="font-bold text-foreground">{kpiStats.emAndamento}</span>
              <span className="text-muted-foreground hidden sm:inline">andamento</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card text-xs">
              <FileCheck className="h-3.5 w-3.5 text-success" />
              <span className="font-bold text-foreground">{kpiStats.concluidos}</span>
              <span className="text-muted-foreground hidden sm:inline">ganhos</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md border border-border bg-card text-xs">
              <Clock className="h-3.5 w-3.5 text-warning" />
              <span className="font-bold text-foreground">{kpiStats.atrasados}</span>
              <span className="text-muted-foreground hidden sm:inline">estagnados</span>
            </div>
          </div>
        </div>

        <TabsContent value="kanban" className="space-y-4 mt-0">
          <div className="flex-1 min-w-0 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              {/* Filters row */}
              <div className="px-4 py-3">
                <ProjetoFilters
                  searchTerm={filters.search}
                  onSearchChange={(v) => handleFilterChange("search", v)}
                  funis={activePipelines.map(p => ({
                    id: p.id,
                    nome: p.name,
                    ordem: 0,
                    ativo: p.is_active,
                    tenant_id: p.tenant_id,
                  }))}
                  filterFunil={filters.pipelineId || selectedPipelineId || (viewMode === "kanban-consultor" ? "todos" : "")}
                  onFilterFunilChange={(v) => handleFilterChange("pipelineId", v)}
                  filterConsultor={filters.ownerId}
                  onFilterConsultorChange={(v) => handleFilterChange("ownerId", v)}
                  consultores={consultoresFilter}
                  filterStatus={filters.status}
                  onFilterStatusChange={(v) => handleFilterChange("status", v)}
                  etiquetas={dynamicEtiquetas.map(e => ({ id: e.id, nome: e.nome, cor: e.cor, tenant_id: "" }))}
                  filterEtiquetas={[]}
                  onFilterEtiquetasChange={() => {}}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onClearFilters={clearFilters}
                  onEditEtapas={(funilId) => setEditingEtapasFunilId(funilId)}
                  onCreateFunil={() => setTemplateDialogOpen(true)}
                  allowAllFunis={viewMode === "kanban-consultor"}
                />
              </div>

              {/* Template dialog for creating new pipelines */}
              <ProjetoPipelineTemplates
                open={templateDialogOpen}
                onOpenChange={setTemplateDialogOpen}
                onCreateFromTemplate={(name, stgs) => createPipeline(name, stgs)}
                onCreateBlank={(name) => createPipeline(name)}
              />

              <Separator className="opacity-60" />

              {/* Etapa Manager Dialog */}
              {editingEtapasFunilId && (
                <ProjetoEtapaManagerDialog
                  pipeline={pipelines.find(p => p.id === editingEtapasFunilId) || null}
                  stages={stages}
                  onClose={() => setEditingEtapasFunilId(null)}
                  onCreateStage={createStage}
                  onRenameStage={renameStage}
                  onReorderStages={reorderStages}
                  onDeleteStage={deleteStage}
                />
              )}

              {/* Summary bar */}
              <div className="px-4 py-2.5 flex items-center justify-between">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground">{deals.length}</span>
                    <span className="text-xs text-muted-foreground">projetos</span>
                  </div>
                  {totalValue > 0 && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-success" />
                      <span className="text-sm font-bold font-mono text-foreground">{formatBRL(totalValue)}</span>
                      <span className="text-xs text-muted-foreground">total</span>
                    </div>
                  )}
                  {totalKwp > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Zap className="h-3.5 w-3.5 text-warning" />
                      <span className="text-sm font-bold font-mono text-foreground">{formatKwp(totalKwp, 1)}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground">{ownerColumns.length}</span>
                    <span className="text-xs text-muted-foreground">consultores</span>
                  </div>
                  {qtdPropostasAceitas > 0 && (
                    <div className="flex items-center gap-1.5">
                      <FileCheck className="h-3.5 w-3.5 text-primary" />
                      <span className="text-sm font-bold font-mono text-foreground">{formatBRL(totalPropostasAceitas)}</span>
                      <span className="text-xs text-muted-foreground">({qtdPropostasAceitas} propostas aceitas)</span>
                    </div>
                  )}
                </div>

                {/* Color Legend — click to toggle */}
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[10px] text-muted-foreground hover:text-foreground">
                      <Info className="h-3 w-3" />
                      Legenda
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent align="end" className="w-64 p-3">
                    <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2.5">Bordas dos cards</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-1 h-5 rounded-full shrink-0 bg-success" />
                        <span className="text-[11px] text-foreground font-medium">Projeto ganho</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-1 h-5 rounded-full shrink-0 bg-destructive" />
                        <span className="text-[11px] text-foreground font-medium">Projeto perdido / estagnado +7d</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-1 h-5 rounded-full shrink-0 bg-warning" />
                        <span className="text-[11px] text-foreground font-medium">Estagnado +3 dias</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-1 h-5 rounded-full shrink-0 bg-muted-foreground/60" />
                        <span className="text-[11px] text-foreground font-medium">Sem proposta vinculada</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-1 h-5 rounded-full bg-primary shrink-0" />
                        <span className="text-[11px] text-foreground font-medium">Com proposta</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
                        <span className="text-[11px] text-foreground font-medium">Cor da etiqueta do projeto</span>
                      </div>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>

            {/* Kanban / List */}
            {loading ? (
              <ProjetoKanbanSkeleton />
            ) : viewMode === "kanban-etapa" ? (
              <ProjetoKanbanStage
                stages={selectedPipelineStages}
                deals={deals}
                onMoveToStage={moveDealToStage}
                onViewProjeto={(deal) => setSelectedDealId(deal.deal_id)}
                pipelineName={pipelines.find(p => p.id === selectedPipelineId)?.name}
                onNewProject={(ctx) => {
                  setDefaultConsultorId(ctx?.consultorId || (filters.ownerId !== "todos" ? filters.ownerId : undefined));
                  setDefaultModalPipelineId(ctx?.pipelineId);
                  setDefaultStageId(ctx?.stageId);
                  setNovoProjetoOpen(true);
                }}
                dynamicEtiquetas={dynamicEtiquetas}
              />
            ) : viewMode === "kanban-consultor" ? (
              <ProjetoKanbanConsultor
                ownerColumns={ownerColumns}
                allDeals={deals}
                onViewProjeto={(deal) => setSelectedDealId(deal.deal_id)}
                onMoveDealToOwner={moveDealToOwner}
                onNewProject={(consultorId) => {
                  setDefaultConsultorId(consultorId);
                  setDefaultModalPipelineId(undefined);
                  setDefaultStageId(undefined);
                  setNovoProjetoOpen(true);
                }}
                dynamicEtiquetas={dynamicEtiquetas}
              />
            ) : (
              <ProjetoListView
                projetos={deals.map(d => ({
                  id: d.deal_id,
                  codigo: null,
                  projeto_num: d.deal_num ?? null,
                  lead_id: null,
                  cliente_id: null,
                  consultor_id: d.owner_id,
                  funil_id: d.pipeline_id,
                  etapa_id: d.stage_id,
                  proposta_id: null,
                  potencia_kwp: null,
                  valor_total: d.deal_value,
                  status: d.deal_status,
                  observacoes: null,
                  created_at: d.last_stage_change,
                  updated_at: d.last_stage_change,
                  cliente: { nome: d.customer_name, telefone: d.customer_phone || "" },
                  consultor: { nome: d.owner_name },
                }))}
                etapas={selectedPipelineStages.map(s => ({
                  id: s.id,
                  funil_id: s.pipeline_id,
                  nome: s.name,
                  cor: s.is_won ? "hsl(var(--success))" : s.is_closed ? "hsl(var(--destructive))" : "hsl(var(--info))",
                  ordem: s.position,
                  categoria: (s.is_won ? "ganho" : s.is_closed ? "perdido" : "aberto") as any,
                  tenant_id: s.tenant_id,
                }))}
              />
            )}
          </div>
        </TabsContent>

        <TabsContent value="performance" className="mt-0">
          <ProjetoPerformanceDashboard />
        </TabsContent>

        <TabsContent value="etiquetas" className="mt-0">
          <EtiquetasManager />
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}