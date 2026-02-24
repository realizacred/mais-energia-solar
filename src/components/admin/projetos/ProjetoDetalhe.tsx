import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { formatProjetoLabel, formatPropostaLabel } from "@/lib/format-entity-labels";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useMotivosPerda } from "@/hooks/useDistribution";
import { Spinner } from "@/components/ui-kit/Spinner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Settings, MessageSquare, FileText, FolderOpen,
  Clock, User, ChevronRight, Zap, DollarSign, CalendarDays, Loader2,
  Upload, Trash2, Download, Eye, Plus, ExternalLink, Phone, StickyNote, Filter,
  MoreVertical, Trophy, XCircle, UserCircle, Mail, MapPin, Hash, Check, Link2,
  AlertCircle, CheckCircle, Building, Paperclip, Copy, Pencil, Send, Activity,
  ChevronDown, SunMedium, Bell, Users, Tag
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { SunLoader } from "@/components/loading/SunLoader";
import { toast } from "@/hooks/use-toast";
import { VariableMapperPanel } from "./VariableMapperPanel";
import { ProjetoDocChecklist } from "./ProjetoDocChecklist";
import { ProjetoMultiPipelineManager } from "./ProjetoMultiPipelineManager";
import { ProjetoChatTab } from "./ProjetoChatTab";
import { PropostaExpandedDetail } from "./PropostaExpandedDetail";

// ─── Types ──────────────────────────────────────────
interface DealDetail {
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

interface StageHistory {
  id: string;
  deal_id: string;
  from_stage_id: string | null;
  to_stage_id: string;
  moved_at: string;
  moved_by: string | null;
  metadata: any;
}

interface StageInfo {
  id: string;
  name: string;
  position: number;
  is_closed: boolean;
  is_won: boolean;
  probability: number;
}

interface PropostaNativa {
  id: string;
  titulo: string;
  codigo: string | null;
  proposta_num: number | null;
  versao_atual: number;
  status: string;
  created_at: string;
  cliente_nome: string | null;
  versoes: {
    id: string;
    versao_numero: number;
    valor_total: number | null;
    potencia_kwp: number | null;
    status: string;
    economia_mensal: number | null;
    payback_meses: number | null;
    geracao_mensal: number | null;
    created_at: string;
  }[];
}

interface StorageFile {
  name: string;
  id: string | null;
  created_at: string | null;
  metadata: { size?: number; mimetype?: string } | null;
}

interface PipelineInfo {
  id: string;
  name: string;
}

interface Props {
  dealId: string;
  onBack: () => void;
  initialPipelineId?: string;
}

const TABS = [
  { id: "gerenciamento", label: "Gerenciamento", icon: Settings, color: "text-secondary" },
  { id: "chat", label: "Chat Whatsapp", icon: MessageSquare, color: "text-success" },
  { id: "propostas", label: "Propostas", icon: FileText, color: "text-primary" },
  
  { id: "vinculo", label: "Vínculo de Contrato", icon: Link2, color: "text-info" },
  { id: "documentos", label: "Documentos", icon: FolderOpen, color: "text-warning" },
] as const;

type TabId = typeof TABS[number]["id"];

export function ProjetoDetalhe({ dealId, onBack, initialPipelineId }: Props) {
  const navigate = useNavigate();
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [history, setHistory] = useState<StageHistory[]>([]);
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerCpfCnpj, setCustomerCpfCnpj] = useState("");
  const [customerAddress, setCustomerAddress] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("gerenciamento");
  const [pipelines, setPipelines] = useState<PipelineInfo[]>([]);
  const [allStagesMap, setAllStagesMap] = useState<Map<string, StageInfo[]>>(new Map());
  const [propostasCount, setPropostasCount] = useState(0);
  const [docsCount, setDocsCount] = useState(0);
  const [userNamesMap, setUserNamesMap] = useState<Map<string, string>>(new Map());
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteBlocking, setDeleteBlocking] = useState<string[]>([]);
  const [deleting, setDeleting] = useState(false);
  const [confirmConsultorId, setConfirmConsultorId] = useState<string | null>(null);
  const [confirmConsultorName, setConfirmConsultorName] = useState("");
  // Loss dialog state
  const [lossDialogOpen, setLossDialogOpen] = useState(false);
  const [lossMotivo, setLossMotivo] = useState("");
  const [lossObs, setLossObs] = useState("");
  const [lossSaving, setLossSaving] = useState(false);
  const { motivos, loading: loadingMotivos } = useMotivosPerda();
  const [dealEtiquetas, setDealEtiquetas] = useState<{id: string; nome: string; cor: string; short: string | null; icon: string | null}[]>([]);
  const [allEtiquetas, setAllEtiquetas] = useState<{id: string; nome: string; cor: string; short: string | null; icon: string | null}[]>([]);
  const [etiquetaPopoverOpen, setEtiquetaPopoverOpen] = useState(false);

  const isClosed = deal?.status === "won" || deal?.status === "lost";

  // ─── Delete logic (unchanged) ──────────────────
  const handleDeleteProject = async () => {
    if (!deal) return;
    setDeleting(true);
    try {
      const propRes = deal.customer_id
        ? await supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("cliente_id", deal.customer_id)
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
  };
  // ─── Refresh proposals count on focus (after wizard navigation)
  // Query propostas_nativas.deal_id directly (no projetos indirection)
  useEffect(() => {
    const refreshCount = async () => {
      const { count } = await supabase
        .from("propostas_nativas")
        .select("id", { count: "exact", head: true })
        .eq("deal_id", dealId);
      setPropostasCount(count || 0);
    };
    refreshCount(); // initial count
    const handleFocus = () => refreshCount();
    const handleVisibility = () => { if (document.visibilityState === "visible") refreshCount(); };
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [dealId]);

  // ─── Load deal data (unchanged) ────────────────
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
          d.customer_id ? supabase.from("clientes").select("nome, telefone, email, cpf_cnpj, rua, numero, bairro, cidade, estado, cep").eq("id", d.customer_id).single() : Promise.resolve({ data: null }),
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

        // Proposals count is handled by the focus/visibility useEffect above

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

  // ─── Load etiquetas ────────────────────────────
  const loadEtiquetas = async () => {
    const [relRes, allRes] = await Promise.all([
      supabase.from("projeto_etiqueta_rel").select("etiqueta_id").eq("projeto_id", dealId),
      supabase.from("projeto_etiquetas").select("id, nome, cor, short, icon").eq("ativo", true).order("ordem"),
    ]);
    const allEts = (allRes.data || []) as any[];
    setAllEtiquetas(allEts);
    const relIds = new Set((relRes.data || []).map((r: any) => r.etiqueta_id));
    setDealEtiquetas(allEts.filter(e => relIds.has(e.id)));
  };

  useEffect(() => { loadEtiquetas(); }, [dealId]);

  const toggleEtiqueta = async (etId: string) => {
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
  };

  // ─── Realtime subscription for auto-refresh ────
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
  }, [dealId]);

  const currentStage = useMemo(() => stages.find(s => s.id === deal?.stage_id), [stages, deal]);
  const currentStageIndex = useMemo(() => stages.findIndex(s => s.id === deal?.stage_id), [stages, deal]);
  const currentPipeline = useMemo(() => pipelines.find(p => p.id === deal?.pipeline_id), [pipelines, deal]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  // formatBRL imported from @/lib/formatters at file top

  const getStageNameById = (id: string | null) => {
    if (!id) return "—";
    // Search current pipeline stages first
    const found = stages.find(s => s.id === id);
    if (found) return found.name;
    // Search ALL pipelines stages (for cross-pipeline history)
    for (const [, pStages] of allStagesMap) {
      const s = pStages.find(st => st.id === id);
      if (s) return s.name;
    }
    return "—";
  };

  const updateDealLocal = (patch: Partial<DealDetail>) => {
    setDeal(prev => prev ? { ...prev, ...patch } : prev);
  };

  const silentRefresh = async () => {
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
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24">
        <SunLoader size="lg" style="spin" />
        <p className="mt-4 text-sm text-muted-foreground">Carregando projeto...</p>
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        <p>Projeto não encontrado.</p>
        <Button variant="ghost" onClick={onBack} className="mt-4">Voltar</Button>
      </div>
    );
  }

  const tabBadge = (tabId: string) => {
    if (tabId === "propostas") return propostasCount;
    if (tabId === "documentos") return docsCount;
    
    return null;
  };

  const _projetoLabel = formatProjetoLabel({ id: deal.id, deal_num: deal.deal_num });
  const projectCode = _projetoLabel.primary;

  return (
    <div className="min-h-screen bg-muted/30 -m-4 sm:-m-6 p-3 sm:p-6 max-w-full overflow-x-hidden">
      {/* ── Breadcrumbs ── */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <button onClick={onBack} className="hover:text-foreground transition-colors">Projetos</button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{projectCode}</span>
      </div>

      {/* ── Header Card ── */}
      <Card className="mb-4 overflow-hidden">
        <CardContent className="p-4 sm:p-5">
          {/* Row 1: Title + Etiquetas + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-wrap">
              <h1 className="text-lg sm:text-2xl font-bold text-foreground truncate max-w-full">
                {customerName || deal.title}
              </h1>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => { setDeleteBlocking([]); handleDeleteProject(); }}
                    disabled={deleting}
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    {deleting ? "Excluindo..." : "Excluir Projeto"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              {/* Etiquetas vinculadas */}
              {dealEtiquetas.map(et => (
                <Badge key={et.id} variant="outline" className="text-xs shrink-0 gap-1" style={{ borderColor: et.cor, color: et.cor }}>
                  {et.icon && <span>{et.icon}</span>}
                  {et.short || et.nome}
                </Badge>
              ))}

              {/* + Etiqueta */}
              <Popover open={etiquetaPopoverOpen} onOpenChange={setEtiquetaPopoverOpen}>
                <PopoverTrigger asChild>
                  <button className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                    <Plus className="h-3.5 w-3.5" />
                    Etiqueta
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2" align="start">
                  <p className="text-xs font-semibold text-muted-foreground mb-2 px-1">Etiquetas</p>
                  {allEtiquetas.length === 0 ? (
                    <p className="text-xs text-muted-foreground px-1 py-2">Nenhuma etiqueta cadastrada</p>
                  ) : (
                    <div className="space-y-0.5 max-h-48 overflow-y-auto">
                      {allEtiquetas.map(et => {
                        const isSelected = dealEtiquetas.some(e => e.id === et.id);
                        return (
                          <button
                            key={et.id}
                            type="button"
                            className={cn(
                              "flex items-center gap-2 w-full text-left px-2 py-1.5 rounded text-xs transition-colors cursor-pointer",
                              isSelected ? "bg-primary/10 text-foreground" : "hover:bg-muted text-muted-foreground"
                            )}
                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleEtiqueta(et.id); }}
                          >
                            <span className="h-3 w-3 rounded-full shrink-0" style={{ backgroundColor: et.cor }} />
                            <span className="flex-1 truncate">{et.nome}</span>
                            {isSelected && <Check className="h-3.5 w-3.5 text-primary shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </PopoverContent>
              </Popover>
            </div>

            {/* Right side: status badges + consultor */}
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <Badge
                variant="secondary"
                className={cn(
                  "text-xs shrink-0 capitalize",
                  deal.status === "won" && "bg-success/10 text-success border-success/20",
                  deal.status === "lost" && "bg-destructive/10 text-destructive border-destructive/20",
                  deal.status === "open" && "bg-info/10 text-info border-info/20"
                )}
              >
                {deal.status === "won" ? "Ganho" : deal.status === "lost" ? "Perdido" : "Aberto"}
              </Badge>
              {deal.value > 0 && (
                <Badge variant="outline" className="text-xs shrink-0 font-semibold">
                  {formatBRL(deal.value)}
                </Badge>
              )}
              <Badge variant="outline" className="text-xs shrink-0 gap-1.5 bg-primary/5 border-primary/20 text-primary font-semibold">
                <UserCircle className="h-3.5 w-3.5" />
                {ownerName || "Sem consultor"}
              </Badge>
            </div>
          </div>

          {/* Row 2: Tabs */}
          <div className="flex items-center border-b border-border/60 -mx-4 sm:-mx-5 px-2 sm:px-5 overflow-x-auto scrollbar-hide overflow-y-hidden">
            {TABS.map(tab => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              const badge = tabBadge(tab.id);
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-all border-b-2 -mb-[1px]",
                    isActive
                      ? "border-primary text-foreground"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
                  )}
                >
                  <Icon className={cn("h-4 w-4", isActive ? tab.color : "text-muted-foreground")} />
                  {tab.label}
                  {badge !== null && (
                    <span className="ml-1 bg-primary/10 text-primary text-[10px] font-bold rounded-full px-1.5 py-0.5">{badge}</span>
                  )}
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ── Multi-Pipeline Manager ── */}
      {activeTab === "gerenciamento" && (
        <Card className="mb-4">
          <CardContent className="p-4 sm:p-5">
            <ProjetoMultiPipelineManager
              dealId={deal.id}
              dealStatus={deal.status}
              pipelines={pipelines}
              allStagesMap={allStagesMap}
              onMembershipChange={silentRefresh}
              initialPipelineId={initialPipelineId}
            />
          </CardContent>
        </Card>
      )}

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.12 }}
        >
          {activeTab === "gerenciamento" && (
            <GerenciamentoTab
              deal={deal} history={history} stages={stages}
              customerName={customerName} customerPhone={customerPhone}
              customerEmail={customerEmail} customerCpfCnpj={customerCpfCnpj}
              customerAddress={customerAddress}
              ownerName={ownerName}
              currentStage={currentStage} currentPipeline={currentPipeline}
              formatDate={formatDate} formatBRL={formatBRL} getStageNameById={getStageNameById}
              userNamesMap={userNamesMap}
            />
          )}
          {activeTab === "chat" && (
            <ProjetoChatTab customerId={deal.customer_id} customerPhone={customerPhone} />
          )}
          {activeTab === "propostas" && (
            <PropostasTab customerId={deal.customer_id} dealId={deal.id} dealTitle={deal.title} navigate={navigate} isClosed={isClosed} />
          )}
          {activeTab === "vinculo" && (
            <VariableMapperPanel
              dealId={deal.id}
              customerId={deal.customer_id}
              onGenerateContract={() => {
                toast({ title: "Geração de contrato", description: "Funcionalidade será conectada ao motor de documentos." });
              }}
            />
          )}
          {activeTab === "documentos" && (
            <DocumentosTab dealId={deal.id} />
          )}
        </motion.div>
      </AnimatePresence>

      {/* ── Confirm consultor change dialog ── */}
      <AlertDialog open={!!confirmConsultorId} onOpenChange={(open) => { if (!open) setConfirmConsultorId(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Trocar consultor?</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja realmente trocar o consultor responsável por este projeto?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmConsultorId(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={async () => {
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
            }}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Delete blocking dialog ── */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Não é possível excluir este projeto</AlertDialogTitle>
            <AlertDialogDescription>
              Existem registros vinculados que impedem a exclusão: <strong>{deleteBlocking.join(", ")}</strong>. Remova ou desassocie esses registros primeiro.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Entendi</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── Loss reason dialog ── */}
      <Dialog open={lossDialogOpen} onOpenChange={setLossDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" />
              Registrar Perda do Projeto
            </DialogTitle>
            <DialogDescription>
              Informe o motivo da perda de <strong>{customerName || deal.title}</strong>. Após isso, o projeto será bloqueado para edições.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label>Motivo de Perda *</Label>
              {loadingMotivos ? (
                <div className="flex items-center gap-2 py-2">
                  <Spinner size="sm" />
                  <span className="text-sm text-muted-foreground">Carregando motivos...</span>
                </div>
              ) : motivos.filter(m => m.ativo).length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">
                  Nenhum motivo cadastrado. Configure em Cadastros → Status de Leads.
                </p>
              ) : (
                <Select value={lossMotivo} onValueChange={setLossMotivo}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Selecione o motivo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {motivos.filter(m => m.ativo).map((m) => (
                      <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div>
              <Label>Observações (opcional)</Label>
              <Textarea
                value={lossObs}
                onChange={(e) => setLossObs(e.target.value)}
                rows={3}
                placeholder="Detalhes adicionais sobre a perda..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLossDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="destructive"
              disabled={!lossMotivo || lossSaving}
              onClick={async () => {
                if (!lossMotivo) return;
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

                  // CASCADE: Mark all project proposals as "perdida"
                  await supabase.from("propostas_nativas")
                    .update({ status: "perdida" })
                    .eq("projeto_id", deal.id);

                  // CASCADE: Cancel pending commissions linked to this project
                  await supabase.from("comissoes")
                    .update({ status: "cancelada", observacoes: "Projeto marcado como perdido" })
                    .eq("projeto_id", deal.id)
                    .eq("status", "pendente");

                  // CASCADE: Mark linked lead as "Perdido"
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
              }}
            >
              {lossSaving && <Spinner size="sm" className="mr-2" />}
              Registrar Perda
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── Consultor Options (lazy loaded) ─────────────
// ═══════════════════════════════════════════════════
function ConsultorOptions({ onResolveName }: { onResolveName?: (id: string, name: string) => void }) {
  const [consultores, setConsultores] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    supabase.from("consultores").select("id, nome").eq("ativo", true).order("nome")
      .then(({ data }) => {
        if (data) {
          setConsultores(data as any[]);
          if (onResolveName) (data as any[]).forEach(c => onResolveName(c.id, c.nome));
        }
      });
  }, []);
  return <>{consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</>;
}

// PipelineSwitcher removed — replaced by ProjetoMultiPipelineManager

// ═══════════════════════════════════════════════════
// ─── TAB: Gerenciamento (Dense Dashboard Grid) ──
// ═══════════════════════════════════════════════════

type TimelineFilter = "todos" | "atividades" | "notas" | "funil" | "projeto" | "proposta";

const TIMELINE_FILTERS: { id: TimelineFilter; label: string; icon: typeof ChevronRight }[] = [
  { id: "todos", label: "Todas", icon: Filter },
  { id: "atividades", label: "Atividades", icon: Activity },
  { id: "notas", label: "Notas", icon: StickyNote },
  { id: "funil", label: "Funil", icon: Zap },
  { id: "projeto", label: "Projeto", icon: Settings },
  { id: "proposta", label: "Proposta", icon: FileText },
];

interface UnifiedTimelineItem {
  id: string;
  type: "funil" | "nota" | "documento" | "criacao" | "atividade" | "projeto" | "proposta";
  title: string;
  subtitle?: string;
  date: string;
  isCurrent?: boolean;
  isFirst?: boolean;
}

function GerenciamentoTab({
  deal, history, stages,
  customerName, customerPhone, customerEmail, customerCpfCnpj, customerAddress,
  ownerName, currentStage, currentPipeline,
  formatDate, formatBRL, getStageNameById, userNamesMap,
}: {
  deal: DealDetail; history: StageHistory[]; stages: StageInfo[];
  customerName: string; customerPhone: string; customerEmail: string;
  customerCpfCnpj: string; customerAddress: string;
  ownerName: string; currentStage?: StageInfo; currentPipeline?: PipelineInfo;
  formatDate: (d: string) => string; formatBRL: (v: number) => string;
  getStageNameById: (id: string | null) => string;
  userNamesMap: Map<string, string>;
}) {
  const navigate = useNavigate();
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("todos");
  const [docEntries, setDocEntries] = useState<UnifiedTimelineItem[]>([]);
  const [projectEventEntries, setProjectEventEntries] = useState<UnifiedTimelineItem[]>([]);
  const [propostaEntries, setPropostaEntries] = useState<UnifiedTimelineItem[]>([]);
  const [noteDialogOpen, setNoteDialogOpen] = useState(false);
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDescription, setActivityDescription] = useState("");
  const [activityDueDate, setActivityDueDate] = useState("");
  const [activityType, setActivityType] = useState<string>("task");
  const [activityAssignedTo, setActivityAssignedTo] = useState<string>("");
  const [activityNotifySystem, setActivityNotifySystem] = useState(true);
  const [activityNotifyWa, setActivityNotifyWa] = useState(false);
  const [teamMembers, setTeamMembers] = useState<Array<{ user_id: string; nome: string }>>([]);
  const [savingNote, setSavingNote] = useState(false);
  const [savingActivity, setSavingActivity] = useState(false);
  const [notes, setNotes] = useState<Array<{ id: string; content: string; created_at: string; created_by_name?: string }>>([]);
  const [activities, setActivities] = useState<Array<{ id: string; title: string; description?: string; activity_type: string; due_date?: string; status: string; created_at: string }>>([]);

  // Custom fields marked as important
  const [importantFields, setImportantFields] = useState<Array<{ id: string; title: string; field_key: string; field_type: string; options: any }>>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, { value_text?: string | null; value_number?: number | null; value_boolean?: boolean | null; value_date?: string | null }>>({});

  // Load important custom fields + values
  useEffect(() => {
    async function loadImportantFields() {
      try {
        const { data: fields } = await supabase
          .from("deal_custom_fields")
          .select("id, title, field_key, field_type, options")
          .eq("is_active", true)
          .eq("field_context", "projeto")
          .eq("important_on_funnel", true)
          .order("ordem");
        if (!fields || fields.length === 0) { setImportantFields([]); return; }
        setImportantFields(fields as any);

        const fieldIds = fields.map((f: any) => f.id);
        const { data: values } = await supabase
          .from("deal_custom_field_values")
          .select("field_id, value_text, value_number, value_boolean, value_date")
          .eq("deal_id", deal.id)
          .in("field_id", fieldIds);
        if (values) {
          const map: Record<string, any> = {};
          values.forEach((v: any) => { map[v.field_id] = v; });
          setCustomFieldValues(map);
        }
      } catch { /* ignore */ }
    }
    loadImportantFields();
  }, [deal.id]);
  useEffect(() => {
    async function loadNotes() {
      try {
        const { data } = await supabase
          .from("deal_notes")
          .select("id, content, created_at, created_by")
          .eq("deal_id", deal.id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (data) {
          setNotes(data.map((n: any) => ({
            ...n,
            created_by_name: n.created_by ? (userNamesMap.get(n.created_by) || "Usuário") : "Sistema",
          })));
        }
      } catch { /* ignore */ }
    }
    loadNotes();
  }, [deal.id, userNamesMap]);

  // Load activities
  useEffect(() => {
    async function loadActivities() {
      try {
        const { data } = await supabase
          .from("deal_activities")
          .select("id, title, description, activity_type, due_date, status, created_at")
          .eq("deal_id", deal.id)
          .order("due_date", { ascending: true, nullsFirst: false })
          .limit(50);
        if (data) setActivities(data as any);
      } catch { /* ignore */ }
    }
    loadActivities();
  }, [deal.id]);

  // Save note
  const handleSaveNote = async () => {
    if (!noteText.trim()) return;
    setSavingNote(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", userId).limit(1).single();
      const { data, error } = await supabase.from("deal_notes").insert({
        deal_id: deal.id,
        content: noteText.trim(),
        tenant_id: (profile as any)?.tenant_id,
        created_by: userId,
      } as any).select("id, content, created_at, created_by").single();
      if (error) throw error;
      if (data) {
        setNotes(prev => [{ ...(data as any), created_by_name: "Você" }, ...prev]);
        setNoteText("");
        setNoteDialogOpen(false);
        toast({ title: "Nota adicionada", description: "A nota foi salva com sucesso." });
      }
    } catch (err: any) {
      toast({ title: "Erro ao salvar nota", description: err.message, variant: "destructive" });
    } finally { setSavingNote(false); }
  };

  // Load team members for activity assignment
  useEffect(() => {
    if (!activityDialogOpen) return;
    async function loadTeam() {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) return;
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", userId).limit(1).single();
      if (!profile) return;
      const { data: members } = await supabase
        .from("profiles")
        .select("user_id, nome")
        .eq("tenant_id", (profile as any).tenant_id)
        .eq("ativo", true)
        .order("nome");
      if (members) setTeamMembers(members as any);
    }
    loadTeam();
  }, [activityDialogOpen]);

  // Save activity
  const handleSaveActivity = async () => {
    if (!activityTitle.trim()) return;
    setSavingActivity(true);
    try {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData?.user?.id;
      if (!userId) throw new Error("Usuário não autenticado");
      const { data: profile } = await supabase.from("profiles").select("tenant_id").eq("user_id", userId).limit(1).single();
      const { data, error } = await supabase.from("deal_activities").insert({
        deal_id: deal.id,
        title: activityTitle.trim(),
        description: activityDescription.trim() || null,
        activity_type: activityType as any,
        due_date: activityDueDate || null,
        assigned_to: activityAssignedTo || null,
        tenant_id: (profile as any)?.tenant_id,
        created_by: userId,
      } as any).select("id, title, description, activity_type, due_date, status, created_at").single();
      if (error) throw error;
      if (data) {
        setActivities(prev => [data as any, ...prev]);
        setActivityTitle("");
        setActivityDescription("");
        setActivityDueDate("");
        setActivityType("task");
        setActivityAssignedTo("");
        setActivityNotifySystem(true);
        setActivityNotifyWa(false);
        setActivityDialogOpen(false);
        toast({ title: "Atividade criada", description: "A atividade foi salva com sucesso." });
      }
    } catch (err: any) {
      toast({ title: "Erro ao salvar atividade", description: err.message, variant: "destructive" });
    } finally { setSavingActivity(false); }
  };

  // Toggle activity status
  const handleToggleActivity = async (activityId: string, currentStatus: string) => {
    const newStatus = currentStatus === "done" ? "pending" : "done";
    try {
      await supabase.from("deal_activities").update({ status: newStatus }).eq("id", activityId);
      setActivities(prev => prev.map(a => a.id === activityId ? { ...a, status: newStatus } : a));
    } catch { /* ignore */ }
  };

  // Load document activity for timeline
  useEffect(() => {
    async function loadDocEntries() {
      try {
        const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
        if (!profile) return;
        const path = `${(profile as any).tenant_id}/deals/${deal.id}`;
        const { data } = await supabase.storage
          .from("projeto-documentos")
          .list(path, { limit: 50, sortBy: { column: "created_at", order: "desc" } });
        if (data && data.length > 0) {
          setDocEntries(data.map((f: any) => ({
            id: `doc-${f.name}`,
            type: "documento" as const,
            title: `Documento: ${f.name.replace(/^\d+_/, "")}`,
            subtitle: f.metadata?.size ? `${(f.metadata.size / 1024).toFixed(0)} KB` : undefined,
            date: f.created_at ? formatDate(f.created_at) : "—",
          })));
        }
      } catch { /* ignore */ }
    }
    loadDocEntries();
  }, [deal.id, formatDate]);

  // Load project_events for timeline
  useEffect(() => {
    async function loadProjectEvents() {
      try {
        const { data } = await supabase
          .from("project_events")
          .select("id, event_type, from_value, to_value, actor_user_id, created_at, metadata")
          .eq("deal_id", deal.id)
          .order("created_at", { ascending: false })
          .limit(50);
        if (data && data.length > 0) {
          const EVENT_LABELS: Record<string, string> = {
            stage_changed: "Etapa alterada",
            status_changed: "Status alterado",
            owner_changed: "Responsável alterado",
            value_changed: "Valor alterado",
            pipeline_added: "Adicionado ao funil",
            pipeline_removed: "Removido do funil",
            consultor_changed: "Consultor alterado",
          };
          setProjectEventEntries(data.map((e: any) => ({
            id: `pe-${e.id}`,
            type: "projeto" as const,
            title: EVENT_LABELS[e.event_type] || e.event_type,
            subtitle: e.from_value && e.to_value
              ? `${e.from_value} → ${e.to_value}`
              : e.to_value || e.from_value || undefined,
            date: formatDate(e.created_at),
          })));
        }
      } catch { /* ignore */ }
    }
    loadProjectEvents();
  }, [deal.id, formatDate]);

  // Load proposal events for timeline
  useEffect(() => {
    async function loadPropostaEvents() {
      try {
        const { data } = await supabase
          .from("propostas_nativas")
          .select("id, titulo, status, created_at, codigo")
          .eq("projeto_id", deal.id)
          .order("created_at", { ascending: false })
          .limit(20);
        if (data && data.length > 0) {
          setPropostaEntries(data.map((p: any) => ({
            id: `prop-${p.id}`,
            type: "proposta" as const,
            title: `Proposta: ${p.titulo}`,
            subtitle: `${p.codigo || "—"} • Status: ${p.status}`,
            date: formatDate(p.created_at),
          })));
        }
      } catch { /* ignore */ }
    }
    loadPropostaEvents();
  }, [deal.id, formatDate]);

  // Build unified timeline
  const allEntries = useMemo(() => {
    const entries: UnifiedTimelineItem[] = [];
    if (currentStage) {
      entries.push({
        id: "current-stage", type: "funil",
        title: `Etapa atual: ${currentStage.name}`,
        subtitle: `Probabilidade: ${currentStage.probability}%`,
        date: formatDate(deal.updated_at), isCurrent: true,
      });
    }
    history.forEach(h => {
      entries.push({
        id: h.id, type: "funil",
        title: h.from_stage_id
          ? `Movido de "${getStageNameById(h.from_stage_id)}" para "${getStageNameById(h.to_stage_id)}"`
          : `Incluído na etapa "${getStageNameById(h.to_stage_id)}"`,
        subtitle: h.moved_by ? `Por: ${userNamesMap.get(h.moved_by) || h.moved_by}` : undefined,
        date: formatDate(h.moved_at),
      });
    });
    // Activities
    activities.forEach(a => {
      entries.push({
        id: `act-${a.id}`, type: "atividade",
        title: `${a.activity_type === "task" ? "Tarefa" : a.activity_type === "call" ? "Ligação" : a.activity_type === "meeting" ? "Reunião" : "Atividade"}: ${a.title}`,
        subtitle: a.status === "done" ? "✓ Concluída" : a.due_date ? `Até ${formatDate(a.due_date)}` : undefined,
        date: formatDate(a.created_at),
      });
    });
    // Notes from DB
    notes.forEach(n => {
      entries.push({
        id: `note-${n.id}`, type: "nota",
        title: "Nota adicionada",
        subtitle: n.content.length > 100 ? n.content.substring(0, 100) + "..." : n.content,
        date: formatDate(n.created_at),
      });
    });
    entries.push(...docEntries);
    entries.push(...projectEventEntries);
    entries.push(...propostaEntries);
    entries.push({ id: "criacao", type: "criacao", title: "Projeto criado", date: formatDate(deal.created_at), isFirst: true });
    return entries;
  }, [history, currentStage, deal, docEntries, projectEventEntries, propostaEntries, notes, activities, formatDate, getStageNameById, userNamesMap]);

  const filteredEntries = useMemo(() => {
    if (timelineFilter === "todos") return allEntries;
    if (timelineFilter === "atividades") return allEntries.filter(e => e.type === "atividade");
    if (timelineFilter === "notas") return allEntries.filter(e => e.type === "nota");
    if (timelineFilter === "funil") return allEntries.filter(e => e.type === "funil" || e.type === "criacao");
    if (timelineFilter === "projeto") return allEntries.filter(e => e.type === "projeto");
    if (timelineFilter === "proposta") return allEntries.filter(e => e.type === "proposta");
    return allEntries;
  }, [allEntries, timelineFilter]);

  const getEntryIcon = (entry: UnifiedTimelineItem) => {
    if (entry.type === "funil") return <Zap className="h-3 w-3 text-primary" />;
    if (entry.type === "nota") return <StickyNote className="h-3 w-3 text-warning" />;
    if (entry.type === "documento") return <FolderOpen className="h-3 w-3 text-info" />;
    if (entry.type === "atividade") return <Activity className="h-3 w-3 text-success" />;
    if (entry.type === "projeto") return <Settings className="h-3 w-3 text-secondary" />;
    if (entry.type === "proposta") return <FileText className="h-3 w-3 text-primary" />;
    return <CalendarDays className="h-3 w-3 text-secondary" />;
  };


  const activityTypeLabels: Record<string, string> = {
    task: "Tarefa",
    call: "Ligação",
    meeting: "Reunião",
    email: "E-mail",
    visit: "Visita",
    follow_up: "Follow-up",
    other: "Outro",
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* ── LEFT SIDEBAR (30%) ── */}
        <div className="lg:col-span-4 xl:col-span-3 space-y-4">
          {/* Card: Dados do Cliente */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 p-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="h-4 w-4 text-secondary" />
                Dados do Cliente
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-7 w-7">
                    <MoreVertical className="h-3.5 w-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem><Eye className="h-3.5 w-3.5 mr-2" />Ver ficha completa</DropdownMenuItem>
                  <DropdownMenuItem><Pencil className="h-3.5 w-3.5 mr-2" />Editar cliente</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => customerPhone && navigator.clipboard.writeText(customerPhone)}>
                    <Copy className="h-3.5 w-3.5 mr-2" />Copiar telefone
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => customerEmail && navigator.clipboard.writeText(customerEmail)}>
                    <Copy className="h-3.5 w-3.5 mr-2" />Copiar e-mail
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {customerPhone && (
                    <DropdownMenuItem onClick={() => navigate("/admin/whatsapp")}>
                      <Send className="h-3.5 w-3.5 mr-2" />Abrir WhatsApp interno
                    </DropdownMenuItem>
                  )}
                  {customerEmail && (
                    <DropdownMenuItem onClick={() => window.open(`mailto:${customerEmail}`, "_blank")}>
                      <Mail className="h-3.5 w-3.5 mr-2" />Enviar e-mail
                    </DropdownMenuItem>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              <div className="space-y-2.5">
                <ClientRow icon={User} label={customerName || "—"} />
                {customerCpfCnpj && <ClientRow icon={Hash} label={customerCpfCnpj} muted onCopy={() => { navigator.clipboard.writeText(customerCpfCnpj); toast({ title: "CPF/CNPJ copiado" }); }} />}
                {customerPhone && (
                  <ClientRow
                    icon={Phone}
                    label={customerPhone}
                    muted
                    onCopy={() => { navigator.clipboard.writeText(customerPhone); toast({ title: "Telefone copiado" }); }}
                    onAction={() => window.open(`https://wa.me/${customerPhone.replace(/\D/g, "")}`, "_blank")}
                    actionIcon={MessageSquare}
                    actionTooltip="Abrir WhatsApp"
                  />
                )}
                {customerEmail && (
                  <ClientRow
                    icon={Mail}
                    label={customerEmail}
                    muted
                    isLink
                    onCopy={() => { navigator.clipboard.writeText(customerEmail); toast({ title: "E-mail copiado" }); }}
                    onAction={() => window.open(`mailto:${customerEmail}`, "_blank")}
                    actionIcon={Send}
                    actionTooltip="Enviar e-mail"
                  />
                )}
                {customerAddress && <ClientRow icon={MapPin} label={customerAddress} muted onCopy={() => { navigator.clipboard.writeText(customerAddress); toast({ title: "Endereço copiado" }); }} />}
              </div>
            </CardContent>
          </Card>

          {/* Custom fields marked as important — only if any exist */}
          {importantFields.length > 0 && (
            <Card>
              <CardHeader className="pb-2 p-4">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertCircle className="h-3.5 w-3.5 text-primary" />
                  Campos Importantes
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-0">
                <div className="space-y-2 text-xs">
                  {importantFields.map(field => {
                    const val = customFieldValues[field.id];
                    let displayValue = "—";
                    if (val) {
                      if (field.field_type === "boolean") {
                        displayValue = val.value_boolean ? "Sim" : "Não";
                      } else if (field.field_type === "number" || field.field_type === "currency") {
                        displayValue = val.value_number != null ? String(val.value_number) : "—";
                      } else if (field.field_type === "date") {
                        displayValue = val.value_date ? new Date(val.value_date).toLocaleDateString("pt-BR") : "—";
                      } else {
                        displayValue = val.value_text || "—";
                      }
                    }
                    return <InfoRow key={field.id} label={field.title} value={displayValue} />;
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Card: Documentos Pendentes */}
          <ProjetoDocChecklist dealId={deal.id} />
        </div>

        {/* ── RIGHT WORK AREA (70%) ── */}
        <div className="lg:col-span-8 xl:col-span-9 space-y-4">
          {/* Card: Atividades */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 p-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-warning" />
                Atividades a fazer
              </CardTitle>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setActivityDialogOpen(true)}>
                <Plus className="h-3 w-3" /> Nova atividade
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <div className="h-11 w-11 rounded-xl bg-warning/10 flex items-center justify-center mb-3">
                    <AlertCircle className="h-5 w-5 text-warning" />
                  </div>
                  <p className="text-sm font-semibold text-foreground">Nenhuma atividade encontrada</p>
                  <p className="text-xs text-muted-foreground mt-1">Crie uma atividade para acompanhar este projeto</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map(a => (
                    <div
                      key={a.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                        a.status === "done" ? "bg-muted/30 border-border/40" : "bg-card border-border hover:bg-muted/20"
                      )}
                    >
                      <button
                        onClick={() => handleToggleActivity(a.id, a.status)}
                        className={cn(
                          "mt-0.5 h-4 w-4 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors",
                          a.status === "done"
                            ? "bg-primary border-primary"
                            : "border-muted-foreground/40 hover:border-primary"
                        )}
                      >
                        {a.status === "done" && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className={cn("text-sm font-medium", a.status === "done" && "line-through text-muted-foreground")}>
                          {a.title}
                        </p>
                        {a.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{a.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-1.5">
                          <Badge variant="outline" className="text-[10px] h-5">
                            {activityTypeLabels[a.activity_type] || a.activity_type}
                          </Badge>
                          {a.due_date && (
                            <span className={cn(
                              "text-[10px]",
                              new Date(a.due_date) < new Date() && a.status !== "done"
                                ? "text-destructive font-medium"
                                : "text-muted-foreground"
                            )}>
                              {new Date(a.due_date).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Histórico / Timeline */}
          <Card>
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 p-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                Histórico
              </CardTitle>
              <Button variant="ghost" size="sm" className="gap-1 text-xs h-7" onClick={() => setNoteDialogOpen(true)}>
                <Plus className="h-3 w-3" /> Nova nota
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {/* Filter pills */}
              <div className="flex items-center gap-1 mb-4">
                {TIMELINE_FILTERS.map(f => {
                  const isActive = timelineFilter === f.id;
                  const count = f.id === "todos" ? null :
                    f.id === "funil" ? allEntries.filter(e => e.type === "funil" || e.type === "criacao").length :
                    f.id === "notas" ? allEntries.filter(e => e.type === "nota").length :
                    f.id === "atividades" ? allEntries.filter(e => e.type === "atividade").length :
                    f.id === "projeto" ? allEntries.filter(e => e.type === "projeto").length :
                    f.id === "proposta" ? allEntries.filter(e => e.type === "proposta").length :
                    0;
                  return (
                    <button
                      key={f.id}
                      onClick={() => setTimelineFilter(f.id)}
                      className={cn(
                        "flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:bg-accent hover:text-foreground"
                      )}
                    >
                      {f.label}
                      {count !== null && count > 0 && (
                        <span className={cn("text-[10px]", isActive ? "opacity-80" : "")}>{count}</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Timeline */}
              {filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                  <p className="text-sm">Nenhuma atividade nesta categoria</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-border rounded-full" />
                  <div className="space-y-3">
                    {filteredEntries.map(entry => (
                      <TimelineEntry
                        key={entry.id}
                        icon={getEntryIcon(entry)}
                        title={entry.title}
                        subtitle={entry.subtitle}
                        date={entry.date}
                        isCurrent={entry.isCurrent}
                        isFirst={entry.isFirst}
                      />
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Dialog: Nova Nota */}
      <Dialog open={noteDialogOpen} onOpenChange={setNoteDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Nota</DialogTitle>
            <DialogDescription>Adicione uma observação ou anotação a este projeto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Textarea
              placeholder="Escreva sua nota aqui..."
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNoteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveNote} disabled={!noteText.trim() || savingNote}>
              {savingNote ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Atividade */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Atividade</DialogTitle>
            <DialogDescription>Crie uma tarefa ou atividade para este projeto.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Título *</Label>
              <Input
                placeholder="Ex: Ligar para o cliente"
                value={activityTitle}
                onChange={e => setActivityTitle(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Tipo</Label>
              <Select value={activityType} onValueChange={setActivityType}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="task">Tarefa</SelectItem>
                  <SelectItem value="call">Ligação</SelectItem>
                  <SelectItem value="meeting">Reunião</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="visit">Visita</SelectItem>
                  <SelectItem value="follow_up">Follow-up</SelectItem>
                  <SelectItem value="other">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Data e hora de vencimento</Label>
              <Input
                type="datetime-local"
                value={activityDueDate}
                onChange={e => setActivityDueDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Users className="h-3.5 w-3.5" /> Atribuir a
              </Label>
              <Select value={activityAssignedTo} onValueChange={setActivityAssignedTo}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Selecione um membro..." />
                </SelectTrigger>
                <SelectContent>
                  {teamMembers.map(m => (
                    <SelectItem key={m.user_id} value={m.user_id}>{m.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Descrição</Label>
              <Textarea
                placeholder="Detalhes adicionais..."
                value={activityDescription}
                onChange={e => setActivityDescription(e.target.value)}
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs font-medium flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5" /> Notificar via
              </Label>
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activityNotifySystem}
                    onChange={e => setActivityNotifySystem(e.target.checked)}
                    className="rounded border-border h-4 w-4 accent-primary"
                  />
                  Sistema
                </label>
                <label className="flex items-center gap-2 text-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={activityNotifyWa}
                    onChange={e => setActivityNotifyWa(e.target.checked)}
                    className="rounded border-border h-4 w-4 accent-primary"
                  />
                  WhatsApp
                </label>
              </div>
              <p className="text-[10px] text-muted-foreground">O criador da atividade sempre será notificado.</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setActivityDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveActivity} disabled={!activityTitle.trim() || savingActivity}>
              {savingActivity ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Criar atividade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ═══════════════════════════════════════════════════
// ─── Client Info Row ─────────────────────────────
// ═══════════════════════════════════════════════════
function ClientRow({ icon: Icon, label, muted, isLink, onCopy, onAction, actionIcon: ActionIcon, actionTooltip }: {
  icon: typeof User;
  label: string;
  muted?: boolean;
  isLink?: boolean;
  onCopy?: () => void;
  onAction?: () => void;
  actionIcon?: typeof User;
  actionTooltip?: string;
}) {
  const iconColorMap: Record<string, string> = {
    User: "text-secondary",
    Hash: "text-muted-foreground",
    Phone: "text-info",
    Mail: "text-primary",
    MapPin: "text-warning",
  };
  const iconColor = iconColorMap[Icon.displayName || ""] || "text-secondary";
  return (
    <div className="flex items-center gap-2.5 group">
      <Icon className={cn("h-3.5 w-3.5 shrink-0", iconColor)} />
      <span className={cn(
        "text-sm leading-snug flex-1 min-w-0 truncate",
        muted ? "text-muted-foreground" : "font-medium text-foreground",
        isLink && "text-primary"
      )}>
        {label}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {onCopy && (
          <button
            onClick={onCopy}
            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            title="Copiar"
          >
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        {onAction && ActionIcon && (
          <button
            onClick={onAction}
            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            title={actionTooltip}
          >
            <ActionIcon className="h-3 w-3 text-success" />
          </button>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── TAB: Propostas ─────────────────────────────
// ═══════════════════════════════════════════════════
interface LinkedOrcamento {
  id: string;
  orc_code: string | null;
  lead_id: string;
  lead_code: string | null;
  media_consumo: number;
  consumo_previsto: number;
  tipo_telhado: string;
  rede_atendimento: string;
  estado: string;
  cidade: string;
  status_id: string | null;
  status_nome?: string;
  created_at: string;
}

function PropostasTab({ customerId, dealId, dealTitle, navigate, isClosed }: { customerId: string | null; dealId: string; dealTitle: string; navigate: any; isClosed?: boolean }) {
  const [propostas, setPropostas] = useState<PropostaNativa[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkedOrcs, setLinkedOrcs] = useState<LinkedOrcamento[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  // Refetch when tab/window regains focus (user navigated back from wizard)
  useEffect(() => {
    const handleFocus = () => setRefreshKey(k => k + 1);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") handleFocus();
    });
    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
    };
  }, []);

  // Load proposals — query propostas_nativas.deal_id directly
  useEffect(() => {
    async function load() {
      if (!dealId && !customerId) { setLoading(false); return; }
      setLoading(true);
      try {
        let query = supabase
          .from("propostas_nativas")
          .select("id, titulo, codigo, proposta_num, versao_atual, status, created_at, cliente_id, clientes(nome)")
          .order("created_at", { ascending: false })
          .limit(20);

        if (dealId) {
          query = query.eq("deal_id", dealId);
        } else if (customerId) {
          query = query.eq("cliente_id", customerId);
        }

        const { data } = await query;

        if (data && data.length > 0) {
          const ids = data.map(p => p.id);
          const { data: versoes } = await supabase
            .from("proposta_versoes")
            .select("id, proposta_id, versao_numero, valor_total, potencia_kwp, status, economia_mensal, payback_meses, created_at, snapshot")
            .in("proposta_id", ids)
            .order("versao_numero", { ascending: false });

          // Fetch UCs for geracao_mensal
          const versaoIds = (versoes || []).map((v: any) => v.id);
          let geracaoMap = new Map<string, number>();
          if (versaoIds.length > 0) {
            const { data: ucs } = await supabase
              .from("proposta_versao_ucs")
              .select("versao_id, geracao_mensal_estimada")
              .in("versao_id", versaoIds);
            if (ucs) {
              for (const uc of ucs as any[]) {
                const cur = geracaoMap.get(uc.versao_id) || 0;
                geracaoMap.set(uc.versao_id, cur + (uc.geracao_mensal_estimada || 0));
              }
            }
          }

          const mapped: PropostaNativa[] = data.map((p: any) => ({
            id: p.id,
            titulo: p.titulo,
            codigo: p.codigo,
            proposta_num: p.proposta_num,
            versao_atual: p.versao_atual,
            status: p.status,
            created_at: p.created_at,
            cliente_nome: p.clientes?.nome || null,
            versoes: (versoes || []).filter(v => (v as any).proposta_id === p.id).map(v => {
              const snap = (v as any).snapshot as any;
              // Fallback: calculate potencia from snapshot items
              let potencia = (v as any).potencia_kwp;
              if ((!potencia || potencia === 0) && snap?.itens) {
                const modulos = (snap.itens as any[]).filter((i: any) => i.categoria === "modulo" || i.categoria === "modulos");
                if (modulos.length > 0) {
                  potencia = modulos.reduce((s: number, m: any) => s + ((m.potencia_w || 0) * (m.quantidade || 1)) / 1000, 0);
                }
              }
              // Fallback: calculate geracao from snapshot UCs or from potência × irradiação
              let geracao = geracaoMap.get((v as any).id) || null;
              if ((!geracao || geracao === 0) && snap?.ucs) {
                const totalGeracao = (snap.ucs as any[]).reduce((s: number, uc: any) => s + (uc.geracao_mensal_estimada || 0), 0);
                if (totalGeracao > 0) geracao = totalGeracao;
              }
              // Ultimate fallback: potência × irradiação × 30 × PR(0.80)
              if ((!geracao || geracao === 0) && potencia > 0 && snap?.locIrradiacao > 0) {
                geracao = Math.round(potencia * snap.locIrradiacao * 30 * 0.80);
              }
              return {
                id: (v as any).id,
                versao_numero: (v as any).versao_numero,
                valor_total: (v as any).valor_total,
                potencia_kwp: potencia,
                status: (v as any).status,
                economia_mensal: (v as any).economia_mensal,
                payback_meses: (v as any).payback_meses,
                created_at: (v as any).created_at,
                geracao_mensal: geracao,
              };
            }),
          }));
          setPropostas(mapped);
        } else {
          setPropostas([]);
        }
      } catch (err) { console.error("PropostasTab:", err); }
      finally { setLoading(false); }
    }
    load();
  }, [customerId, dealId, refreshKey]);

  // Lead discovery by customer phone
  useEffect(() => {
    if (!customerId) return;
    setLoadingLeads(true);
    (async () => {
      try {
        const { data: cliente } = await supabase
          .from("clientes")
          .select("telefone, telefone_normalized, lead_id")
          .eq("id", customerId)
          .single();
        if (!cliente?.telefone) { setLoadingLeads(false); return; }

        const digits = (cliente.telefone_normalized || cliente.telefone).replace(/\D/g, "");
        const suffix = digits.slice(-9);

        const { data: leads } = await (supabase as any)
          .from("leads")
          .select("id, lead_code")
          .or(`telefone_normalized.ilike.%${suffix}%,telefone.ilike.%${suffix}%`)
          .limit(10);

        if (leads && leads.length > 0) {
          const leadIds = leads.map((l: any) => l.id);
          const leadCodeMap = new Map<string, string>();
          leads.forEach((l: any) => leadCodeMap.set(l.id, l.lead_code));

          const { data: orcs } = await supabase
            .from("orcamentos")
            .select("id, orc_code, lead_id, media_consumo, consumo_previsto, tipo_telhado, rede_atendimento, estado, cidade, status_id, created_at")
            .in("lead_id", leadIds)
            .order("created_at", { ascending: false })
            .limit(20);

          if (orcs && orcs.length > 0) {
            const statusIds = [...new Set(orcs.map((o: any) => o.status_id).filter(Boolean))] as string[];
            let statusMap = new Map<string, string>();
            if (statusIds.length > 0) {
              const { data: statuses } = await supabase
                .from("lead_status")
                .select("id, nome")
                .in("id", statusIds);
              (statuses || []).forEach((s: any) => statusMap.set(s.id, s.nome));
            }

            setLinkedOrcs(orcs.map((o: any) => ({
              ...o,
              lead_code: leadCodeMap.get(o.lead_id) || null,
              status_nome: o.status_id ? statusMap.get(o.status_id) || "—" : "—",
            })));
          }
        }
      } catch (err) { console.error("Lead discovery:", err); }
      finally { setLoadingLeads(false); }
    })();
  }, [customerId]);

  if (loading) return <div className="flex justify-center py-12"><SunLoader style="spin" /></div>;

  // Principal = latest (first in array, already sorted desc)
  const principal = propostas.length > 0 ? propostas[0] : null;
  const outras = propostas.slice(1);

  // Render a proposal card using the new expanded detail component
  const renderPropostaCard = (p: PropostaNativa, isPrincipal: boolean) => {
    return (
      <PropostaExpandedDetail
        key={p.id}
        proposta={p}
        isPrincipal={isPrincipal}
        isExpanded={expandedId === p.id}
        onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
        dealId={dealId}
        customerId={customerId}
        onRefresh={() => setRefreshKey(k => k + 1)}
      />
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">
          Propostas ({propostas.length})
        </h3>
        {isClosed ? (
          <Badge variant="secondary" className="text-xs bg-destructive/10 text-destructive border-destructive/20">
            <AlertCircle className="h-3 w-3 mr-1" />
            Projeto fechado
          </Badge>
        ) : (
          <Button size="sm" onClick={() => {
            const params = new URLSearchParams({ deal_id: dealId });
            if (customerId) params.set("customer_id", customerId);
            navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
          }} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />Nova proposta
          </Button>
        )}
      </div>

      {/* Lead discovery cards */}
      {linkedOrcs.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5" /> Orçamentos (Leads) vinculados
          </p>
          <div className="grid gap-2 sm:grid-cols-2">
            {linkedOrcs.map(orc => (
              <Card
                key={orc.id}
                className="cursor-pointer transition-all hover:shadow-md hover:ring-2 hover:ring-primary/50"
                onClick={() => {
                  if (isClosed) return;
                  const params = new URLSearchParams({ deal_id: dealId });
                  if (customerId) params.set("customer_id", customerId);
                  params.set("lead_id", orc.lead_id);
                  params.set("orc_id", orc.id);
                  navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
                }}
              >
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-mono font-bold text-primary">
                        {orc.orc_code || `ORC-${orc.id.slice(0, 6)}`}
                      </span>
                      {orc.lead_code && (
                        <Badge variant="outline" className="text-[9px] font-mono">
                          {orc.lead_code}
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[9px]">
                        {orc.status_nome}
                      </Badge>
                      {!isClosed && (
                        <Badge variant="secondary" className="text-[9px] gap-1 bg-primary/10 text-primary border-primary/20">
                          <Plus className="h-2.5 w-2.5" /> Criar Proposta
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-[11px]">
                    <div>
                      <p className="text-muted-foreground">Consumo</p>
                      <p className="font-semibold">{orc.consumo_previsto || orc.media_consumo || 0} kWh</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Telhado</p>
                      <p className="font-semibold truncate">{orc.tipo_telhado || "N/A"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Fase</p>
                      <p className="font-semibold truncate">{orc.rede_atendimento || "N/A"}</p>
                    </div>
                  </div>
                  <div className="mt-1 text-[10px] text-muted-foreground">
                    {orc.cidade && `${orc.cidade}, ${orc.estado}`} • {new Date(orc.created_at).toLocaleDateString("pt-BR")}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Proposals */}
      {propostas.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <FileText className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">Nenhuma proposta encontrada</p>
            <p className="text-xs mt-1">
              {customerId ? "Crie a primeira proposta para este cliente" : "Vincule um cliente ao projeto primeiro"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Proposta principal */}
          {principal && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-foreground">Proposta principal</p>
              {renderPropostaCard(principal, true)}
            </div>
          )}

          {/* Outras propostas */}
          {outras.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-bold text-foreground">Outras propostas</p>
              <div className="space-y-2">
                {outras.map(p => renderPropostaCard(p, false))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ChatTab moved to ProjetoChatTab.tsx

// ═══════════════════════════════════════════════════
// ─── TAB: Documentos ────────────────────────────
// ═══════════════════════════════════════════════════

const DOC_STATUS_MAP: Record<string, { label: string; color: string }> = {
  draft: { label: "Rascunho", color: "bg-muted text-muted-foreground" },
  generated: { label: "Gerado", color: "bg-info/10 text-info" },
  sent_for_signature: { label: "Aguardando assinatura", color: "bg-warning/10 text-warning" },
  signed: { label: "Assinado", color: "bg-success/10 text-success" },
  cancelled: { label: "Cancelado", color: "bg-destructive/10 text-destructive" },
};

const DOC_CATEGORY_LABELS: Record<string, string> = {
  contrato: "Contratos",
  procuracao: "Procurações",
  proposta: "Propostas",
  termo: "Termos",
};

interface GeneratedDocRow {
  id: string;
  title: string;
  status: string;
  created_at: string;
  template_id: string;
  template_name?: string;
  template_categoria?: string;
}

function DocumentosTab({ dealId }: { dealId: string }) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [generatedDocs, setGeneratedDocs] = useState<GeneratedDocRow[]>([]);
  const [templates, setTemplates] = useState<{ id: string; nome: string; categoria: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [generateOpen, setGenerateOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string>("");
  const [generating, setGenerating] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const folderPath = useMemo(() => `deals/${dealId}`, [dealId]);

  const loadAll = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
      if (!profile) { setLoading(false); return; }
      const tenantId = (profile as any).tenant_id;

      // Load storage files
      const path = `${tenantId}/${folderPath}`;
      const { data: storageFiles } = await supabase.storage
        .from("projeto-documentos")
        .list(path, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      setFiles((storageFiles || []) as StorageFile[]);

      // Load generated documents
      const { data: docs } = await supabase
        .from("generated_documents")
        .select("id, title, status, created_at, template_id")
        .eq("deal_id", dealId)
        .order("created_at", { ascending: false });

      // Load templates for names
      const { data: tpls } = await supabase
        .from("document_templates")
        .select("id, nome, categoria")
        .eq("status", "active")
        .order("categoria")
        .order("nome");

      const tplMap = new Map((tpls || []).map((t: any) => [t.id, t]));
      setTemplates((tpls || []).map((t: any) => ({ id: t.id, nome: t.nome, categoria: t.categoria })));

      setGeneratedDocs((docs || []).map((d: any) => {
        const tpl = tplMap.get(d.template_id);
        return {
          ...d,
          template_name: (tpl as any)?.nome || "—",
          template_categoria: (tpl as any)?.categoria || "outro",
        };
      }));
    } catch (err) { console.error("DocumentosTab:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadAll(); }, [dealId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    try {
      await supabase.auth.refreshSession();
      const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
      if (!profile) throw new Error("Perfil não encontrado");
      const basePath = `${(profile as any).tenant_id}/${folderPath}`;
      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const fileName = `${Date.now()}_${file.name}`;
        const { error } = await supabase.storage
          .from("projeto-documentos")
          .upload(`${basePath}/${fileName}`, file, { upsert: false });
        if (error) throw error;
      }
      toast({ title: "Arquivo(s) enviado(s) com sucesso!" });
      loadAll();
    } catch (err: any) {
      toast({ title: "Erro ao enviar", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleDelete = async (fileName: string) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
      if (!profile) return;
      const path = `${(profile as any).tenant_id}/${folderPath}/${fileName}`;
      const { error } = await supabase.storage.from("projeto-documentos").remove([path]);
      if (error) throw error;
      setFiles(prev => prev.filter(f => f.name !== fileName));
      toast({ title: "Arquivo removido" });
    } catch (err: any) {
      toast({ title: "Erro ao remover", description: err.message, variant: "destructive" });
    }
  };

  const handleDownload = async (fileName: string) => {
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
      if (!profile) return;
      const path = `${(profile as any).tenant_id}/${folderPath}/${fileName}`;
      const { data, error } = await supabase.storage.from("projeto-documentos").createSignedUrl(path, 300);
      if (error) throw error;
      if (data?.signedUrl) window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      toast({ title: "Erro ao baixar", description: err.message, variant: "destructive" });
    }
  };

  const handleGenerate = async () => {
    if (!selectedTemplateId) return;
    setGenerating(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
      const { data: { user } } = await supabase.auth.getUser();
      if (!profile || !user) throw new Error("Sessão inválida");
      const tenantId = (profile as any).tenant_id;
      const tpl = templates.find(t => t.id === selectedTemplateId);

      const { error } = await supabase.from("generated_documents").insert({
        tenant_id: tenantId,
        deal_id: dealId,
        template_id: selectedTemplateId,
        template_version: 1,
        title: tpl?.nome || "Documento",
        status: "draft",
        input_payload: {},
        created_by: user.id,
        updated_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Documento criado", description: "O documento foi gerado como rascunho." });
      setGenerateOpen(false);
      setSelectedTemplateId("");
      loadAll();
    } catch (err: any) {
      toast({ title: "Erro ao gerar", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const formatSize = (bytes: number | undefined) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Group generated docs by category
  const docsByCategory = useMemo(() => {
    const groups: Record<string, GeneratedDocRow[]> = {};
    for (const doc of generatedDocs) {
      const cat = doc.template_categoria || "outro";
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(doc);
    }
    return groups;
  }, [generatedDocs]);

  if (loading) return <div className="flex justify-center py-12"><SunLoader style="spin" /></div>;

  return (
    <div className="space-y-6">
      {/* Document Checklist */}
      <ProjetoDocChecklist dealId={dealId} />

      {/* Generated Documents */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            Documentos Gerados
          </h3>
          <Button size="sm" onClick={() => setGenerateOpen(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Gerar Documento
          </Button>
        </div>

        {generatedDocs.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <FileText className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">Nenhum documento gerado</p>
              <p className="text-xs mt-1">Clique em "Gerar Documento" para criar a partir de um template</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {Object.entries(docsByCategory).map(([cat, docs]) => (
              <div key={cat} className="space-y-1.5">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-1">
                  {DOC_CATEGORY_LABELS[cat] || cat}
                </h4>
                {docs.map(doc => {
                  const statusCfg = DOC_STATUS_MAP[doc.status] || DOC_STATUS_MAP.draft;
                  return (
                    <div key={doc.id} className="flex items-center gap-3 py-2.5 px-4 rounded-lg bg-card border border-border/40 hover:border-border/70 transition-all">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{doc.title}</p>
                        <p className="text-[10px] text-muted-foreground">
                          {doc.template_name} • {new Date(doc.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <Badge className={cn("text-[10px] h-5 px-1.5 border-0 shrink-0", statusCfg.color)}>
                        {statusCfg.label}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* File uploads */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <FolderOpen className="h-4 w-4 text-warning" />
            Arquivos do Projeto
          </h3>
          <div>
            <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
            <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
              {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
              {uploading ? "Enviando..." : "Upload"}
            </Button>
          </div>
        </div>

        {files.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-10 text-muted-foreground">
              <FolderOpen className="h-10 w-10 mb-3 opacity-30" />
              <p className="font-medium">Nenhum arquivo</p>
              <p className="text-xs mt-1">Faça upload de documentos relacionados ao projeto</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-1.5">
            {files.map(f => (
              <div key={f.name} className="flex items-center gap-3 py-2.5 px-4 rounded-lg bg-card border border-border/40 hover:border-border/70 transition-all">
                <FileText className="h-5 w-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{f.name.replace(/^\d+_/, "")}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {formatSize(f.metadata?.size)} • {f.created_at ? new Date(f.created_at).toLocaleDateString("pt-BR") : ""}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDownload(f.name)}>
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => handleDelete(f.name)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Generate Document Dialog */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Gerar documento</DialogTitle>
            <DialogDescription>Selecione um modelo para gerar o documento com os dados do projeto.</DialogDescription>
          </DialogHeader>
          {templates.length === 0 ? (
            <div className="py-6 text-center space-y-2">
              <FileText className="h-10 w-10 mx-auto opacity-30" />
              <p className="text-sm font-medium">Nenhum modelo de documento cadastrado</p>
              <p className="text-xs text-muted-foreground">Cadastre templates em Configurações → Templates de Documento para poder gerar documentos.</p>
            </div>
          ) : (
            <>
              <div className="space-y-4 py-2">
                <div className="space-y-2">
                  <Label>Modelo <span className="text-destructive">*</span></Label>
                  <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione um modelo de documento" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(
                        templates.reduce<Record<string, typeof templates>>((acc, t) => {
                          const cat = DOC_CATEGORY_LABELS[t.categoria] || t.categoria;
                          if (!acc[cat]) acc[cat] = [];
                          acc[cat].push(t);
                          return acc;
                        }, {})
                      ).map(([cat, tpls]) => (
                        <div key={cat}>
                          <div className="px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{cat}</div>
                          {tpls.map(t => (
                            <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                          ))}
                        </div>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setGenerateOpen(false)}>Cancelar</Button>
                <Button onClick={handleGenerate} disabled={!selectedTemplateId || generating}>
                  {generating ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Gerar
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
// ═══════════════════════════════════════════════════
// ─── Shared Components ──────────────────────────
// ═══════════════════════════════════════════════════
function TimelineEntry({ icon, title, subtitle, date, isCurrent, isFirst }: {
  icon: React.ReactNode; title: string; subtitle?: string; date: string; isCurrent?: boolean; isFirst?: boolean;
}) {
  return (
    <div className="relative flex gap-3 pl-0">
      <div className={cn(
        "relative z-10 flex items-center justify-center w-6 h-6 rounded-full shrink-0 border-2",
        isCurrent ? "bg-primary border-primary text-primary-foreground"
          : isFirst ? "bg-warning border-warning text-warning-foreground"
          : "bg-card border-border text-muted-foreground"
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <p className={cn("text-sm leading-snug", isCurrent ? "font-semibold text-foreground" : "text-foreground/80")}>{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{date}</p>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
