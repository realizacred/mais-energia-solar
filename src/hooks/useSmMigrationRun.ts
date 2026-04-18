/**
 * useSmMigrationRun — Orquestrador de migração SolarMarket (V2 job-based).
 *
 * Reescrito para o novo sistema baseado em jobs assíncronos:
 *   1. Cria um job `full_migration` via edge `migration-start-job`
 *   2. Dispara `migration-execute-job` (fire-and-forget)
 *   3. Faz polling em `migration-status` até completar
 *
 * Mantém a interface `UnifiedRunResult` para preservar os componentes
 * BlocoResumo / BlocoExecucao / BlocoResultado sem alterações.
 */
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PhaseKey =
  | "classify"
  | "createClients"
  | "createProjects"
  | "createProposals";

export interface PhaseStatus {
  key: PhaseKey;
  label: string;
  status: "pending" | "running" | "success" | "error" | "placeholder";
  successCount: number;
  failedCount: number;
  details: string[];
}

export interface UnifiedRunResult {
  ok: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  eligible: number;
  successCount: number;
  failedCount: number;
  phasesDone: number;
  progress: number;
  failedSample: Array<{ phase: string; ref: string | number; reason: string }>;
  logLines: string[];
  phases: PhaseStatus[];
}

const INITIAL_PHASES: PhaseStatus[] = [
  { key: "classify", label: "Classificando projetos", status: "pending", successCount: 0, failedCount: 0, details: [] },
  { key: "createClients", label: "Migrando clientes", status: "pending", successCount: 0, failedCount: 0, details: [] },
  { key: "createProjects", label: "Migrando projetos", status: "pending", successCount: 0, failedCount: 0, details: [] },
  { key: "createProposals", label: "Migrando propostas", status: "pending", successCount: 0, failedCount: 0, details: [] },
];

function emptyRun(): UnifiedRunResult {
  return {
    ok: false,
    startedAt: null,
    finishedAt: null,
    eligible: 0,
    successCount: 0,
    failedCount: 0,
    phasesDone: 0,
    progress: 0,
    failedSample: [],
    logLines: [],
    phases: INITIAL_PHASES.map((p) => ({ ...p, details: [...p.details] })),
  };
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour12: false });

export function useSmMigrationRun() {
  const qc = useQueryClient();
  const [run, setRun] = useState<UnifiedRunResult>(emptyRun);
  const [isRunning, setIsRunning] = useState(false);
  const cancelRef = useRef(false);
  const jobIdRef = useRef<string | null>(null);

  const reset = useCallback(() => {
    if (isRunning) return;
    setRun(emptyRun());
    jobIdRef.current = null;
  }, [isRunning]);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const start = useCallback(async () => {
    if (isRunning) return;
    cancelRef.current = false;
    setIsRunning(true);

    const startedAt = new Date().toISOString();
    let local: UnifiedRunResult = {
      ...emptyRun(),
      startedAt,
      logLines: [`[${fmtTime(startedAt)}] Iniciando migração completa...`],
    };
    setRun(local);

    try {
      // 1) Start job
      const { data: startData, error: startErr } = await supabase.functions.invoke(
        "migration-start-job",
        { body: { job_type: "full_migration" } },
      );
      if (startErr || !startData?.job_id) {
        throw new Error(startErr?.message || startData?.error || "Falha ao criar job");
      }
      const jobId = startData.job_id as string;
      jobIdRef.current = jobId;

      local = {
        ...local,
        logLines: [...local.logLines, `[${fmtTime(new Date().toISOString())}] Job ${jobId.slice(0, 8)} criado. Executando...`],
      };
      setRun(local);

      // 2) Execute (fire-and-forget — backend processa síncrono mas pode demorar)
      supabase.functions.invoke("migration-execute-job", { body: { job_id: jobId } }).catch(() => {
        /* erro será capturado via status */
      });

      // 3) Polling status
      let lastCounters = "";
      while (!cancelRef.current) {
        await sleep(2000);

        const { data: status, error: statusErr } = await supabase.functions.invoke(
          "migration-status",
          { body: { job_id: jobId } },
        );
        if (statusErr || !status?.job) {
          local = {
            ...local,
            logLines: [...local.logLines, `[${fmtTime(new Date().toISOString())}] Erro ao consultar status: ${statusErr?.message ?? "desconhecido"}`],
          };
          setRun(local);
          continue;
        }

        const job = status.job;
        const counters = status.counters as Record<string, number>;
        const total = status.total as number;
        const progress = status.progress as number;
        const errors = (status.errors ?? []) as Array<{
          entity_type: string;
          sm_entity_id: number | string;
          error_message: string | null;
        }>;

        // Mapear contadores em fases
        const phases: PhaseStatus[] = INITIAL_PHASES.map((p) => ({ ...p, details: [] }));
        // Heurística simples: distribuir por entity_type
        // Buscar contagens por entity_type via mais detalhe se possível
        // Aqui usamos counters globais
        const phaseRunning = job.status === "running";
        for (const ph of phases) {
          if (job.status === "completed") {
            ph.status = "success";
          } else if (job.status === "failed") {
            ph.status = "error";
          } else if (phaseRunning) {
            ph.status = "running";
          }
        }
        phases[0].successCount = counters.migrated ?? 0;
        phases[0].details = [
          `${counters.migrated ?? 0} migrados · ${counters.skipped ?? 0} pulados · ${counters.failed ?? 0} falhas`,
        ];

        const failedSample = errors.slice(0, 20).map((e) => ({
          phase: e.entity_type,
          ref: e.sm_entity_id,
          reason: e.error_message ?? "erro desconhecido",
        }));

        const cKey = JSON.stringify(counters);
        const newLogs = [...local.logLines];
        if (cKey !== lastCounters) {
          newLogs.push(
            `[${fmtTime(new Date().toISOString())}] ${counters.migrated ?? 0} migrados / ${total} total · ${counters.failed ?? 0} falhas (${progress}%)`,
          );
          lastCounters = cKey;
        }

        const finished = job.status === "completed" || job.status === "failed";
        local = {
          ...local,
          ok: job.status === "completed" && (counters.failed ?? 0) === 0,
          eligible: total,
          successCount: counters.migrated ?? 0,
          failedCount: counters.failed ?? 0,
          phasesDone: finished ? phases.length : Math.floor((progress / 100) * phases.length),
          progress,
          failedSample,
          logLines: newLogs,
          phases,
          finishedAt: finished ? (job.completed_at ?? new Date().toISOString()) : null,
        };
        setRun(local);

        if (finished) break;
      }

      if (cancelRef.current) {
        local = {
          ...local,
          finishedAt: new Date().toISOString(),
          logLines: [...local.logLines, `[${fmtTime(new Date().toISOString())}] Cancelado pelo usuário (job ${jobIdRef.current?.slice(0, 8)} continua no servidor).`],
        };
        setRun(local);
      }
    } catch (e: any) {
      const msg = e?.message ?? String(e);
      setRun((prev) => ({
        ...prev,
        ok: false,
        finishedAt: new Date().toISOString(),
        failedCount: prev.failedCount + 1,
        failedSample: [...prev.failedSample, { phase: "start", ref: "-", reason: msg }],
        logLines: [...prev.logLines, `[${fmtTime(new Date().toISOString())}] ❌ ${msg}`],
        phases: prev.phases.map((p) => (p.status === "pending" || p.status === "running" ? { ...p, status: "error" } : p)),
      }));
    } finally {
      setIsRunning(false);
      qc.invalidateQueries({ queryKey: ["sm-migration-v3"] });
      qc.invalidateQueries({ queryKey: ["sm-sync-progress"] });
    }
  }, [isRunning, qc]);

  return { run, isRunning, start, reset, cancel };
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
