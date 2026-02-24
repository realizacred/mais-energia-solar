import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { FolderKanban, Zap, DollarSign, LayoutGrid, Plus, BarChart3, Layers, Tag, Info } from "lucide-react";
import { Separator } from "@/components/ui/separator";

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
  const [selectedDealId, setSelectedDealId] = useState<string | null>(null);
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
      try { sessionStorage.setItem(STORED_STATUS_KEY, value); } catch {}
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
    try { sessionStorage.removeItem(STORED_STATUS_KEY); } catch {}
  };

  const totalValue = useMemo(() => {
    return deals.reduce((sum, d) => sum + (d.deal_value || 0), 0);
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
    <div className="space-y-4 max-w-full overflow-x-hidden">
      <PageHeader
        icon={FolderKanban}
        title="Projetos"
        description="Acompanhe cada projeto da documentação à vistoria"
        actions={
          <Button onClick={() => { setDefaultConsultorId(undefined); setDefaultStageId(undefined); setDefaultModalPipelineId(undefined); setNovoProjetoOpen(true); }} className="gap-1.5 border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground transition-all duration-200 shadow-none font-semibold">
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
        defaultConsultorId={defaultConsultorId}
        defaultPipelineId={defaultModalPipelineId || selectedPipelineId || pipelines[0]?.id}
        defaultStageId={defaultStageId}
        pipelines={activePipelines.map(p => ({ id: p.id, name: p.name }))}
        stages={stages.map(s => ({ id: s.id, name: s.name, pipeline_id: s.pipeline_id, position: s.position, is_closed: s.is_closed }))}
        onSubmit={async (data) => {
          // ✅ 1) Se selecionou cliente existente, usa ele e NÃO cria outro
          let customerId: string | undefined = data.clienteId || undefined;

          // ✅ 2) Se não selecionou, chama RPC (deduplica por telefone_normalized via RLS)
          if (!customerId && data.cliente?.nome?.trim()) {
            // Bloquear se telefone vazio (clientes.telefone é NOT NULL)
            if (!data.cliente.telefone?.trim()) {
              toast({ title: "Telefone obrigatório", description: "Preencha o telefone do cliente para continuar.", variant: "destructive" });
              return;
            }

            const rpcPayload = {
              p_nome: data.cliente.nome,
              p_telefone: data.cliente.telefone,
              p_email: data.cliente.email || null,
              p_cpf_cnpj: data.cliente.cpfCnpj || null,
              p_empresa: data.cliente.empresa || null,
              p_cep: data.cliente.cep || null,
              p_estado: data.cliente.estado || null,
              p_cidade: data.cliente.cidade || null,
              p_rua: data.cliente.endereco || null,
              p_numero: data.cliente.numero || null,
              p_bairro: data.cliente.bairro || null,
              p_complemento: data.cliente.complemento || null,
            };

            console.debug("[NovoProj] RPC payload:", { nome: rpcPayload.p_nome, telefone: rpcPayload.p_telefone });

            const { data: clienteId, error } = await supabase.rpc(
              "get_or_create_cliente" as any,
              rpcPayload
            );

            if (error) {
              console.error("[NovoProj] RPC error:", error);
              toast({ title: "Erro ao criar/buscar cliente", description: error.message, variant: "destructive" });
              return;
            }
            if (!clienteId) {
              console.error("[NovoProj] RPC returned null");
              toast({ title: "Erro", description: "Não foi possível obter o ID do cliente.", variant: "destructive" });
              return;
            }
            customerId = clienteId as string;
            console.debug("[NovoProj] customerId resolvido:", customerId);
          }

          console.debug("[NovoProj] createDeal payload:", {
            title: data.nome || data.cliente.nome,
            ownerId: data.consultorId,
            pipelineId: data.pipelineId,
            stageId: data.stageId,
            customerId,
          });

          // ✅ 3) Validar que temos um cliente antes de criar o deal
          if (!customerId) {
            toast({ title: "Erro", description: "Selecione ou cadastre um cliente para criar o projeto.", variant: "destructive" });
            return;
          }

          // ✅ 4) Cria o projeto/deal vinculando o cliente certo
          const result = await createDeal({
            title: data.nome || data.cliente.nome,
            ownerId: data.consultorId || undefined,
            pipelineId: data.pipelineId,
            stageId: data.stageId,
            customerId,
            etiqueta: data.etiqueta || undefined,
            notas: data.notas || undefined,
          });

          console.debug("[NovoProj] createDeal result:", result);
        }}
      />

      {/* ── Main Tabs: Funil + Performance ── */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
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

                {/* Color Legend — hover to reveal */}
                <div className="relative group/legend">
                  <Button variant="ghost" size="sm" className="h-7 gap-1.5 text-[10px] text-muted-foreground hover:text-foreground">
                    <Info className="h-3 w-3" />
                    Legenda
                  </Button>
                  <div className="absolute right-0 mt-1 z-20 bg-popover border border-border rounded-xl shadow-xl p-3 w-64 invisible opacity-0 group-hover/legend:visible group-hover/legend:opacity-100 transition-all duration-200">
                    <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-2.5">Bordas dos cards</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: "hsl(142 71% 45%)" }} />
                        <span className="text-[11px] text-muted-foreground">Projeto ganho</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: "hsl(0 84% 60%)" }} />
                        <span className="text-[11px] text-muted-foreground">Projeto perdido / estagnado +7d</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: "hsl(38 92% 50%)" }} />
                        <span className="text-[11px] text-muted-foreground">Estagnado +3 dias</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-5 rounded-full shrink-0" style={{ backgroundColor: "hsl(27 96% 61%)" }} />
                        <span className="text-[11px] text-muted-foreground">Sem proposta vinculada</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-5 rounded-full bg-primary shrink-0" />
                        <span className="text-[11px] text-muted-foreground">Com proposta</span>
                      </div>
                      <div className="flex items-center gap-2.5">
                        <span className="w-1.5 h-5 rounded-full bg-accent shrink-0" />
                        <span className="text-[11px] text-muted-foreground">Cor da etiqueta do projeto</span>
                      </div>
                    </div>
                  </div>
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
    </div>
  );
}