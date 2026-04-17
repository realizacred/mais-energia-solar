import { useState, useCallback, useEffect } from "react";
import { useRef } from "react";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerDescription, DrawerFooter } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
// invokeEdgeFunction replaced by direct fetch with 120s timeout for migration
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";
import { Sun, CheckCircle, XCircle, Loader2, Clock, ArrowRight, AlertTriangle, FileText, User, Briefcase, FolderKanban, Copy, StopCircle } from "lucide-react";
import { toast } from "sonner";
import type { SmProposal } from "@/hooks/useSolarMarket";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { SmBentoKpis } from "@/components/admin/solarmarket/SmBentoKpis";
import { SmVerticalStepper } from "@/components/admin/solarmarket/SmVerticalStepper";
import { SmTerminalLog } from "@/components/admin/solarmarket/SmTerminalLog";
import { SmCompletionBanner } from "@/components/admin/solarmarket/SmCompletionBanner";

// ─── Constants ──────────────────────────────────────────

const SM_STATUS_LABEL_MAP: Record<string, { proposal_status: string; label: string }> = {
  approved: { proposal_status: "aceita", label: "Ganho" },
  sent: { proposal_status: "enviada", label: "Proposta Enviada" },
  viewed: { proposal_status: "enviada", label: "Proposta Enviada" },
  generated: { proposal_status: "rascunho", label: "Negociação" },
  draft: { proposal_status: "rascunho", label: "Qualificação" },
  rejected: { proposal_status: "rejeitada", label: "Perdido" },
};

// ─── Types ──────────────────────────────────────────────

type StepName = "fetch" | "cliente" | "deal" | "projeto" | "proposta" | "versao" | "done";
type StepState = "pending" | "running" | "done" | "error" | "skipped";

interface MigrationStep {
  name: StepName;
  label: string;
  icon: React.ElementType;
  state: StepState;
  detail?: string;
  createdId?: string;
}

const INITIAL_STEPS: MigrationStep[] = [
  { name: "fetch", label: "Buscar proposta SM", icon: FileText, state: "pending" },
  { name: "cliente", label: "Resolver/Criar cliente", icon: User, state: "pending" },
  { name: "deal", label: "Criar/Vincular deal", icon: Briefcase, state: "pending" },
  { name: "projeto", label: "Criar/Vincular projeto", icon: FolderKanban, state: "pending" },
  { name: "proposta", label: "Criar proposta nativa", icon: FileText, state: "pending" },
  { name: "versao", label: "Criar versão", icon: Copy, state: "pending" },
  { name: "done", label: "Concluído", icon: CheckCircle, state: "pending" },
];

interface MigrationResult {
  mode: string;
  summary: Record<string, number>;
  details: Array<{
    sm_proposal_id: number;
    sm_client_name: string | null;
    aborted: boolean;
    steps: Record<string, { status: string; id?: string; reason?: string }>;
  }>;
  total_found: number;
  total_processed: number;
  has_more?: boolean;
  time_budget_exceeded?: boolean;
  completed?: boolean;
  pending?: number;
  migrated?: number;
}

interface MigrationBlockedPayload {
  blocked?: boolean;
  blocked_by?: string | null;
  blocked_by_type?: string | null;
  error?: string;
  message?: string;
}

const SYNC_BLOCKING_OPERATION_TYPES = new Set([
  "sync_proposals",
  "solarmarket_sync",
  "sync_staging",
]);

function getBlockedType(errBody: MigrationBlockedPayload) {
  return errBody?.blocked_by_type || errBody?.blocked_by || null;
}

function getBlockedMessage(errBody: MigrationBlockedPayload, fallback: string) {
  return errBody?.message || errBody?.error || fallback;
}

// ─── Humanization helpers ─────────────────────────────────

const SUMMARY_KEY_LABELS: Record<string, string> = {
  CREATED: "Migradas com sucesso",
  OK: "Processadas",
  ERROR: "Com erro",
  WOULD_CREATE: "Seriam criadas",
  WOULD_SKIP: "Já existentes",
  WOULD_LINK: "Seriam vinculadas",
  FALLBACK_USED: "Destino automático",
  CONFLICT: "Conflito",
};

function formatSummaryKey(key: string): string {
  return SUMMARY_KEY_LABELS[key] || key;
}

const STEP_LABELS: Record<string, string> = {
  cliente: "Cliente",
  deal: "Negócio",
  projeto: "Projeto",
  proposta_nativa: "Proposta",
  proposta_versao: "Versão",
  pipelines: "Pipeline",
  _fatal: "Erro fatal",
};

const SUCCESS_STEP_STATUSES = new Set<string>(["CREATED", "SUCCESS", "WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP"]);

function humanizeStepResult(
  stepKey: string,
  stepVal: { status: string; id?: string; reason?: string },
): { label: string; description: string; colorClass: string } {
  const stepLabel = STEP_LABELS[stepKey] || stepKey;
  const status = stepVal.status || "";
  const reason = stepVal.reason || "";

  let colorClass = "text-muted-foreground";
  if (status.includes("ERROR")) colorClass = "text-destructive";
  else if (status.includes("CREATE") || status === "CREATED") colorClass = "text-success";
  else if (status.includes("LINK")) colorClass = "text-info";

  let description = "";

  if (status === "CREATED" || status === "WOULD_CREATE") {
    description = "Criado";
    if (reason) description = humanizeReason(reason);
  } else if (status === "WOULD_SKIP") {
    description = "Já existia no sistema";
  } else if (status === "WOULD_LINK") {
    description = "Vinculado a registro existente";
  } else if (status === "FALLBACK_USED") {
    description = humanizeFallbackReason(reason);
  } else if (status === "ERROR") {
    description = reason || "Erro durante o processamento";
  } else if (status === "CONFLICT") {
    description = reason || "Conflito detectado";
  } else {
    description = reason || status;
  }

  return { label: stepLabel, description, colorClass };
}

function humanizeReason(reason: string): string {
  if (reason.includes("comercial_default")) return "Enviado ao pipeline Comercial";
  if (reason.includes("fallback_escritorio")) return "Consultor: Escritório (vendedor não encontrado)";
  if (reason.includes("fallback_mandatory")) return "Pipeline Comercial (sem funil operacional)";
  if (reason.includes("fallback_default")) return "Pipeline Comercial (destino padrão)";
  if (reason.includes("sm_lifecycle")) {
    const match = reason.match(/sm_lifecycle:(\w+)/);
    const lifecycle = match?.[1];
    const labels: Record<string, string> = {
      approved: "Proposta aprovada → Ganho",
      sent: "Proposta enviada",
      viewed: "Proposta visualizada → Negociação",
      generated: "Proposta gerada → Qualificação",
      draft: "Rascunho → Entrada",
      rejected: "Proposta recusada → Perdido",
    };
    return labels[lifecycle || ""] || `Status: ${lifecycle}`;
  }
  if (reason.includes("db_all_funnels:")) {
    const name = reason.replace(/.*db_all_funnels:/, "").trim();
    return `Consultor: ${name} (vendedor SM)`;
  }
  if (reason.includes("db_funnel:")) {
    const name = reason.replace(/.*db_funnel:/, "").trim();
    return `Consultor: ${name} (vendedor SM)`;
  }
  if (reason.includes("api_funnel:")) {
    const name = reason.replace(/.*api_funnel:/, "").trim();
    return `Consultor: ${name} (API SM)`;
  }
  if (reason.includes("owner:")) {
    const ownerMatch = reason.match(/owner:\s*([^,]+)/);
    const pipelineMatch = reason.match(/pipeline:\s*(.+)/);
    const parts: string[] = [];
    if (ownerMatch) {
      const src = ownerMatch[1].trim();
      if (src.includes("escritorio")) parts.push("Consultor: Escritório");
      else if (src.includes("db_all_funnels")) parts.push("Consultor detectado do SM");
      else if (src !== "none") parts.push(`Consultor: ${src}`);
    }
    if (pipelineMatch) {
      const src = pipelineMatch[1].trim();
      if (src.includes("comercial")) parts.push("Pipeline Comercial");
      else if (src.includes("lifecycle")) parts.push("Etapa pelo status da proposta");
      else parts.push(`Pipeline: ${src}`);
    }
    return parts.join(" · ") || reason;
  }
  if (reason.includes("matched by codigo")) return "Vinculado pelo código do projeto";
  if (reason.includes("matched by deal_id")) return "Vinculado pelo negócio";
  if (reason.includes("funis mapeados")) return reason.replace("funis mapeados", "pipelines detectados no SM");
  return reason;
}

function humanizeFallbackReason(reason: string): string {
  if (reason.includes("Nenhum funil real")) return "Sem funil operacional no SM — mantido no Comercial";
  if (reason.includes("Comercial")) return "Pipeline Comercial (destino automático)";
  return reason || "Destino definido automaticamente";
}

// ─── Hook: fetch consultores for owner dropdown ─────────


function useConsultores(isReady: boolean) {
  return useQuery<{ id: string; nome: string }[]>({
    queryKey: ["consultores-active"],
    enabled: isReady,
    queryFn: async () => {
      const { data } = await supabase
        .from("consultores")
        .select("id, nome")
        .eq("ativo", true)
        .order("nome");
      return data || [];
    },
    staleTime: 60_000,
  });
}

// ─── Hook: fetch available pipelines ───────────────────

function usePipelines(isReady: boolean) {
  return useQuery<{ id: string; name: string; kind: string; is_default: boolean }[]>({
    queryKey: ["pipelines-for-migration"],
    enabled: isReady,
    queryFn: async () => {
      const { data } = await supabase
        .from("pipelines")
        .select("id, name, kind, is_default")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      // Sort so is_default pipeline comes first
      const sorted = (data || []).sort((a: any, b: any) => {
        if (a.is_default && !b.is_default) return -1;
        if (!a.is_default && b.is_default) return 1;
        return 0;
      });
      return sorted as { id: string; name: string; kind: string; is_default: boolean }[];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Hook: fetch stages for a pipeline ─────────────────

function usePipelineStages(pipelineId: string | null, isReady: boolean) {
  return useQuery<{ id: string; name: string }[]>({
    queryKey: ["pipeline-stages-migration", pipelineId],
    enabled: !!pipelineId && isReady,
    queryFn: async () => {
      const { data } = await supabase
        .from("pipeline_stages")
        .select("id, name, position")
        .eq("pipeline_id", pipelineId!)
        .eq("is_closed", false)
        .order("position", { ascending: true });
      return data || [];
    },
    staleTime: 1000 * 60 * 5,
  });
}

// ─── Hook: check if already migrated ───────────────────

function useCanonicalCheck(smProposalId: number | null) {
  return useQuery({
    queryKey: ["canonical-check", smProposalId],
    enabled: !!smProposalId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("propostas_nativas")
        .select("id, titulo, status, created_at")
        .eq("sm_id", String(smProposalId))
        .limit(1);
      return (data && data.length > 0) ? data[0] : null;
    },
  });
}

// ─── Hook: pending migration count ─────────────────────

function usePendingMigrationCount() {
  return useQuery<{ total: number; pending: number; migrated: number; errors: number }>({
    queryKey: ["sm-migration-pending-count"],
    queryFn: async () => {
      const [
        { count: total },
        { count: migrated },
        { data: lastRun, error: lastRunError },
      ] = await Promise.all([
        supabase.from("solar_market_proposals").select("id", { count: "exact", head: true }),
        supabase.from("solar_market_proposals").select("id", { count: "exact", head: true }).not("migrado_em", "is", null),
        (supabase as any)
          .from("sm_operation_runs")
          .select("error_items")
          .eq("operation_type", "migrate_to_native")
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (lastRunError) throw lastRunError;

      return {
        total: total || 0,
        migrated: migrated || 0,
        pending: Math.max(0, (total || 0) - (migrated || 0)),
        errors: Number(lastRun?.error_items || 0),
      };
    },
    staleTime: 1000 * 30,
  });
}

// ─── Hook: resolve real client name via project → client ──

function useSmRealClientName(smProjectId: number | null) {
  return useQuery<string | null>({
    queryKey: ["sm-real-client-name", smProjectId],
    enabled: !!smProjectId,
    queryFn: async () => {
      // First get sm_client_id from project
      const { data: proj } = await (supabase as any)
        .from("solar_market_projects")
        .select("sm_client_id, name")
        .eq("sm_project_id", smProjectId)
        .limit(1);
      if (!proj?.[0]) return null;
      const smClientId = proj[0].sm_client_id;
      if (!smClientId || smClientId < 0) return proj[0].name || null;
      // Then get client name
      const { data: client } = await (supabase as any)
        .from("solar_market_clients")
        .select("name")
        .eq("sm_client_id", smClientId)
        .limit(1);
      return client?.[0]?.name || proj[0].name || null;
    },
    staleTime: 60_000,
  });
}

// ─── Hook: fetch all funnels from SM project ───────────

interface SmFunnel {
  funnelId: number | null;
  funnelName: string;
  stageId: number | null;
  stageName: string;
}

function useSmProjectFunnels(smProjectId: number | null) {
  return useQuery<SmFunnel[]>({
    queryKey: ["sm-project-funnels", smProjectId],
    enabled: !!smProjectId,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("solar_market_projects")
        .select("all_funnels")
        .eq("sm_project_id", smProjectId)
        .limit(1);
      const funnels = data?.[0]?.all_funnels;
      return Array.isArray(funnels) ? funnels : [];
    },
    staleTime: 60_000,
  });
}

// ─── Migration Block Banner ──────────────────────────────

function MigrationBlockBanner() {
  const { data: config } = useQuery({
    queryKey: ["sm-config-block"],
    queryFn: async () => {
      const { data } = await supabase
        .from("solar_market_config")
        .select("migration_blocked")
        .limit(1)
        .maybeSingle();
      return data;
    },
    staleTime: 1000 * 30,
  });

  if (!config?.migration_blocked) return null;

  return (
    <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 flex items-start gap-2">
      <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-semibold text-warning">Migração pausada para manutenção</p>
        <p className="text-xs text-muted-foreground mt-1">
          A migração está temporariamente bloqueada enquanto os dados existentes são auditados e corrigidos.
          Contate o administrador para mais informações.
        </p>
      </div>
    </div>
  );
}

// ─── Drawer Component ───────────────────────────────────

interface SmMigrationDrawerProps {
  proposals: SmProposal[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Expose running state to parent */
  onRunningChange?: (running: boolean) => void;
}

export function SmMigrationDrawer({ proposals, open, onOpenChange, onRunningChange }: SmMigrationDrawerProps) {
  const [ownerId, setOwnerId] = useState<string>(""); // always used as fallback
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>("");
  const [selectedStageId, setSelectedStageId] = useState<string>("");
  const [steps, setSteps] = useState<MigrationStep[]>(INITIAL_STEPS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<MigrationResult | null>(null);
  const [dryRunCompleted, setDryRunCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [logs, setLogs] = useState<string[]>([]);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [smoothProgress, setSmoothProgress] = useState(0);
  const cancelRef = useRef(false);
  const [cancelling, setCancelling] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);

  useEffect(() => {
    return () => {
      cancelRef.current = true;
      onRunningChange?.(false);
    };
  }, [onRunningChange]);

  const lastHiddenAtRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  const { session } = useAuth();
  const isAuthReady = !!session;

  const { data: consultores = [] } = useConsultores(isAuthReady);
  const { data: pipelines = [] } = usePipelines(isAuthReady);
  const { data: pipelineStages = [] } = usePipelineStages(selectedPipelineId || null, isAuthReady);
  const { data: pendingStats, refetch: refetchPending } = usePendingMigrationCount();
  const qc = useQueryClient();

  // ─── Visibility change: refetch all data when tab regains focus ──
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState === "hidden") {
        lastHiddenAtRef.current = Date.now();
      }
      if (document.visibilityState === "visible") {
        const hiddenDuration = lastHiddenAtRef.current
          ? Date.now() - lastHiddenAtRef.current
          : 0;
        lastHiddenAtRef.current = null;

        // Always refetch counts when returning to tab
        refetchPending();
        qc.invalidateQueries({ queryKey: ["sm-proposals"] });
        qc.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });

        // If tab was hidden for more than 10s, also refresh canonical checks
        if (hiddenDuration > 10_000) {
          qc.invalidateQueries({ queryKey: ["canonical-check"] });
          qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [refetchPending, qc]);

  // ─── Realtime: auto-update pending count when proposals are migrated ──
  useEffect(() => {
    if (!open) return;

    const channel = supabase
      .channel("sm-migration-realtime-drawer")
      .on(
        "postgres_changes" as any,
        { event: "UPDATE", schema: "public", table: "solar_market_proposals" },
        () => {
          // Debounce: only refetch if not already running a batch
          refetchPending();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [open, refetchPending]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${formatTime(new Date())}] ${msg}`]);
  }, []);

  const updateStep = useCallback((name: StepName, update: Partial<MigrationStep>) => {
    setSteps(prev => prev.map(s => s.name === name ? { ...s, ...update } : s));
  }, []);

  const proposal = proposals[0]; // Single or first for display
  const isBulk = proposals.length > 1;
  const internalIds = proposals.map(p => p.id); // Use UUID primary keys for unique identification

  const { data: existingCanonical } = useCanonicalCheck(proposal?.sm_proposal_id ?? null);
  const { data: projectFunnels = [] } = useSmProjectFunnels(proposal?.sm_project_id ?? null);
  const { data: realClientName } = useSmRealClientName(proposal?.sm_project_id ?? null);

  const statusLabel = proposal ? (SM_STATUS_LABEL_MAP[proposal.status?.toLowerCase() ?? ""] ?? { proposal_status: "rascunho", label: "Qualificação" }) : { proposal_status: "rascunho", label: "Qualificação" };

  // Auto-select is_default pipeline first, then fallback to first in list
  const defaultPipeline = pipelines.find(p => p.is_default);
  const activePipelineId = selectedPipelineId || defaultPipeline?.id || pipelines[0]?.id || "";
  // Auto-select first stage when loaded
  const activeStageId = selectedStageId || pipelineStages[0]?.id || "";
  const selectedPipeline = pipelines.find(p => p.id === activePipelineId);
  const needsStage = selectedPipeline?.kind === "process";
  const canMigrate = !!activePipelineId && (!needsStage || !!activeStageId || pipelineStages.length === 0);

  // addLog already declared above

  const resetState = useCallback(() => {
    setSteps(INITIAL_STEPS);
    setResult(null);
    setError(null);
    setDryRunCompleted(false);
    setLogs([]);
    setConfirmText("");
    setSmoothProgress(0);
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
  }, []);

  // updateStep already declared above

  const runMigration = useCallback(async (dryRun: boolean) => {
    if (!activePipelineId) {
      setError("Nenhum pipeline encontrado. Crie um pipeline comercial antes de migrar.");
      return;
    }
    // owner_id is now optional — auto-resolved from SM funnel "Vendedores"
    resetState();
    setRunning(true);
    cancelRef.current = false;
    setBatchProgress(null);
    addLog(`Iniciando ${dryRun ? "simulação (dry-run)" : "migração real"} para ${internalIds.length} proposta(s)`);
    addLog(ownerId ? `Responsável manual: ${consultores.find(c => c.id === ownerId)?.nome || ownerId}` : "Responsável será auto-resolvido pelo funil Vendedores");

    // Step: Fetch
    updateStep("fetch", { state: "running" });
    addLog("Buscando sessão do usuário...");

    try {
      updateStep("fetch", { state: "done", detail: `${internalIds.length} proposta(s) selecionada(s)` });
      addLog(`Invocando edge function...`);

      // Sequential step animation running in parallel with EF calls
      const stepAnimCancelRef = { current: false };
      const runStepAnimation = async () => {
        if (dryRun) return;
        const seq: { key: StepName; ms: number }[] = [
          { key: "cliente", ms: 1200 },
          { key: "deal", ms: 1000 },
          { key: "projeto", ms: 1000 },
          { key: "proposta", ms: 1500 },
          { key: "versao", ms: 2000 },
        ];
        for (let i = 0; i < seq.length; i++) {
          if (stepAnimCancelRef.current) break;
          // Mark previous step as visually done before activating next
          if (i > 0) {
            updateStep(seq[i - 1].key, { state: "done" });
          }
          updateStep(seq[i].key, { state: "running" });
          await new Promise(r => setTimeout(r, seq[i].ms));
          if (stepAnimCancelRef.current) break;
        }
        // Mark last animated step as done if not cancelled
        if (!stepAnimCancelRef.current && seq.length > 0) {
          updateStep(seq[seq.length - 1].key, { state: "done" });
        }
      };
      const animPromise = runStepAnimation();

      // Smooth time-based progress bar
      const TOTAL_ESTIMATED_MS = 10_000;
      const progressStartTime = Date.now();
      progressIntervalRef.current = setInterval(() => {
        const elapsed = Date.now() - progressStartTime;
        const percent = Math.min(95, Math.round((elapsed / TOTAL_ESTIMATED_MS) * 100));
        setSmoothProgress(percent);
      }, 200);

      const basePayload: Record<string, any> = {
        dry_run: dryRun,
        pipeline_id: activePipelineId,
        stage_id: activeStageId || null,
        auto_resolve_owner: true,
        include_projects_without_proposal: false,
      };
      // Always send owner_id as fallback for proposals without Vendedores funnel
      if (ownerId && ownerId !== "__auto__") {
        basePayload.owner_id = ownerId;
      }

      // ── Batch processing: use slightly larger chunks in bulk migrations,
      // while avoiding excessive EF duration per request.
      const BATCH_SIZE = internalIds.length >= 100 ? 10 : 5;
      const INVALIDATE_EVERY_BATCHES = 5;
      const batches: string[][] = [];
      for (let i = 0; i < internalIds.length; i += BATCH_SIZE) {
        batches.push(internalIds.slice(i, i + BATCH_SIZE));
      }

      const allResults: MigrationResult[] = [];
      setBatchProgress({ current: 0, total: batches.length });

      const batchErrors: string[] = [];
      let syncWaitRetries = 0;
      const MAX_SYNC_WAIT_RETRIES = 12; // 12 * 15s = 3 min max wait

      for (let b = 0; b < batches.length; b++) {
        if (cancelRef.current) break;

        const batch = batches[b];
        setBatchProgress({ current: b + 1, total: batches.length });
        addLog(`Lote ${b + 1}/${batches.length} (${batch.length} propostas)...`);

        const payload = {
          ...basePayload,
          filters: { internal_ids: batch },
          batch_size: batch.length,
        };

        const MAX_NETWORK_RETRIES = 3;
        let networkRetry = 0;
        let batchDone = false;

        while (!batchDone && networkRetry <= MAX_NETWORK_RETRIES) {
          try {
            // Use direct fetch with 120s timeout to avoid "Failed to fetch" on long migrations
            const projectUrl = import.meta.env.VITE_SUPABASE_URL;
            // Refresh token if close to expiry before each batch call
            const { data: { session: currentSession } } = await supabase.auth.getSession();
            if (!currentSession?.access_token) throw new Error("Sessão expirada. Faça login novamente.");
            const expiresAt = currentSession.expires_at ?? 0;
            const now = Math.floor(Date.now() / 1000);
            let session = currentSession;
            if (expiresAt - now < 300) {
              const { data: refreshed } = await supabase.auth.refreshSession();
              if (!refreshed.session?.access_token) throw new Error("Não foi possível renovar a sessão.");
              session = refreshed.session;
            }

            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 120_000);

            let response: Response;
            try {
              response = await fetch(`${projectUrl}/functions/v1/migrate-sm-proposals-v2`, {
                method: "POST",
                headers: {
                  Authorization: `Bearer ${session.access_token}`,
                  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  "Content-Type": "application/json",
                },
                body: JSON.stringify(payload),
                signal: controller.signal,
              });
            } finally {
              clearTimeout(timeoutId);
            }

            if (!response.ok) {
              const errBody = await response.json().catch(() => ({} as MigrationBlockedPayload));
              if (response.status === 409 && errBody?.blocked) {
                const rawBlockedType = getBlockedType(errBody);
                const blockedType = rawBlockedType || "operação";
                const isSyncBlock = !!rawBlockedType && SYNC_BLOCKING_OPERATION_TYPES.has(rawBlockedType);
                if (isSyncBlock && syncWaitRetries < MAX_SYNC_WAIT_RETRIES) {
                  syncWaitRetries++;
                  addLog(`Lote ${b + 1}: aguardando término de ${blockedType}... Retentativa automática ${syncWaitRetries}/${MAX_SYNC_WAIT_RETRIES} em 15s.`);
                  await new Promise(r => setTimeout(r, 15_000));
                  b--; // retry same batch
                  batchDone = true;
                  continue;
                }
                if (isSyncBlock) {
                  throw new Error(`Sync de propostas ainda em execução após ${MAX_SYNC_WAIT_RETRIES} tentativas. Tente novamente mais tarde.`);
                }
                throw new Error(`Bloqueado: ${blockedType} em andamento. Aguarde a conclusão ou tente novamente em 2 minutos.`);
              }
              if (response.status === 423) {
                throw new Error(getBlockedMessage(errBody, "Migração bloqueada para manutenção. Contate o administrador."));
              }
              if (errBody?.blocked) {
                throw new Error(getBlockedMessage(errBody, "Migração bloqueada para manutenção. Contate o administrador."));
              }
              throw new Error(getBlockedMessage(errBody, `HTTP ${response.status}`));
            }

            const data = await response.json() as MigrationResult;

            if ((data as any)?.error) {
              throw new Error((data as any).error);
            }

            syncWaitRetries = 0; // reset after successful batch
            allResults.push(data);
            const successCount = allResults.reduce((acc, r) => acc + Math.max(0, (r.total_processed || 0) - (r.summary?.ERROR || 0)), 0);
            addLog(`Lote ${b + 1} OK: ${JSON.stringify(data.summary)} — Total migrado até agora: ${successCount}`);

            // Avoid refetching the full 1k+ proposals list on every single batch,
            // which makes the UI feel frozen during large migrations.
            if (!dryRun && ((b + 1) % INVALIDATE_EVERY_BATCHES === 0 || b === batches.length - 1)) {
              qc.invalidateQueries({ queryKey: ["sm-proposals"] });
            }

            // Update steps progressively from this batch's first detail
            if (!dryRun && data.details?.[0]) {
              const detail = data.details[0];
              const stepMap: Record<string, StepName> = {
                cliente: "cliente", deal: "deal", projeto: "projeto",
                proposta_nativa: "proposta", proposta_versao: "versao",
              };
              for (const [key, stepName] of Object.entries(stepMap)) {
                const serverStep = (detail.steps as Record<string, any>)[key];
                if (serverStep) {
                  const isOk = SUCCESS_STEP_STATUSES.has(serverStep.status);
                  updateStep(stepName, {
                    state: isOk ? "done" : "error",
                    detail: `${serverStep.status}${serverStep.id ? ` → ${serverStep.id.slice(0, 8)}...` : ""}${serverStep.reason ? ` (${serverStep.reason})` : ""}`,
                    createdId: serverStep.id,
                  });
                }
              }
            }
            batchDone = true;
          } catch (batchErr: any) {
            const isNetworkError = batchErr?.message === "Failed to fetch" || batchErr?.message === "Load failed";
            const isAbort = batchErr?.name === "AbortError";

            if (isNetworkError && networkRetry < MAX_NETWORK_RETRIES) {
              networkRetry++;
              const waitMs = networkRetry * 3_000;
              addLog(`Lote ${b + 1}: erro de rede, retentativa ${networkRetry}/${MAX_NETWORK_RETRIES} em ${waitMs / 1000}s...`);
              await new Promise(r => setTimeout(r, waitMs));
              continue;
            }

            const msg = isAbort
              ? "Timeout: migração demorou mais de 120s. Tente com menos propostas."
              : isNetworkError
                ? `Falha de rede após ${MAX_NETWORK_RETRIES} tentativas. Verifique sua conexão e tente novamente.`
                : batchErr?.message ?? "Erro desconhecido no lote";
            batchErrors.push(msg);
            addLog(`ERRO lote ${b + 1}: ${msg}`);
            // Mark all pending steps as error on failure
            if (!dryRun) {
              for (const s of ["cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
                setSteps(prev => prev.map(st => st.name === s && (st.state === "running" || st.state === "pending") ? { ...st, state: "error", detail: msg } : st));
              }
            }
            batchDone = true;
            // Continue with remaining batches
          }
        }

        // Small pause between batches to avoid rate limiting without making bulk
        // migrations unnecessarily slow.
        if (b < batches.length - 1) {
          await new Promise(r => setTimeout(r, 100));
        }
      }

      // Stop animation and wait for it to finish
      stepAnimCancelRef.current = true;
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);

      // Handle user cancellation
      if (cancelRef.current) {
        const completedBatches = batchProgress ? batchProgress.current - 1 : 0;
        const totalBatches = batches.length;
        addLog(`Migração cancelada pelo usuário — ${completedBatches} de ${totalBatches} lotes concluídos`);
        toast.warning(`Migração cancelada. ${completedBatches} lote(s) processados.`);
        updateStep("done", {
          state: "error",
          detail: `Migração interrompida — ${completedBatches} de ${totalBatches} lotes concluídos`,
        });
        if (!dryRun) {
          qc.invalidateQueries({ queryKey: ["sm-proposals"] });
          qc.invalidateQueries({ queryKey: ["canonical-check"] });
        }
        return;
      }

      setSmoothProgress(100);

      // All batches done
      if (allResults.length === 0) {
        throw new Error(batchErrors[0] || "Nenhum lote retornou resultado de migração.");
      }

      // Merge results from all batches
      const mergedResult: MigrationResult = {
        mode: dryRun ? "dry_run" : "execute",
        summary: { WOULD_CREATE: 0, WOULD_LINK: 0, WOULD_SKIP: 0, CONFLICT: 0, ERROR: 0, SUCCESS: 0 },
        details: [],
        total_found: 0,
        total_processed: 0,
      };

      for (const r of allResults) {
        mergedResult.total_found += r.total_found || 0;
        mergedResult.total_processed += r.total_processed || 0;
        if (r.details) mergedResult.details.push(...r.details);
        for (const [k, v] of Object.entries(r.summary || {})) {
          mergedResult.summary[k] = (mergedResult.summary[k] || 0) + (v as number);
        }
      }

      const hasBatchErrors = batchErrors.length > 0;
      setResult(mergedResult);
      addLog(`Resultado final: ${JSON.stringify(mergedResult.summary)}`);
      if (hasBatchErrors) {
        addLog(`Migração parcial: ${batchErrors.length} lote(s) falharam.`);
      }

      // Map server steps to UI steps
      const detail = mergedResult.details?.[0];
      if (detail) {
        const stepMap: Record<string, StepName> = {
          cliente: "cliente",
          deal: "deal",
          projeto: "projeto",
          proposta_nativa: "proposta",
          proposta_versao: "versao",
        };

        for (const [key, stepName] of Object.entries(stepMap)) {
          const serverStep = detail.steps[key];
          if (serverStep) {
            const isOk = SUCCESS_STEP_STATUSES.has(serverStep.status);
            updateStep(stepName, {
              state: isOk ? "done" : "error",
              detail: `${serverStep.status}${serverStep.id ? ` → ${serverStep.id.slice(0, 8)}...` : ""}${serverStep.reason ? ` (${serverStep.reason})` : ""}`,
              createdId: serverStep.id,
            });
          }
        }
      } else if (isBulk) {
        // Bulk: mark all steps based on summary
        const hasErrors = hasBatchErrors || (mergedResult.summary.ERROR || 0) > 0;
        for (const s of ["cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
          updateStep(s, { state: hasErrors ? "error" : "done" });
        }
      }

      // Ensure no steps remain stuck in "running" or "pending" after completion
      for (const s of ["fetch", "cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
        setSteps(prev => prev.map(st =>
          st.name === s && (st.state === "running" || st.state === "pending")
            ? { ...st, state: "done", detail: st.detail?.replace(/🖥️ Servidor processando.*/, "Concluído") || "Concluído" }
            : st
        ));
      }

      updateStep("done", {
        state: hasBatchErrors || (mergedResult.summary.ERROR || 0) > 0 ? "error" : "done",
        detail: hasBatchErrors
          ? `Migração parcial com falha em ${batchErrors.length} lote(s)`
          : dryRun
            ? "Simulação concluída"
            : "Migração concluída",
      });

      if (dryRun) {
        setDryRunCompleted(true);
      } else {
        qc.invalidateQueries({ queryKey: ["sm-proposals"] });
        qc.invalidateQueries({ queryKey: ["canonical-check"] });
        qc.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });
        qc.invalidateQueries({ queryKey: ["sm-sync-progress"] });
        // Refresh native project views
        qc.invalidateQueries({ queryKey: ["projetos"] });
        qc.invalidateQueries({ queryKey: ["deals"] });
        qc.invalidateQueries({ queryKey: ["clientes"] });
      }
    } catch (err: any) {
      const msg = err?.message ?? "Erro desconhecido";
      setError(msg);
      addLog(`ERRO: ${msg}`);
      updateStep("done", { state: "error", detail: msg });
    } finally {
      setRunning(false);
      setCancelling(false);
      cancelRef.current = false;
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    }
  }, [ownerId, internalIds, activePipelineId, activeStageId, addLog, resetState, updateStep, isBulk, qc, consultores, cancelRef]);

  const handleExecuteConfirm = () => {
    setConfirmOpen(false);
    setConfirmText("");
    runMigration(false);
  };

  // Progress calculation
  const progressPercent = running
    ? (batchProgress && isBulk ? Math.min(95, Math.round((batchProgress.current / batchProgress.total) * 100)) : smoothProgress)
    : (result ? 100 : 0);

  if (!proposal) return null;

  return (
    <>
        <Drawer open={open} onOpenChange={(v) => {
        if (!v && running) {
          toast.warning("Migração em andamento. Cancele a migração antes de fechar.");
          return;
        }
        onOpenChange(v);
          if (!v) {
            onRunningChange?.(false);
            if (!running) resetState();
          }
      }}>
        <DrawerContent className="max-h-[calc(100dvh-2rem)]">
          <DrawerHeader>
            <DrawerTitle className="flex items-center gap-2">
              <Sun className="h-5 w-5 text-primary" />
              {isBulk ? `Migrar ${proposals.length} propostas` : "Migrar Proposta"}
            </DrawerTitle>
            <DrawerDescription>
              {isBulk
                ? `Migração em lote de ${proposals.length} propostas SolarMarket para o sistema canônico.`
                : `SM #${proposal.sm_proposal_id} — ${realClientName || proposal.titulo || "Sem título"}`}
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 pb-4 space-y-4 flex-1 min-h-0 overflow-y-auto max-h-[60vh]">
            {/* Migration Block Banner */}
            <MigrationBlockBanner />

            {/* Pending migration stats */}
            {pendingStats && (
              <SmBentoKpis items={[
                {
                  icon: CheckCircle,
                  label: "Migradas",
                  value: pendingStats.migrated,
                  color: pendingStats.migrated > 0 ? "success" : "muted",
                },
                {
                  icon: Clock,
                  label: "Pendentes",
                  value: pendingStats.pending,
                  color: pendingStats.pending > 0 ? "warning" : "success",
                },
                {
                  icon: XCircle,
                  label: "Erros última rodada",
                  value: pendingStats.errors,
                  color: pendingStats.errors > 0 ? "destructive" : "muted",
                },
                {
                  icon: FileText,
                  label: "Progresso total",
                  value: `${pendingStats.total > 0 ? Math.round((pendingStats.migrated / pendingStats.total) * 100) : 0}%`,
                  color: "primary",
                  progress: pendingStats.total > 0 ? Math.round((pendingStats.migrated / pendingStats.total) * 100) : 0,
                },
              ]} />
            )}

            {/* Proposal Summary */}
            {!isBulk && (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground text-xs">Cliente</span>
                    <p className="font-medium truncate">{realClientName || proposal.titulo || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Status SM</span>
                    <p><Badge variant="outline" className="text-[10px]">{proposal.status || "—"}</Badge></p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Potência</span>
                    <p className="font-medium">{proposal.potencia_kwp ? `${proposal.potencia_kwp} kWp` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Valor</span>
                    <p className="font-medium">{proposal.valor_total ? `R$ ${Number(proposal.valor_total).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}` : "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">PDF</span>
                    <p className="truncate">{proposal.link_pdf ? <a href={proposal.link_pdf} target="_blank" rel="noopener" className="text-primary underline text-xs">Ver PDF</a> : "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground text-xs">Etapa mapeada</span>
                    <p><Badge className="text-[10px] bg-primary/10 text-primary border-0">{statusLabel.label}</Badge></p>
                  </div>
                </div>

                {/* All SM funnels for this project */}
                {projectFunnels.length > 0 && (
                  <div className="space-y-1">
                    <span className="text-muted-foreground text-xs">Funis SM do projeto ({projectFunnels.length})</span>
                    <div className="flex flex-wrap gap-1">
                      {projectFunnels.map((f, i) => (
                        <Badge key={i} variant="outline" className="text-[10px]">
                          {f.funnelName}: <span className="font-semibold ml-0.5">{f.stageName || "—"}</span>
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </>
            )}

            {/* Already migrated warning */}
            {existingCanonical && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-warning/10 border border-warning/20 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <div>
                  <p className="font-medium text-warning">Já migrada</p>
                  <p className="text-xs text-muted-foreground">
                    Proposta canônica: {existingCanonical.id?.slice(0, 8)}... — Status: {existingCanonical.status} — {formatDate(existingCanonical.created_at)}
                  </p>
                </div>
              </div>
            )}

            {/* Owner selector — optional fallback, auto-resolved from SM Vendedores */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Consultor responsável
              </label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Automático (vendedor do SolarMarket)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">🔄 Automático (detectar pelo vendedor SM)</SelectItem>
                  {consultores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                O consultor é definido pelo vendedor do SolarMarket. Se o vendedor existir como consultor cadastrado, será usado.
                Se não existir ou estiver ausente, será atribuído a "Escritório".
              </p>
            </div>

            {/* Pipeline selector (dynamic) */}
            {pipelines.length === 0 && (
              <div className="flex items-center gap-2 p-3 rounded-md bg-warning/10 border border-warning/20 text-sm">
                <AlertTriangle className="h-4 w-4 text-warning shrink-0" />
                <p className="text-warning font-medium">Nenhum pipeline encontrado. Crie um pipeline comercial antes de migrar.</p>
              </div>
            )}
            {pipelines.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">Pipeline de destino</label>
                <Select value={activePipelineId} onValueChange={setSelectedPipelineId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Selecione o pipeline" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelines.map(p => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Stage selector (dynamic from selected pipeline) */}
            {activePipelineId && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  Etapa inicial {needsStage && <span className="text-destructive">*</span>}
                </label>
                <Select value={activeStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Definida automaticamente pelo status" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelineStages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {pipelineStages.length === 0
                    ? "Nenhuma etapa disponível neste pipeline."
                    : `A etapa é definida pelo status da proposta no SolarMarket. Propostas aprovadas vão para "Ganho", enviadas para "Proposta Enviada", etc.`}
                </p>
                {needsStage && !activeStageId && pipelineStages.length > 0 && (
                  <p className="text-[10px] text-destructive">
                    Selecione uma etapa para continuar
                  </p>
                )}
              </div>
            )}

            {/* Progress */}
            {(running || result) && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">
                    {cancelling ? "Cancelando..." : running ? "Processando..." : result ? "Resultado" : ""}
                  </span>
                  <div className="flex items-center gap-2">
                    {running && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs border-destructive text-destructive"
                        disabled={cancelling}
                        onClick={() => setCancelConfirmOpen(true)}
                      >
                        {cancelling ? (
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                        ) : (
                          <StopCircle className="h-3 w-3 mr-1" />
                        )}
                        {cancelling ? "Cancelando..." : "Cancelar"}
                      </Button>
                    )}
                    <span className="text-xs text-muted-foreground font-mono">{progressPercent}%</span>
                  </div>
                </div>
                <Progress value={progressPercent} className="h-2" />

                {/* Batch counter */}
                {running && batchProgress && isBulk && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Lote <span className="font-semibold text-foreground">{batchProgress.current}</span> de{" "}
                      <span className="font-semibold text-foreground">{batchProgress.total}</span>
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{Math.min(batchProgress.current * 10, internalIds.length)}</span>/{internalIds.length} propostas
                    </span>
                  </div>
                )}

                {/* Vertical Stepper */}
                <SmVerticalStepper steps={steps} />

                {/* Completion Banner */}
                <SmCompletionBanner
                  migrated={result?.summary?.CREATED || result?.summary?.OK || result?.total_processed || 0}
                  errors={result?.summary?.ERROR || 0}
                  total={result?.total_found || 0}
                  visible={!running && !!result && progressPercent === 100}
                />
              </div>
            )}

            {/* Result summary (bulk) */}
            {result && isBulk && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Resumo ({result.total_processed} processadas)</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(result.summary).filter(([, v]) => v > 0).map(([key, count]) => (
                    <Badge key={key} variant="outline" className={cn(
                      "text-[10px]",
                      key === "ERROR" && "border-destructive/50 text-destructive",
                      (key === "CREATED" || key === "OK") && "border-success/50 text-success",
                    )}>
                      {formatSummaryKey(key)}: {count}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Result details */}
            {result?.details && result.details.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Detalhes por proposta</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.details.map((d, i) => (
                    <div key={i} className="text-[11px] p-2 rounded bg-muted/30 space-y-1">
                      <div className="flex items-center gap-1.5">
                        {d.aborted ? <XCircle className="h-3 w-3 text-destructive" /> : <CheckCircle className="h-3 w-3 text-success" />}
                        <span className="font-medium">{d.sm_client_name || `Proposta #${d.sm_proposal_id}`}</span>
                      </div>
                      {/* Humanized step results */}
                      <div className="ml-5 space-y-0.5">
                        {Object.entries(d.steps).map(([stepKey, stepVal]) => {
                          const { label, description, colorClass } = humanizeStepResult(stepKey, stepVal);
                          return (
                            <div key={stepKey} className="flex items-start gap-1.5">
                              <span className={cn("text-[10px] font-medium shrink-0", colorClass)}>{label}</span>
                              {description && <span className="text-[10px] text-muted-foreground">{description}</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Error display */}
            {error && (
              <div className="p-3 rounded-md bg-destructive/10 border border-destructive/20 text-sm text-destructive">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <p>{error}</p>
                </div>
              </div>
            )}

            {/* Terminal Logs */}
            <SmTerminalLog logs={logs} />
          </div>

          <DrawerFooter className="flex-col gap-2 pt-2">
            {/* Migração em background foi descontinuada — agora apenas batches manuais */}
            {pendingStats && pendingStats.pending > 0 && (
              <div className="w-full rounded-md border border-warning/30 bg-warning/5 p-3 text-xs text-foreground space-y-1">
                <p className="font-semibold text-warning">
                  Migração automática em background descontinuada
                </p>
                <p className="text-muted-foreground">
                  O modo "Migrar todos" em segundo plano não está mais disponível. Use{" "}
                  <span className="font-medium text-foreground">"Migrar selecionadas"</span>{" "}
                  para processar lotes manualmente, ou execute o fluxo novo{" "}
                  <span className="font-mono">create-projetos-from-sm</span> +{" "}
                  <span className="font-mono">migrate-sm-proposals-v3</span>.
                </p>
              </div>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => runMigration(true)}
                disabled={running}
              >
                {running ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
                Simular (Dry-run)
              </Button>
              <Button
                className="flex-1"
                variant="outline"
                onClick={() => setConfirmOpen(true)}
                disabled={running || (!dryRunCompleted && !!existingCanonical) || !canMigrate}
                title={!canMigrate ? "Selecione uma etapa do pipeline antes de migrar" : existingCanonical && !dryRunCompleted ? "Execute uma simulação (dry-run) antes de migrar novamente" : undefined}
              >
                Migrar selecionadas
              </Button>
            </div>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>

      {/* Hard confirmation dialog */}
      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-warning" />
              Confirmar Migração
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Isto vai criar registros no sistema canônico (clientes, deals, projetos, propostas).
              {isBulk ? ` ${proposals.length} propostas serão processadas.` : ""}
            </p>
            <p className="text-sm">
              Digite <span className="font-bold text-destructive">MIGRAR</span> para confirmar:
            </p>
            <Input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="MIGRAR"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setConfirmOpen(false); setConfirmText(""); }}>
              Cancelar
            </Button>
            <Button
              variant="default"
              disabled={confirmText !== "MIGRAR"}
              onClick={handleExecuteConfirm}
            >
              Confirmar Migração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel confirmation */}
      <AlertDialog open={cancelConfirmOpen} onOpenChange={setCancelConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <StopCircle className="h-5 w-5 text-destructive" />
              Cancelar migração?
            </AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza? Os lotes já processados serão mantidos. A migração será interrompida após o lote atual terminar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                setCancelConfirmOpen(false);
                cancelRef.current = true;
                setCancelling(true);
                addLog("Cancelamento solicitado...");
                addLog("Aguardando lote atual terminar...");
              }}
            >
              Cancelar migração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </>
  );
}
