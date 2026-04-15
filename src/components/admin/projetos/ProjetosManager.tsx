import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { formatKwp } from "@/lib/formatters/index";
import { useState, useEffect, useMemo, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { FolderKanban, Zap, DollarSign, LayoutGrid, Plus, BarChart3, Layers, Tag, Info, Users, FileCheck, Download, Clock } from "lucide-react";

import { motion } from "framer-motion";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";

import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { useProjetoPipeline } from "@/hooks/useProjetoPipeline";
import type { ProjetoItem, ProjetoEtapa, ConsultorColumn as ProjetoConsultorColumn } from "@/hooks/useProjetoPipeline";
import type { DealKanbanCard, PipelineStage, OwnerColumn } from "@/hooks/useDealPipeline";
import { PageHeader, LoadingState } from "@/components/ui-kit";
import { supabase } from "@/integrations/supabase/client";

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

// ─── Adapters: ProjetoItem → DealKanbanCard ──────────────────

function projetoStatusToDeal(status: string): string {
  switch (status) {
    case "concluido": case "comissionado": case "instalado": return "won";
    case "cancelado": return "lost";
    default: return "open";
  }
}

function projetoToCard(p: ProjetoItem, etapaMap: Map<string, ProjetoEtapa>): DealKanbanCard {
  const etapa = p.etapa_id ? etapaMap.get(p.etapa_id) : null;
  const effectiveFunilId = etapa?.funil_id || p.funil_id || "";

  return {
    deal_id: p.deal_id || p.id,
    tenant_id: "",
    pipeline_id: effectiveFunilId,
    stage_id: p.etapa_id || "",
    stage_name: etapa?.nome || "Sem etapa",
    stage_position: etapa?.ordem ?? 0,
    owner_id: p.consultor_id || "",
    owner_name: p.consultor?.nome || "Sem consultor",
    customer_name: p.cliente?.nome || "",
    customer_phone: p.cliente?.telefone || "",
    deal_title: p.codigo || `PRJ-${p.projeto_num || ""}`,
    deal_value: p.valor_total || 0,
    deal_kwp: p.potencia_kwp || 0,
    deal_status: projetoStatusToDeal(p.status),
    stage_probability: 0,
    last_stage_change: p.updated_at,
    etiqueta: null,
    etiqueta_ids: p.etiquetas || [],
    notas: p.observacoes,
    cliente_code: p.codigo,
    deal_num: p.projeto_num ?? null,
    proposta_id: p.proposta_id || null,
    proposta_status: p.proposta_status || null,
  };
}

function etapaToPipelineStage(e: ProjetoEtapa): PipelineStage {
  return {
    id: e.id,
    tenant_id: e.tenant_id,
    pipeline_id: e.funil_id,
    name: e.nome,
    position: e.ordem,
    probability: 0,
    is_closed: e.categoria === "perdido" || e.categoria === "excluido",
    is_won: e.categoria === "ganho",
    color: e.cor,
  };
}

function consultorColumnToOwner(c: ProjetoConsultorColumn, etapaMap: Map<string, ProjetoEtapa>): OwnerColumn {
  return {
    id: c.id,
    nome: c.nome,
    ativo: c.ativo,
    deals: c.projetos.map(p => projetoToCard(p, etapaMap)),
    totalValor: c.totalValor,
    totalKwp: c.totalKwp,
    count: c.count,
  };
}

// ─── Main Component ──────────────────────────────────────────

export function ProjetosManager() {
  const { toast } = useToast();
  const {
    funis, etapas, etiquetas, projetos, consultores, loading,
    selectedFunilId, setSelectedFunilId,
    filters, applyFilters,
    selectedFunilEtapas, projetosByEtapa, consultorColumns,
    consultoresFilter,
    fetchAll,
    createFunil, renameFunil, toggleFunilAtivo, reorderFunis,
    createEtapa, renameEtapa, updateEtapaCor, updateEtapaCategoria,
    reorderEtapas, deleteEtapa,
    moveProjetoToEtapa, moveProjetoToConsultor,
  } = useProjetoPipeline();

  // Build etapa map for adapters
  const etapaMap = useMemo(() => new Map(etapas.map(e => [e.id, e])), [etapas]);

  // Adapted data for child components
  const adaptedStages = useMemo(
    () => selectedFunilEtapas.map(etapaToPipelineStage),
    [selectedFunilEtapas]
  );

  const adaptedDeals = useMemo(
    () => projetos.map(p => projetoToCard(p, etapaMap)),
    [projetos, etapaMap]
  );

  const adaptedOwnerColumns = useMemo(
    () => consultorColumns.map(c => consultorColumnToOwner(c, etapaMap)),
    [consultorColumns, etapaMap]
  );

  // ── Persistent filter storage ──
  const STORAGE_KEY = "projetos_kanban_prefs";
  
  const getStoredPrefs = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as {
        viewMode?: string;
        funilId?: string | null;
        consultorId?: string;
        status?: string;
      };
    } catch { return null; }
  }, []);

  const savePrefs = useCallback((prefs: Record<string, any>) => {
    try {
      const current = getStoredPrefs() || {};
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...current, ...prefs }));
    } catch { /* ignore */ }
  }, [getStoredPrefs]);

  const storedPrefs = useMemo(() => getStoredPrefs(), []);
  
  const [viewMode, setViewModeRaw] = useState<"kanban-etapa" | "kanban-consultor" | "lista">(
    (storedPrefs?.viewMode as any) || "kanban-consultor"
  );

  const setViewMode = (mode: "kanban-etapa" | "kanban-consultor" | "lista") => {
    setViewModeRaw(mode);
    savePrefs({ viewMode: mode });
    if (mode === "kanban-consultor") {
      setSelectedFunilId(null);
      applyFilters({ funilId: null });
      savePrefs({ viewMode: mode, funilId: null });
    }
  };

  // Apply stored filters on mount
  useEffect(() => {
    if (!storedPrefs) return;
    const updates: Record<string, any> = {};
    if (storedPrefs.status && storedPrefs.status !== "todos" && filters.status !== storedPrefs.status) {
      updates.status = storedPrefs.status;
    }
    if (storedPrefs.consultorId && storedPrefs.consultorId !== "todos" && filters.consultorId !== storedPrefs.consultorId) {
      updates.consultorId = storedPrefs.consultorId;
    }
    if (storedPrefs.funilId && filters.funilId !== storedPrefs.funilId) {
      updates.funilId = storedPrefs.funilId;
      setSelectedFunilId(storedPrefs.funilId);
    }
    if (Object.keys(updates).length > 0) {
      applyFilters(updates);
    }
  }, []);

  const [editingEtapasFunilId, setEditingEtapasFunilId] = useState<string | null>(null);
  const [novoProjetoOpen, setNovoProjetoOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [defaultConsultorId, setDefaultConsultorId] = useState<string | undefined>();
  const [legendOpen, setLegendOpen] = useState(false);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();
  const [defaultModalFunilId, setDefaultModalFunilId] = useState<string | undefined>();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedProjetoId = searchParams.get("projeto") || null;
  const setSelectedProjetoId = useCallback((id: string | null) => {
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
  const [defaultFunilApplied, setDefaultFunilApplied] = useState(false);

  useEffect(() => {
    supabase
      .from("projeto_etiquetas")
      .select("id, nome, cor, grupo, short, icon")
      .eq("ativo", true)
      .order("grupo")
      .order("ordem")
      .then(({ data }) => { if (data) setDynamicEtiquetas(data as DynamicEtiqueta[]); });
  }, [activeTab]);

  const handleFilterChange = (key: string, value: any) => {
    if (key === "pipelineId") {
      const funilValue = value === "todos" ? null : value;
      setSelectedFunilId(funilValue);
      applyFilters({ funilId: funilValue });
      savePrefs({ funilId: funilValue });
      if (funilValue && viewMode === "kanban-consultor") {
        setViewMode("kanban-etapa");
      }
    } else if (key === "ownerId") {
      applyFilters({ consultorId: value });
      savePrefs({ consultorId: value });
    } else if (key === "status") {
      applyFilters({ status: value });
      savePrefs({ status: value });
    } else if (key === "search") {
      applyFilters({ search: value });
    }
  };

  const activeFunis = useMemo(
    () => funis.filter(f => f.ativo),
    [funis]
  );

  useEffect(() => {
    if (viewMode !== "kanban-etapa") return;

    const resolvedFunilId = selectedFunilId || activeFunis[0]?.id || null;
    if (!resolvedFunilId) return;
    if (filters.funilId === resolvedFunilId) return;

    if (!selectedFunilId) {
      setSelectedFunilId(resolvedFunilId);
    }

    applyFilters({ funilId: resolvedFunilId });
    savePrefs({ funilId: resolvedFunilId });
  }, [viewMode, selectedFunilId, activeFunis, filters.funilId, applyFilters, savePrefs, setSelectedFunilId]);

  useEffect(() => {
    if (!defaultFunilApplied && activeFunis.length > 0) {
      if (!selectedFunilId) {
        applyFilters({ funilId: null });
      }
      setDefaultFunilApplied(true);
    }
    if (selectedFunilId) {
      const current = funis.find(f => f.id === selectedFunilId);
      if (current && !current.ativo) {
        setSelectedFunilId(null);
        applyFilters({ funilId: null });
      }
    }
  }, [funis, selectedFunilId, activeFunis, defaultFunilApplied]);

  const clearFilters = () => {
    applyFilters({ funilId: null, consultorId: "todos", status: "todos", search: "" });
    setSelectedFunilId(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  };

  const totalValue = useMemo(() => {
    return projetos.reduce((sum, p) => sum + (p.valor_total || 0), 0);
  }, [projetos]);

  const totalKwp = useMemo(() => {
    return projetos.reduce((sum, p) => sum + (p.potencia_kwp || 0), 0);
  }, [projetos]);

  // KPI stats
  const kpiStats = useMemo(() => {
    const total = projetos.length;
    const emAndamento = projetos.filter(p => !["concluido","cancelado","comissionado","instalado"].includes(p.status)).length;
    const concluidos = projetos.filter(p => ["concluido","comissionado","instalado"].includes(p.status)).length;
    const atrasados = projetos.filter(p => {
      if (["concluido","cancelado","comissionado","instalado"].includes(p.status)) return false;
      const lastChange = new Date(p.updated_at);
      const diffDays = (Date.now() - lastChange.getTime()) / (1000 * 60 * 60 * 24);
      return diffDays > 7;
    }).length;
    return { total, emAndamento, concluidos, atrasados };
  }, [projetos]);

  // CSV export
  const handleExportCSV = useCallback(() => {
    if (projetos.length === 0) return;
    const now = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }).replace(/[/:\s]/g, "-");
    const header = ["Projeto", "Cliente", "Consultor", "Status", "Valor", "kWp", "Última Atualização"];
    const rows = projetos.map(p => [
      p.codigo || `PRJ-${p.projeto_num || ""}`,
      p.cliente?.nome || "",
      p.consultor?.nome || "",
      p.status || "",
      String(p.valor_total || 0),
      String(p.potencia_kwp || 0),
      p.updated_at ? new Date(p.updated_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" }) : "",
    ]);
    const csv = [header, ...rows].map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `projetos_${now}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    sonnerToast.success(`${projetos.length} projetos exportados`);
  }, [projetos]);

  // ── Detail View ──
  if (selectedProjetoId) {
    return (
      <ProjetoDetalhe
        dealId={selectedProjetoId}
        onBack={() => { setSelectedProjetoId(null); fetchAll(); }}
        initialPipelineId={selectedFunilId || undefined}
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
                <Button variant="outline" size="sm" onClick={handleExportCSV} disabled={projetos.length === 0}>
                  <Download className="h-4 w-4 mr-1.5" />
                  Exportar
                </Button>
              </TooltipTrigger>
              <TooltipContent>Exportar projetos filtrados em CSV</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  onClick={() => { setDefaultConsultorId(undefined); setDefaultStageId(undefined); setDefaultModalFunilId(undefined); setNovoProjetoOpen(true); }}
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

      {/* ── Novo Projeto Modal ── */}
      <NovoProjetoModal
        open={novoProjetoOpen}
        onOpenChange={setNovoProjetoOpen}
        consultores={consultoresFilter}
        defaultConsultorId={defaultConsultorId}
        defaultPipelineId={defaultModalFunilId || selectedFunilId || funis[0]?.id}
        defaultStageId={defaultStageId}
        pipelines={activeFunis.map(f => ({ id: f.id, name: f.nome }))}
        stages={etapas.map(e => ({ id: e.id, name: e.nome, pipeline_id: e.funil_id, position: e.ordem, is_closed: e.categoria === "perdido" }))}
        dynamicEtiquetas={dynamicEtiquetas.map(e => ({ id: e.id, nome: e.nome, cor: e.cor }))}
        onSubmit={async (data) => {
          const clienteId = data.clienteId;
          if (!clienteId) {
            toast({ title: "Erro", description: "Selecione um cliente.", variant: "destructive" });
            return;
          }

          // Create projeto directly in projetos table
          const { data: newProjeto, error } = await supabase
            .from("projetos")
            .insert({
              cliente_id: clienteId,
              consultor_id: data.consultorId || null,
              funil_id: data.pipelineId || funis[0]?.id || null,
              etapa_id: data.stageId || etapas.find(e => e.funil_id === (data.pipelineId || funis[0]?.id) && e.ordem === 0)?.id || null,
              valor_total: data.valor || 0,
              observacoes: data.descricao || null,
              status: "criado" as any,
            } as any)
            .select("id")
            .single();

          if (error) {
            toast({ title: "Erro ao criar projeto", description: error.message, variant: "destructive" });
            return;
          }

          if (newProjeto?.id) {
            // Attach etiqueta if selected
            if (data.etiqueta) {
              await supabase.from("projeto_etiqueta_rel").insert({
                projeto_id: newProjeto.id,
                etiqueta_id: data.etiqueta,
              } as any);
            }
            setSelectedProjetoId(newProjeto.id);
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
              <span className="text-muted-foreground hidden sm:inline">concluídos</span>
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
            <div className="rounded-xl border border-border/60 bg-card overflow-hidden" style={{ boxShadow: "var(--shadow-sm)" }}>
              {/* Summary bar — top */}
              <div className="px-4 py-2.5 flex items-center justify-between border-b border-border/40">
                <div className="flex items-center gap-4 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <LayoutGrid className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-bold text-foreground">{projetos.length}</span>
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
                    <span className="text-sm font-bold text-foreground">{adaptedOwnerColumns.length}</span>
                    <span className="text-xs text-muted-foreground">consultores</span>
                  </div>
                </div>

                {/* Color Legend — lateral toggle */}
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

              {/* Filters row */}
              <div className="px-4 py-3">
                <ProjetoFilters
                  searchTerm={filters.search}
                  onSearchChange={(v) => handleFilterChange("search", v)}
                  funis={activeFunis}
                  filterFunil={selectedFunilId ?? (viewMode === "kanban-consultor" ? "todos" : "")}
                  onFilterFunilChange={(v) => handleFilterChange("pipelineId", v)}
                  filterConsultor={filters.consultorId}
                  onFilterConsultorChange={(v) => handleFilterChange("ownerId", v)}
                  consultores={consultoresFilter}
                  filterStatus={filters.status}
                  onFilterStatusChange={(v) => handleFilterChange("status", v)}
                  etiquetas={dynamicEtiquetas.map(e => ({ id: e.id, nome: e.nome, cor: e.cor, tenant_id: "" }))}
                  filterEtiquetas={filters.etiquetaIds || []}
                  onFilterEtiquetasChange={(ids) => applyFilters({ etiquetaIds: ids })}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onClearFilters={clearFilters}
                  onEditEtapas={(funilId) => setEditingEtapasFunilId(funilId)}
                  onCreateFunil={() => setTemplateDialogOpen(true)}
                  allowAllFunis={viewMode === "kanban-consultor"}
                />
              </div>

              {/* Template dialog for creating new funnels */}
              <ProjetoPipelineTemplates
                open={templateDialogOpen}
                onOpenChange={setTemplateDialogOpen}
                onCreateFromTemplate={(name, stgs) => {
                  // Create funil + etapas from template
                  createFunil(name);
                }}
                onCreateBlank={(name) => createFunil(name)}
              />

              {/* Etapa Manager Dialog — adapted to Pipeline/PipelineStage interface */}
              {editingEtapasFunilId && (
                <ProjetoEtapaManagerDialog
                  pipeline={{
                    id: editingEtapasFunilId,
                    tenant_id: funis.find(f => f.id === editingEtapasFunilId)?.tenant_id || "",
                    name: funis.find(f => f.id === editingEtapasFunilId)?.nome || "",
                    kind: "process",
                    version: 1,
                    is_active: funis.find(f => f.id === editingEtapasFunilId)?.ativo ?? true,
                    created_at: "",
                  }}
                  stages={etapas
                    .filter(e => e.funil_id === editingEtapasFunilId)
                    .map(etapaToPipelineStage)}
                  allPipelines={funis
                    .filter(f => f.ativo && f.id !== editingEtapasFunilId)
                    .map(f => ({
                      id: f.id,
                      tenant_id: f.tenant_id,
                      name: f.nome,
                      kind: "process" as const,
                      version: 1,
                      is_active: f.ativo,
                      created_at: "",
                    }))}
                  onClose={() => setEditingEtapasFunilId(null)}
                  onCreateStage={(funilId, name, categoria) => createEtapa(funilId, name, (categoria || "aberto") as any)}
                  onRenameStage={renameEtapa}
                  onReorderStages={reorderEtapas}
                  onDeleteStage={deleteEtapa}
                  onDeletePipeline={async (id, moveDealsTo) => {
                    await toggleFunilAtivo(id, false);
                    return true;
                  }}
                />
              )}
            </div>

            {/* Kanban / List + Legend lateral */}
            <div className="flex gap-0">
              <div className="flex-1 min-w-0">
                {loading ? (
                  <ProjetoKanbanSkeleton />
                ) : viewMode === "kanban-etapa" ? (
                  <ProjetoKanbanStage
                    stages={adaptedStages}
                    deals={adaptedDeals.filter(d => {
                      // Filter deals to the selected funil
                      if (!selectedFunilId) return true;
                      return d.pipeline_id === selectedFunilId;
                    })}
                    onMoveToStage={(projetoId, etapaId) => moveProjetoToEtapa(projetoId, etapaId)}
                    onViewProjeto={(deal) => setSelectedProjetoId(deal.deal_id)}
                    onViewProjetoTab={(deal, tab) => {
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("projeto", deal.deal_id);
                        next.set("tab", tab);
                        return next;
                      }, { replace: true });
                    }}
                    pipelineName={funis.find(f => f.id === selectedFunilId)?.nome}
                    onNewProject={(ctx) => {
                      setDefaultConsultorId(ctx?.consultorId || (filters.consultorId !== "todos" ? filters.consultorId : undefined));
                      setDefaultModalFunilId(ctx?.pipelineId);
                      setDefaultStageId(ctx?.stageId);
                      setNovoProjetoOpen(true);
                    }}
                    dynamicEtiquetas={dynamicEtiquetas}
                  />
                ) : viewMode === "kanban-consultor" ? (
                  <ProjetoKanbanConsultor
                    ownerColumns={adaptedOwnerColumns}
                    allDeals={adaptedDeals}
                    onViewProjeto={(deal) => setSelectedProjetoId(deal.deal_id)}
                    onViewProjetoTab={(deal, tab) => {
                      setSearchParams((prev) => {
                        const next = new URLSearchParams(prev);
                        next.set("projeto", deal.deal_id);
                        next.set("tab", tab);
                        return next;
                      }, { replace: true });
                    }}
                    onMoveDealToOwner={(projetoId, consultorId) => moveProjetoToConsultor(projetoId, consultorId)}
                    onNewProject={(consultorId) => {
                      setDefaultConsultorId(consultorId);
                      setDefaultModalFunilId(undefined);
                      setDefaultStageId(undefined);
                      setNovoProjetoOpen(true);
                    }}
                    dynamicEtiquetas={dynamicEtiquetas}
                  />
                ) : (
                  <ProjetoListView
                    projetos={projetos}
                    etapas={selectedFunilEtapas}
                    onViewProjeto={(p) => setSelectedProjetoId(p.deal_id || p.id)}
                  />
                )}
              </div>

              {/* Lateral Legend Panel */}
              {legendOpen && (
                <div className="w-48 shrink-0 border-l border-border bg-card/80 rounded-r-xl p-3 hidden sm:block animate-in slide-in-from-right-2 duration-200">
                  <p className="text-[10px] font-semibold text-foreground uppercase tracking-wider mb-3">Bordas dos cards</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="w-1 h-5 rounded-full shrink-0 bg-success" />
                      <span className="text-[11px] text-foreground font-medium">Projeto concluído</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1 h-5 rounded-full shrink-0 bg-destructive" />
                      <span className="text-[11px] text-foreground font-medium leading-tight">Cancelado / estagnado +7d</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1 h-5 rounded-full shrink-0 bg-warning" />
                      <span className="text-[11px] text-foreground font-medium">Estagnado +3 dias</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1 h-5 rounded-full shrink-0 bg-muted-foreground/60" />
                      <span className="text-[11px] text-foreground font-medium">Sem proposta</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1 h-5 rounded-full bg-primary shrink-0" />
                      <span className="text-[11px] text-foreground font-medium">Com proposta</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-1 h-5 rounded-full bg-accent shrink-0" />
                      <span className="text-[11px] text-foreground font-medium">Etiqueta do projeto</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
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
