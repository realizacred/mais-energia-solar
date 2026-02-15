import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Settings, MessageSquare, FileText, FolderOpen,
  Clock, User, ChevronRight, Zap, DollarSign, CalendarDays, Loader2,
  Upload, Trash2, Download, Eye, Plus, ExternalLink, Phone, StickyNote, Filter,
  MoreVertical, Trophy, XCircle, UserCircle, Mail, MapPin, Hash, Check, Link2,
  AlertCircle, CheckCircle, Building, Paperclip
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { SunLoader } from "@/components/loading/SunLoader";
import { toast } from "@/hooks/use-toast";
import { VariableMapperPanel } from "./VariableMapperPanel";

// ─── Types ──────────────────────────────────────────
interface DealDetail {
  id: string;
  title: string;
  value: number;
  status: string;
  created_at: string;
  updated_at: string;
  owner_id: string;
  pipeline_id: string;
  stage_id: string;
  customer_id: string | null;
  expected_close_date: string | null;
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
  versao_atual: number;
  created_at: string;
  versoes: {
    id: string;
    versao_numero: number;
    valor_total: number | null;
    potencia_kwp: number | null;
    status: string;
    economia_mensal: number | null;
    payback_meses: number | null;
    created_at: string;
  }[];
}

interface WaConversation {
  id: string;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  last_message_preview: string | null;
  last_message_at: string | null;
  status: string;
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
}

const TABS = [
  { id: "gerenciamento", label: "Gerenciamento", icon: Settings },
  { id: "chat", label: "Chat Whatsapp", icon: MessageSquare },
  { id: "propostas", label: "Propostas", icon: FileText },
  { id: "vinculo", label: "Vínculo de Contrato", icon: Link2 },
  { id: "documentos", label: "Documentos", icon: FolderOpen },
] as const;

type TabId = typeof TABS[number]["id"];

export function ProjetoDetalhe({ dealId, onBack }: Props) {
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

  // ─── Load deal data (unchanged) ────────────────
  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [dealRes, historyRes] = await Promise.all([
          supabase.from("deals").select("id, title, value, status, created_at, updated_at, owner_id, pipeline_id, stage_id, customer_id, expected_close_date").eq("id", dealId).single(),
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

        if (d.customer_id) {
          supabase.from("propostas_nativas").select("id", { count: "exact", head: true }).eq("cliente_id", d.customer_id)
            .then(({ count }) => setPropostasCount(count || 0));
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

  const currentStage = useMemo(() => stages.find(s => s.id === deal?.stage_id), [stages, deal]);
  const currentStageIndex = useMemo(() => stages.findIndex(s => s.id === deal?.stage_id), [stages, deal]);
  const currentPipeline = useMemo(() => pipelines.find(p => p.id === deal?.pipeline_id), [pipelines, deal]);

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });

  const formatBRL = (v: number) => {
    if (!v) return "R$ 0";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
  };

  const getStageNameById = (id: string | null) => {
    if (!id) return "—";
    return stages.find(s => s.id === id)?.name || "—";
  };

  const updateDealLocal = (patch: Partial<DealDetail>) => {
    setDeal(prev => prev ? { ...prev, ...patch } : prev);
  };

  const silentRefresh = async () => {
    try {
      const { data: d } = await supabase.from("deals").select("id, title, value, status, created_at, updated_at, owner_id, pipeline_id, stage_id, customer_id, expected_close_date").eq("id", dealId).single();
      if (d) {
        setDeal(d as DealDetail);
        const [stagesRes, historyRes] = await Promise.all([
          supabase.from("pipeline_stages").select("id, name, position, is_closed, is_won, probability").eq("pipeline_id", (d as any).pipeline_id).order("position"),
          supabase.from("deal_stage_history").select("id, deal_id, from_stage_id, to_stage_id, moved_at, moved_by, metadata").eq("deal_id", dealId).order("moved_at", { ascending: false }),
        ]);
        setStages((stagesRes.data || []) as StageInfo[]);
        setHistory((historyRes.data || []) as StageHistory[]);
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
    if (tabId === "propostas" && propostasCount > 0) return propostasCount;
    if (tabId === "documentos" && docsCount > 0) return docsCount;
    return null;
  };

  const projectCode = deal.title?.match(/#(\d+)/)?.[1] || deal.id.slice(0, 6);

  return (
    <div className="min-h-screen bg-muted/30 -m-4 sm:-m-6 p-4 sm:p-6">
      {/* ── Breadcrumbs ── */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <button onClick={onBack} className="hover:text-foreground transition-colors">Projetos</button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Projeto #{projectCode}</span>
      </div>

      {/* ── Header Card ── */}
      <Card className="mb-4">
        <CardContent className="p-4 sm:p-5">
          {/* Row 1: Title + Actions */}
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3 min-w-0">
              <h1 className="text-2xl font-bold text-foreground truncate">
                Projeto: {customerName || deal.title}
              </h1>
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
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0">
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
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm"
                onClick={async () => {
                  if (deal.status === "won" || deal.status === "lost") return;
                  const prevStatus = deal.status;
                  const prevStageId = deal.stage_id;
                  const wonStage = stages.find(s => s.is_won);
                  const update: any = { status: "won" };
                  if (wonStage) update.stage_id = wonStage.id;
                  updateDealLocal(update);
                  try {
                    const { error } = await supabase.from("deals").update(update).eq("id", deal.id);
                    if (error) throw error;
                    toast({ title: "🎉 Projeto ganho!" });
                    silentRefresh();
                  } catch (err: any) {
                    updateDealLocal({ status: prevStatus, stage_id: prevStageId });
                    toast({ title: "Erro", description: err.message, variant: "destructive" });
                  }
                }}
                disabled={deal.status === "won" || deal.status === "lost"}
                className="bg-success hover:bg-success/90 text-success-foreground font-semibold gap-1.5 disabled:opacity-50"
              >
                {deal.status === "won" ? <><Check className="h-3.5 w-3.5" /> Ganho</> : <><Trophy className="h-3.5 w-3.5" /> Ganhar</>}
              </Button>
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  if (deal.status === "won" || deal.status === "lost") return;
                  const prevStatus = deal.status;
                  const prevStageId = deal.stage_id;
                  const lostStage = stages.find(s => s.is_closed && !s.is_won);
                  const update: any = { status: "lost" };
                  if (lostStage) update.stage_id = lostStage.id;
                  updateDealLocal(update);
                  try {
                    const { error } = await supabase.from("deals").update(update).eq("id", deal.id);
                    if (error) throw error;
                    toast({ title: "Projeto marcado como perdido" });
                    silentRefresh();
                  } catch (err: any) {
                    updateDealLocal({ status: prevStatus, stage_id: prevStageId });
                    toast({ title: "Erro", description: err.message, variant: "destructive" });
                  }
                }}
                disabled={deal.status === "won" || deal.status === "lost"}
                className="font-semibold gap-1.5 disabled:opacity-50"
              >
                {deal.status === "lost" ? <><XCircle className="h-3.5 w-3.5" /> Perdido</> : <><XCircle className="h-3.5 w-3.5" /> Perder</>}
              </Button>

              <Separator orientation="vertical" className="h-7 mx-1" />

              <div className="flex flex-col items-end gap-0.5">
                <span className="text-[10px] text-muted-foreground font-medium">Responsável</span>
                <Select value={deal.owner_id} onValueChange={async (ownerId) => {
                  if (ownerId === deal.owner_id) return;
                  const prev = deal.owner_id;
                  updateDealLocal({ owner_id: ownerId });
                  try {
                    const { error } = await supabase.from("deals").update({ owner_id: ownerId }).eq("id", deal.id);
                    if (error) throw error;
                    toast({ title: "Responsável alterado" });
                    silentRefresh();
                  } catch (err: any) {
                    updateDealLocal({ owner_id: prev });
                    toast({ title: "Erro", description: err.message, variant: "destructive" });
                  }
                }}>
                  <SelectTrigger className="h-8 w-[180px] text-sm">
                    <SelectValue placeholder="Selecionar" />
                  </SelectTrigger>
                  <SelectContent>
                    <ConsultorOptions />
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* Row 2: Tabs */}
          <div className="flex items-center border-b border-border/60 -mx-4 sm:-mx-5 px-4 sm:px-5 overflow-x-auto">
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
                  <Icon className="h-4 w-4" />
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

      {/* ── Pipeline Stepper ── */}
      {activeTab === "gerenciamento" && (
        <Card className="mb-4">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Pipeline</span>
                <Badge variant="outline" className="text-[10px] font-medium">{currentPipeline?.name || "—"}</Badge>
              </div>
              <PipelineSwitcher
                pipelines={pipelines}
                currentPipelineId={deal.pipeline_id}
                allStagesMap={allStagesMap}
                dealId={deal.id}
                updateDealLocal={updateDealLocal}
                onDealUpdated={silentRefresh}
              />
            </div>

            {/* Stepper with labels */}
            <div className="relative pt-2">
              {/* Background track */}
              <div className="absolute top-[18px] left-0 right-0 h-1 bg-border rounded-full" />
              {/* Filled track */}
              <motion.div
                className="absolute top-[18px] left-0 h-1 bg-success rounded-full"
                initial={{ width: "0%" }}
                animate={{ width: stages.length > 1 ? `${(currentStageIndex / (stages.length - 1)) * 100}%` : "0%" }}
                transition={{ duration: 0.6, ease: "easeOut" }}
              />
              <div className="relative flex justify-between">
                {stages.map((stage, i) => {
                  const isPast = i < currentStageIndex;
                  const isCurrent = i === currentStageIndex;
                  const isFuture = i > currentStageIndex;
                  return (
                    <Tooltip key={stage.id}>
                      <TooltipTrigger asChild>
                        <button
                          onClick={async () => {
                            if (stage.id === deal.stage_id) return;
                            const prevStageId = deal.stage_id;
                            updateDealLocal({ stage_id: stage.id });
                            try {
                              const { error } = await supabase.from("deals").update({ stage_id: stage.id }).eq("id", deal.id);
                              if (error) throw error;
                              toast({ title: `Movido para "${stage.name}"` });
                              silentRefresh();
                            } catch (err: any) {
                              updateDealLocal({ stage_id: prevStageId });
                              toast({ title: "Erro", description: err.message, variant: "destructive" });
                            }
                          }}
                          className="flex flex-col items-center z-10 group cursor-pointer gap-1.5"
                        >
                          <motion.div
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
                              isPast && "bg-success border-success",
                              isCurrent && "bg-secondary border-secondary ring-2 ring-secondary/30 ring-offset-2 ring-offset-card",
                              isFuture && "bg-card border-border",
                              !isCurrent && "group-hover:ring-2 group-hover:ring-primary/20 group-hover:ring-offset-1 group-hover:ring-offset-card"
                            )}
                            animate={{ scale: isCurrent ? 1.15 : 1 }}
                            transition={{ duration: 0.3 }}
                          >
                            {isPast && <Check className="h-3 w-3 text-success-foreground" />}
                          </motion.div>
                          <span className={cn(
                            "text-[10px] font-medium max-w-[80px] text-center leading-tight",
                            isPast && "text-success",
                            isCurrent && "text-secondary font-bold",
                            isFuture && "text-muted-foreground"
                          )}>
                            {stage.name}
                          </span>
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="bottom" className="text-xs">
                        {stage.name} • {stage.probability}%
                        {isCurrent && " (atual)"}
                      </TooltipContent>
                    </Tooltip>
                  );
                })}
              </div>
            </div>
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
            <ChatTab customerId={deal.customer_id} customerPhone={customerPhone} />
          )}
          {activeTab === "propostas" && (
            <PropostasTab customerId={deal.customer_id} dealTitle={deal.title} navigate={navigate} />
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
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── Consultor Options (lazy loaded) ─────────────
// ═══════════════════════════════════════════════════
function ConsultorOptions() {
  const [consultores, setConsultores] = useState<{ id: string; nome: string }[]>([]);
  useEffect(() => {
    supabase.from("consultores").select("id, nome").eq("ativo", true).order("nome")
      .then(({ data }) => { if (data) setConsultores(data as any[]); });
  }, []);
  return <>{consultores.map(c => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}</>;
}

// ═══════════════════════════════════════════════════
// ─── Pipeline Switcher ──────────────────────────
// ═══════════════════════════════════════════════════
function PipelineSwitcher({ pipelines, currentPipelineId, allStagesMap, dealId, updateDealLocal, onDealUpdated }: {
  pipelines: PipelineInfo[];
  currentPipelineId: string;
  allStagesMap: Map<string, StageInfo[]>;
  dealId: string;
  updateDealLocal: (patch: Partial<DealDetail>) => void;
  onDealUpdated: () => void;
}) {
  const [changing, setChanging] = useState(false);
  return (
    <Select
      value={currentPipelineId}
      onValueChange={async (pipelineId) => {
        if (pipelineId === currentPipelineId) return;
        setChanging(true);
        try {
          const targetStages = allStagesMap.get(pipelineId);
          const firstStage = targetStages?.sort((a, b) => a.position - b.position)[0];
          if (!firstStage) {
            toast({ title: "Este funil não tem etapas configuradas", variant: "destructive" });
            return;
          }
          updateDealLocal({ pipeline_id: pipelineId, stage_id: firstStage.id });
          const { error } = await supabase.from("deals").update({ pipeline_id: pipelineId, stage_id: firstStage.id }).eq("id", dealId);
          if (error) throw error;
          toast({ title: "Funil alterado com sucesso" });
          onDealUpdated();
        } catch (err: any) {
          toast({ title: "Erro ao alterar funil", description: err.message, variant: "destructive" });
        } finally {
          setChanging(false);
        }
      }}
      disabled={changing}
    >
      <SelectTrigger className="h-7 w-auto text-xs gap-1">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {pipelines.map(p => (
          <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

// ═══════════════════════════════════════════════════
// ─── TAB: Gerenciamento (Dense Dashboard Grid) ──
// ═══════════════════════════════════════════════════

type TimelineFilter = "todos" | "funil" | "notas" | "documentos";

const TIMELINE_FILTERS: { id: TimelineFilter; label: string; icon: typeof ChevronRight }[] = [
  { id: "todos", label: "Todas", icon: Filter },
  { id: "funil", label: "Funil", icon: Zap },
  { id: "notas", label: "Notas", icon: StickyNote },
  { id: "documentos", label: "Documentos", icon: FolderOpen },
];

interface UnifiedTimelineItem {
  id: string;
  type: "funil" | "nota" | "documento" | "criacao";
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
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("todos");
  const [docEntries, setDocEntries] = useState<UnifiedTimelineItem[]>([]);

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
    if ((deal as any).notas) {
      const notasText = String((deal as any).notas);
      entries.push({
        id: "nota-principal", type: "nota",
        title: "Nota adicionada",
        subtitle: notasText.length > 80 ? notasText.substring(0, 80) + "..." : notasText,
        date: formatDate(deal.updated_at),
      });
    }
    entries.push(...docEntries);
    entries.push({ id: "criacao", type: "criacao", title: "Projeto criado", date: formatDate(deal.created_at), isFirst: true });
    return entries;
  }, [history, currentStage, deal, docEntries, formatDate, getStageNameById, userNamesMap]);

  const filteredEntries = useMemo(() => {
    if (timelineFilter === "todos") return allEntries;
    if (timelineFilter === "funil") return allEntries.filter(e => e.type === "funil" || e.type === "criacao");
    if (timelineFilter === "notas") return allEntries.filter(e => e.type === "nota");
    if (timelineFilter === "documentos") return allEntries.filter(e => e.type === "documento");
    return allEntries;
  }, [allEntries, timelineFilter]);

  const getEntryIcon = (entry: UnifiedTimelineItem) => {
    if (entry.type === "funil") return <Zap className="h-3 w-3" />;
    if (entry.type === "nota") return <StickyNote className="h-3 w-3" />;
    if (entry.type === "documento") return <FolderOpen className="h-3 w-3" />;
    return <CalendarDays className="h-3 w-3" />;
  };

  // Pending documents list
  const pendingDocs = [
    { label: "Identidade (RG/CNH)", filled: !!customerCpfCnpj },
    { label: "Comprovante de endereço", filled: !!customerAddress },
    { label: "Conta de energia", filled: false },
    { label: "Procuração (se PJ)", filled: false },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
      {/* ── LEFT SIDEBAR (30%) ── */}
      <div className="lg:col-span-4 xl:col-span-3 space-y-4">
        {/* Card: Dados do Cliente */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 p-4">
            <CardTitle className="text-sm font-semibold">Dados do Cliente</CardTitle>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7">
                  <MoreVertical className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem><Eye className="h-3.5 w-3.5 mr-2" />Ver ficha completa</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2.5">
              <ClientRow icon={User} label={customerName || "—"} />
              {customerCpfCnpj && <ClientRow icon={Hash} label={customerCpfCnpj} muted />}
              {customerPhone && <ClientRow icon={Phone} label={customerPhone} muted />}
              {customerEmail && <ClientRow icon={Mail} label={customerEmail} muted isLink />}
              {customerAddress && <ClientRow icon={MapPin} label={customerAddress} muted />}
            </div>

            <Separator className="my-3" />

            {/* Project quick info */}
            <div className="space-y-2 text-xs">
              <InfoRow label="Funil" value={currentPipeline?.name || "—"} />
              <InfoRow label="Etapa" value={currentStage?.name || "—"} />
              <InfoRow label="Valor" value={formatBRL(deal.value)} />
              <InfoRow label="Criado em" value={formatDate(deal.created_at)} />
              {deal.expected_close_date && (
                <InfoRow label="Previsão" value={new Date(deal.expected_close_date).toLocaleDateString("pt-BR")} />
              )}
            </div>
          </CardContent>
        </Card>

        {/* Card: Campos Importantes / Anexos */}
        <Card>
          <CardHeader className="pb-2 p-4">
            <CardTitle className="text-sm font-semibold">Documentos Pendentes</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="space-y-2">
              {pendingDocs.map((doc, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {doc.filled ? (
                      <CheckCircle className="h-3.5 w-3.5 text-success shrink-0" />
                    ) : (
                      <AlertCircle className="h-3.5 w-3.5 text-warning shrink-0" />
                    )}
                    <span className={cn("text-xs truncate", doc.filled ? "text-muted-foreground line-through" : "text-foreground")}>
                      {doc.label}
                    </span>
                  </div>
                  {!doc.filled && (
                    <Button variant="outline" size="sm" className="h-6 text-[10px] px-2 gap-1 shrink-0">
                      <Paperclip className="h-3 w-3" /> Anexar
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── RIGHT WORK AREA (70%) ── */}
      <div className="lg:col-span-8 xl:col-span-9 space-y-4">
        {/* Card: Atividades */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 p-4">
            <CardTitle className="text-sm font-semibold">Atividades a fazer</CardTitle>
            <Button size="sm" className="h-7 text-xs gap-1">
              <Plus className="h-3 w-3" /> Nova atividade
            </Button>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <div className="h-11 w-11 rounded-xl bg-warning/10 flex items-center justify-center mb-3">
                <AlertCircle className="h-5 w-5 text-warning" />
              </div>
              <p className="text-sm font-semibold text-foreground">Nenhuma atividade encontrada</p>
              <p className="text-xs text-muted-foreground mt-1">Crie uma atividade para acompanhar este projeto</p>
            </div>
          </CardContent>
        </Card>

        {/* Card: Histórico / Timeline */}
        <Card>
          <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 p-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" />
              Histórico
            </CardTitle>
            <Button variant="ghost" size="sm" className="gap-1 text-xs h-7">
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
                  allEntries.filter(e => e.type === "documento").length;
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
  );
}

// ═══════════════════════════════════════════════════
// ─── Client Info Row ─────────────────────────────
// ═══════════════════════════════════════════════════
function ClientRow({ icon: Icon, label, muted, isLink }: { icon: typeof User; label: string; muted?: boolean; isLink?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
      <span className={cn(
        "text-sm leading-snug",
        muted ? "text-muted-foreground" : "font-medium text-foreground",
        isLink && "text-primary"
      )}>
        {label}
      </span>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── TAB: Propostas ─────────────────────────────
// ═══════════════════════════════════════════════════
function PropostasTab({ customerId, dealTitle, navigate }: { customerId: string | null; dealTitle: string; navigate: any }) {
  const [propostas, setPropostas] = useState<PropostaNativa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!customerId) { setLoading(false); return; }
      try {
        const { data } = await supabase
          .from("propostas_nativas")
          .select("id, titulo, codigo, versao_atual, created_at")
          .eq("cliente_id", customerId)
          .order("created_at", { ascending: false })
          .limit(20);

        if (data && data.length > 0) {
          const ids = data.map(p => p.id);
          const { data: versoes } = await supabase
            .from("proposta_versoes")
            .select("id, proposta_id, versao_numero, valor_total, potencia_kwp, status, economia_mensal, payback_meses, created_at")
            .in("proposta_id", ids)
            .order("versao_numero", { ascending: false });

          const mapped: PropostaNativa[] = data.map(p => ({
            ...p,
            versoes: (versoes || []).filter(v => (v as any).proposta_id === p.id).map(v => ({
              id: (v as any).id,
              versao_numero: (v as any).versao_numero,
              valor_total: (v as any).valor_total,
              potencia_kwp: (v as any).potencia_kwp,
              status: (v as any).status,
              economia_mensal: (v as any).economia_mensal,
              payback_meses: (v as any).payback_meses,
              created_at: (v as any).created_at,
            })),
          }));
          setPropostas(mapped);
        }
      } catch (err) { console.error("PropostasTab:", err); }
      finally { setLoading(false); }
    }
    load();
  }, [customerId]);

  const formatBRL = (v: number | null) => {
    if (!v) return "—";
    return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", minimumFractionDigits: 0 }).format(v);
  };

  if (loading) return <div className="flex justify-center py-12"><SunLoader style="spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Propostas do Cliente</h3>
        <Button size="sm" onClick={() => navigate("/admin/propostas-nativas/nova")} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" />Nova Proposta
        </Button>
      </div>

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
        <div className="space-y-3">
          {propostas.map(p => (
            <Card key={p.id} className="hover:shadow-md transition-shadow">
              <CardContent className="py-4 px-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-sm font-bold text-foreground">{p.titulo}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {p.codigo && <span className="font-mono mr-2">{p.codigo}</span>}
                      v{p.versao_atual} • {new Date(p.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-[10px]">{p.versoes.length} versões</Badge>
                </div>

                {p.versoes.slice(0, 3).map(v => (
                  <div
                    key={v.id}
                    onClick={() => navigate(`/admin/propostas-nativas/${p.id}/versoes/${v.id}`)}
                    className="flex items-center justify-between py-2 px-3 -mx-1 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-muted-foreground w-8">v{v.versao_numero}</span>
                      <StatusBadge status={v.status} />
                    </div>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      {v.potencia_kwp && (
                        <span className="flex items-center gap-0.5">
                          <Zap className="h-3 w-3 text-warning" />{v.potencia_kwp} kWp
                        </span>
                      )}
                      <span className="font-bold text-foreground">{formatBRL(v.valor_total)}</span>
                      {v.payback_meses && <span>{v.payback_meses}m payback</span>}
                      <ExternalLink className="h-3 w-3" />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    rascunho: { label: "Rascunho", cls: "bg-muted text-muted-foreground" },
    gerada: { label: "Gerada", cls: "bg-primary/10 text-primary" },
    enviada: { label: "Enviada", cls: "bg-info/10 text-info" },
    aceita: { label: "Aceita", cls: "bg-success/10 text-success" },
    rejeitada: { label: "Rejeitada", cls: "bg-destructive/10 text-destructive" },
    expirada: { label: "Expirada", cls: "bg-warning/10 text-warning" },
  };
  const s = map[status] || { label: status, cls: "bg-muted text-muted-foreground" };
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full", s.cls)}>{s.label}</span>;
}

// ═══════════════════════════════════════════════════
// ─── TAB: Chat WhatsApp ─────────────────────────
// ═══════════════════════════════════════════════════
function ChatTab({ customerId, customerPhone }: { customerId: string | null; customerPhone: string }) {
  const [conversations, setConversations] = useState<WaConversation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      if (!customerPhone && !customerId) { setLoading(false); return; }
      try {
        const digits = customerPhone.replace(/\D/g, "");
        if (digits.length >= 10) {
          const { data } = await supabase
            .from("wa_conversations")
            .select("id, cliente_nome, cliente_telefone, last_message_preview, last_message_at, status")
            .or(`cliente_telefone.ilike.%${digits.slice(-10)}%,remote_jid.ilike.%${digits.slice(-11)}%`)
            .order("last_message_at", { ascending: false })
            .limit(10);
          setConversations((data || []) as WaConversation[]);
        }
      } catch (err) { console.error("ChatTab:", err); }
      finally { setLoading(false); }
    }
    load();
  }, [customerId, customerPhone]);

  const navigate = useNavigate();

  if (loading) return <div className="flex justify-center py-12"><SunLoader style="spin" /></div>;

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Conversas WhatsApp</h3>

      {conversations.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <MessageSquare className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">Nenhuma conversa encontrada</p>
            <p className="text-xs mt-1">
              {customerPhone ? `Nenhuma conversa com ${customerPhone}` : "Vincule um cliente com telefone ao projeto"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {conversations.map(conv => (
            <Card
              key={conv.id}
              className="hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate("/admin/inbox")}
            >
              <CardContent className="py-3 px-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-foreground truncate">{conv.cliente_nome || "Sem nome"}</p>
                    <Badge variant={conv.status === "open" ? "default" : "secondary"} className="text-[9px] h-4">
                      {conv.status === "open" ? "Aberta" : "Resolvida"}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.last_message_preview || "..."}</p>
                </div>
                <div className="text-right shrink-0">
                  {conv.cliente_telefone && (
                    <p className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                      <Phone className="h-3 w-3" />{conv.cliente_telefone}
                    </p>
                  )}
                  {conv.last_message_at && (
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(conv.last_message_at).toLocaleDateString("pt-BR")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── TAB: Documentos ────────────────────────────
// ═══════════════════════════════════════════════════
function DocumentosTab({ dealId }: { dealId: string }) {
  const [files, setFiles] = useState<StorageFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const folderPath = useMemo(() => `deals/${dealId}`, [dealId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
      if (!profile) { setLoading(false); return; }
      const path = `${(profile as any).tenant_id}/${folderPath}`;
      const { data, error } = await supabase.storage
        .from("projeto-documentos")
        .list(path, { limit: 100, sortBy: { column: "created_at", order: "desc" } });
      if (error) throw error;
      setFiles((data || []) as StorageFile[]);
    } catch (err) { console.error("DocumentosTab:", err); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadFiles(); }, [dealId]);

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
      loadFiles();
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

  const formatSize = (bytes: number | undefined) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (loading) return <div className="flex justify-center py-12"><SunLoader style="spin" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Documentos do Projeto</h3>
        <div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={handleUpload} />
          <Button size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5">
            {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
            {uploading ? "Enviando..." : "Upload"}
          </Button>
        </div>
      </div>

      {files.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
            <FolderOpen className="h-10 w-10 mb-3 opacity-30" />
            <p className="font-medium">Nenhum documento</p>
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
