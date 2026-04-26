/**
 * useChunkedMigration — Migração SolarMarket via edge `sm-migrate-chunk`.
 *
 * Estratégia (background real):
 *   1. start    → edge cria job mestre + auto-encadeia steps em background
 *                 (UI fecha aba? tudo bem, pg_cron de safety retoma em <2min)
 *   2. continue → retoma job que ficou failed/cancelled
 *   3. cancel   → marca job como cancelled (interrompe a cadeia)
 *   4. polling  → React Query a cada 3s lê estado real do banco
 *
 * O loop de execução vive 100% no servidor — UI só observa.
 */
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenantId } from "@/hooks/useTenantId";

const LEGACY_SM_SOURCES = ["solarmarket", "solar_market"] as const;

/**
 * supabase.functions.invoke joga FunctionsHttpError quando status != 2xx,
 * deixando `data` como null e a mensagem real escondida em error.context.response.
 * Esta helper extrai o `error` real do body (ex: "Já existe uma migração em andamento")
 * para que o toast mostre a causa, em vez de "non-2xx status code".
 */
async function extractInvokeError(err: unknown, fallback: string): Promise<string> {
  // FunctionsHttpError tem context.response (Response clonável)
  const anyErr = err as { context?: { response?: Response }; message?: string };
  const resp = anyErr?.context?.response;
  if (resp && typeof resp.clone === "function") {
    try {
      const body = await resp.clone().json();
      if (body && typeof body === "object") {
        const msg = (body as { error?: string }).error;
        if (msg) return msg;
      }
    } catch {
      try {
        const text = await resp.clone().text();
        if (text) return text.slice(0, 400);
      } catch {
        // ignore
      }
    }
  }
  return anyErr?.message || fallback;
}

export interface ChunkedJob {
  id: string;
  status: string; // running | completed | completed_with_warnings | failed | cancelled
  total_items: number;
  items_processed: number;
  items_promoted: number;
  items_with_errors: number;
  items_with_warnings: number;
  items_blocked: number;
  items_skipped: number;
  started_at: string | null;
  finished_at: string | null;
  last_step_at: string | null;
  error_summary: string | null;
}

export interface ChunkedTotals {
  clientes: { promoted: number; total: number };
  projetos: { promoted: number; total: number };
  propostas: { promoted: number; total: number };
}

export interface ChunkedProgress {
  job: ChunkedJob | null;
  totals: ChunkedTotals;
  history: ChunkedJob[];
  isRunning: boolean;
  isComplete: boolean;
  isResumable: boolean; // failed ou cancelled E ainda tem backlog
  pctGeral: number;
  pctTotal: number; // % acumulada de propostas migradas vs propostas em staging
  isStuck: boolean; // running mas last_step_at > 3min
  lastActivityAt: string | null;
  lastActivityAgeMs: number | null;
  executionState:
    | "empty"
    | "ready"
    | "running_active"
    | "running_stalled"
    | "resumable"
    | "completed";
}

const KEY = ["sm-migrate-chunk", "progress-v2"] as const;

function applyOptimisticJobState(
  previous: ChunkedProgress | undefined,
  patch: Partial<ChunkedJob>,
): ChunkedProgress | undefined {
  if (!previous) return previous;

  const baseJob: ChunkedJob = previous.job ?? {
    id: patch.id ?? "optimistic",
    status: "running",
    total_items: 0,
    items_processed: 0,
    items_promoted: 0,
    items_with_errors: 0,
    items_with_warnings: 0,
    items_blocked: 0,
    items_skipped: 0,
    started_at: null,
    finished_at: null,
    last_step_at: null,
    error_summary: null,
  };

  const nextJob = { ...baseJob, ...patch };
  const lastActivityAt = nextJob.last_step_at ?? nextJob.finished_at ?? nextJob.started_at ?? null;
  const lastActivityAgeMs = lastActivityAt
    ? Math.max(0, Date.now() - new Date(lastActivityAt).getTime())
    : null;
  const hasBacklog = previous.totals.propostas.total > previous.totals.propostas.promoted;
  const isRunning = nextJob.status === "running";
  const isComplete = nextJob.status === "completed" || nextJob.status === "completed_with_warnings";
  const isResumable = (nextJob.status === "failed" || nextJob.status === "cancelled") && hasBacklog;

  return {
    ...previous,
    job: nextJob,
    history: [nextJob, ...previous.history.filter((item) => item.id !== nextJob.id)].slice(0, 5),
    isRunning,
    isComplete,
    isResumable,
    isStuck: false,
    lastActivityAt,
    lastActivityAgeMs,
    executionState: isRunning
      ? "running_active"
      : isResumable
        ? "resumable"
        : isComplete
          ? "completed"
          : hasBacklog
            ? "ready"
            : "empty",
  };
}

export function useChunkedMigration() {
  const qc = useQueryClient();
  const { data: tenantId } = useTenantId();
  const progressKey = [...KEY, tenantId] as const;

  const start = useMutation({
    onMutate: () => {
      qc.setQueryData<ChunkedProgress | undefined>(progressKey, (previous) =>
        applyOptimisticJobState(previous, {
          status: "running",
          finished_at: null,
          error_summary: null,
          last_step_at: new Date().toISOString(),
        }),
      );
    },
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("sm-migrate-chunk", {
        body: { action: "start", payload: {} },
      });
      if (error) throw new Error(error.message || "Falha ao iniciar.");
      const resp = data as {
        ok: boolean;
        master_job_id?: string;
        total_backlog?: number;
        existing_job_id?: string;
        error?: string;
      };
      if (!resp?.ok) throw new Error(resp?.error ?? "Resposta inválida do backend.");
      return resp;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: progressKey }),
  });

  const continueJob = useMutation({
    onMutate: async (jobId: string) => {
      qc.setQueryData<ChunkedProgress | undefined>(progressKey, (previous) =>
        applyOptimisticJobState(previous, {
          id: jobId,
          status: "running",
          finished_at: null,
          error_summary: null,
          last_step_at: new Date().toISOString(),
        }),
      );
    },
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("sm-migrate-chunk", {
        body: { action: "continue", payload: { master_job_id: jobId } },
      });
      if (error) throw new Error(error.message);
      const resp = data as { ok: boolean; error?: string };
      if (!resp?.ok) throw new Error(resp?.error ?? "Falha ao retomar.");
      return resp;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: progressKey }),
  });

  const cancel = useMutation({
    mutationFn: async (jobId: string) => {
      const { data, error } = await supabase.functions.invoke("sm-migrate-chunk", {
        body: { action: "cancel", payload: { master_job_id: jobId } },
      });
      if (error) throw new Error(error.message);
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: progressKey }),
  });

  const progressQuery = useQuery<ChunkedProgress>({
    queryKey: progressKey,
    enabled: !!tenantId,
    staleTime: 1000 * 2,
    refetchInterval: (query) => (query.state.data?.isRunning ? 3000 : 3000),
    queryFn: async (): Promise<ChunkedProgress> => {
      // 1. Histórico (últimos 5 jobs)
      const { data: jobs } = await supabase
        .from("solarmarket_promotion_jobs")
        .select(
          "id, status, total_items, items_processed, items_promoted, items_with_errors, items_with_warnings, items_blocked, items_skipped, started_at, finished_at, last_step_at, error_summary",
        )
        .eq("tenant_id", tenantId!)
        .eq("job_type", "migrate-chunked")
        .order("created_at", { ascending: false })
        .limit(5);

      const history: ChunkedJob[] = (jobs ?? []).map((j) => ({
        id: j.id,
        status: j.status,
        total_items: j.total_items ?? 0,
        items_processed: j.items_processed ?? 0,
        items_promoted: j.items_promoted ?? 0,
        items_with_errors: j.items_with_errors ?? 0,
        items_with_warnings: j.items_with_warnings ?? 0,
        items_blocked: j.items_blocked ?? 0,
        items_skipped: j.items_skipped ?? 0,
        started_at: j.started_at,
        finished_at: j.finished_at,
        last_step_at: (j as any).last_step_at ?? null,
        error_summary: (j as any).error_summary ?? null,
      }));
      const job = history.find((item) => item.status === "running") ?? history[0] ?? null;

      // 2. Totais por entidade — staging vs canônico.
      //    Importante: projetos e propostas usam `external_source`, não `import_source`.
      const [cliRaw, projRaw, propRaw, cliProm, projProm, propProm] = await Promise.all([
        supabase.from("sm_clientes_raw").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!),
        supabase.from("sm_projetos_raw").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!),
        supabase.from("sm_propostas_raw").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId!),
        supabase
          .from("clientes")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .in("external_source", [...LEGACY_SM_SOURCES]),
        supabase
          .from("projetos")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .in("external_source", [...LEGACY_SM_SOURCES])
          .not("deal_id", "is", null),
        supabase
          .from("propostas_nativas")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", tenantId!)
          .in("external_source", [...LEGACY_SM_SOURCES])
          .not("deal_id", "is", null),
      ]);

      const totals: ChunkedTotals = {
        clientes: { promoted: cliProm.count ?? 0, total: cliRaw.count ?? 0 },
        projetos: { promoted: projProm.count ?? 0, total: projRaw.count ?? 0 },
        propostas: { promoted: propProm.count ?? 0, total: propRaw.count ?? 0 },
      };

      const isRunning = !!job && job.status === "running";
      const isComplete =
        !!job && (job.status === "completed" || job.status === "completed_with_warnings");

      // Resumable: último job parou no meio E ainda tem propostas em staging não migradas
      const propostasFaltam = totals.propostas.total - totals.propostas.promoted;
      const isResumable =
        !!job &&
        (job.status === "failed" || job.status === "cancelled") &&
        propostasFaltam > 0;

      // Stuck: running mas sem step há mais de 3 minutos (cron de safety vai pegar)
      const isStuck =
        isRunning &&
        !!job?.last_step_at &&
        Date.now() - new Date(job.last_step_at).getTime() > 3 * 60 * 1000;
      const lastActivityAt = job?.last_step_at ?? job?.finished_at ?? job?.started_at ?? null;
      const lastActivityAgeMs = lastActivityAt
        ? Math.max(0, Date.now() - new Date(lastActivityAt).getTime())
        : null;

      const total = job?.total_items ?? totals.propostas.total;
      const processed = job?.items_processed ?? 0;
      const pctGeral = total > 0 ? Math.min(100, Math.round((processed / total) * 100)) : 0;

      const pctTotal =
        totals.propostas.total > 0
          ? Math.min(100, Math.round((totals.propostas.promoted / totals.propostas.total) * 100))
          : 0;
      const executionState: ChunkedProgress["executionState"] =
        totals.clientes.total + totals.projetos.total + totals.propostas.total === 0
          ? "empty"
          : isRunning
            ? isStuck
              ? "running_stalled"
              : "running_active"
            : isResumable
              ? "resumable"
              : isComplete
                ? "completed"
                : "ready";

      return {
        job,
        totals,
        history,
        isRunning,
        isComplete,
        isResumable,
        pctGeral,
        pctTotal,
        isStuck,
        lastActivityAt,
        lastActivityAgeMs,
        executionState,
      };
    },
  });

  return {
    start,
    continueJob,
    cancel,
    progress: progressQuery.data,
    isLoading: progressQuery.isLoading,
  };
}
