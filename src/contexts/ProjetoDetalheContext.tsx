import { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useMotivosPerda } from "@/hooks/useDistribution";
import { formatProjetoLabel } from "@/lib/format-entity-labels";
import { toast } from "@/hooks/use-toast";
import {
  useProjetoDetalheData,
  useDealEtiquetas,
  useToggleEtiqueta,
  projetoDetalheKeys,
} from "@/hooks/useProjetoDetalheData";

// ─── Shared Types ──────────────────────────────────
export interface DealDetail {
  id: string;
  title: string;
  value: number;
  kwp: number | null;
  status: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  pipeline_id: string;
  stage_id: string;
  customer_id: string | null;
  expected_close_date: string | null;
  motivo_perda_id: string | null;
  motivo_perda_obs: string | null;
  deal_num: number | null;
}

export interface StageHistory {
  id: string;
  deal_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  moved_at: string;
  moved_by: string | null;
  metadata: any;
}

export interface StageInfo {
  id: string;
  name: string;
  position: number;
  is_closed: boolean;
  is_won: boolean;
  probability: number;
}

export interface PipelineInfo {
  id: string;
  name: string;
}

export type TabId = "gerenciamento" | "comunicacao" | "propostas" | "documentos" | "instalacao";

export interface EtiquetaItem {
  id: string;
  nome: string;
  cor: string;
  short: string | null;
  icon: string | null;
}

// ─── Context Value ─────────────────────────────────
export interface ProjetoDetalheContextValue {
  // Props
  dealId: string;
  onBack: () => void;
  initialPipelineId?: string;

  // Data
  deal: DealDetail | null;
  history: StageHistory[];
  stages: StageInfo[];
  loading: boolean;

  // Customer
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  customerCpfCnpj: string;
  customerAddress: string;
  customerEmpresa: string;
  ownerName: string;

  // Pipeline
  pipelines: PipelineInfo[];
  allStagesMap: Map<string, StageInfo[]>;

  // Counts
  propostasCount: number;
  docsCount: number;

  // Maps
  userNamesMap: Map<string, string>;

  // Etiquetas
  dealEtiquetas: EtiquetaItem[];
  allEtiquetas: EtiquetaItem[];
  etiquetaPopoverOpen: boolean;
  setEtiquetaPopoverOpen: (open: boolean) => void;
  toggleEtiqueta: (etId: string) => Promise<void>;

  // UI - Tabs
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;

  // UI - Delete dialog
  deleteDialogOpen: boolean;
  setDeleteDialogOpen: (open: boolean) => void;
  deleteBlocking: string[];
  setDeleteBlocking: (v: string[]) => void;
  deleting: boolean;
  handleDeleteProject: () => Promise<void>;

  // UI - Consultor dialog
  confirmConsultorId: string | null;
  setConfirmConsultorId: (id: string | null) => void;
  confirmConsultorName: string;
  handleConfirmConsultor: () => Promise<void>;

  // UI - Loss dialog
  lossDialogOpen: boolean;
  setLossDialogOpen: (open: boolean) => void;
  lossMotivo: string;
  setLossMotivo: (v: string) => void;
  lossObs: string;
  setLossObs: (v: string) => void;
  lossSaving: boolean;
  motivos: any[];
  loadingMotivos: boolean;
  handleConfirmLoss: () => Promise<void>;

  // Computed
  isClosed: boolean;
  currentStage: StageInfo | undefined;
  currentStageIndex: number;
  currentPipeline: PipelineInfo | undefined;
  projectCode: string;

  // Handlers
  silentRefresh: () => Promise<void>;
  refreshCustomer: () => Promise<void>;
  updateDealLocal: (patch: Partial<DealDetail>) => void;
  formatDate: (d: string) => string;
  getStageNameById: (id: string | null) => string;
  tabBadge: (tabId: string) => number | null;
}

// ─── Context ───────────────────────────────────────
const ProjetoDetalheContext = createContext<ProjetoDetalheContextValue | null>(null);

export function useProjetoDetalhe() {
  const ctx = useContext(ProjetoDetalheContext);
  if (!ctx) throw new Error("useProjetoDetalhe must be used within ProjetoDetalheProvider");
  return ctx;
}

// ─── Provider ──────────────────────────────────────
interface ProviderProps {
  dealId: string;
  onBack: () => void;
  initialPipelineId?: string;
  children: ReactNode;
}

export function ProjetoDetalheProvider({ dealId, onBack, initialPipelineId, children }: ProviderProps) {
  const queryClient = useQueryClient();

  // ── Data from hooks ──
  const { data: fullData, isLoading: loadingData } = useProjetoDetalheData(dealId);
  const { data: etiquetasData } = useDealEtiquetas(dealId);
  const toggleEtiquetaMutation = useToggleEtiqueta(dealId);

  // Propostas count
  const { data: propostasCountData = 0 } = usePropostasCount(dealId);

  // Derived data from query
  const deal = fullData?.deal ?? null;
  const history = fullData?.history ?? [];
  const stages = fullData?.stages ?? [];
  const customerName = fullData?.customerName ?? "";
  const customerPhone = fullData?.customerPhone ?? "";
  const customerEmail = fullData?.customerEmail ?? "";
  const customerCpfCnpj = fullData?.customerCpfCnpj ?? "";
  const customerAddress = fullData?.customerAddress ?? "";
  const customerEmpresa = fullData?.customerEmpresa ?? "";
  const ownerName = fullData?.ownerName ?? "";
  const pipelines = fullData?.pipelines ?? [];
  const allStagesMap = fullData?.allStagesMap ?? new Map<string, StageInfo[]>();
  const docsCount = fullData?.docsCount ?? 0;
  const userNamesMap = fullData?.userNamesMap ?? new Map<string, string>();
  const dealEtiquetas = etiquetasData?.dealEtiquetas ?? [];
  const allEtiquetas = etiquetasData?.allEtiquetas ?? [];

  // ── UI states ──
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as TabId | null;

  const validTabs: TabId[] = ["gerenciamento", "comunicacao", "propostas", "documentos", "instalacao"];

  const [activeTab, setActiveTabState] = useState<TabId>(
    (tabFromUrl && validTabs.includes(tabFromUrl))
      ? tabFromUrl
      : "gerenciamento"
  );

  // React to tab param changes
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTabState(tabFromUrl);
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete("tab");
        return next;
      }, { replace: true });
    }
  }, [tabFromUrl, setSearchParams]);

  const setActiveTab = useCallback((tab: TabId) => {
    setActiveTabState(tab);
  }, []);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBlocking, setDeleteBlocking] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [confirmConsultorId, setConfirmConsultorId] = useState<string | null>(null);
  const [confirmConsultorName, setConfirmConsultorName] = useState("");
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [lossMotivo, setLossMotivo] = useState("");
  const [lossObs, setLossObs] = useState("");
  const [lossSaving, setLossSaving] = useState(false);
  const [etiquetaPopoverOpen, setEtiquetaPopoverOpen] = useState(false);

  const { motivos, loading: loadingMotivos } = useMotivosPerda();

  // ── Computed ──
  const isClosed = deal?.status === "won" || deal?.status === "lost";
  const currentStage = useMemo(() => stages.find(s => s.id === deal?.stage_id), [stages, deal]);
  const currentStageIndex = useMemo(() => stages.findIndex(s => s.id === deal?.stage_id), [stages, deal]);
  const currentPipeline = useMemo(() => pipelines.find(p => p.id === deal?.pipeline_id), [pipelines, deal]);
  const projectCode = useMemo(() => {
    if (!deal) return "";
    return formatProjetoLabel({ id: deal.id, deal_num: deal.deal_num }).primary;
  }, [deal]);

  // ── Helpers ──
  const formatDate = useCallback((d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }),
  []);

  const getStageNameById = useCallback((id: string | null) => {
    if (!id) return "—";
    const found = stages.find(s => s.id === id);
    if (found) return found.name;
    for (const [, pStages] of allStagesMap) {
      const s = pStages.find(st => st.id === id);
      if (s) return s.name;
    }
    return "—";
  }, [stages, allStagesMap]);

  const tabBadge = useCallback((tabId: string) => {
    if (tabId === "propostas") return propostasCountData;
    if (tabId === "documentos") return docsCount;
    return null;
  }, [propostasCountData, docsCount]);

  const updateDealLocal = useCallback((patch: Partial<DealDetail>) => {
    queryClient.setQueryData(
      projetoDetalheKeys.detail(dealId),
      (old: any) => {
        if (!old) return old;
        return { ...old, deal: { ...old.deal, ...patch } };
      }
    );
  }, [dealId, queryClient]);

  // ── silentRefresh → invalidateQueries ──
  const silentRefresh = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: projetoDetalheKeys.detail(dealId) });
  }, [dealId, queryClient]);

  // ── refreshCustomer → invalidate deal detail + related queries ──
  const refreshCustomer = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: projetoDetalheKeys.detail(dealId) }),
      queryClient.invalidateQueries({ queryKey: ["clientes"] }),
      queryClient.invalidateQueries({ queryKey: ["clientes-ativos"] }),
      queryClient.invalidateQueries({ queryKey: ["clientes_list"] }),
    ]);
  }, [dealId, queryClient]);

  // ── toggleEtiqueta ──
  const toggleEtiqueta = useCallback(async (etId: string) => {
    try {
      const has = dealEtiquetas.some(e => e.id === etId);
      await toggleEtiquetaMutation.mutateAsync({ etId, has });
    } catch (err) {
      console.error("toggleEtiqueta error:", err);
    }
  }, [dealEtiquetas, toggleEtiquetaMutation]);

  // ── Delete handler ──
  const handleDeleteProject = useCallback(async () => {
    if (!deal) return;
    setDeleting(true);
    try {
      const propRes = deal.customer_id
        ? await supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("cliente_id", deal.customer_id).neq("status", "excluida")
        : { count: 0 };
      const histRes = await supabase.from("deal_stage_history").select("id", { count: "exact", head: true }).eq("deal_id", deal.id);
      const checkRes = await supabase.from("checklists_instalador").select("id", { count: "exact", head: true }).eq("projeto_id", deal.id);

      const depEntries: [string, number][] = [
        ["Propostas", propRes.count ?? 0],
        ["Histórico de etapas", histRes.count ?? 0],
        ["Checklists de instalação", checkRes.count ?? 0],
      ];
      const blocking: string[] = [];
      depEntries.forEach(([name, count]) => {
        if (count > 0) blocking.push(`${name} (${count})`);
      });

      if (blocking.length > 0) {
        setDeleteBlocking(blocking);
        setDeleteDialogOpen(true);
        setDeleting(false);
        return;
      }

      await supabase.from("deal_kanban_projection").delete().eq("deal_id", deal.id);
      const { error } = await supabase.from("deals").delete().eq("id", deal.id);
      if (error) throw error;

      toast({ title: "Projeto excluído com sucesso!" });
      onBack();
    } catch (err: any) {
      toast({ title: "Erro ao excluir projeto", description: err?.message || "Tente novamente.", variant: "destructive" });
    } finally {
      setDeleting(false);
    }
  }, [deal, onBack]);

  // ── Confirm consultor handler ──
  const handleConfirmConsultor = useCallback(async () => {
    if (!confirmConsultorId || !deal) return;
    const prev = deal.owner_id;
    const newId = confirmConsultorId;
    setConfirmConsultorId(null);
    updateDealLocal({ owner_id: newId });
    try {
      const { error } = await supabase.from("deals").update({ owner_id: newId }).eq("id", deal.id);
      if (error) throw error;
      toast({ title: "Consultor alterado" });
      silentRefresh();
    } catch (err: any) {
      updateDealLocal({ owner_id: prev });
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    }
  }, [confirmConsultorId, deal, updateDealLocal, silentRefresh]);

  // ── Loss handler ──
  const handleConfirmLoss = useCallback(async () => {
    if (!lossMotivo || !deal) return;
    setLossSaving(true);
    const prevStatus = deal.status;
    const prevStageId = deal.stage_id;
    const lostStage = stages.find(s => s.is_closed && !s.is_won);
    const update: any = {
      status: "lost",
      motivo_perda_id: lossMotivo,
      motivo_perda_obs: lossObs.trim() || null,
    };
    if (lostStage) update.stage_id = lostStage.id;
    updateDealLocal(update);
    try {
      const { error } = await supabase.from("deals").update(update).eq("id", deal.id);
      if (error) throw error;

      await supabase.from("propostas_nativas")
        .update({ status: "perdida" })
        .eq("projeto_id", deal.id);

      await supabase.from("comissoes")
        .update({ status: "cancelada", observacoes: "Projeto marcado como perdido" })
        .eq("projeto_id", deal.id)
        .eq("status", "pendente");

      if (deal.customer_id) {
        const { data: cli } = await supabase
          .from("clientes")
          .select("lead_id")
          .eq("id", deal.customer_id)
          .single();

        if (cli?.lead_id) {
          await supabase.from("leads")
            .update({
              status_id: "a07b8727-0331-4431-a7c1-30a8d2b2326b",
              motivo_perda_id: lossMotivo,
              motivo_perda_obs: lossObs.trim() || null,
            })
            .eq("id", cli.lead_id);
        }
      }

      toast({ title: "Projeto marcado como perdido" });
      setLossDialogOpen(false);
      silentRefresh();
    } catch (err: any) {
      updateDealLocal({ status: prevStatus, stage_id: prevStageId });
      toast({ title: "Erro", description: err.message, variant: "destructive" });
    } finally {
      setLossSaving(false);
    }
  }, [lossMotivo, lossObs, deal, stages, updateDealLocal, silentRefresh]);

  // ── Realtime subscription ──
  useEffect(() => {
    const channel = supabase
      .channel(`deal-${dealId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: `id=eq.${dealId}` }, () => {
        queryClient.invalidateQueries({ queryKey: projetoDetalheKeys.detail(dealId) });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_stage_history", filter: `deal_id=eq.${dealId}` }, () => {
        queryClient.invalidateQueries({ queryKey: projetoDetalheKeys.detail(dealId) });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dealId, queryClient]);

  // ── Context value ──
  const value = useMemo<ProjetoDetalheContextValue>(() => ({
    dealId,
    onBack,
    initialPipelineId,
    deal,
    history,
    stages,
    loading: loadingData,
    customerName,
    customerPhone,
    customerEmail,
    customerCpfCnpj,
    customerAddress,
    customerEmpresa,
    ownerName,
    pipelines,
    allStagesMap,
    propostasCount: propostasCountData,
    docsCount,
    userNamesMap,
    dealEtiquetas,
    allEtiquetas,
    etiquetaPopoverOpen,
    setEtiquetaPopoverOpen,
    toggleEtiqueta,
    activeTab,
    setActiveTab,
    deleteDialogOpen,
    setDeleteDialogOpen,
    deleteBlocking,
    setDeleteBlocking,
    deleting,
    handleDeleteProject,
    confirmConsultorId,
    setConfirmConsultorId,
    confirmConsultorName,
    handleConfirmConsultor,
    lossDialogOpen,
    setLossDialogOpen,
    lossMotivo,
    setLossMotivo,
    lossObs,
    setLossObs,
    lossSaving,
    motivos,
    loadingMotivos,
    handleConfirmLoss,
    isClosed,
    currentStage,
    currentStageIndex,
    currentPipeline,
    projectCode,
    silentRefresh,
    refreshCustomer,
    updateDealLocal,
    formatDate,
    getStageNameById,
    tabBadge,
  }), [
    dealId, onBack, initialPipelineId,
    deal, history, stages, loadingData,
    customerName, customerPhone, customerEmail, customerCpfCnpj, customerAddress, customerEmpresa,
    ownerName, pipelines, allStagesMap, propostasCountData, docsCount, userNamesMap,
    dealEtiquetas, allEtiquetas, etiquetaPopoverOpen,
    toggleEtiqueta, activeTab, deleteDialogOpen, deleteBlocking, deleting,
    handleDeleteProject, confirmConsultorId, confirmConsultorName, handleConfirmConsultor,
    lossDialogOpen, lossMotivo, lossObs, lossSaving, motivos, loadingMotivos, handleConfirmLoss,
    isClosed, currentStage, currentStageIndex, currentPipeline, projectCode,
    silentRefresh, refreshCustomer, updateDealLocal, formatDate, getStageNameById, tabBadge,
  ]);

  return (
    <ProjetoDetalheContext.Provider value={value}>
      {children}
    </ProjetoDetalheContext.Provider>
  );
}

// ─── Internal: propostas count query (kept from original) ──
function usePropostasCount(dealId: string) {
  return useQuery({
    queryKey: projetoDetalheKeys.propostasCount(dealId),
    queryFn: async () => {
      const { count } = await supabase
        .from("propostas_nativas")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", dealId)
        .neq("status", "excluida");
      return count || 0;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!dealId,
  });
}
