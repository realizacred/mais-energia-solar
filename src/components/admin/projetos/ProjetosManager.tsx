import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { formatKwp } from "@/lib/formatters/index";
import { useState, useEffect, useMemo, useCallback, useRef } from "react";
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
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";
import { useEnsureDefaultProjectPipeline } from "@/hooks/useDefaultPipeline";
import { useAuth } from "@/hooks/useAuth";
import { resolveDefaultCommercialPipeline } from "@/services/pipelines/resolveDefaultCommercialPipeline";

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
import { CentralPendencias } from "./CentralPendencias";
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
  const { user } = useAuth();
  const saveTimerRef = useRef<NodeJS.Timeout | null>(null);
  const {
    funis, etapas, etiquetas, projetos, consultores, loading,
    selectedFunilId, setSelectedFunilId,
    filters, applyFilters,
    selectedFunilEtapas, projetosByEtapa, consultorColumns,
    consultoresFilter,
    fetchAll,
    createFunil, renameFunil, toggleFunilAtivo, deleteFunil, reorderFunis,
    createEtapa, renameEtapa, updateEtapaCor, updateEtapaCategoria,
    reorderEtapas, deleteEtapa,
    moveProjetoToEtapa, moveProjetoToConsultor,
    dbPrefs,
  } = useProjetoPipeline();

  // Build etapa map for adapters (canonical source: projeto_etapas)
  const etapaMap = useMemo(() => new Map(etapas.map(e => [e.id, e])), [etapas]);
  const existingEtapaIds = useMemo(() => new Set(etapas.map(e => e.id)), [etapas]);

  // Adapted data for child components — columns come exclusively from projeto_etapas (Sistema B)
  const adaptedStages = useMemo(
    () => selectedFunilEtapas.map(etapaToPipelineStage),
    [selectedFunilEtapas]
  );

  // Filter out orphan projetos (etapa_id pointing to deleted/invalid stage)
  // so cards never land in the wrong column or in an empty bucket.
  // Also applies the status filter (Abertos/Ganhos/Perdidos/Excluídos) using
  // the canonical source: projeto_etapas.categoria.
  const validProjetos = useMemo(
    () => projetos.filter(p => p.etapa_id && existingEtapaIds.has(p.etapa_id)),
    [projetos, existingEtapaIds]
  );

  // Status do projeto considera categoria da etapa + status da proposta.
  // Proposta aceita (verde) é tratada como "ganho", não pode aparecer em "Abertos".
  const ACEITA_STATUSES = ["aceita", "accepted"];
  const RECUSADA_STATUSES = ["recusada", "rejeitada", "perdida", "rejected"];
  const resolveProjetoStatus = useCallback((p: ProjetoItem): string => {
    const proposta = (p.proposta_status || "").toLowerCase();
    
    // GOVERNANÇA: Apenas se o status da proposta for REALMENTE aceita/accepted
    if (ACEITA_STATUSES.includes(proposta)) return "ganho";
    if (RECUSADA_STATUSES.includes(proposta)) return "perdido";
    
    const etapa = p.etapa_id ? etapaMap.get(p.etapa_id) : null;
    return etapa?.categoria || "aberto";
  }, [etapaMap]);


  const statusFiltered = useMemo(() => {
    const status = filters.status;
    const tipoSolar = filters.tipoProjetoSolar;
    return validProjetos.filter((p) => {
      if (status && status !== "todos" && resolveProjetoStatus(p) !== status) return false;
      if (tipoSolar && tipoSolar !== "todos") {
        const t = (p.tipo_projeto_solar || "on_grid").toString();
        if (t !== tipoSolar) return false;
      }
      return true;
    });
  }, [validProjetos, filters.status, filters.tipoProjetoSolar, resolveProjetoStatus]);

  const adaptedDeals = useMemo(
    () => statusFiltered.map(p => projetoToCard(p, etapaMap)),
    [statusFiltered, etapaMap]
  );

  const adaptedOwnerColumns = useMemo(
    () => consultorColumns.map(c => ({
      ...c,
      projetos: c.projetos.filter(p => {
        if (!p.etapa_id || !existingEtapaIds.has(p.etapa_id)) return false;
        const status = filters.status;
        if (status && status !== "todos" && resolveProjetoStatus(p) !== status) return false;
        const tipoSolar = filters.tipoProjetoSolar;
        if (tipoSolar && tipoSolar !== "todos") {
          const t = (p.tipo_projeto_solar || "on_grid").toString();
          if (t !== tipoSolar) return false;
        }
        return true;
      }),
    })).map(c => consultorColumnToOwner(c, etapaMap)),
    [consultorColumns, etapaMap, existingEtapaIds, filters.status, filters.tipoProjetoSolar, resolveProjetoStatus]
  );

  // ── Persistent filter storage (per user) ──
  const STORAGE_KEY = useMemo(
    () => `projetos_kanban_prefs:${user?.id ?? "anon"}`,
    [user?.id]
  );

  const getStoredPrefs = useCallback(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      return JSON.parse(raw) as {
        viewMode?: string;
        funilId?: string | null;
        consultorId?: string;
        status?: string;
        tipoProjetoSolar?: string;
        etiquetaIds?: string[];
      };
    } catch { return null; }
  }, [STORAGE_KEY]);

  const savePrefs = useCallback(async (prefs: Record<string, any>) => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      const current = raw ? JSON.parse(raw) : {};
      const updated = { ...current, ...prefs };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

      if (!user?.id) return;

      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(async () => {
        try {
          const { data: currentProfile } = await supabase
            .from("profiles")
            .select("settings")
            .eq("user_id", user.id)
            .maybeSingle();

          const existingSettings = (currentProfile?.settings && typeof currentProfile.settings === "object")
            ? currentProfile.settings as Record<string, unknown>
            : {};

          const currentFiltros = existingSettings.projetos_filtros as Record<string, any> || {};
          const newFiltros = { ...currentFiltros, ...prefs };
          const newSettings = { ...existingSettings, projetos_filtros: newFiltros };

          await supabase
            .from("profiles")
            .update({ settings: newSettings as any })
            .eq("user_id", user.id);
        } catch (err) {
          console.error("Erro ao salvar preferências no banco:", err);
        }
      }, 1500);
    } catch { /* ignore */ }
  }, [STORAGE_KEY, user?.id]);

  const storedPrefs = useMemo(() => getStoredPrefs(), [getStoredPrefs]);

  const [searchParams, setSearchParams] = useSearchParams();

  // ── URL params ↔ filtros (URL = SSOT entre navegações) ──
  const urlFilters = useMemo(() => ({
    status: searchParams.get("status") || undefined,
    consultor: searchParams.get("consultor") || undefined,
    funil: searchParams.get("funil") || undefined,
    tipoSolar: searchParams.get("tipoSolar") || undefined,
    etiquetas: searchParams.get("etiquetas")?.split(",").filter(Boolean) || undefined,
    view: searchParams.get("view") || undefined,
  }), [searchParams]);

  const updateUrlFilter = useCallback((updates: Record<string, string | string[] | null | undefined>) => {
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      for (const [k, v] of Object.entries(updates)) {
        const isEmpty =
          v === null || v === undefined || v === "" ||
          v === "todos" || (Array.isArray(v) && v.length === 0);
        if (isEmpty) next.delete(k);
        else next.set(k, Array.isArray(v) ? v.join(",") : v);
      }
      return next;
    }, { replace: true });
  }, [setSearchParams]);

  const initialView =
    (urlFilters.view as any) ||
    (storedPrefs?.viewMode as any) ||
    (dbPrefs?.view as any) ||
    "kanban-consultor";

  const [viewMode, setViewModeRaw] = useState<"kanban-etapa" | "kanban-consultor" | "lista">(initialView);

  const setViewMode = (mode: "kanban-etapa" | "kanban-consultor" | "lista") => {
    setViewModeRaw(mode);
    savePrefs({ viewMode: mode });
    updateUrlFilter({ view: mode });
    if (mode === "kanban-consultor") {
      setSelectedFunilId(null);
      applyFilters({ funilId: null });
      savePrefs({ viewMode: mode, funilId: null });
      updateUrlFilter({ view: mode, funil: null });
    }
  };

  // Apply stored filters on mount.
  // Roda novamente quando funis chegam para validar funilId persistido (defesa contra
  // funil deletado) e respeita viewMode kanban-consultor (que NÃO deve filtrar funil).
  const [storedPrefsApplied, setStoredPrefsApplied] = useState(false);
  // Reset flag when storage key changes (user.id resolves async after first render).
  useEffect(() => { setStoredPrefsApplied(false); }, [STORAGE_KEY]);
  useEffect(() => {
    if (storedPrefsApplied) return;
    if (funis.length === 0) return; // aguarda metadata
    // Aguarda user.id resolver para não aplicar prefs do bucket "anon" e travar o flag.
    if (!user?.id) return;

    // URL params têm precedência sobre localStorage/DB para permitir
    // compartilhamento de URL e back/forward do navegador.
    const fromUrl = {
      status: urlFilters.status,
      consultorId: urlFilters.consultor,
      tipoProjetoSolar: urlFilters.tipoSolar,
      etiquetaIds: urlFilters.etiquetas,
      funilId: urlFilters.funil,
    };
    
    const dbFiltros = dbPrefs?.projetos_filtros || {};
    
    const source = {
      status: fromUrl.status ?? storedPrefs?.status ?? dbFiltros.status,
      consultorId: fromUrl.consultorId ?? storedPrefs?.consultorId ?? dbFiltros.consultorId,
      tipoProjetoSolar: fromUrl.tipoProjetoSolar ?? storedPrefs?.tipoProjetoSolar ?? dbFiltros.tipoProjetoSolar,
      etiquetaIds: fromUrl.etiquetaIds ?? storedPrefs?.etiquetaIds ?? dbFiltros.etiquetaIds,
      funilId: fromUrl.funilId ?? storedPrefs?.funilId ?? dbFiltros.funilId,
    };

    const updates: Record<string, any> = {};
    if (source.status && source.status !== "todos" && filters.status !== source.status) {
      updates.status = source.status;
    }
    if (source.consultorId && source.consultorId !== "todos" && filters.consultorId !== source.consultorId) {
      updates.consultorId = source.consultorId;
    }
    if (source.tipoProjetoSolar && source.tipoProjetoSolar !== "todos" && filters.tipoProjetoSolar !== source.tipoProjetoSolar) {
      updates.tipoProjetoSolar = source.tipoProjetoSolar;
    }
    if (Array.isArray(source.etiquetaIds) && source.etiquetaIds.length > 0) {
      const current = filters.etiquetaIds || [];
      const same = current.length === source.etiquetaIds.length && current.every((id) => source.etiquetaIds!.includes(id));
      if (!same) updates.etiquetaIds = source.etiquetaIds;
    }
    // Só aplica funilId se: (a) view não for por consultor; (b) funil ainda existe no tenant.
    const funilExiste = !!funis.find((f) => f.id === source.funilId);
    if (
      source.funilId &&
      funilExiste &&
      viewMode !== "kanban-consultor" &&
      filters.funilId !== source.funilId
    ) {
      updates.funilId = source.funilId;
      setSelectedFunilId(source.funilId);
    }
    if (Object.keys(updates).length > 0) {
      applyFilters(updates);
    }

    // Re-hidrata a URL a partir das prefs restauradas quando a URL veio vazia.
    // Garante que ?funil=...&status=... apareça mesmo após sair/voltar para a tela.
    const urlIsEmpty =
      !urlFilters.status && !urlFilters.consultor && !urlFilters.funil &&
      !urlFilters.tipoSolar && !urlFilters.etiquetas && !urlFilters.view;
    if (urlIsEmpty) {
      updateUrlFilter({
        status: source.status,
        consultor: source.consultorId,
        funil: viewMode === "kanban-consultor" ? null : (funilExiste ? source.funilId : null),
        tipoSolar: source.tipoProjetoSolar,
        etiquetas: source.etiquetaIds,
        view: (storedPrefs?.viewMode as string) || (dbPrefs?.view as string) || viewMode,
      });
    }

    setStoredPrefsApplied(true);
  }, [storedPrefs, urlFilters, funis, viewMode, filters, applyFilters, setSelectedFunilId, storedPrefsApplied, updateUrlFilter]);

  const [editingEtapasFunilId, setEditingEtapasFunilId] = useState<string | null>(null);
  const [novoProjetoOpen, setNovoProjetoOpen] = useState(false);
  const ensureProjectPipeline = useEnsureDefaultProjectPipeline();
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [defaultConsultorId, setDefaultConsultorId] = useState<string | undefined>();
  const [legendOpen, setLegendOpen] = useState(false);
  const [defaultStageId, setDefaultStageId] = useState<string | undefined>();
  const [defaultModalFunilId, setDefaultModalFunilId] = useState<string | undefined>();
  // searchParams já declarado acima (URL params dos filtros)
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
      updateUrlFilter({ funil: funilValue });
      if (funilValue && viewMode === "kanban-consultor") {
        setViewMode("kanban-etapa");
      }
    } else if (key === "status") {
      applyFilters({ status: value });
      savePrefs({ status: value });
      updateUrlFilter({ status: value });
    } else if (key === "ownerId") {
      applyFilters({ consultorId: value });
      savePrefs({ consultorId: value });
      updateUrlFilter({ consultor: value });
    } else if (key === "tipoProjetoSolar") {
      applyFilters({ tipoProjetoSolar: value });
      savePrefs({ tipoProjetoSolar: value });
      updateUrlFilter({ tipoSolar: value });
    } else if (key === "etiquetas") {
      applyFilters({ etiquetaIds: value });
      savePrefs({ etiquetaIds: value });
      updateUrlFilter({ etiquetas: value });
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
    applyFilters({ funilId: null, consultorId: "todos", status: "todos", search: "", tipoProjetoSolar: "todos", etiquetaIds: [] });
    setSelectedFunilId(null);
    try { localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    updateUrlFilter({ status: null, consultor: null, funil: null, tipoSolar: null, etiquetas: null });
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
    const selectedFunilName = funis.find(f => f.id === selectedFunilId)?.nome;

    return (
      <ProjetoDetalhe
        dealId={selectedProjetoId}
        onBack={() => { setSelectedProjetoId(null); fetchAll(); }}
        initialPipelineId={selectedFunilId || undefined}
        initialPipelineName={selectedFunilName}
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

          try {
            // ── RB-60/RB-61: cadeia obrigatória cliente → projeto → deal com vínculos duais ──
            const { tenantId } = await getCurrentTenantId();

            // 1) Garantir funil/etapa de PROJETO (mundo execução: projeto_funis/projeto_etapas)
            let funilId = data.pipelineId || funis[0]?.id || null;
            let etapaId =
              data.stageId ||
              etapas.find((e) => e.funil_id === funilId && e.ordem === 0)?.id ||
              null;

            if (!funilId || !etapaId) {
              const ensured = await ensureProjectPipeline.mutateAsync();
              funilId = ensured.id;
              const { data: firstEtapa, error: etapaErr } = await supabase
                .from("projeto_etapas")
                .select("id")
                .eq("funil_id", funilId)
                .order("ordem", { ascending: true })
                .limit(1)
                .maybeSingle();
              if (etapaErr) throw new Error(etapaErr.message);
              etapaId = firstEtapa?.id || null;
            }

            if (!funilId || !etapaId) {
              throw new Error("Não foi possível resolver funil/etapa de projeto.");
            }

            // 2) Garantir pipeline/stage COMERCIAL (mundo deals: pipelines/pipeline_stages)
            // SSOT: usar resolveDefaultCommercialPipeline (não pegar "primeiro por created_at").
            await supabase.rpc("ensure_tenant_default_pipeline", { _tenant_id: tenantId });

            const commercial = await resolveDefaultCommercialPipeline(tenantId);
            if (!commercial.pipelineId) throw new Error("Nenhum pipeline comercial disponível.");
            if (!commercial.stageId) throw new Error("Nenhuma etapa comercial disponível.");
            const comPipe = { id: commercial.pipelineId };
            const comStage = { id: commercial.stageId };

            // 3) INSERT projeto (com funil_id/etapa_id)
            const { data: newProjeto, error: projErr } = await supabase
              .from("projetos")
              .insert({
                cliente_id: clienteId,
                consultor_id: data.consultorId || null,
                funil_id: funilId,
                etapa_id: etapaId,
                nome: data.nome?.trim() ? data.nome.trim() : null,
                valor_total: data.valor || 0,
                observacoes: data.descricao || null,
                status: "criado" as any,
                tipo_projeto_solar: data.tipoProjetoSolar || "on_grid",
              } as any)
              .select("id")
              .single();
            if (projErr || !newProjeto?.id) {
              throw new Error(projErr?.message || "Falha ao criar projeto.");
            }

            // 4) INSERT deal vinculado ao projeto (RB-60: nunca projeto sem deal)
            const { data: newDeal, error: dealErr } = await supabase
              .from("deals")
              .insert({
                title: data.nome || data.cliente.nome,
                customer_id: clienteId,
                owner_id: data.consultorId || null,
                pipeline_id: comPipe.id,
                stage_id: comStage.id,
                projeto_id: newProjeto.id,
                value: data.valor || 0,
                status: "open",
              } as any)
              .select("id")
              .single();

            if (dealErr || !newDeal?.id) {
              // Rollback do projeto: sem deal o projeto fica órfão (RB-60)
              await supabase.from("projetos").delete().eq("id", newProjeto.id);
              throw new Error(dealErr?.message || "Falha ao criar deal.");
            }

            // 5) UPDATE projeto.deal_id
            const { error: updErr } = await supabase
              .from("projetos")
              .update({ deal_id: newDeal.id } as any)
              .eq("id", newProjeto.id);
            if (updErr) {
              console.error("[NovoProjeto] Falha ao vincular deal_id:", updErr.message);
            }

            // Etiqueta opcional
            if (data.etiqueta) {
              await supabase.from("projeto_etiqueta_rel").insert({
                projeto_id: newProjeto.id,
                etiqueta_id: data.etiqueta,
              } as any);
            }

            toast({ title: "Projeto criado", description: "Projeto, deal e vínculos criados com sucesso." });
            setSelectedProjetoId(newProjeto.id);
          } catch (err: any) {
            console.error("[NovoProjeto] Erro:", err);
            toast({
              title: "Erro ao criar projeto",
              description: err?.message || "Falha desconhecida.",
              variant: "destructive",
            });
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
            <TabsTrigger value="pendencias" className="gap-1.5 text-xs">
              <Clock className="h-4 w-4" />
              <span className="hidden sm:inline">Pendências</span>
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
                  filterTipoProjetoSolar={filters.tipoProjetoSolar || "todos"}
                  onFilterTipoProjetoSolarChange={(v) => handleFilterChange("tipoProjetoSolar", v)}
                  etiquetas={dynamicEtiquetas.map(e => ({ id: e.id, nome: e.nome, cor: e.cor, tenant_id: "" }))}
                  filterEtiquetas={filters.etiquetaIds || []}
                  onFilterEtiquetasChange={(ids) => { applyFilters({ etiquetaIds: ids }); savePrefs({ etiquetaIds: ids }); updateUrlFilter({ etiquetas: ids }); }}
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
                     return await deleteFunil(id) ?? true;
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
                    projetos={statusFiltered}
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
                      <span className="text-[11px] text-foreground font-medium">Negociação ganha</span>
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
        <TabsContent value="pendencias" className="mt-0">
          <CentralPendencias 
            projetos={projetos} 
            onViewProjeto={(p, tab) => {
              if (tab) {
                setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  next.set("projeto", p.deal_id || p.id);
                  next.set("tab", tab);
                  return next;
                }, { replace: true });
              } else {
                setSelectedProjetoId(p.deal_id || p.id);
              }
            }} 
            loading={loading}
          />
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
