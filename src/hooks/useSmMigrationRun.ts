/**
 * useSmMigrationRun — Orquestrador único de migração SolarMarket.
 *
 * Une classify → create → apply em uma única ação com:
 *   - RunResult unificado (SSOT da UI)
 *   - progresso por etapa
 *   - log consolidado
 *   - failedCount real (soma das 3 fases)
 *
 * Sem pipeline global. Sem etapa global. Sem background.
 * O usuário só inicia e acompanha.
 */
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

export type MigrationPhase = "idle" | "classify" | "create" | "apply" | "done" | "error";

export interface PhaseStatus {
  key: Exclude<MigrationPhase, "idle" | "done" | "error">;
  label: string;
  status: "pending" | "running" | "success" | "error";
  successCount: number;
  failedCount: number;
}

export interface UnifiedRunResult {
  ok: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  /** Total elegíveis (do classify). */
  eligible: number;
  /** Soma de itens processados com sucesso em todas as fases. */
  successCount: number;
  /** Soma real de falhas em todas as fases. ÚNICA fonte para "Erros". */
  failedCount: number;
  /** Total de fases concluídas com sucesso (0..3). */
  phasesDone: number;
  /** Progresso 0..100 baseado em fases concluídas. */
  progress: number;
  /** Amostra de erros consolidada. */
  failedSample: Array<{ phase: string; ref: string | number; reason: string }>;
  /** Log consolidado, formatado para terminal. */
  logLines: string[];
  /** Status de cada fase para o stepper visual. */
  phases: PhaseStatus[];
}

const INITIAL_PHASES: PhaseStatus[] = [
  { key: "classify", label: "Classificando", status: "pending", successCount: 0, failedCount: 0 },
  { key: "create", label: "Criando projetos", status: "pending", successCount: 0, failedCount: 0 },
  { key: "apply", label: "Aplicando funis/etapas", status: "pending", successCount: 0, failedCount: 0 },
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
    phases: INITIAL_PHASES.map((p) => ({ ...p })),
  };
}

const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("pt-BR", { hour12: false });

export function useSmMigrationRun() {
  const qc = useQueryClient();
  const [run, setRun] = useState<UnifiedRunResult>(emptyRun);
  const [isRunning, setIsRunning] = useState(false);
  const cancelRef = useRef(false);

  const reset = useCallback(() => {
    setRun(emptyRun());
  }, []);

  const cancel = useCallback(() => {
    cancelRef.current = true;
  }, []);

  const start = useCallback(async () => {
    if (isRunning) return;
    cancelRef.current = false;
    setIsRunning(true);
    const startedAt = new Date().toISOString();
    let state: UnifiedRunResult = { ...emptyRun(), startedAt, logLines: [`[${fmtTime(startedAt)}] Iniciando migração SolarMarket`] };
    setRun(state);

    const { tenantId } = await getCurrentTenantId();

    const updatePhase = (
      key: PhaseStatus["key"],
      patch: Partial<PhaseStatus>,
      extra?: Partial<UnifiedRunResult>,
    ) => {
      state = {
        ...state,
        ...extra,
        phases: state.phases.map((p) => (p.key === key ? { ...p, ...patch } : p)),
      };
      const phasesDone = state.phases.filter((p) => p.status === "success" || p.status === "error").length;
      state = { ...state, phasesDone, progress: Math.round((phasesDone / 3) * 100) };
      setRun({ ...state });
    };

    const appendLog = (line: string) => {
      state = { ...state, logLines: [...state.logLines, line] };
      setRun({ ...state });
    };

    const runPhase = async (
      key: PhaseStatus["key"],
      label: string,
      fn: () => Promise<{ success: number; failed: number; eligible?: number; sample: Array<{ ref: string | number; reason: string }>; logs: string[] }>,
    ) => {
      updatePhase(key, { status: "running" });
      appendLog(`[${fmtTime(new Date().toISOString())}] ▶ ${label}`);
      try {
        const r = await fn();
        const ok = r.failed === 0;
        updatePhase(
          key,
          { status: ok ? "success" : "error", successCount: r.success, failedCount: r.failed },
          {
            successCount: state.successCount + r.success,
            failedCount: state.failedCount + r.failed,
            eligible: r.eligible !== undefined ? r.eligible : state.eligible,
            failedSample: [
              ...state.failedSample,
              ...r.sample.map((s) => ({ phase: label, ref: s.ref, reason: s.reason })),
            ].slice(0, 20),
          },
        );
        r.logs.forEach((l) => appendLog(`  ${l}`));
        return ok;
      } catch (e: any) {
        const reason = e?.message ?? String(e);
        updatePhase(
          key,
          { status: "error", failedCount: 1 },
          {
            failedCount: state.failedCount + 1,
            failedSample: [...state.failedSample, { phase: label, ref: key, reason }].slice(0, 20),
          },
        );
        appendLog(`  ✖ ${reason}`);
        return false;
      }
    };

    // ── Fase 1: classify ─────────────────────────────────
    const ok1 = await runPhase("classify", "Classificando registros", async () => {
      const { data, error } = await supabase.functions.invoke("classify-sm-projects", {
        body: { tenant_id: tenantId, reclassify_all: false },
      });
      if (error) throw new Error(error.message);
      const classified = Number(data?.classified ?? 0);
      const skipped = Number(data?.skipped ?? 0);
      const eligible = Number(data?.total_eligible ?? 0);
      return {
        success: classified,
        failed: 0,
        eligible,
        sample: [],
        logs: [`Elegíveis: ${eligible} · Classificados: ${classified} · Ignorados: ${skipped}`],
      };
    });

    // ── Fase 2: create (APPLY) — chunked para evitar timeout HTTP ─────────
    const ok2 = ok1
      ? await runPhase("create", "Criando projetos nativos", async () => {
          const BATCH = 200;
          let totalInserted = 0;
          let totalClients = 0;
          let totalFailed = 0;
          const allSample: Array<{ ref: string | number; reason: string }> = [];
          const logs: string[] = [];
          let pass = 0;

          while (true) {
            if (cancelRef.current) {
              logs.push(`⛔ Cancelado pelo usuário no lote ${pass}`);
              break;
            }
            pass++;
            const { data, error } = await supabase.functions.invoke("create-projetos-from-sm", {
              body: { tenant_id: tenantId, confirm_apply: true, limit: BATCH },
            });
            if (error) throw new Error(error.message);
            const inserted = Number(data?.inserted_projects ?? 0);
            const insertedClients = Number(data?.inserted_clients ?? 0);
            const failed = Number(data?.failed_count ?? 0);
            const eligible = Number(data?.eligible ?? 0);
            const alreadyExist = Number(data?.already_exist ?? 0);
            const sample = Array.isArray(data?.failed_sample) ? data.failed_sample : [];

            totalInserted += inserted;
            totalClients += insertedClients;
            totalFailed += failed;
            for (const s of sample) {
              allSample.push({ ref: s.sm_project_id ?? "?", reason: s.reason ?? "sem motivo" });
            }
            logs.push(`Lote ${pass}: +${inserted} projetos · +${insertedClients} clientes · ${failed} falha(s)`);

            // Sai quando não houver mais o que inserir neste lote
            const remaining = eligible - alreadyExist;
            if (remaining <= 0 || inserted + failed === 0) break;
            // segurança: no máximo 50 lotes (10k projetos)
            if (pass >= 50) break;
          }

          return {
            success: totalInserted,
            failed: totalFailed,
            sample: allSample.slice(0, 10),
            logs: [...logs, `Total: ${totalInserted} projetos · ${totalClients} clientes · ${totalFailed} falha(s)`],
          };
        })
      : false;

    // ── Fase 3: apply (APPLY) ────────────────────────────
    if (ok2) {
      await runPhase("apply", "Aplicando funis/etapas", async () => {
        const { data, error } = await supabase.functions.invoke("migrate-sm-proposals-v3", {
          body: { tenant_id: tenantId, confirm_apply: true },
        });
        if (error) throw new Error(error.message);
        const c = data?.counters ?? {};
        const updated = Number(c.updated ?? 0);
        const failed = Number(c.failed ?? (Array.isArray(c.errors) ? c.errors.length : 0));
        const errors = Array.isArray(c.errors) ? c.errors : [];
        return {
          success: updated,
          failed,
          sample: errors.slice(0, 10).map((e: any) => ({
            ref: e.sm_project_id ?? "?",
            reason: e.error ?? "erro",
          })),
          logs: [`Atualizados: ${updated} · Falhas: ${failed}`],
        };
      });
    }

    const finishedAt = new Date().toISOString();
    state = {
      ...state,
      finishedAt,
      ok: state.failedCount === 0 && state.phases.every((p) => p.status === "success"),
      logLines: [
        ...state.logLines,
        `[${fmtTime(finishedAt)}] ${state.failedCount === 0 ? "✔ Migração concluída" : `✖ Migração com ${state.failedCount} falha(s)`}`,
      ],
    };
    setRun({ ...state });
    setIsRunning(false);

    qc.invalidateQueries({ queryKey: ["sm-migration-v3"] });
  }, [isRunning, qc]);

  return { run, isRunning, start, reset };
}
