import { createContext, useContext, useState, useEffect, useMemo, ReactNode, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useSearchParams } from "react-router-dom";
import { useMotivosPerda } from "@/hooks/useDistribution";
import { formatProjetoLabel } from "@/lib/format-entity-labels";
import { toast } from "@/hooks/use-toast";

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
  // ── Data states ──
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [history, setHistory] = useState<StageHistory[]>([]);
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerCpfCnpj, setCustomerCpfCnpj] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [customerEmpresa, setCustomerEmpresa] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);
  const [allStagesMap, setAllStagesMap] = useState<Map<string, StageInfo[]>>(new Map());
  const [propostasCount, setPropostasCount] = useState(0);
  const [docsCount, setDocsCount] = useState(0);
  const [userNamesMap, setUserNamesMap] = useState<Map<string, string>>(new Map());

  // ── UI states ──
  const [searchParams, setSearchParams] = useSearchParams();
  const tabFromUrl = searchParams.get("tab") as TabId | null;
  

  const validTabs: TabId[] = ["gerenciamento", "comunicacao", "propostas", "documentos", "instalacao"];

  const [activeTab, setActiveTabState] = useState<TabId>(
    (tabFromUrl && validTabs.includes(tabFromUrl))
      ? tabFromUrl
      : "gerenciamento"
  );

  // React to tab param changes (e.g. clicking proposal icon on kanban)
  useEffect(() => {
    if (tabFromUrl && validTabs.includes(tabFromUrl)) {
      setActiveTabState(tabFromUrl);
      // Clear tab param from URL after applying (keep URL clean)
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
  const [dealEtiquetas, setDealEtiquetas] = useState<EtiquetaItem[]>([]);
  const [allEtiquetas, setAllEtiquetas] = useState<EtiquetaItem[]>([]);
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
    if (tabId === "propostas") return propostasCount;
    if (tabId === "documentos") return docsCount;
    return null;
  }, [propostasCount, docsCount]);

  const updateDealLocal = useCallback((patch: Partial<DealDetail>) => {
    setDeal(prev => prev ? { ...prev, ...patch } : prev);
  }, []);

  // ── Silent refresh ──
  const silentRefresh = useCallback(async () => {
    try {
      const { data: d } = await supabase.from("deals").select("id, title, value, kwp, status, created_at, updated_at, owner_id, pipeline_id, stage_id, customer_id, expected_close_date, motivo_perda_id, motivo_perda_obs, deal_num").eq("id", dealId).single();
      if (d) {
        setDeal(d as DealDetail);
        const [stagesRes, historyRes, ownerRes] = await Promise.all([
          supabase.from("pipeline_stages").select("id, name, position, is_closed, is_won, probability").eq("pipeline_id", (d as any).pipeline_id).order("position"),
          supabase.from("deal_stage_history").select("id, deal_id, from_stage_id, to_stage_id, moved_at, moved_by, metadata").eq("deal_id", dealId).order("moved_at", { ascending: false }),
          supabase.from("consultores").select("nome").eq("id", (d as any).owner_id).single(),
        ]);
        setStages((stagesRes.data || []) as StageInfo[]);
        setHistory((historyRes.data || []) as StageHistory[]);
        if (ownerRes.data) setOwnerName((ownerRes.data as any).nome);
      }
    } catch { /* silent */ }
  }, [dealId]);

  // ── Refresh customer ──
  const refreshCustomer = useCallback(async () => {
    if (!deal?.customer_id) return;
    const { data: c } = await supabase.from("clientes").select("nome, telefone, email, cpf_cnpj, empresa, rua, numero, bairro, cidade, estado, cep").eq("id", deal.customer_id).single();
    if (c) {
      const cl = c as any;
      setCustomerName(cl.nome);
      setCustomerPhone(cl.telefone || "");
      setCustomerEmail(cl.email || "");
      setCustomerCpfCnpj(cl.cpf_cnpj || "");
      setCustomerEmpresa(cl.empresa || "");
      const parts = [cl.rua, cl.numero ? `n° ${cl.numero}` : null, cl.bairro, cl.cidade ? `${cl.cidade} (${cl.estado || ""})` : null, cl.cep ? `CEP: ${cl.cep}` : null].filter(Boolean);
      setCustomerAddress(parts.join(", "));
    }
  }, [deal?.customer_id]);

  // ── Etiquetas ──
  const loadEtiquetas = useCallback(async () => {
    const [relRes, allRes] = await Promise.all([
      supabase.from("projeto_etiqueta_rel").select("etiqueta_id").eq("projeto_id", dealId),
      supabase.from("projeto_etiquetas").select("id, nome, cor, short, icon").eq("ativo", true).order("ordem"),
    ]);
    const allEts = (allRes.data || []) as EtiquetaItem[];
    setAllEtiquetas(allEts);
    const relIds = new Set((relRes.data || []).map((r: any) => r.etiqueta_id));
    setDealEtiquetas(allEts.filter(e => relIds.has(e.id)));
  }, [dealId]);

  const toggleEtiqueta = useCallback(async (etId: string) => {
    try {
      const has = dealEtiquetas.some(e => e.id === etId);
      if (has) {
        const { error } = await supabase.from("projeto_etiqueta_rel").delete().eq("projeto_id", dealId).eq("etiqueta_id", etId);
        if (error) { console.error("Erro ao remover etiqueta:", error); return; }
      } else {
        const { error } = await supabase.from("projeto_etiqueta_rel").insert({ projeto_id: dealId, etiqueta_id: etId } as any);
        if (error) { console.error("Erro ao adicionar etiqueta:", error); return; }
      }
      await loadEtiquetas();
    } catch (err) {
      console.error("toggleEtiqueta error:", err);
    }
  }, [dealId, dealEtiquetas, loadEtiquetas]);

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

  // ── Effects ──

  // Refresh proposals count on focus or after proposal changes
  useEffect(() => {
    const refreshCount = async () => {
      const { count } = await supabase
        .from("propostas_nativas")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", dealId)
        .neq("status", "excluida");
      setPropostasCount(count || 0);
    };
    refreshCount();
    const handleFocus = () => refreshCount();
    const handleVisibility = () => { if (document.visibilityState === "visible") refreshCount(); };
    const handlePropostasChanged = () => refreshCount();
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("propostas-changed", handlePropostasChanged);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("propostas-changed", handlePropostasChanged);
    };
  }, [dealId]);

  // Load deal data
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [dealRes, historyRes] = await Promise.all([
          supabase.from("deals").select("id, title, value, kwp, status, created_at, updated_at, owner_id, pipeline_id, stage_id, customer_id, expected_close_date, motivo_perda_id, motivo_perda_obs, deal_num").eq("id", dealId).single(),
          supabase.from("deal_stage_history").select("id, deal_id, from_stage_id, to_stage_id, moved_at, moved_by, metadata").eq("deal_id", dealId).order("moved_at", { ascending: false }),
        ]);

        if (dealRes.error) throw dealRes.error;
        const d = dealRes.data as DealDetail;
        setDeal(d);
        const historyData = (historyRes.data || []) as StageHistory[];
        setHistory(historyData);

        const movedByIds = [...new Set(historyData.map(h => h.moved_by).filter(Boolean))] as string[];
        if (movedByIds.length > 0) {
          supabase.from("profiles").select("user_id, nome").in("user_id", movedByIds)
            .then(({ data: profiles }) => {
              if (profiles) {
                const map = new Map<string, string>();
                (profiles as any[]).forEach(p => map.set(p.user_id, p.nome));
                setUserNamesMap(map);
              }
            });
        }

        const [stagesRes, customerRes, ownerRes, pipelinesRes, allStagesRes] = await Promise.all([
          supabase.from("pipeline_stages").select("id, name, position, is_closed, is_won, probability").eq("pipeline_id", d.pipeline_id).order("position"),
          d.customer_id ? supabase.from("clientes").select("nome, telefone, email, cpf_cnpj, empresa, rua, numero, bairro, cidade, estado, cep").eq("id", d.customer_id).single() : Promise.resolve({ data: null }),
          supabase.from("consultores").select("nome").eq("id", d.owner_id).single(),
          supabase.from("pipelines").select("id, name").eq("is_active", true).order("name"),
          supabase.from("pipeline_stages").select("id, name, position, pipeline_id, is_closed, is_won, probability").order("position"),
        ]);

        setStages((stagesRes.data || []) as StageInfo[]);
        if (customerRes.data) {
          const c = customerRes.data as any;
          setCustomerName(c.nome);
          setCustomerPhone(c.telefone || "");
          setCustomerEmail(c.email || "");
          setCustomerCpfCnpj(c.cpf_cnpj || "");
          setCustomerEmpresa(c.empresa || "");
          const parts = [c.rua, c.numero ? `n° ${c.numero}` : null, c.bairro, c.cidade ? `${c.cidade} (${c.estado || ""})` : null, c.cep ? `CEP: ${c.cep}` : null].filter(Boolean);
          setCustomerAddress(parts.join(", "));
        }
        if (ownerRes.data) setOwnerName((ownerRes.data as any).nome);
        if (pipelinesRes.data) setPipelines(pipelinesRes.data as PipelineInfo[]);
        if (allStagesRes.data) {
          const map = new Map<string, StageInfo[]>();
          (allStagesRes.data as any[]).forEach(s => {
            const arr = map.get(s.pipeline_id) || [];
            arr.push({ id: s.id, name: s.name, position: s.position, is_closed: s.is_closed, is_won: s.is_won, probability: s.probability });
            map.set(s.pipeline_id, arr);
          });
          setAllStagesMap(map);
        }

        supabase.from("profiles").select("tenant_id").limit(1).single().then(({ data: profile }) => {
          if (profile) {
            supabase.storage.from("projeto-documentos").list(`${(profile as any).tenant_id}/deals/${d.id}`, { limit: 100 })
              .then(({ data: files }) => setDocsCount(files?.length || 0));
          }
        });
      } catch (err) {
        console.error("ProjetoDetalhe:", err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [dealId]);

  // Load etiquetas
  useEffect(() => { loadEtiquetas(); }, [dealId, loadEtiquetas]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`deal-${dealId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "deals", filter: `id=eq.${dealId}` }, () => {
        silentRefresh();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "deal_stage_history", filter: `deal_id=eq.${dealId}` }, () => {
        silentRefresh();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [dealId, silentRefresh]);

  // ── Context value ──
  const value = useMemo<ProjetoDetalheContextValue>(() => ({
    dealId,
    onBack,
    initialPipelineId,
    deal,
    history,
    stages,
    loading,
    customerName,
    customerPhone,
    customerEmail,
    customerCpfCnpj,
    customerAddress,
    customerEmpresa,
    ownerName,
    pipelines,
    allStagesMap,
    propostasCount,
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
    deal, history, stages, loading,
    customerName, customerPhone, customerEmail, customerCpfCnpj, customerAddress, customerEmpresa,
    ownerName, pipelines, allStagesMap, propostasCount, docsCount, userNamesMap,
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
