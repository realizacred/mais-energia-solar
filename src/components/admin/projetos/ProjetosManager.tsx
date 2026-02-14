import { useState, useMemo } from "react";
import { FolderKanban, Zap, DollarSign, LayoutGrid } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { useDealPipeline } from "@/hooks/useDealPipeline";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { ProjetoFunilSelector } from "./ProjetoFunilSelector";
import { ProjetoFilters } from "./ProjetoFilters";
import { ProjetoKanbanOwner } from "./ProjetoKanbanOwner";
import { ProjetoListView } from "./ProjetoListView";
import { ProjetoEtapaManager } from "./ProjetoEtapaManager";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function ProjetosManager() {
  const {
    pipelines, stages, deals, consultores, loading,
    selectedPipelineId, setSelectedPipelineId,
    filters, applyFilters,
    selectedPipelineStages, ownerColumns,
    consultoresFilter,
    createPipeline, renamePipeline, togglePipelineActive, reorderPipelines,
    createStage, renameStage, updateStageProbability, reorderStages, deleteStage,
    moveDealToOwner,
  } = useDealPipeline();

  const [viewMode, setViewMode] = useState<"kanban" | "lista">("kanban");
  const [editingEtapasFunilId, setEditingEtapasFunilId] = useState<string | null>(null);

  const handleFilterChange = (key: string, value: any) => {
    if (key === "pipelineId") {
      setSelectedPipelineId(value === "todos" ? null : value);
      applyFilters({ pipelineId: value === "todos" ? null : value });
    } else if (key === "ownerId") {
      applyFilters({ ownerId: value });
    } else if (key === "status") {
      applyFilters({ status: value });
    } else if (key === "search") {
      applyFilters({ search: value });
    }
  };

  const clearFilters = () => {
    applyFilters({ pipelineId: null, ownerId: "todos", status: "todos", search: "" });
    setSelectedPipelineId(null);
  };

  const totalValue = useMemo(() => {
    return deals.reduce((sum, d) => sum + (d.deal_value || 0), 0);
  }, [deals]);

  const formatBRL = (v: number) => {
    if (!v) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
  };

  const selectedPipeline = pipelines.find(p => p.id === selectedPipelineId);

  if (loading) return <LoadingState message="Carregando projetos..." />;

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FolderKanban}
        title="Projetos"
        description="Pipeline de vendas e gestão de projetos"
      />

      <div className="rounded-xl border border-border/60 bg-card">
        {/* ── Filters row with view toggle ── */}
        <div className="px-4 py-3">
          <ProjetoFilters
            searchTerm={filters.search}
            onSearchChange={(v) => handleFilterChange("search", v)}
            funis={pipelines.map(p => ({
              id: p.id,
              nome: p.name,
              ordem: 0,
              ativo: p.is_active,
              tenant_id: p.tenant_id,
            }))}
            filterFunil={filters.pipelineId || "todos"}
            onFilterFunilChange={(v) => handleFilterChange("pipelineId", v)}
            filterConsultor={filters.ownerId}
            onFilterConsultorChange={(v) => handleFilterChange("ownerId", v)}
            consultores={consultoresFilter}
            filterStatus={filters.status}
            onFilterStatusChange={(v) => handleFilterChange("status", v)}
            etiquetas={[]}
            filterEtiquetas={[]}
            onFilterEtiquetasChange={() => {}}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            onClearFilters={clearFilters}
          />
        </div>

        <Separator />

        {/* ── Pipeline tabs ── */}
        <div className="px-4 py-2.5">
          <ProjetoFunilSelector
            funis={pipelines.map(p => ({
              id: p.id,
              nome: p.name,
              ordem: 0,
              ativo: p.is_active,
              tenant_id: p.tenant_id,
            }))}
            selectedId={selectedPipelineId}
            onSelect={(id) => {
              setSelectedPipelineId(id);
              applyFilters({ pipelineId: id });
            }}
            onCreate={createPipeline}
            onRename={renamePipeline}
            onToggleAtivo={togglePipelineActive}
            onReorder={reorderPipelines}
            onEditEtapas={(funilId) => setEditingEtapasFunilId(funilId)}
          />
        </div>

        {/* ── Etapa Manager Dialog (opened by pencil icon) ── */}
        {editingEtapasFunilId && (() => {
          const pipeline = pipelines.find(p => p.id === editingEtapasFunilId);
          const pipelineStages = stages.filter(s => s.pipeline_id === editingEtapasFunilId).sort((a, b) => a.position - b.position);
          if (!pipeline) return null;
          return (
            <Dialog open={true} onOpenChange={(open) => { if (!open) setEditingEtapasFunilId(null); }}>
              <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    Etapas do funil "{pipeline.name}"
                  </DialogTitle>
                </DialogHeader>
                <ProjetoEtapaManager
                  funilId={pipeline.id}
                  funilNome={pipeline.name}
                  etapas={pipelineStages.map(s => ({
                    id: s.id,
                    funil_id: s.pipeline_id,
                    nome: s.name,
                    cor: s.is_won ? "#10B981" : s.is_closed ? "#EF4444" : "#3B82F6",
                    ordem: s.position,
                    categoria: (s.is_won ? "ganho" : s.is_closed ? "perdido" : "aberto") as any,
                    tenant_id: s.tenant_id,
                  }))}
                  onCreate={createStage}
                  onRename={renameStage}
                  onUpdateCor={() => {}}
                  onUpdateCategoria={() => {}}
                  onReorder={reorderStages}
                  onDelete={deleteStage}
                />
              </DialogContent>
            </Dialog>
          );
        })()}

        {/* ── Summary bar ── */}
        <div className="px-4 pb-3 flex items-center justify-between">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-1.5">
              <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-sm font-semibold text-foreground">{deals.length}</span>
              <span className="text-xs text-muted-foreground">projetos</span>
            </div>
            {totalValue > 0 && (
              <div className="flex items-center gap-1.5">
                <DollarSign className="h-3.5 w-3.5 text-success" />
                <span className="text-sm font-semibold text-foreground">{formatBRL(totalValue)}</span>
              </div>
            )}
            <span className="text-xs text-muted-foreground">
              {ownerColumns.length} responsáveis
            </span>
          </div>
        </div>
      </div>

      {/* ── Kanban / List ── */}
      {viewMode === "kanban" ? (
        <ProjetoKanbanOwner
          columns={ownerColumns}
          onMoveProjeto={moveDealToOwner}
        />
      ) : (
        <ProjetoListView
          projetos={deals.map(d => ({
            id: d.deal_id,
            codigo: null,
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
            cliente: { nome: d.customer_name, telefone: "" },
            consultor: { nome: d.owner_name },
          }))}
          etapas={selectedPipelineStages.map(s => ({
            id: s.id,
            funil_id: s.pipeline_id,
            nome: s.name,
            cor: s.is_won ? "#10B981" : s.is_closed ? "#EF4444" : "#3B82F6",
            ordem: s.position,
            categoria: (s.is_won ? "ganho" : s.is_closed ? "perdido" : "aberto") as any,
            tenant_id: s.tenant_id,
          }))}
        />
      )}
    </div>
  );
}
