import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Settings, MessageSquare, FileText, ShoppingCart, FolderOpen,
  Clock, User, ChevronRight, Zap, DollarSign, CalendarDays, Loader2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { SunLoader } from "@/components/loading/SunLoader";

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
  const [deal, setDeal] = useState<DealDetail | null>(null);
  const [history, setHistory] = useState<StageHistory[]>([]);
  const [stages, setStages] = useState<StageInfo[]>([]);
  const [customerName, setCustomerName] = useState<string>("");
  const [ownerName, setOwnerName] = useState<string>("");
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

        // Load stages, customer, owner in parallel
        const [stagesRes, customerRes, ownerRes] = await Promise.all([
          supabase.from("pipeline_stages").select("id, name, position, is_closed, is_won, probability").eq("pipeline_id", d.pipeline_id).order("position"),
          d.customer_id ? supabase.from("clientes").select("nome").eq("id", d.customer_id).single() : Promise.resolve({ data: null }),
          supabase.from("consultores").select("nome").eq("id", d.owner_id).single(),
        ]);

        setStages((stagesRes.data || []) as StageInfo[]);
        if (customerRes.data) setCustomerName((customerRes.data as any).nome);
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

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
  };

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
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {ownerName}
            </span>
            {deal.value > 0 && (
              <span className="flex items-center gap-1 font-bold text-foreground">
                <DollarSign className="h-3 w-3 text-success" />
                {formatBRL(deal.value)}
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
            {/* Progress bar background */}
            <div className="absolute top-4 left-0 right-0 h-1 bg-muted rounded-full" />
            {/* Progress bar fill */}
            <motion.div
              className="absolute top-4 left-0 h-1 bg-gradient-to-r from-teal-solar to-amarelo-sol rounded-full"
              initial={{ width: "0%" }}
              animate={{
                width: stages.length > 1
                  ? `${(currentStageIndex / (stages.length - 1)) * 100}%`
                  : "0%",
              }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />

            {/* Steps */}
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
                isActive
                  ? "bg-teal-solar text-white shadow-sm"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
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
              deal={deal}
              history={history}
              stages={stages}
              customerName={customerName}
              ownerName={ownerName}
              currentStage={currentStage}
              formatDate={formatDate}
              formatBRL={formatBRL}
              getStageNameById={getStageNameById}
            />
          )}
          {activeTab === "chat" && <PlaceholderTab icon={MessageSquare} label="Chat WhatsApp" />}
          {activeTab === "propostas" && <PlaceholderTab icon={FileText} label="Propostas" />}
          {activeTab === "loja" && <PlaceholderTab icon={ShoppingCart} label="Loja SolarMarket" />}
          {activeTab === "documentos" && <PlaceholderTab icon={FolderOpen} label="Documentos" />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ─── Gerenciamento Tab ──────────────────────────────
function GerenciamentoTab({
  deal, history, stages, customerName, ownerName, currentStage,
  formatDate, formatBRL, getStageNameById,
}: {
  deal: DealDetail;
  history: StageHistory[];
  stages: StageInfo[];
  customerName: string;
  ownerName: string;
  currentStage?: StageInfo;
  formatDate: (d: string) => string;
  formatBRL: (v: number) => string;
  getStageNameById: (id: string | null) => string;
}) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      {/* ── Info Cards ── */}
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

      {/* ── Timeline ── */}
      <div className="lg:col-span-2">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2">
              <Clock className="h-4 w-4 text-teal-solar" />
              Timeline de Atividades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              {/* Vertical line */}
              <div className="absolute left-[11px] top-2 bottom-2 w-[2px] bg-border/60 rounded-full" />

              <div className="space-y-4">
                {/* Current stage entry */}
                <TimelineEntry
                  icon={<Zap className="h-3 w-3" />}
                  title={`Etapa atual: ${currentStage?.name || "—"}`}
                  subtitle={`Probabilidade: ${currentStage?.probability || 0}%`}
                  date={formatDate(deal.updated_at)}
                  isCurrent
                />

                {/* History entries */}
                {history.map(h => (
                  <TimelineEntry
                    key={h.id}
                    icon={<ChevronRight className="h-3 w-3" />}
                    title={
                      h.from_stage_id
                        ? `Movido de "${getStageNameById(h.from_stage_id)}" para "${getStageNameById(h.to_stage_id)}"`
                        : `Incluído na etapa "${getStageNameById(h.to_stage_id)}"`
                    }
                    subtitle={h.moved_by ? `Por: ${h.moved_by}` : undefined}
                    date={formatDate(h.moved_at)}
                  />
                ))}

                {/* Created entry */}
                <TimelineEntry
                  icon={<CalendarDays className="h-3 w-3" />}
                  title="Projeto criado"
                  date={formatDate(deal.created_at)}
                  isFirst
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

// ─── Timeline Entry ──────────────────────────────────
function TimelineEntry({ icon, title, subtitle, date, isCurrent, isFirst }: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  date: string;
  isCurrent?: boolean;
  isFirst?: boolean;
}) {
  return (
    <div className="relative flex gap-3 pl-0">
      <div className={cn(
        "relative z-10 flex items-center justify-center w-6 h-6 rounded-full shrink-0 border-2",
        isCurrent
          ? "bg-teal-solar border-teal-solar text-white"
          : isFirst
            ? "bg-amarelo-sol border-amarelo-sol text-white"
            : "bg-background border-border text-muted-foreground"
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0 pb-1">
        <p className={cn("text-sm leading-snug", isCurrent ? "font-bold text-foreground" : "text-foreground/80")}>
          {title}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        <p className="text-[10px] text-muted-foreground/70 mt-0.5">{date}</p>
      </div>
    </div>
  );
}

// ─── Info Row ──────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}

// ─── Placeholder Tab ──────────────────────────────────
function PlaceholderTab({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <Card>
      <CardContent className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Icon className="h-10 w-10 mb-3 opacity-30" />
        <p className="font-medium">{label}</p>
        <p className="text-xs mt-1">Em breve...</p>
      </CardContent>
    </Card>
  );
}
