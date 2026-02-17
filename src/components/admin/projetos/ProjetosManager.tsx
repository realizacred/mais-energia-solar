import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { FolderKanban, Zap, DollarSign, LayoutGrid, Plus, BarChart3, Layers, Tag } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useDealPipeline } from "@/hooks/useDealPipeline";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { ProjetoFilters } from "./ProjetoFilters";
import { ProjetoKanbanStage } from "./ProjetoKanbanStage";
import { ProjetoListView } from "./ProjetoListView";
import { ProjetoEtapaManagerDialog } from "./ProjetoEtapaManagerDialog";
import { NovoProjetoModal } from "./NovoProjetoModal";
import { ProjetoDetalhe } from "./ProjetoDetalhe";
import { ProjetoKanbanSkeleton } from "./ProjetoKanbanSkeleton";
import { ProjetoPerformanceDashboard } from "./ProjetoPerformanceDashboard";
import { EtiquetasManager } from "./EtiquetasManager";
import { cn } from "@/lib/utils";

interface DynamicEtiqueta {
  id: string;
  nome: string;
  cor: string;
  grupo: string;
  short: string | null;
  icon: string | null;
}

export function ProjetosManager() {
  const {
    pipelines, stages, deals, consultores, loading,
    selectedPipelineId, setSelectedPipelineId,
    filters, applyFilters,
    selectedPipelineStages, ownerColumns,
    consultoresFilter,
    createPipeline, renamePipeline, togglePipelineActive, reorderPipelines,
    createStage, renameStage, updateStageProbability, reorderStages, deleteStage,
    moveDealToOwner, moveDealToStage,
    createDeal,
  } = useDealPipeline();

  const [viewMode, setViewMode] = useState<"kanban-etapa" | "lista">("kanban-etapa");
  const [editingEtapasFunilId, setEditingEtapasFunilId] = useState<string | null>(null);
  const [novoProjetoOpen, setNovoProjetoOpen] = useState(false);
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>("kanban");
  const [dynamicEtiquetas, setDynamicEtiquetas] = useState<DynamicEtiqueta[]>([]);

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
      setSelectedPipelineId(value);
      applyFilters({ pipelineId: value });
    } else if (key === "ownerId") {
      applyFilters({ ownerId: value });
    } else if (key === "status") {
      applyFilters({ status: value });
    } else if (key === "search") {
      applyFilters({ search: value });
    }
  };

  // Auto-select first active pipeline if none selected
  useEffect(() => {
    if (!selectedPipelineId && pipelines.length > 0) {
      const firstActive = pipelines.find(p => p.is_active);
      if (firstActive) {
        setSelectedPipelineId(firstActive.id);
        applyFilters({ pipelineId: firstActive.id });
      }
    }
  }, [pipelines, selectedPipelineId]);

  const clearFilters = () => {
    const firstActive = pipelines.find(p => p.is_active);
    const pid = firstActive?.id || null;
    applyFilters({ pipelineId: pid, ownerId: "todos", status: "todos", search: "" });
    setSelectedPipelineId(pid);
  };

  const totalValue = useMemo(() => {
    return deals.reduce((sum, d) => sum + (d.deal_value || 0), 0);
  }, [deals]);

  // ── Detail View ──
  if (selectedDealId) {
    return (
      <ProjetoDetalhe
        dealId={selectedDealId}
        onBack={() => setSelectedDealId(null)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        icon={FolderKanban}
        title="Projetos"
        description="Gestão operacional de engenharia — acompanhe cada projeto da documentação à vistoria"
        actions={
          <Button onClick={() => setNovoProjetoOpen(true)} className="gap-1.5 border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-none font-semibold">
            <Plus className="h-4 w-4" />
            Novo Projeto
          </Button>
        }
      />

      {/* ── Novo Projeto Modal ── */}
      <NovoProjetoModal
        open={novoProjetoOpen}
        onOpenChange={setNovoProjetoOpen}
        consultores={consultoresFilter}
        dynamicEtiquetas={dynamicEtiquetas}
        onSubmit={async (data) => {
          let customerId: string | undefined;
          if (data.cliente.nome.trim()) {
            const { data: cli, error } = await supabase
              .from("clientes")
              .insert({
                nome: data.cliente.nome,
                telefone: data.cliente.telefone || "N/A",
                email: data.cliente.email || null,
                cpf_cnpj: data.cliente.cpfCnpj || null,
                empresa: data.cliente.empresa || null,
                cep: data.cliente.cep || null,
                estado: data.cliente.estado || null,
                cidade: data.cliente.cidade || null,
                rua: data.cliente.endereco || null,
                numero: data.cliente.numero || null,
                bairro: data.cliente.bairro || null,
                complemento: data.cliente.complemento || null,
              } as any)
              .select("id")
              .single();
            if (!error && cli) customerId = cli.id;
          }

          await createDeal({
            title: data.nome || data.cliente.nome,
            ownerId: data.consultorId || consultoresFilter[0]?.id,
            customerId,
            etiqueta: data.etiqueta || undefined,
            notas: data.notas || undefined,
          });
        }}
      />

      {/* ── Main Tabs: Funil + Performance ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-muted/50 border border-border/40">
          <TabsTrigger value="kanban" className="gap-1.5 text-xs">
            <Layers className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Funil</span>
          </TabsTrigger>
          <TabsTrigger value="performance" className="gap-1.5 text-xs">
            <BarChart3 className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Performance</span>
          </TabsTrigger>
          <TabsTrigger value="etiquetas" className="gap-1.5 text-xs">
            <Tag className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Etiquetas</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="kanban" className="space-y-4 mt-0">
          <div className="flex-1 min-w-0 space-y-4">
            <div className="rounded-2xl border border-border/60 bg-card" style={{ boxShadow: "var(--shadow-sm)" }}>
              {/* Filters row */}
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
                  filterFunil={filters.pipelineId || selectedPipelineId || ""}
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
                />
              </div>

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
                <div className="flex items-center gap-5 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground">{deals.length}</span>
                    <span className="text-xs text-muted-foreground">projetos</span>
                  </div>
                  {totalValue > 0 && (
                    <div className="flex items-center gap-1.5">
                      <DollarSign className="h-3.5 w-3.5 text-success" />
                      <span className="text-sm font-bold font-mono text-foreground">{formatBRL(totalValue)}</span>
                    </div>
                  )}
                  <span className="text-xs text-muted-foreground">
                    {ownerColumns.length} consultores
                  </span>
                </div>
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
                onNewProject={() => setNovoProjetoOpen(true)}
                dynamicEtiquetas={dynamicEtiquetas}
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
    </div>
  );
}