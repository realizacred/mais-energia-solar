import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Settings, MessageSquare, FileText, ShoppingCart, FolderOpen,
  Clock, User, ChevronRight, Zap, DollarSign, CalendarDays, Loader2,
  Upload, Trash2, Download, Eye, Plus, ExternalLink, Phone, StickyNote, Filter
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { SunLoader } from "@/components/loading/SunLoader";
import { toast } from "@/hooks/use-toast";

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

interface Props {
  dealId: string;
  onBack: () => void;
}

const TABS = [
  { id: "gerenciamento", label: "Gerenciamento", icon: Settings },
  { id: "chat", label: "Chat Whatsapp", icon: MessageSquare },
  { id: "propostas", label: "Propostas", icon: FileText },
  { id: "loja", label: "Loja SolarMarket", icon: ShoppingCart },
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
  const [ownerName, setOwnerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabId>("gerenciamento");

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
        setHistory((historyRes.data || []) as StageHistory[]);

        const [stagesRes, customerRes, ownerRes] = await Promise.all([
          supabase.from("pipeline_stages").select("id, name, position, is_closed, is_won, probability").eq("pipeline_id", d.pipeline_id).order("position"),
          d.customer_id ? supabase.from("clientes").select("nome, telefone").eq("id", d.customer_id).single() : Promise.resolve({ data: null }),
          supabase.from("consultores").select("nome").eq("id", d.owner_id).single(),
        ]);

        setStages((stagesRes.data || []) as StageInfo[]);
        if (customerRes.data) {
          setCustomerName((customerRes.data as any).nome);
          setCustomerPhone((customerRes.data as any).telefone || "");
        }
        if (ownerRes.data) setOwnerName((ownerRes.data as any).nome);
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
    <div className="space-y-4">
      {/* ── Header ── */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon-sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-foreground truncate">
            {customerName || deal.title}
          </h2>
          <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><User className="h-3 w-3" />{ownerName}</span>
            {deal.value > 0 && (
              <span className="flex items-center gap-1 font-bold text-foreground">
                <DollarSign className="h-3 w-3 text-success" />{formatBRL(deal.value)}
              </span>
            )}
            <Badge variant="secondary" className="text-[10px] h-5">{deal.status}</Badge>
          </div>
        </div>
      </div>

      {/* ── Stepper Horizontal ── */}
      <Card className="overflow-hidden">
        <CardContent className="py-5 px-6">
          <div className="relative">
            <div className="absolute top-4 left-0 right-0 h-1 bg-muted rounded-full" />
            <motion.div
              className="absolute top-4 left-0 h-1 bg-gradient-to-r from-teal-solar to-amarelo-sol rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: stages.length > 1 ? `${(currentStageIndex / (stages.length - 1)) * 100}%` : "0%" }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
            <div className="relative flex justify-between">
              {stages.map((stage, i) => {
                const isCompleted = i < currentStageIndex;
                const isCurrent = i === currentStageIndex;
                const isPast = i <= currentStageIndex;
                return (
                  <div key={stage.id} className="flex flex-col items-center z-10">
                    <motion.div
                      className={cn(
                        "w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold border-2 transition-all",
                        isCompleted && "bg-teal-solar border-teal-solar text-white",
                        isCurrent && "bg-background border-teal-solar text-teal-solar shadow-md",
                        !isPast && "bg-muted border-muted-foreground/20 text-muted-foreground"
                      )}
                      animate={{ scale: isCurrent ? 1.15 : 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      {isCompleted ? "✓" : i + 1}
                    </motion.div>
                    <span className={cn(
                      "mt-1.5 text-[10px] font-medium text-center max-w-[70px] leading-tight",
                      isCurrent ? "text-teal-solar font-bold" : "text-muted-foreground"
                    )}>
                      {stage.name}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs ── */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all",
                isActive ? "bg-teal-solar text-white shadow-sm" : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />{tab.label}
            </button>
          );
        })}
      </div>

      {/* ── Tab Content ── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === "gerenciamento" && (
            <GerenciamentoTab
              deal={deal} history={history} stages={stages}
              customerName={customerName} ownerName={ownerName}
              currentStage={currentStage}
              formatDate={formatDate} formatBRL={formatBRL} getStageNameById={getStageNameById}
            />
          )}
          {activeTab === "chat" && (
            <ChatTab customerId={deal.customer_id} customerPhone={customerPhone} />
          )}
          {activeTab === "propostas" && (
            <PropostasTab customerId={deal.customer_id} dealTitle={deal.title} navigate={navigate} />
          )}
          {activeTab === "loja" && <LojaTab />}
          {activeTab === "documentos" && (
            <DocumentosTab dealId={deal.id} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ═══════════════════════════════════════════════════
// ─── TAB: Gerenciamento ──────────────────────────
// ═══════════════════════════════════════════════════

type TimelineFilter = "todos" | "funil" | "notas" | "documentos";

const TIMELINE_FILTERS: { id: TimelineFilter; label: string; icon: typeof ChevronRight }[] = [
  { id: "todos", label: "Todos", icon: Filter },
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
  deal, history, stages, customerName, ownerName, currentStage,
  formatDate, formatBRL, getStageNameById,
}: {
  deal: DealDetail; history: StageHistory[]; stages: StageInfo[];
  customerName: string; ownerName: string; currentStage?: StageInfo;
  formatDate: (d: string) => string; formatBRL: (v: number) => string;
  getStageNameById: (id: string | null) => string;
}) {
  const [timelineFilter, setTimelineFilter] = useState<TimelineFilter>("todos");
  const [docEntries, setDocEntries] = useState<UnifiedTimelineItem[]>([]);

  // Load document activity for timeline
  useEffect(() => {
    async function loadDocEntries() {
      try {
        const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
        if (!profile) return;
        const path = `${profile.tenant_id}/deals/${deal.id}`;
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

  // Build unified timeline entries
  const allEntries = useMemo(() => {
    const entries: UnifiedTimelineItem[] = [];

    // Current stage (always first)
    if (currentStage) {
      entries.push({
        id: "current-stage",
        type: "funil",
        title: `Etapa atual: ${currentStage.name}`,
        subtitle: `Probabilidade: ${currentStage.probability}%`,
        date: formatDate(deal.updated_at),
        isCurrent: true,
      });
    }

    // Stage history
    history.forEach(h => {
      entries.push({
        id: h.id,
        type: "funil",
        title: h.from_stage_id
          ? `Movido de "${getStageNameById(h.from_stage_id)}" para "${getStageNameById(h.to_stage_id)}"`
          : `Incluído na etapa "${getStageNameById(h.to_stage_id)}"`,
        subtitle: h.moved_by ? `Por: ${h.moved_by}` : undefined,
        date: formatDate(h.moved_at),
      });
    });

    // Notes from deal
    if ((deal as any).notas) {
      const notasText = String((deal as any).notas);
      entries.push({
        id: "nota-principal",
        type: "nota",
        title: "Nota adicionada",
        subtitle: notasText.length > 80 ? notasText.substring(0, 80) + "..." : notasText,
        date: formatDate(deal.updated_at),
      });
    }

    // Document entries
    entries.push(...docEntries);

    // Creation entry (always last)
    entries.push({
      id: "criacao",
      type: "criacao",
      title: "Projeto criado",
      date: formatDate(deal.created_at),
      isFirst: true,
    });

    return entries;
  }, [history, currentStage, deal, docEntries, formatDate, getStageNameById]);

  // Filtered entries
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

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold">Informações</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <InfoRow label="Cliente" value={customerName || "—"} />
            <InfoRow label="Responsável" value={ownerName} />
            <InfoRow label="Etapa Atual" value={currentStage?.name || "—"} />
            <InfoRow label="Probabilidade" value={currentStage ? `${currentStage.probability}%` : "—"} />
            <InfoRow label="Valor" value={formatBRL(deal.value)} />
            <InfoRow label="Status" value={deal.status} />
            <InfoRow label="Criado em" value={formatDate(deal.created_at)} />
            {deal.expected_close_date && (
              <InfoRow label="Previsão" value={new Date(deal.expected_close_date).toLocaleDateString("pt-BR")} />
            )}
          </CardContent>
        </Card>
      </div>

      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Clock className="h-4 w-4 text-teal-solar" />Timeline de Atividades
              </CardTitle>
            </div>
            {/* Mini-filter tabs */}
            <div className="flex items-center gap-1 mt-2 overflow-x-auto">
              {TIMELINE_FILTERS.map(f => {
                const Icon = f.icon;
                const isActive = timelineFilter === f.id;
                return (
                  <button
                    key={f.id}
                    onClick={() => setTimelineFilter(f.id)}
                    className={cn(
                      "flex items-center gap-1 px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition-all",
                      isActive
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}
                  >
                    <Icon className="h-3 w-3" />{f.label}
                  </button>
                );
              })}
            </div>
          </CardHeader>
          <CardContent>
            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <p className="text-sm">Nenhuma atividade nesta categoria</p>
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-border/60 rounded-full" />
                <div className="space-y-4">
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
        <h3 className="text-sm font-bold text-foreground">Propostas do Cliente</h3>
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
                          <Zap className="h-3 w-3 text-amarelo-sol" />{v.potencia_kwp} kWp
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
        // Search by phone digits
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
      <h3 className="text-sm font-bold text-foreground">Conversas WhatsApp</h3>

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
                <div className="w-10 h-10 rounded-full bg-teal-solar/10 flex items-center justify-center shrink-0">
                  <MessageSquare className="h-5 w-5 text-teal-solar" />
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

  const folderPath = useMemo(() => {
    // We'll resolve tenant_id on the fly at upload time
    return `deals/${dealId}`;
  }, [dealId]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      // Get tenant_id from profile
      const { data: profile } = await supabase.from("profiles").select("tenant_id").limit(1).single();
      if (!profile) { setLoading(false); return; }

      const path = `${profile.tenant_id}/${folderPath}`;
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

      const basePath = `${profile.tenant_id}/${folderPath}`;

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

      const path = `${profile.tenant_id}/${folderPath}/${fileName}`;
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

      const path = `${profile.tenant_id}/${folderPath}/${fileName}`;
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
        <h3 className="text-sm font-bold text-foreground">Documentos do Projeto</h3>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleUpload}
          />
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="gap-1.5"
          >
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
              <FileText className="h-5 w-5 text-teal-solar shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{f.name.replace(/^\d+_/, "")}</p>
                <p className="text-[10px] text-muted-foreground">
                  {formatSize(f.metadata?.size)} • {f.created_at ? new Date(f.created_at).toLocaleDateString("pt-BR") : ""}
                </p>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon-sm" onClick={() => handleDownload(f.name)}>
                  <Download className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={() => handleDelete(f.name)} className="text-destructive hover:text-destructive">
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
// ─── TAB: Loja SolarMarket ──────────────────────
// ═══════════════════════════════════════════════════
function LojaTab() {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-14 text-muted-foreground">
        <ShoppingCart className="h-10 w-10 mb-3 opacity-30" />
        <p className="font-medium">Loja SolarMarket</p>
        <p className="text-xs mt-1">Integração com a loja de kits disponível em breve</p>
      </CardContent>
    </Card>
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
        isCurrent ? "bg-teal-solar border-teal-solar text-white"
          : isFirst ? "bg-amarelo-sol border-amarelo-sol text-white"
          : "bg-background border-border text-muted-foreground"
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <p className={cn("text-sm leading-snug", isCurrent ? "font-bold text-foreground" : "text-foreground/80")}>{title}</p>
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
