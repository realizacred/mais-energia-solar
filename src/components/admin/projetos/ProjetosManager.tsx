import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { formatKwp } from "@/lib/formatters/index";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FolderKanban, Zap, DollarSign, LayoutGrid, Plus, BarChart3, Layers, Tag, Info, Users, FileCheck, Download, Clock } from "lucide-react";

import { motion } from "framer-motion";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDealPipeline } from "@/hooks/useDealPipeline";
import { PageHeader, LoadingState } from "@/components/ui-kit";

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
}

export function ProjetosManager() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { toast } = useToast();
  const [viewMode, setViewMode] = useState<"kanban-etapa" | "kanban-consultor" | "lista">("kanban-etapa");
  const [legendOpen, setLegendOpen] = useState(false);
  const [editingEtapasFunilId, setEditingEtapasFunilId] = useState<string | null>(null);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [selectedProjetoId, setSelectedProjetoId] = useState<string | null>(null);
  const [isNovoProjetoOpen, setIsNovoProjetoOpen] = useState(false);
  const [dynamicEtiquetas, setDynamicEtiquetas] = useState<DynamicEtiqueta[]>([]);

  const {
    deals,
    pipelines,
    stages,
    consultores,
    loading,
    filters,
    handleFilterChange,
    clearFilters,
    createPipeline,
    createStage,
    renameStage,
    reorderStages,
    deleteStage,
    deletePipeline,
    updateDealStage,
  } = useDealPipeline();

  const selectedPipelineId = searchParams.get("pipelineId") || pipelines[0]?.id;

  const activePipelines = pipelines.filter(p => p.is_active);

  const totalValue = deals.reduce((acc, d) => acc + (d.valor_projeto || 0), 0);
  const totalKwp = deals.reduce((acc, d) => acc + (d.potencia_kwp || 0), 0);
  const propostasAceitas = deals.filter(d => d.status_proposta === "aceita");
  const totalPropostasAceitas = propostasAceitas.reduce((acc, d) => acc + (d.valor_projeto || 0), 0);
  const qtdPropostasAceitas = propostasAceitas.length;

  const ownerColumns = useMemo(() => {
    const owners = new Set(deals.map(d => d.consultor_id).filter(Boolean));
    return Array.from(owners);
  }, [deals]);

  const consultoresFilter = useMemo(() => {
    return consultores.map(c => ({ id: c.id, nome: c.nome }));
  }, [consultores]);

  if (loading) return <ProjetoKanbanSkeleton />;

  return (
    <div className="h-full flex flex-col space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Projetos</h2>
          <p className="text-muted-foreground">Gerencie o pipeline de vendas e execução</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => setIsNovoProjetoOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" /> Novo Projeto
          </Button>
        </div>
      </div>

      <Tabs defaultValue="kanban" className="flex-1 flex flex-col">
        <TabsList>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="lista">Lista</TabsTrigger>
          <TabsTrigger value="dashboard">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="space-y-4 mt-0">
          <div className="flex-1 min-w-0 space-y-4">
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/40">
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

                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 gap-1.5 text-[10px] text-muted-foreground hover:text-foreground"
                  onClick={() => setLegendOpen(prev => !prev)}
                >
                  <Info className="h-3 w-3" />
                  Legenda
                </Button>
              </div>

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

              <ProjetoPipelineTemplates
                open={templateDialogOpen}
                onOpenChange={setTemplateDialogOpen}
                onCreateFromTemplate={(name, stgs) => createPipeline(name, stgs)}
                onCreateBlank={(name) => createPipeline(name)}
              />

              {editingEtapasFunilId && (
                <ProjetoEtapaManagerDialog
                  pipeline={pipelines.find(p => p.id === editingEtapasFunilId) || null}
                  stages={stages}
                  allPipelines={pipelines.filter(p => p.is_active && p.id !== editingEtapasFunilId)}
                  onClose={() => setEditingEtapasFunilId(null)}
                  onCreateStage={createStage}
                  onRenameStage={renameStage}
                  onReorderStages={reorderStages}
                  onDeleteStage={deleteStage}
                  onDeletePipeline={deletePipeline}
                />
              )}
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 min-h-[600px]">
              {viewMode === "kanban-etapa" ? (
                stages
                  .filter(s => s.pipeline_id === (filters.pipelineId || selectedPipelineId))
                  .map(stage => (
                    <ProjetoKanbanStage
                      key={stage.id}
                      stage={stage}
                      deals={deals.filter(d => d.stage_id === stage.id)}
                      onDealClick={setSelectedProjetoId}
                    />
                  ))
              ) : (
                ownerColumns.map(ownerId => (
                  <ProjetoKanbanConsultor
                    key={ownerId}
                    consultorId={ownerId}
                    deals={deals.filter(d => d.consultor_id === ownerId)}
                    onDealClick={setSelectedProjetoId}
                  />
                ))
              )}
            </div>
          </div>
        </TabsContent>

        <TabsContent value="lista">
          <ProjetoListView deals={deals} onDealClick={setSelectedProjetoId} />
        </TabsContent>

        <TabsContent value="dashboard">
          <ProjetoPerformanceDashboard deals={deals} />
        </TabsContent>
      </Tabs>

      {selectedProjetoId && (
        <ProjetoDetalhe
          projetoId={selectedProjetoId}
          onClose={() => setSelectedProjetoId(null)}
        />
      )}

      <NovoProjetoModal
        open={isNovoProjetoOpen}
        onOpenChange={setIsNovoProjetoOpen}
      />
    </div>
  );
}
