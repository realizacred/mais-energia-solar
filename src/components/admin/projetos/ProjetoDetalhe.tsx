import { EmptyState } from "@/components/ui-kit/EmptyState";
import { formatBRLInteger as formatBRL } from "@/lib/formatters";
import { useClienteHasRecebimento } from "@/hooks/useClienteRecebimento";
import { formatPropostaLabel } from "@/lib/format-entity-labels";
import { formatPhone } from "@/lib/validations";
import { formatCpfCnpj } from "@/lib/cpfCnpjUtils";
import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Spinner } from "@/components/ui-kit/Spinner";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Settings, MessageSquare, FileText, FolderOpen,
  Clock, User, ChevronRight, Zap, DollarSign, CalendarDays, Loader2,
  Upload, Trash2, Download, Eye, Plus, ExternalLink, Phone, StickyNote, Filter,
  MoreVertical, Trophy, XCircle, UserCircle, Mail, MapPin, Hash, Check,
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
import { DocumentosTab } from "./DocumentosTab";
import { ProjetoInstalacaoTab } from "./ProjetoInstalacaoTab";
import { ImportantFieldRow } from "./ImportantFieldRow";
import { ProjetoOutrosCampos } from "./ProjetoOutrosCampos";
import { ProjetoMultiPipelineManager } from "./ProjetoMultiPipelineManager";
import { AddressFields, type AddressData } from "@/components/shared/AddressFields";
import { ProjetoComunicacaoResumo } from "./ProjetoComunicacaoResumo";
import { PropostaExpandedDetail } from "./PropostaExpandedDetail";
import { useQuery } from "@tanstack/react-query";
import { usePropostasProjetoTab, selectPrincipal, useSetPropostaPrincipal, useArquivarProposta } from "@/hooks/usePropostasProjetoTab";
import {
  ProjetoDetalheProvider,
  useProjetoDetalhe,
  type DealDetail,
  type StageHistory,
  type StageInfo,
  type PipelineInfo,
  type TabId,
  type EtiquetaItem,
} from "@/contexts/ProjetoDetalheContext";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";

// ─── Types (local to sub-components) ────────────
interface PropostaNativa {
  id: string;
  titulo: string;
  codigo: string | null;
  proposta_num: number | null;
  versao_atual: number;
  status: string;
  created_at: string;
  cliente_nome: string | null;
  is_principal: boolean;
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
    output_pdf_path: string | null;
    output_docx_path: string | null;
    public_slug: string | null;
    gerado_em: string | null;
  }[];
}

interface StorageFile {
  name: string;
  id: string | null;
  created_at: string | null;
  metadata: { size?: number; mimetype?: string } | null;
}

interface Props {
  dealId: string;
  onBack: () => void;
  initialPipelineId?: string;
}

const TABS = [
  { id: "gerenciamento" as TabId, label: "Gerenciamento", icon: Settings, color: "text-secondary" },
  { id: "comunicacao" as TabId, label: "Comunicação", icon: MessageSquare, color: "text-success" },
  { id: "propostas" as TabId, label: "Propostas", icon: FileText, color: "text-primary" },
  { id: "documentos" as TabId, label: "Documentos", icon: FolderOpen, color: "text-warning" },
  { id: "instalacao" as TabId, label: "Instalação", icon: Zap, color: "text-success" },
] as const;

// ─── Recebimento CTA (won deals) ────────────
function RecebimentoCTA({ dealId, customerId, customerName, navigate }: {
  dealId: string; customerId: string | null; customerName: string; navigate: ReturnType<typeof useNavigate>;
}) {
  const { data: hasRecebimento, isLoading } = useClienteHasRecebimento(customerId);

  if (isLoading || hasRecebimento === undefined) return null;
  if (hasRecebimento) return null;

  return (
    <Card className="mb-2 border-l-[3px] border-l-success">
      <CardContent className="flex items-center gap-4 p-4">
        <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-success/10 text-success shrink-0">
          <DollarSign className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Criar recebimento para este projeto</p>
          <p className="text-xs text-muted-foreground">Nenhum recebimento vinculado a {customerName || "este cliente"}</p>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="shrink-0 gap-1.5 border-success/30 text-success hover:bg-success/10"
          onClick={() => {
            const params = new URLSearchParams();
            if (customerId) params.set("cliente_id", customerId);
            params.set("deal_id", dealId);
            navigate(`/admin/recebimentos?${params.toString()}`);
          }}
        >
          <Plus className="h-3.5 w-3.5" />
          Criar
        </Button>
      </CardContent>
    </Card>
  );
}

export function ProjetoDetalhe({ dealId, onBack, initialPipelineId }: Props) {
  return (
    <ProjetoDetalheProvider dealId={dealId} onBack={onBack} initialPipelineId={initialPipelineId}>
      <ProjetoDetalheContent />
    </ProjetoDetalheProvider>
  );
}

function ProjetoDetalheContent() {
  const ctx = useProjetoDetalhe();
  const navigate = useNavigate();

  const {
    deal, loading, activeTab, setActiveTab, stages,
    customerName, customerPhone, customerEmail, customerCpfCnpj, customerEmpresa, customerAddress,
    ownerName, pipelines, allStagesMap, userNamesMap,
    currentStage, currentPipeline, projectCode,
    dealEtiquetas, allEtiquetas, etiquetaPopoverOpen, setEtiquetaPopoverOpen, toggleEtiqueta,
    deleteDialogOpen, setDeleteDialogOpen, deleteBlocking, deleting, handleDeleteProject, setDeleteBlocking,
    confirmConsultorId, setConfirmConsultorId, handleConfirmConsultor,
    lossDialogOpen, setLossDialogOpen, lossMotivo, setLossMotivo, lossObs, setLossObs, lossSaving,
    motivos, loadingMotivos, handleConfirmLoss,
    isClosed, silentRefresh, refreshCustomer, formatDate, getStageNameById, tabBadge,
    dealId, onBack, initialPipelineId,
  } = ctx;

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

  return (
    <div className="min-h-screen bg-muted/30 -m-4 sm:-m-6 p-3 sm:p-6 max-w-full overflow-x-hidden">
      {/* ── Breadcrumbs ── */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-3">
        <Button variant="link" onClick={onBack} className="hover:text-foreground transition-colors h-auto p-0 text-xs text-muted-foreground">Projetos</Button>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">{projectCode}</span>
      </div>

      {/* ── Header Card ── */}
      <Card className="mb-2 overflow-hidden">
        <CardContent className="p-3 sm:p-4">
          {/* Row 1: Title + Etiquetas + Actions */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-3">
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
                <Badge key={et.id} variant="outline" className="text-xs shrink-0 gap-1" style={{ borderColor: et.cor, color: et.cor }} title={et.nome}>
                  {et.icon && <span>{et.icon}</span>}
                  {et.short || et.nome}
                </Badge>
              ))}

              {/* + Etiqueta */}
              <Popover open={etiquetaPopoverOpen} onOpenChange={setEtiquetaPopoverOpen}>
                <PopoverTrigger asChild>
                  <Button variant="ghost" className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors h-auto p-0">
                    <Plus className="h-3.5 w-3.5" />
                    Etiqueta
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-56 p-2 z-50" align="start" onOpenAutoFocus={(e) => e.preventDefault()}>
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
                            onClick={() => { toggleEtiqueta(et.id); }}
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

            {/* Right side: status + consultor + nova proposta inline */}
            <div className="flex items-center gap-2 shrink-0 flex-wrap justify-end">
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
              {deal.status !== "won" && deal.status !== "lost" && (
                <Button size="sm" onClick={() => {
                  const params = new URLSearchParams({ deal_id: dealId });
                  if (deal.customer_id) params.set("customer_id", deal.customer_id);
                  navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
                }} className="gap-1.5 shrink-0">
                  <Plus className="h-3.5 w-3.5" />Nova proposta
                </Button>
              )}
            </div>
          </div>

          {/* Row 2: Tabs */}
          <div className="flex items-center border-b border-border/60 -mx-3 sm:-mx-4 px-2 sm:px-4 overflow-x-auto scrollbar-hide overflow-y-hidden">
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
        <Card className="mb-2">
          <CardContent className="p-3 sm:p-4">
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

      {/* ── Recebimento CTA for won deals ── */}
      {deal.status === "won" && activeTab === "gerenciamento" && (
        <RecebimentoCTA dealId={deal.id} customerId={deal.customer_id} customerName={customerName} navigate={navigate} />
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
              deal={deal} history={ctx.history} stages={stages}
              customerName={customerName} customerPhone={customerPhone}
              customerEmail={customerEmail} customerCpfCnpj={customerCpfCnpj}
              customerEmpresa={customerEmpresa}
              customerAddress={customerAddress}
              ownerName={ownerName}
              currentStage={currentStage} currentPipeline={currentPipeline}
              formatDate={formatDate} formatBRL={formatBRL} getStageNameById={getStageNameById}
              userNamesMap={userNamesMap}
              onRefreshCustomer={refreshCustomer}
            />
          )}
          {activeTab === "comunicacao" && (
            <ProjetoComunicacaoResumo customerId={deal.customer_id} customerPhone={customerPhone} />
          )}
          {activeTab === "propostas" && (
            <PropostasTab customerId={deal.customer_id} dealId={deal.id} dealTitle={deal.title} navigate={navigate} isClosed={isClosed} dealStatus={deal.status} />
          )}
          {activeTab === "documentos" && (
            <DocumentosTab dealId={deal.id} customerId={deal.customer_id} />
          )}
          {activeTab === "instalacao" && (
            <ProjetoInstalacaoTab dealId={deal.id} />
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
            <AlertDialogAction onClick={handleConfirmConsultor}>
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
        <DialogContent className="w-[90vw] max-w-md p-0 gap-0 overflow-hidden">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
            <div className="w-9 h-9 rounded-lg bg-destructive/10 flex items-center justify-center shrink-0">
              <XCircle className="w-5 h-5 text-destructive" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">
                Registrar Perda do Projeto
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                Informe o motivo da perda de {customerName || deal.title}. O projeto será bloqueado.
              </p>
            </div>
          </DialogHeader>
          <div className="p-5 space-y-4 overflow-y-auto max-h-[70vh]">
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
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
            <Button variant="outline" onClick={() => setLossDialogOpen(false)}>Cancelar</Button>
            <Button
              variant="outline"
              className="border-destructive text-destructive hover:bg-destructive/10"
              disabled={!lossMotivo || lossSaving}
              onClick={handleConfirmLoss}
            >
              {lossSaving && <Spinner size="sm" className="mr-2" />}
              Registrar Perda
            </Button>
          </div>
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
  customerName, customerPhone, customerEmail, customerCpfCnpj, customerEmpresa, customerAddress,
  ownerName, currentStage, currentPipeline,
  formatDate, formatBRL, getStageNameById, userNamesMap,
  onRefreshCustomer,
}: {
  deal: DealDetail; history: StageHistory[]; stages: StageInfo[];
  customerName: string; customerPhone: string; customerEmail: string;
  customerCpfCnpj: string; customerEmpresa: string; customerAddress: string;
  ownerName: string; currentStage?: StageInfo; currentPipeline?: PipelineInfo;
  formatDate: (d: string) => string; formatBRL: (v: number) => string;
  getStageNameById: (id: string | null) => string;
  userNamesMap: Map<string, string>;
  onRefreshCustomer?: () => void;
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
  const [activities, setActivities] = useState<Array<{ id: string; title: string; description?: string; activity_type: string; due_date?: string; status: string; created_at: string; assigned_to?: string | null }>>([]);

  // Custom fields marked as important
  const [importantFields, setImportantFields] = useState<Array<{ id: string; title: string; field_key: string; field_type: string; options: any }>>([]);
  const [customFieldValues, setCustomFieldValues] = useState<Record<string, { value_text?: string | null; value_number?: number | null; value_boolean?: boolean | null; value_date?: string | null }>>({});

  // ── Inline edit popup for client fields ──
  const [inlineEditOpen, setInlineEditOpen] = useState(false);
  const [inlineEditField, setInlineEditField] = useState<string>("");
  const [inlineEditLabel, setInlineEditLabel] = useState<string>("");
  const [inlineEditValue, setInlineEditValue] = useState<string>("");
  const [savingInlineEdit, setSavingInlineEdit] = useState(false);

  // ── Address edit dialog ──
  const [addressDialogOpen, setAddressDialogOpen] = useState(false);
  const [addressData, setAddressData] = useState<AddressData>({ cep: "", rua: "", numero: "", complemento: "", bairro: "", cidade: "", estado: "" });
  const [savingAddress, setSavingAddress] = useState(false);

  const openAddressDialog = async () => {
    if (!deal.customer_id) return;
    // Load current address from client
    const { data } = await supabase
      .from("clientes")
      .select("cep, rua, numero, complemento, bairro, cidade, estado")
      .eq("id", deal.customer_id)
      .single();
    if (data) {
      setAddressData({
        cep: data.cep || "",
        rua: data.rua || "",
        numero: data.numero || "",
        complemento: data.complemento || "",
        bairro: data.bairro || "",
        cidade: data.cidade || "",
        estado: data.estado || "",
      });
    }
    setAddressDialogOpen(true);
  };

  const saveAddress = async () => {
    if (!deal.customer_id) return;
    setSavingAddress(true);
    try {
      const { error } = await supabase
        .from("clientes")
        .update({
          cep: addressData.cep.trim() || null,
          rua: addressData.rua.trim() || null,
          numero: addressData.numero.trim() || null,
          complemento: addressData.complemento.trim() || null,
          bairro: addressData.bairro.trim() || null,
          cidade: addressData.cidade.trim() || null,
          estado: addressData.estado.trim() || null,
        })
        .eq("id", deal.customer_id);
      if (error) throw error;
      toast({ title: "Endereço atualizado!" });
      setAddressDialogOpen(false);
      onRefreshCustomer?.();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingAddress(false);
    }
  };

  const openInlineEdit = (field: string, label: string, currentValue: string) => {
    setInlineEditField(field);
    setInlineEditLabel(label);
    setInlineEditValue(currentValue || "");
    setInlineEditOpen(true);
  };

  const saveInlineEdit = async () => {
    if (!deal.customer_id || !inlineEditField) return;
    setSavingInlineEdit(true);
    try {
      const { error } = await supabase
        .from("clientes")
        .update({ [inlineEditField]: inlineEditValue.trim() || null })
        .eq("id", deal.customer_id);
      if (error) throw error;
      toast({ title: "Dados atualizados!" });
      setInlineEditOpen(false);
      onRefreshCustomer?.();
    } catch (err: any) {
      toast({ title: "Erro ao salvar", description: err.message, variant: "destructive" });
    } finally {
      setSavingInlineEdit(false);
    }
  };

  // Load important custom fields + values
  const loadImportantFields = async () => {
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
  };
  useEffect(() => { loadImportantFields(); }, [deal.id]);
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
          .select("id, title, description, activity_type, due_date, status, created_at, assigned_to")
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
      } as any).select("id, title, description, activity_type, due_date, status, created_at, assigned_to").single();
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
            created: "Projeto criado",
            stage_changed: "Etapa alterada",
            status_changed: "Status alterado",
            owner_changed: "Responsável alterado",
            value_changed: "Valor alterado",
            pipeline_added: "Adicionado ao funil",
            pipeline_removed: "Removido do funil",
            consultor_changed: "Consultor alterado",
            proposal_message_sent: "Mensagem da proposta enviada",
            "proposal.sent": "Proposta enviada",
            "proposal.accepted": "Proposta aceita pelo cliente",
            "proposal.rejected": "Proposta recusada pelo cliente",
          };
          const PROPOSAL_EVENT_TYPES = new Set([
            "proposal_message_sent",
            "proposal.sent",
            "proposal.accepted",
            "proposal.rejected",
          ]);
          const VALUE_LABELS: Record<string, string> = {
            open: "Aberto",
            won: "Ganho",
            lost: "Perdido",
            created: "Criado",
          };
          const translateValue = (v: string | null | undefined) => {
            if (!v) return v;
            return VALUE_LABELS[v] || v;
          };
          const buildSubtitle = (e: any): string | undefined => {
            // For proposal events, show channel/metadata info
            if (PROPOSAL_EVENT_TYPES.has(e.event_type) && e.metadata) {
              const meta = typeof e.metadata === "string" ? JSON.parse(e.metadata) : e.metadata;
              const canal = meta?.canal || meta?.channel;
              const dest = meta?.destinatario_tipo || meta?.tipo;
              const parts: string[] = [];
              if (canal) parts.push(canal);
              if (dest) parts.push(dest);
              return parts.length > 0 ? parts.join(" • ") : undefined;
            }
            if (e.from_value && e.to_value) return `${translateValue(e.from_value)} → ${translateValue(e.to_value)}`;
            return translateValue(e.to_value) || translateValue(e.from_value) || undefined;
          };
          setProjectEventEntries(data.map((e: any) => ({
            id: `pe-${e.id}`,
            type: PROPOSAL_EVENT_TYPES.has(e.event_type) ? "proposta" as const : "projeto" as const,
            title: EVENT_LABELS[e.event_type] || e.event_type,
            subtitle: buildSubtitle(e),
            date: formatDate(e.created_at),
          })));
        }
      } catch { /* ignore */ }
    }
    loadProjectEvents();
  }, [deal.id, formatDate]);

  // Load proposal records for timeline
  useEffect(() => {
    async function loadPropostaEvents() {
      try {
        const { data } = await (supabase as any)
          .from("propostas_nativas")
          .select("id, titulo, status, created_at, codigo")
          .or(`deal_id.eq.${deal.id},projeto_id.eq.${deal.id}`)
          .neq("status", "excluida")
          .order("created_at", { ascending: false })
          .limit(20);
        if (data && data.length > 0) {
          const PROPOSTA_STATUS: Record<string, string> = {
            draft: "Rascunho", rascunho: "Rascunho", gerada: "Gerada", sent: "Enviada", enviada: "Enviada",
            accepted: "Aceita", aceita: "Aceita", rejected: "Rejeitada", recusada: "Recusada",
            expired: "Expirada", expirada: "Expirada",
          };
          setPropostaEntries(data.map((p: any) => ({
            id: `prop-${p.id}`,
            type: "proposta" as const,
            title: `Proposta: ${p.titulo || p.codigo || "Sem título"}`,
            subtitle: `${p.codigo || "—"} • Status: ${PROPOSTA_STATUS[p.status] || p.status}`,
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
        <div className="lg:col-span-5 xl:col-span-4 space-y-4">
          {/* Card: Dados do Cliente */}
          <Card>
            <CardHeader className="pb-1 flex flex-row items-center justify-between space-y-0 px-4 pt-3">
              <CardTitle className="text-sm font-bold text-foreground">
                Dados do cliente
              </CardTitle>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <MoreVertical className="h-3 w-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => navigate("/admin/clientes")}>
                    <Eye className="h-3.5 w-3.5 mr-2" />Ver ficha completa
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => openAddressDialog()}>
                    <Pencil className="h-3.5 w-3.5 mr-2" />Editar cliente
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  {customerPhone && (
                    <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(customerPhone); toast({ title: "Telefone copiado" }); }}>
                      <Copy className="h-3.5 w-3.5 mr-2" />Copiar telefone
                    </DropdownMenuItem>
                  )}
                  {customerEmail && (
                    <DropdownMenuItem onClick={() => { navigator.clipboard.writeText(customerEmail); toast({ title: "E-mail copiado" }); }}>
                      <Copy className="h-3.5 w-3.5 mr-2" />Copiar e-mail
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  {customerPhone && (
                    <DropdownMenuItem onClick={() => navigate("/admin/inbox")}>
                      <MessageSquare className="h-3.5 w-3.5 mr-2" />Abrir WhatsApp interno
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
            <CardContent className="px-4 pb-3 pt-1">
              <div className="space-y-1.5">
                <ClientRow icon={User} label={customerName || "—"} />
                <ClientRow icon={Building} label={customerEmpresa || "Adicionar Empresa"} muted={!customerEmpresa} isLink={!customerEmpresa} onEdit={!customerEmpresa ? () => openInlineEdit("empresa", "Nome da Empresa", customerEmpresa) : undefined} />
                <ClientRow icon={Hash} label={customerCpfCnpj ? formatCpfCnpj(customerCpfCnpj) : "Adicionar CNPJ/CPF"} muted={!customerCpfCnpj} isLink={!customerCpfCnpj} onCopy={customerCpfCnpj ? () => { navigator.clipboard.writeText(customerCpfCnpj); toast({ title: "CPF/CNPJ copiado" }); } : undefined} onEdit={!customerCpfCnpj ? () => openInlineEdit("cpf_cnpj", "CPF / CNPJ", customerCpfCnpj) : undefined} />
                <ClientRow
                  icon={Phone}
                  label={customerPhone ? formatPhone(customerPhone) : "Adicionar Telefone"}
                  muted={!customerPhone}
                  isLink={!customerPhone}
                  onCopy={customerPhone ? () => { navigator.clipboard.writeText(customerPhone); toast({ title: "Telefone copiado" }); } : undefined}
                  onAction={customerPhone ? () => window.open(`https://wa.me/${customerPhone.replace(/\D/g, "")}`, "_blank") : undefined}
                  actionIcon={customerPhone ? MessageSquare : undefined}
                  actionTooltip="Abrir WhatsApp"
                  onEdit={!customerPhone ? () => openInlineEdit("telefone", "Telefone", customerPhone) : undefined}
                />
                <ClientRow
                  icon={Mail}
                  label={customerEmail || "Adicionar Email"}
                  muted
                  isLink={!customerEmail}
                  onCopy={customerEmail ? () => { navigator.clipboard.writeText(customerEmail); toast({ title: "E-mail copiado" }); } : undefined}
                  onAction={customerEmail ? () => window.open(`mailto:${customerEmail}`, "_blank") : undefined}
                  actionIcon={customerEmail ? Send : undefined}
                  actionTooltip="Enviar e-mail"
                  onEdit={!customerEmail ? () => openInlineEdit("email", "E-mail", customerEmail) : undefined}
                />
                <ClientRow icon={MapPin} label={customerAddress || "Adicionar Cidade"} muted isLink={!customerAddress} wrap onCopy={customerAddress ? () => { navigator.clipboard.writeText(customerAddress); toast({ title: "Endereço copiado" }); } : undefined} onEdit={() => openAddressDialog()} />
              </div>
            </CardContent>
          </Card>

          {/* ── Inline Edit Dialog ── */}
          <Dialog open={inlineEditOpen} onOpenChange={setInlineEditOpen}>
            <DialogContent className="max-w-[400px]">
              <DialogHeader>
                <DialogTitle>{inlineEditLabel ? `Adicionar ${inlineEditLabel}` : "Editar"}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <Label className="text-sm text-primary">{inlineEditLabel}</Label>
                <Input
                  value={inlineEditValue}
                  onChange={(e) => setInlineEditValue(e.target.value)}
                  placeholder={`Digite ${inlineEditLabel?.toLowerCase()}...`}
                  autoFocus
                  onKeyDown={(e) => { if (e.key === "Enter") saveInlineEdit(); }}
                />
              </div>
              <Separator />
              <div className="flex justify-end">
                <Button onClick={saveInlineEdit} disabled={savingInlineEdit} size="sm">
                  {savingInlineEdit ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Aplicar
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          {/* ── Address Edit Dialog ── */}
          <Dialog open={addressDialogOpen} onOpenChange={setAddressDialogOpen}>
            <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
              <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <MapPin className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <DialogTitle className="text-base font-semibold text-foreground">Endereço do Cliente</DialogTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">Preencha o CEP para autocompletar os campos</p>
                </div>
              </DialogHeader>
              <div className="flex-1 min-h-0 overflow-y-auto p-5">
                <AddressFields value={addressData} onChange={setAddressData} />
              </div>
              <DialogFooter className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
                <Button variant="outline" onClick={() => setAddressDialogOpen(false)} disabled={savingAddress}>Cancelar</Button>
                <Button onClick={saveAddress} disabled={savingAddress}>
                  {savingAddress ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                  Salvar Endereço
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>


          <ProjetoOutrosCampos
            clienteId={deal.customer_id}
            dealId={deal.id}
            importantFields={importantFields}
            customFieldValues={customFieldValues}
            onReloadImportant={() => loadImportantFields()}
          />

          <ProjetoDocChecklist dealId={deal.id} />
        </div>

        {/* ── RIGHT WORK AREA (70%) ── */}
        <div className="lg:col-span-7 xl:col-span-8 space-y-4">
          {/* Card: Atividades */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 p-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-warning/15 flex items-center justify-center">
                  <Zap className="h-3.5 w-3.5 text-warning" />
                </div>
                Atividades a fazer
                {activities.filter(a => a.status !== "done").length > 0 && (
                  <Badge className="bg-warning/15 text-warning border-warning/30 text-[10px] h-5 px-1.5">
                    {activities.filter(a => a.status !== "done").length}
                  </Badge>
                )}
              </CardTitle>
              <Button size="sm" className="h-7 text-xs gap-1" onClick={() => setActivityDialogOpen(true)}>
                <Plus className="h-3 w-3" /> Nova atividade
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {activities.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center border border-dashed border-border rounded-lg bg-muted/20">
                  <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mb-3">
                    <CalendarDays className="w-5 h-5 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">Nenhuma atividade</p>
                  <p className="text-xs text-muted-foreground/70 mt-1">Crie uma atividade para acompanhar este projeto</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {activities.map(a => {
                    const isOverdue = a.due_date && new Date(a.due_date) < new Date() && a.status !== "done";
                    const isDone = a.status === "done";
                    const assignedName = a.assigned_to ? (teamMembers.find(m => m.user_id === a.assigned_to)?.nome || null) : null;
                    const phoneForAction = customerPhone?.replace(/\D/g, "") || "";
                    const waLink = phoneForAction ? `https://wa.me/${phoneForAction.startsWith("55") ? phoneForAction : `55${phoneForAction}`}` : "";
                    const telLink = phoneForAction ? `tel:+${phoneForAction.startsWith("55") ? phoneForAction : `55${phoneForAction}`}` : "";
                    const isCallType = a.activity_type === "call";
                    const isWaType = a.activity_type === "whatsapp" || a.activity_type === "follow_up";
                    const isEmailType = a.activity_type === "email";
                    return (
                      <div
                        key={a.id}
                        className={cn(
                          "flex items-start gap-3 p-3 rounded-lg border transition-all",
                          isDone
                            ? "bg-muted/20 border-border/30 opacity-60"
                            : isOverdue
                              ? "bg-destructive/5 border-destructive/20 hover:bg-destructive/10"
                              : "bg-card border-border hover:border-primary/30 hover:shadow-sm"
                        )}
                      >
                        <button
                          onClick={() => handleToggleActivity(a.id, a.status)}
                          className={cn(
                            "mt-0.5 h-5 w-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-all",
                            isDone
                              ? "bg-success border-success"
                              : "border-muted-foreground/30 hover:border-primary hover:scale-110"
                          )}
                        >
                          {isDone && <Check className="h-3 w-3 text-primary-foreground" />}
                        </button>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <p className={cn("text-sm font-medium", isDone && "line-through text-muted-foreground")}>
                              {a.title}
                            </p>
                            {/* Action buttons */}
                            {!isDone && (
                              <div className="flex items-center gap-1 shrink-0">
                                {(isCallType || isWaType) && telLink && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a href={telLink} className="inline-flex">
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                          <Phone className="h-3.5 w-3.5 text-info" />
                                        </Button>
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent>Ligar para {customerName || "cliente"}</TooltipContent>
                                  </Tooltip>
                                )}
                                {(isCallType || isWaType) && waLink && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex">
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                          <MessageSquare className="h-3.5 w-3.5 text-success" />
                                        </Button>
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent>WhatsApp para {customerName || "cliente"}</TooltipContent>
                                  </Tooltip>
                                )}
                                {isEmailType && customerEmail && (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <a href={`mailto:${customerEmail}`} className="inline-flex">
                                        <Button variant="ghost" size="icon" className="h-6 w-6">
                                          <Mail className="h-3.5 w-3.5 text-warning" />
                                        </Button>
                                      </a>
                                    </TooltipTrigger>
                                    <TooltipContent>Enviar e-mail para {customerEmail}</TooltipContent>
                                  </Tooltip>
                                )}
                              </div>
                            )}
                          </div>
                          {a.description && (
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{a.description}</p>
                          )}
                          <div className="flex items-center gap-2 mt-2 flex-wrap">
                            <Badge variant="outline" className={cn(
                              "text-[10px] h-5 font-medium",
                              a.activity_type === "call" && "border-info/30 text-info bg-info/10",
                              a.activity_type === "meeting" && "border-primary/30 text-primary bg-primary/10",
                              a.activity_type === "visit" && "border-success/30 text-success bg-success/10",
                              a.activity_type === "email" && "border-warning/30 text-warning bg-warning/10",
                              a.activity_type === "whatsapp" && "border-success/30 text-success bg-success/10",
                              a.activity_type === "follow_up" && "border-secondary/30 text-secondary bg-secondary/10",
                            )}>
                              {activityTypeLabels[a.activity_type] || a.activity_type}
                            </Badge>
                            {a.due_date && (
                              <span className={cn(
                                "text-[10px] flex items-center gap-1",
                                isOverdue
                                  ? "text-destructive font-semibold"
                                  : "text-muted-foreground"
                              )}>
                                <CalendarDays className="h-3 w-3" />
                                {formatDateTime(a.due_date)}
                              </span>
                            )}
                            {assignedName && (
                              <span className="text-[10px] flex items-center gap-1 text-muted-foreground">
                                <User className="h-3 w-3" />
                                {assignedName}
                              </span>
                            )}
                            {(isCallType || isWaType) && customerPhone && (
                              <span className="text-[10px] flex items-center gap-1 text-muted-foreground font-mono">
                                <Phone className="h-3 w-3" />
                                {customerPhone}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Card: Histórico / Timeline */}
          <Card className="shadow-sm">
            <CardHeader className="pb-2 flex flex-row items-center justify-between space-y-0 p-4">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5 text-primary" />
                </div>
                Histórico
              </CardTitle>
              <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => setNoteDialogOpen(true)}>
                <Plus className="h-3 w-3" /> Nova nota
              </Button>
            </CardHeader>
            <CardContent className="p-4 pt-0">
              {/* Filter pills */}
              <div className="flex items-center gap-1.5 mb-4 flex-wrap">
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
                    <Button
                      key={f.id}
                      variant={isActive ? "default" : "outline"}
                      size="sm"
                      onClick={() => setTimelineFilter(f.id)}
                      className={cn(
                        "h-7 text-xs gap-1 rounded-full px-3",
                        !isActive && "border-border bg-card hover:bg-muted"
                      )}
                    >
                      {f.label}
                      {count !== null && count > 0 && (
                        <Badge variant="secondary" className={cn(
                          "text-[9px] h-4 px-1 min-w-[16px] justify-center",
                          isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                        )}>
                          {count}
                        </Badge>
                      )}
                    </Button>
                  );
                })}
              </div>

              {/* Timeline */}
              {filteredEntries.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-muted-foreground border border-dashed border-border rounded-lg bg-muted/10">
                  <p className="text-sm">Nenhuma atividade nesta categoria</p>
                </div>
              ) : (
                <div className="relative">
                  <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-gradient-to-b from-primary/30 via-border to-border rounded-full" />
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
        <DialogContent className="max-w-md">
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
            <Button variant="ghost" onClick={() => setNoteDialogOpen(false)}>Cancelar</Button>
            <Button onClick={handleSaveNote} disabled={!noteText.trim() || savingNote}>
              {savingNote ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
              Salvar nota
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog: Nova Atividade */}
      <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
        <DialogContent className="max-w-md">
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
            <Button variant="ghost" onClick={() => setActivityDialogOpen(false)}>Cancelar</Button>
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
function ClientRow({ icon: Icon, label, muted, isLink, wrap, onCopy, onAction, actionIcon: ActionIcon, actionTooltip, onEdit }: {
  icon: typeof User;
  label: string;
  muted?: boolean;
  isLink?: boolean;
  wrap?: boolean;
  onCopy?: () => void;
  onAction?: () => void;
  actionIcon?: typeof User;
  actionTooltip?: string;
  onEdit?: () => void;
}) {
  const iconColorMap: Record<string, string> = {
    User: "text-secondary",
    Building: "text-accent",
    Hash: "text-muted-foreground",
    Phone: "text-info",
    Mail: "text-primary",
    MapPin: "text-warning",
  };
  const iconColor = iconColorMap[Icon.displayName || ""] || "text-secondary";
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 py-1 group",
        onEdit && "cursor-pointer hover:bg-muted/40 -mx-2 px-2 rounded-md transition-colors"
      )}
      onClick={onEdit}
    >
      <Icon className={cn("h-3.5 w-3.5 shrink-0 mt-0.5", iconColor)} />
      <span className={cn(
        "text-sm leading-snug flex-1 min-w-0",
        wrap ? "break-words" : "truncate",
        isLink ? "text-primary underline underline-offset-2 text-xs cursor-pointer" : "",
        muted && !isLink ? "text-muted-foreground" : "",
        !muted && !isLink ? "font-medium text-foreground" : "",
      )}>
        {label}
      </span>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {onCopy && (
          <button
            onClick={(e) => { e.stopPropagation(); onCopy(); }}
            className="h-6 w-6 flex items-center justify-center rounded-md hover:bg-muted transition-colors"
            title="Copiar"
          >
            <Copy className="h-3 w-3 text-muted-foreground" />
          </button>
        )}
        {onAction && ActionIcon && (
          <button
            onClick={(e) => { e.stopPropagation(); onAction(); }}
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

function PropostasTab({ customerId, dealId, dealTitle, navigate, isClosed, dealStatus }: { customerId: string | null; dealId: string; dealTitle: string; navigate: any; isClosed?: boolean; dealStatus?: string }) {
  const { data: propostas = [], isLoading: loading, refetch } = usePropostasProjetoTab(dealId, customerId);
  const setPrincipalMutation = useSetPropostaPrincipal();
  const arquivarMutation = useArquivarProposta();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Reset expandedId if the expanded proposta no longer exists in the list (e.g. after deletion)
  useEffect(() => {
    if (expandedId && propostas.length > 0 && !propostas.find(p => p.id === expandedId)) {
      setExpandedId(null);
    }
    if (expandedId && propostas.length === 0) {
      setExpandedId(null);
    }
  }, [propostas, expandedId]);
  const [linkedOrcs, setLinkedOrcs] = useState<LinkedOrcamento[]>([]);
  const [loadingLeads, setLoadingLeads] = useState(false);

  // Fetch deal snapshot-relevant fields for staleness detection
  const { data: dealSnapshotMeta } = useQuery({
    queryKey: ["deal-snapshot-meta", dealId],
    queryFn: async () => {
      const { data } = await supabase
        .from("deals")
        .select("kwp, value, updated_at")
        .eq("id", dealId)
        .single();
      return data || null;
    },
    staleTime: 1000 * 60 * 5,
    enabled: !!dealId,
  });

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
            const statusMap = new Map<string, string>();
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

  const principal = selectPrincipal(propostas as any[]);
  const outras = propostas.filter(p => p.id !== principal?.id);

  const isPropostaOutdated = (prop: any) => {
    if (!dealSnapshotMeta) return false;
    const lv = prop.versoes?.[0];
    if (!lv?.gerado_em) return false;
    // Only consider outdated if deal was updated AFTER proposal was generated
    // AND snapshot-relevant fields differ (potencia/valor changed)
    const dealTime = new Date(dealSnapshotMeta.updated_at).getTime();
    const propTime = new Date(lv.gerado_em).getTime();
    if (dealTime <= propTime) return false;
    // Check if snapshot-critical fields differ from deal
    const snap = lv.snapshot || {};
    const snapPotencia = Number(snap.potenciaKwp ?? snap.potencia_kwp ?? 0);
    const snapValor = Number(snap.precoTotal ?? snap.preco_total ?? snap.valor_total ?? 0);
    const dealPotencia = Number(dealSnapshotMeta.kwp ?? 0);
    const dealValor = Number(dealSnapshotMeta.value ?? 0);
    // Only mark as outdated if critical data actually changed
    return Math.abs(snapPotencia - dealPotencia) > 0.01 || Math.abs(snapValor - dealValor) > 1;
  };

  const isPrincipalOutdated = principal ? isPropostaOutdated(principal) : false;

  const renderPropostaCard = (p: any, isPrin: boolean) => {
    return (
      <PropostaExpandedDetail
        key={p.id}
        proposta={p}
        isPrincipal={isPrin}
        isExpanded={expandedId === p.id}
        onToggle={() => setExpandedId(expandedId === p.id ? null : p.id)}
        dealId={dealId}
        customerId={customerId}
        onRefresh={() => refetch()}
        isOutdated={isPropostaOutdated(p)}
        onSetPrincipal={() => setPrincipalMutation.mutate({ propostaId: p.id, dealId })}
        onArchive={() => arquivarMutation.mutate(p.id)}
      />
    );
  };

  return (
    <div className="space-y-6">
      {isClosed && (
        <div className="flex items-center justify-end">
          <Badge variant="secondary" className={cn("text-xs", dealStatus === "won" ? "bg-success/10 text-success border-success/20" : "bg-destructive/10 text-destructive border-destructive/20")}>
            <AlertCircle className="h-3 w-3 mr-1" />
            {dealStatus === "won" ? "Projeto concluído" : "Projeto perdido"}
          </Badge>
        </div>
      )}

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
                    {orc.cidade && `${orc.cidade}, ${orc.estado}`} • {formatDate(orc.created_at)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {propostas.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="Nenhuma proposta encontrada"
          description={customerId ? "Crie a primeira proposta para este cliente" : "Vincule um cliente ao projeto primeiro"}
          action={customerId && !isClosed ? {
            label: "Criar proposta",
            onClick: () => {
              const params = new URLSearchParams({ deal_id: dealId });
              if (customerId) params.set("customer_id", customerId);
              navigate(`/admin/propostas-nativas/nova?${params.toString()}`);
            },
            icon: Plus,
          } : undefined}
        />
      ) : (
        <div className="space-y-6">
          {principal && (
            <div>
              {renderPropostaCard(principal, true)}
            </div>
          )}

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
function TimelineEntry({ icon, title, subtitle, date, isCurrent, isFirst }: {
  icon: React.ReactNode; title: string; subtitle?: string; date: string; isCurrent?: boolean; isFirst?: boolean;
}) {
  return (
    <div className={cn(
      "relative flex gap-3 pl-0 group",
    )}>
      <div className={cn(
        "relative z-10 flex items-center justify-center w-6 h-6 rounded-full shrink-0 border-2 transition-transform group-hover:scale-110",
        isCurrent ? "bg-primary border-primary text-primary-foreground shadow-sm shadow-primary/30"
          : isFirst ? "bg-warning border-warning text-warning-foreground shadow-sm shadow-warning/20"
          : "bg-card border-border text-muted-foreground"
      )}>
        {icon}
      </div>
      <div className={cn(
        "flex-1 min-w-0 pb-2 -mt-0.5 px-3 py-2 rounded-lg transition-colors",
        isCurrent ? "bg-primary/5" : "hover:bg-muted/30"
      )}>
        <p className={cn("text-sm leading-snug", isCurrent ? "font-semibold text-foreground" : "text-foreground")}>{title}</p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{subtitle}</p>}
        <p className="text-[10px] text-muted-foreground/60 mt-1">{date}</p>
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
