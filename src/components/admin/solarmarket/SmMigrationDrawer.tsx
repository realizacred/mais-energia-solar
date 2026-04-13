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
import { Sun, CheckCircle, XCircle, Loader2, Clock, ArrowRight, AlertTriangle, FileText, User, Briefcase, FolderKanban, Copy, StopCircle, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import type { SmProposal } from "@/hooks/useSolarMarket";
import { cn } from "@/lib/utils";
import { formatDateTime, formatDate, formatTime, formatDateShort } from "@/lib/dateUtils";
import { useActiveSmOperation } from "@/hooks/useSmOperationRuns";

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
  return useQuery<{ id: string; name: string; kind: string }[]>({
    queryKey: ["pipelines-for-migration"],
    enabled: isReady,
    queryFn: async () => {
      const { data } = await supabase
        .from("pipelines")
        .select("id, name, kind")
        .eq("is_active", true)
        .order("created_at", { ascending: true });
      return (data || []) as { id: string; name: string; kind: string }[];
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

  // Cleanup: cancel auto-resume on unmount to prevent background loops
  // Also notify parent that running stopped (prevents stuck "Migrando..." in parent)
  useEffect(() => {
    return () => {
      cancelRef.current = true;
      if (backgroundMonitorIntervalRef.current) clearInterval(backgroundMonitorIntervalRef.current);
      // Ensure parent knows migration is no longer running from this drawer instance
      onRunningChange?.(false);
    };
  }, [onRunningChange]);

  // Track when tab was last hidden for stall detection
  const lastHiddenAtRef = useRef<number | null>(null);
  const progressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Auto-resume state
  const [autoResumeRunning, setAutoResumeRunning] = useState(false);
  const [autoResumeStats, setAutoResumeStats] = useState<{
    migrated: number;
    errors: number;
    startTime: number;
    round: number;
    initialPending: number;
  } | null>(null);
  const [autoResumeConfirmOpen, setAutoResumeConfirmOpen] = useState(false);
  const [autoResumeConfirmText, setAutoResumeConfirmText] = useState("");
  const autoResumeErrorIdsRef = useRef<Set<number>>(new Set());
  const backgroundMonitorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoResumeLastProgressAtRef = useRef<number>(0);
  const autoResumeLastMigratedRef = useRef<number>(0);

  // Notify parent of running state changes
  useEffect(() => {
    onRunningChange?.(running);
  }, [running, onRunningChange]);

  const { session } = useAuth();
  const isAuthReady = !!session;

  const { data: consultores = [] } = useConsultores(isAuthReady);
  const { data: pipelines = [] } = usePipelines(isAuthReady);
  const { data: pipelineStages = [] } = usePipelineStages(selectedPipelineId || null, isAuthReady);
  const { data: pendingStats, refetch: refetchPending } = usePendingMigrationCount();
  const { data: activeSmRun } = useActiveSmOperation();
  const qc = useQueryClient();
  const isServerMigrationRunning = activeSmRun?.operation_type === "migrate_to_native" && (activeSmRun as any)?._stale !== true;

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

  useEffect(() => {
    if (!autoResumeRunning) {
      if (backgroundMonitorIntervalRef.current) {
        clearInterval(backgroundMonitorIntervalRef.current);
        backgroundMonitorIntervalRef.current = null;
      }
      return;
    }

    if (backgroundMonitorIntervalRef.current) clearInterval(backgroundMonitorIntervalRef.current);
    backgroundMonitorIntervalRef.current = setInterval(() => {
      refetchPending();
      qc.invalidateQueries({ queryKey: ["sm-proposals"] });
      qc.invalidateQueries({ queryKey: ["canonical-check"] });
    }, 4000);

    return () => {
      if (backgroundMonitorIntervalRef.current) {
        clearInterval(backgroundMonitorIntervalRef.current);
        backgroundMonitorIntervalRef.current = null;
      }
    };
  }, [autoResumeRunning, qc, refetchPending]);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev, `[${formatTime(new Date())}] ${msg}`]);
  }, []);

  const updateStep = useCallback((name: StepName, update: Partial<MigrationStep>) => {
    setSteps(prev => prev.map(s => s.name === name ? { ...s, ...update } : s));
  }, []);

  useEffect(() => {
    if (!open || autoResumeRunning || !pendingStats || !isServerMigrationRunning) return;

    const initialPending = pendingStats.pending + pendingStats.migrated;
    setAutoResumeRunning(true);
    setRunning(true);
    setCancelling(false);
    setAutoResumeStats({
      migrated: pendingStats.migrated,
      errors: pendingStats.errors,
      startTime: Date.now(),
      round: 1,
      initialPending,
    });
    autoResumeLastProgressAtRef.current = Date.now();
    autoResumeLastMigratedRef.current = pendingStats.migrated;
    updateStep("fetch", {
      state: "done",
      detail: `${pendingStats.pending} proposta(s) aguardando no servidor`,
    });
    for (const stepName of ["cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
      updateStep(stepName, {
        state: "running",
        detail: `🖥️ Servidor processando • ${pendingStats.migrated}/${Math.max(initialPending, 1)} migradas`,
      });
    }
  }, [open, autoResumeRunning, pendingStats, isServerMigrationRunning, updateStep]);

  useEffect(() => {
    if (!autoResumeRunning || !autoResumeStats || !pendingStats) return;

    const now = Date.now();
    const migrated = pendingStats.migrated;
    const errors = pendingStats.errors;
    const pending = pendingStats.pending;

    if (migrated > autoResumeLastMigratedRef.current) {
      autoResumeLastMigratedRef.current = migrated;
      autoResumeLastProgressAtRef.current = now;
    }

    setAutoResumeStats((prev) => {
      if (!prev) return prev;
      if (prev.migrated === migrated && prev.errors === errors) return prev;
      return { ...prev, migrated, errors };
    });

    const elapsed = (now - autoResumeStats.startTime) / 1000;
    const rate = migrated / Math.max(elapsed, 1);
    const eta = rate > 0 ? Math.round(pending / rate) : 0;

    for (const stepName of ["cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
      updateStep(stepName, {
        state: "running",
        detail: `🖥️ Servidor processando • ${migrated}/${autoResumeStats.initialPending} migradas • ETA: ${eta}s`,
      });
    }

    setSmoothProgress(
      autoResumeStats.initialPending > 0
        ? Math.min(95, Math.round((migrated / autoResumeStats.initialPending) * 100))
        : 0,
    );

    if (cancelRef.current) {
      if (backgroundMonitorIntervalRef.current) clearInterval(backgroundMonitorIntervalRef.current);
      setAutoResumeRunning(false);
      setRunning(false);
      setCancelling(false);
      cancelRef.current = false;
      addLog("Migração pausada — o progresso salvo será retomado na próxima execução manual.");
      updateStep("done", {
        state: "error",
        detail: "Migração pausada. Execute novamente para continuar de onde parou.",
      });
      toast.warning("Migração pausada. Execute novamente para continuar de onde parou.");
      return;
    }

    if (pending === 0) {
      if (backgroundMonitorIntervalRef.current) clearInterval(backgroundMonitorIntervalRef.current);
      setAutoResumeRunning(false);
      setRunning(false);
      setCancelling(false);
      cancelRef.current = false;
      setSmoothProgress(100);
      for (const stepName of ["cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
        updateStep(stepName, {
          state: "done",
          detail: `${migrated} proposta(s) migradas em segundo plano`,
        });
      }
      updateStep("done", {
        state: "done",
        detail: `${migrated} migrados, ${errors} erros`,
      });
      qc.invalidateQueries({ queryKey: ["sm-proposals"] });
      qc.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });
      qc.invalidateQueries({ queryKey: ["canonical-check"] });
      qc.invalidateQueries({ queryKey: ["sm-sync-progress"] });
      qc.invalidateQueries({ queryKey: ["projetos"] });
      qc.invalidateQueries({ queryKey: ["deals"] });
      qc.invalidateQueries({ queryKey: ["clientes"] });
      toast.success(`Migração completa! ${migrated} propostas migradas.`);
      return;
    }

    if (autoResumeLastProgressAtRef.current && now - autoResumeLastProgressAtRef.current > 180_000 && !isServerMigrationRunning) {
      if (backgroundMonitorIntervalRef.current) clearInterval(backgroundMonitorIntervalRef.current);
      setAutoResumeRunning(false);
      setRunning(false);
      setCancelling(false);
      cancelRef.current = false;
      const msg = "Sem avanço recente no monitor. A fila continua agendada no servidor e pode ser retomada automaticamente.";
      updateStep("done", { state: "done", detail: msg });
      qc.invalidateQueries({ queryKey: ["sm-proposals"] });
      qc.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });
      toast.info(msg);
    }
  }, [autoResumeRunning, autoResumeStats, pendingStats, addLog, qc, updateStep, isServerMigrationRunning]);

  const proposal = proposals[0]; // Single or first for display
  const isBulk = proposals.length > 1;
  const internalIds = proposals.map(p => p.id); // Use UUID primary keys for unique identification

  const { data: existingCanonical } = useCanonicalCheck(proposal?.sm_proposal_id ?? null);
  const { data: projectFunnels = [] } = useSmProjectFunnels(proposal?.sm_project_id ?? null);
  const { data: realClientName } = useSmRealClientName(proposal?.sm_project_id ?? null);

  const statusLabel = proposal ? (SM_STATUS_LABEL_MAP[proposal.status?.toLowerCase() ?? ""] ?? { proposal_status: "rascunho", label: "Qualificação" }) : { proposal_status: "rascunho", label: "Qualificação" };

  // Auto-select first pipeline when loaded
  const activePipelineId = selectedPipelineId || pipelines[0]?.id || "";
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
    autoResumeErrorIdsRef.current = new Set();
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
              response = await fetch(`${projectUrl}/functions/v1/migrate-sm-proposals`, {
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
                  const isOk = ["WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP", "SUCCESS"].includes(serverStep.status);
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
            const isOk = ["WOULD_CREATE", "WOULD_LINK", "WOULD_SKIP", "SUCCESS"].includes(serverStep.status);
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

  // ─── Auto-resume: migrate all pending proposals in loop ──
  const runAutoResume = useCallback(async () => {
    if (!activePipelineId) {
      setError("Nenhum pipeline encontrado.");
      return;
    }

    // Save migration settings for server-side auto-resume (pg_cron)
    resetState();
    setBatchProgress(null);
    setAutoResumeRunning(true);
    setRunning(true);
    setCancelling(false);
    cancelRef.current = false;

    const MAX_ROUNDS = 200;
    const MAX_STAGNANT_ROUNDS = 5;
    const initialPending = pendingStats?.pending ?? proposals.length;
    const initialMigrated = pendingStats?.migrated ?? 0;
    const initialErrors = pendingStats?.errors ?? 0;

    let currentStats = {
      migrated: initialMigrated,
      errors: initialErrors,
      startTime: Date.now(),
      round: 1,
      initialPending,
    };

    setAutoResumeStats(currentStats);
    autoResumeLastProgressAtRef.current = Date.now();
    autoResumeLastMigratedRef.current = initialMigrated;

    updateStep("fetch", {
      state: "done",
      detail: `${initialPending} proposta(s) pendente(s) identificada(s)`,
    });
    for (const stepName of ["cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
      updateStep(stepName, {
        state: "running",
        detail: "Preparando processamento em lotes...",
      });
    }
    addLog(`Iniciando migração em lote para ${initialPending} pendentes...`);

    try {
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

      const projectUrl = import.meta.env.VITE_SUPABASE_URL;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30_000);

      try {
        const response = await fetch(`${projectUrl}/functions/v1/migrate-sm-proposals`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "start_background_migration",
            dry_run: false,
            pipeline_id: activePipelineId,
            stage_id: activeStageId || null,
            auto_resolve_owner: true,
            batch_size: 25,
            include_projects_without_proposal: false,
            ...(ownerId && ownerId !== "__auto__" ? { owner_id: ownerId } : {}),
          }),
          signal: controller.signal,
        });

        const data = await response.json().catch(() => ({} as Record<string, any>));
        if (!response.ok) {
          throw new Error(getBlockedMessage(data as MigrationBlockedPayload, `HTTP ${response.status}`));
        }

        if (data.completed) {
          setAutoResumeRunning(false);
          setRunning(false);
          setSmoothProgress(100);
          updateStep("done", { state: "done", detail: data.message || "Nenhuma proposta pendente para migrar." });
          toast.success(data.message || "Nenhuma proposta pendente para migrar.");
          return;
        }

        addLog(data.message || "Migração enviada ao servidor.");
        for (const stepName of ["cliente", "deal", "projeto", "proposta", "versao"] as StepName[]) {
          updateStep(stepName, {
            state: "running",
            detail: `🖥️ Servidor processando • ${initialMigrated}/${Math.max(initialPending, 1)} migradas`,
          });
        }
        qc.invalidateQueries({ queryKey: ["sm-proposals"] });
        qc.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });
        qc.invalidateQueries({ queryKey: ["sm-sync-progress"] });
        toast.success(data.message || "Migração iniciada no servidor.");
      } finally {
        clearTimeout(timeoutId);
      }
    } catch (err: any) {
      const msg = err?.name === "AbortError"
        ? "Timeout ao solicitar a migração em background."
        : err?.message ?? "Erro desconhecido";
      setAutoResumeRunning(false);
      setRunning(false);
      setCancelling(false);
      cancelRef.current = false;
      setError(msg);
      addLog(`ERRO FATAL: ${msg}`);
      for (const stepName of ["cliente", "deal", "projeto", "proposta", "versao", "done"] as StepName[]) {
        updateStep(stepName, { state: "error", detail: msg });
      }
    }
  }, [activePipelineId, activeStageId, ownerId, addLog, pendingStats?.pending, pendingStats?.migrated, pendingStats?.errors, proposals.length, resetState, updateStep, qc]);

  const handleAutoResumeConfirm = () => {
    setAutoResumeConfirmOpen(false);
    setAutoResumeConfirmText("");
    runAutoResume();
  };

  // Progress calculation
  const completedSteps = steps.filter(s => s.state === "done" || s.state === "error" || s.state === "skipped").length;
  const autoResumeTotal = autoResumeStats?.initialPending ?? 0;
  const autoResumeTotalRounds = Math.max(Math.ceil(Math.max(autoResumeTotal, 1) / 10), 1);
  const autoResumeCurrentRound = Math.min(Math.max(autoResumeStats?.round ?? 1, 1), autoResumeTotalRounds);
  const progressPercent = running
    ? autoResumeRunning && autoResumeStats
      ? autoResumeTotal > 0
        ? Math.min(95, Math.round((autoResumeStats.migrated / autoResumeTotal) * 100))
        : smoothProgress
      : (batchProgress && isBulk ? Math.min(95, Math.round((batchProgress.current / batchProgress.total) * 100)) : smoothProgress)
    : (result ? 100 : 0);

  if (!proposal) return null;

  return (
    <>
        <Drawer open={open} onOpenChange={(v) => {
        if (!v && running && autoResumeRunning) {
          toast.info("Migração em andamento no servidor. Você pode fechar esta tela com segurança.");
          onOpenChange(v);
          return;
        }
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

          <div className="px-4 pb-4 space-y-4 overflow-y-auto max-h-[60vh]">
            {/* Migration Block Banner */}
            <MigrationBlockBanner />

            {/* Pending migration stats */}
            {pendingStats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{pendingStats.migrated}</p>
                  <p className="text-[10px] text-muted-foreground">Migradas</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold text-foreground">{pendingStats.pending}</p>
                  <p className="text-[10px] text-muted-foreground">Pendentes</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold text-destructive">{pendingStats.errors}</p>
                  <p className="text-[10px] text-muted-foreground">Erros última rodada</p>
                </div>
                <div className="rounded-lg border border-border bg-muted/30 p-3 text-center">
                  <p className="text-lg font-bold text-foreground">
                    {pendingStats.total > 0 ? Math.round((pendingStats.migrated / pendingStats.total) * 100) : 0}%
                  </p>
                  <p className="text-[10px] text-muted-foreground">Progresso total</p>
                </div>
              </div>
            )}

            {/* Auto-resume progress */}
            {autoResumeRunning && autoResumeStats && (
              <div className="rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    Migração em lote em andamento
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-xs border-destructive text-destructive"
                    disabled={cancelling}
                    onClick={() => setCancelConfirmOpen(true)}
                  >
                    {cancelling ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <StopCircle className="h-3 w-3 mr-1" />}
                    {cancelling ? "Cancelando..." : "Parar"}
                  </Button>
                </div>
                <div className="rounded-md border border-warning/20 bg-warning/5 px-3 py-2 flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
                  <div className="text-xs text-muted-foreground">
                    <p className="font-medium text-foreground">Migração no servidor</p>
                    <p>Você pode fechar esta tela. O processamento continua em background e o painel atualizará quando houver progresso.</p>
                  </div>
                </div>
                <Progress value={smoothProgress} className="h-2" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>Rodada {autoResumeCurrentRound}/{autoResumeTotalRounds} • {autoResumeStats.migrated} migrados, {autoResumeStats.errors} erros</span>
                  <span>{(() => {
                    const elapsed = (Date.now() - autoResumeStats.startTime) / 1000;
                    const rate = autoResumeStats.migrated / Math.max(elapsed, 1);
                    const remaining = Math.max(0, autoResumeStats.initialPending - autoResumeStats.migrated);
                    const eta = rate > 0 ? Math.round(remaining / rate) : 0;
                    return eta > 60 ? `~${Math.round(eta / 60)}min restantes` : `~${eta}s restantes`;
                  })()}</span>
                </div>
              </div>
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

            {/* Owner selector — optional fallback, auto-resolved from project responsible */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">
                Responsável (fallback opcional)
              </label>
              <Select value={ownerId} onValueChange={setOwnerId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Automático (campo responsible do projeto)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__auto__">🔄 Automático (responsible do projeto SM)</SelectItem>
                  {consultores.map(c => (
                    <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground">
                O consultor é resolvido automaticamente: 1º busca na API SM o funil "Vendedores" (nome da etapa = nome do consultor),
                2º usa o campo "responsible" do projeto SM. Consultores inexistentes serão criados sem acesso ao sistema.
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
                  Etapa padrão {needsStage && <span className="text-destructive">*</span>}
                </label>
                <Select value={activeStageId} onValueChange={setSelectedStageId}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="Primeira etapa (padrão)" />
                  </SelectTrigger>
                  <SelectContent>
                    {pipelineStages.map(s => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground">
                  {pipelineStages.length === 0
                    ? "Nenhuma etapa aberta encontrada; a EF usará fallback."
                    : `Status SM "${statusLabel.label}" → Etapa: ${pipelineStages.find(s => s.id === activeStageId)?.name || "primeira disponível"}`}
                </p>
                {needsStage && !activeStageId && pipelineStages.length > 0 && (
                  <p className="text-[10px] text-destructive">
                    Obrigatório para pipelines do tipo processo
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
                {running && autoResumeRunning && autoResumeStats && (
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>
                      Rodada <span className="font-semibold text-foreground">{autoResumeCurrentRound}</span> de{" "}
                      <span className="font-semibold text-foreground">{autoResumeTotalRounds}</span>
                    </span>
                    <span>
                      <span className="font-semibold text-foreground">{autoResumeStats.migrated}</span>/{autoResumeStats.initialPending} propostas
                    </span>
                  </div>
                )}
                {running && !autoResumeRunning && batchProgress && isBulk && (
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

                {/* Step list */}
                <div className="space-y-1">
                  {steps.map(step => (
                    <div key={step.name} className={cn(
                      "flex items-center gap-2 p-2 rounded text-sm transition-colors",
                      step.state === "running" && "bg-primary/5 border border-primary/20",
                      step.state === "done" && "bg-success/5",
                      step.state === "error" && "bg-destructive/5",
                    )}>
                      {step.state === "running" && <Loader2 className="h-4 w-4 text-primary animate-spin shrink-0" />}
                      {step.state === "done" && <CheckCircle className="h-4 w-4 text-success shrink-0" />}
                      {step.state === "error" && <XCircle className="h-4 w-4 text-destructive shrink-0" />}
                      {step.state === "pending" && <Clock className="h-4 w-4 text-muted-foreground/40 shrink-0" />}
                      {step.state === "skipped" && <Clock className="h-4 w-4 text-muted-foreground/30 shrink-0" />}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium">{step.label}</p>
                        {step.detail && <p className="text-[10px] text-muted-foreground truncate">{step.detail}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Result summary (bulk) */}
            {result && isBulk && (
              <div className="space-y-2">
                <p className="text-xs font-medium">Resumo ({result.total_processed} processadas)</p>
                <div className="flex flex-wrap gap-1.5">
                  {Object.entries(result.summary).filter(([, v]) => v > 0).map(([key, count]) => (
                    <Badge key={key} variant="outline" className="text-[10px]">{key}: {count}</Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Result details */}
            {result?.details && result.details.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium">Detalhes</p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.details.map((d, i) => (
                    <div key={i} className="text-[11px] p-2 rounded bg-muted/30 space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        {d.aborted ? <XCircle className="h-3 w-3 text-destructive" /> : <CheckCircle className="h-3 w-3 text-success" />}
                        <span className="font-medium">SM #{d.sm_proposal_id}</span>
                        <span className="text-muted-foreground">{d.sm_client_name}</span>
                      </div>
                      <div className="flex flex-wrap gap-1 ml-4">
                        {Object.entries(d.steps).map(([k, v]) => (
                          <Badge key={k} variant="outline" className={cn(
                            "text-[9px]",
                            v.status.includes("ERROR") && "border-destructive/50 text-destructive",
                            v.status.includes("CREATE") && "border-success/50 text-success",
                            v.status.includes("LINK") && "border-info/50 text-info",
                            v.status.includes("SKIP") && "border-muted-foreground/50 text-muted-foreground",
                          )}>
                            {k}: {v.status}{v.id ? ` → ${v.id.slice(0, 8)}` : ""}
                          </Badge>
                        ))}
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

            {/* Client-side logs */}
            {logs.length > 0 && (
              <details className="text-xs">
                <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                  Logs ({logs.length})
                </summary>
                <pre className="mt-1 p-2 rounded bg-muted/30 max-h-32 overflow-auto whitespace-pre-wrap text-[10px]">
                  {logs.join("\n")}
                </pre>
              </details>
            )}
          </div>

          <DrawerFooter className="flex-col gap-2 pt-2">
            {/* Auto-resume button — top priority */}
            {pendingStats && pendingStats.pending > 0 && (
              <Button
                className="w-full"
                variant="default"
                onClick={() => setAutoResumeConfirmOpen(true)}
                disabled={running || !canMigrate}
              >
                <PlayCircle className="h-4 w-4 mr-1.5" />
                Migrar todos os {pendingStats.pending} pendentes
              </Button>
            )}
            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => runMigration(true)}
                disabled={running}
              >
                {running && !autoResumeRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : null}
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
              onClick={async () => {
                setCancelConfirmOpen(false);
                if (autoResumeRunning) {
                  setCancelling(true);
                  try {
                    const { data: { session: currentSession } } = await supabase.auth.getSession();
                    if (!currentSession?.access_token) throw new Error("Sessão expirada. Faça login novamente.");

                    const projectUrl = import.meta.env.VITE_SUPABASE_URL;
                    const response = await fetch(`${projectUrl}/functions/v1/migrate-sm-proposals`, {
                      method: "POST",
                      headers: {
                        Authorization: `Bearer ${currentSession.access_token}`,
                        apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                        "Content-Type": "application/json",
                      },
                      body: JSON.stringify({ action: "pause_background_migration", dry_run: false }),
                    });

                    const data = await response.json().catch(() => ({} as Record<string, any>));
                    if (!response.ok) throw new Error(getBlockedMessage(data as MigrationBlockedPayload, `HTTP ${response.status}`));

                    setAutoResumeRunning(false);
                    setRunning(false);
                    addLog(data.message || "Migração em background pausada.");
                    updateStep("done", {
                      state: "error",
                      detail: "Migração pausada. O lote atual pode terminar normalmente.",
                    });
                    qc.invalidateQueries({ queryKey: ["sm-migration-pending-count"] });
                    toast.warning(data.message || "Migração pausada.");
                  } catch (err: any) {
                    const msg = err?.message ?? "Erro ao pausar migração.";
                    setError(msg);
                    addLog(`ERRO: ${msg}`);
                    toast.error(msg);
                  } finally {
                    setCancelling(false);
                  }
                  return;
                }

                cancelRef.current = true;
                setCancelling(true);
                addLog("Cancelamento solicitado — aguardando lote atual terminar...");
              }}
            >
              Cancelar migração
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Auto-resume confirmation */}
      <Dialog open={autoResumeConfirmOpen} onOpenChange={setAutoResumeConfirmOpen}>
        <DialogContent className="w-[90vw] max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlayCircle className="h-5 w-5 text-primary" />
              Migrar todos os pendentes
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Isto vai migrar automaticamente todas as <span className="font-bold text-foreground">{pendingStats?.pending || 0}</span> propostas
              pendentes em lotes de 25, criando clientes, deals, projetos e propostas no sistema canônico.
            </p>
            <p className="text-sm text-muted-foreground">
              A migração pode ser pausada a qualquer momento. Os registros já processados serão mantidos.
            </p>
            <p className="text-sm">
              Digite <span className="font-bold text-destructive">MIGRAR TODOS</span> para confirmar:
            </p>
            <Input
              value={autoResumeConfirmText}
              onChange={e => setAutoResumeConfirmText(e.target.value)}
              placeholder="MIGRAR TODOS"
              className="font-mono"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setAutoResumeConfirmOpen(false); setAutoResumeConfirmText(""); }}>
              Cancelar
            </Button>
            <Button
              variant="default"
              disabled={autoResumeConfirmText !== "MIGRAR TODOS"}
              onClick={handleAutoResumeConfirm}
            >
              Iniciar migração
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
