/**
 * useSmMigrationRun — Orquestrador único de migração SolarMarket.
 *
 * Sequência real (6 fases executáveis + 1 placeholder):
 *   1. classify         — classificar projetos
 *   2. resolveFunnels   — criar/garantir funis nativos e resolver classificações
 *   3. createClients    — criar/reaproveitar clientes (parte do create-projetos-from-sm)
 *   4. createProjects   — criar projetos (parte do create-projetos-from-sm)
 *   5. applyFunnels     — aplicar funil/etapa nos projetos (migrate-sm-proposals-v3)
 *   6. createProposals  — placeholder "em breve" (não executa)
 *   7. validate         — validação de integridade no banco (RPC)
 *
 * Cada fase emite contadores reais e linhas humanas em `details[]`.
 * Progresso = fases reais concluídas / 6 (placeholder ignorado).
 */
import { useCallback, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { getCurrentTenantId } from "@/lib/getCurrentTenantId";

export type PhaseKey =
  | "classify"
  | "resolveFunnels"
  | "createClients"
  | "createProjects"
  | "applyFunnels"
  | "createProposals"
  | "validate";

export interface PhaseStatus {
  key: PhaseKey;
  label: string;
  status: "pending" | "running" | "success" | "error" | "placeholder";
  successCount: number;
  failedCount: number;
  /** Linhas humanas mostradas na UI (ex.: "23 clientes criados · 10 reaproveitados"). */
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

const REAL_PHASE_KEYS: PhaseKey[] = [
  "classify",
  "resolveFunnels",
  "createClients",
  "createProjects",
  "applyFunnels",
  "validate",
];
const TOTAL_REAL_PHASES = REAL_PHASE_KEYS.length; // 6

const INITIAL_PHASES: PhaseStatus[] = [
  { key: "classify", label: "Classificando projetos", status: "pending", successCount: 0, failedCount: 0, details: [] },
  { key: "resolveFunnels", label: "Resolvendo funis/etapas", status: "pending", successCount: 0, failedCount: 0, details: [] },
  { key: "createClients", label: "Criando clientes", status: "pending", successCount: 0, failedCount: 0, details: [] },
  { key: "createProjects", label: "Criando projetos", status: "pending", successCount: 0, failedCount: 0, details: [] },
  { key: "applyFunnels", label: "Aplicando funil/etapa", status: "pending", successCount: 0, failedCount: 0, details: [] },
  { key: "createProposals", label: "Criando propostas (em breve)", status: "placeholder", successCount: 0, failedCount: 0, details: ["Integração ainda não disponível nesta versão"] },
  { key: "validate", label: "Validação final", status: "pending", successCount: 0, failedCount: 0, details: [] },
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

interface PhaseResult {
  success: number;
  failed: number;
  eligible?: number;
  sample: Array<{ ref: string | number; reason: string }>;
  logs: string[];
  details: string[];
}

export function useSmMigrationRun() {
  const qc = useQueryClient();
  const [run, setRun] = useState<UnifiedRunResult>(emptyRun);
  const [isRunning, setIsRunning] = useState(false);
  const cancelRef = useRef(false);

  const reset = useCallback(() => setRun(emptyRun()), []);
  const cancel = useCallback(() => { cancelRef.current = true; }, []);

  const start = useCallback(async () => {
    if (isRunning) return;
    cancelRef.current = false;
    setIsRunning(true);
    const startedAt = new Date().toISOString();
    let state: UnifiedRunResult = {
      ...emptyRun(),
      startedAt,
      logLines: [`[${fmtTime(startedAt)}] Iniciando migração SolarMarket`],
    };
    setRun(state);

    const { tenantId } = await getCurrentTenantId();

    const recomputeProgress = (s: UnifiedRunResult): UnifiedRunResult => {
      const phasesDone = s.phases.filter(
        (p) => REAL_PHASE_KEYS.includes(p.key) && (p.status === "success" || p.status === "error"),
      ).length;
      return { ...s, phasesDone, progress: Math.round((phasesDone / TOTAL_REAL_PHASES) * 100) };
    };

    const updatePhase = (key: PhaseKey, patch: Partial<PhaseStatus>, extra?: Partial<UnifiedRunResult>) => {
      state = {
        ...state,
        ...extra,
        phases: state.phases.map((p) => (p.key === key ? { ...p, ...patch } : p)),
      };
      state = recomputeProgress(state);
      setRun({ ...state });
    };

    const appendLog = (line: string) => {
      state = { ...state, logLines: [...state.logLines, line] };
      setRun({ ...state });
    };

    const runPhase = async (
      key: PhaseKey,
      label: string,
      fn: () => Promise<PhaseResult>,
    ): Promise<boolean> => {
      updatePhase(key, { status: "running" });
      appendLog(`[${fmtTime(new Date().toISOString())}] ▶ ${label}`);
      try {
        const r = await fn();
        const ok = r.failed === 0;
        updatePhase(
          key,
          { status: ok ? "success" : "error", successCount: r.success, failedCount: r.failed, details: r.details },
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
        let reason = e?.message ?? String(e);
        if (e?.name === "FunctionsHttpError" && e?.context) {
          try {
            const body = await e.context.json();
            const details = [body?.error, body?.detail, body?.hint].filter(Boolean).join(" · ");
            if (details) reason = details;
          } catch {
            try { const text = await e.context.text(); if (text) reason = text; } catch { /* noop */ }
          }
        }
        updatePhase(
          key,
          { status: "error", failedCount: 1, details: [reason] },
          {
            failedCount: state.failedCount + 1,
            failedSample: [...state.failedSample, { phase: label, ref: key, reason }].slice(0, 20),
          },
        );
        appendLog(`  ✖ ${reason}`);
        return false;
      }
    };

    // ── Fase 1: classify ─────────────────────────────────────────────
    const ok1 = await runPhase("classify", "Classificando projetos", async () => {
      const { data, error } = await supabase.functions.invoke("classify-sm-projects", {
        body: { tenant_id: tenantId, reclassify_all: false },
      });
      if (error) throw error;
      const classified = Number(data?.classified ?? 0);
      const skipped = Number(data?.skipped ?? 0);
      const eligible = Number(data?.total_eligible ?? 0);
      return {
        success: classified,
        failed: 0,
        eligible,
        sample: [],
        logs: [`Elegíveis: ${eligible} · Novos: ${classified} · Já classificados: ${skipped}`],
        details: [
          `${eligible} elegíveis no total`,
          `${classified} novos classificados`,
          ...(skipped > 0 ? [`${skipped} mantidos (idempotência)`] : []),
        ],
      };
    });

    // ── Fase 2: resolveFunnels ──────────────────────────────────────
    const ok2 = ok1 && !cancelRef.current
      ? await runPhase("resolveFunnels", "Resolvendo funis/etapas", async () => {
          const { data, error } = await supabase.functions.invoke("sync-projeto-funis", {
            body: { tenant_id: tenantId },
          });
          if (error) throw error;
          const funisCriados = Number(data?.funisCriados ?? 0);
          const etapasCriadas = Number(data?.etapasCriadas ?? 0);
          const resolvidas = Number(data?.classificacoesResolvidas ?? 0);
          const puladas = Number(data?.classificacoesPuladas ?? 0);
          const erros = Number(data?.classificacoesComErro ?? 0);
          return {
            success: resolvidas,
            failed: erros,
            sample: [],
            logs: [`Funis criados: ${funisCriados} · Etapas criadas: ${etapasCriadas} · Resolvidas: ${resolvidas} · Puladas: ${puladas} · Erros: ${erros}`],
            details: [
              `${funisCriados} funis criados · ${etapasCriadas} etapas criadas`,
              `${resolvidas} classificações resolvidas`,
              ...(puladas > 0 ? [`${puladas} puladas (sem destino válido)`] : []),
              ...(erros > 0 ? [`${erros} com erro de resolução`] : []),
            ],
          };
        })
      : false;

    // ── Fases 3 + 4: createClients + createProjects ─────────────────
    // Uma chamada HTTP cobre as duas — UI recebe contadores separados.
    let ok34 = false;
    if (ok2 && !cancelRef.current) {
      updatePhase("createClients", { status: "running" });
      updatePhase("createProjects", { status: "running" });
      appendLog(`[${fmtTime(new Date().toISOString())}] ▶ Criando clientes e projetos`);

      const BATCH = 200;
      let totInsertedClients = 0;
      let totReusedClients = 0;
      let totInsertedProjects = 0;
      let totReusedProjects = 0;
      let totFailedClients = 0;
      let totFailedProjects = 0;
      const allSample: Array<{ ref: string | number; reason: string; phase: "client" | "project" }> = [];
      let pass = 0;
      let fatalError: string | null = null;

      while (true) {
        if (cancelRef.current) {
          appendLog(`  ⛔ Cancelado pelo usuário no lote ${pass}`);
          break;
        }
        pass++;
        try {
          const { data, error } = await supabase.functions.invoke("create-projetos-from-sm", {
            body: { tenant_id: tenantId, confirm_apply: true, limit: BATCH },
          });
          if (error) throw error;
          const insClients = Number(data?.inserted_clients ?? 0);
          const reusedClients = Number(data?.reused_clients ?? 0);
          const insProjects = Number(data?.inserted_projects ?? 0);
          const reusedProjects = Number(data?.reused_projects ?? data?.already_exist ?? 0);
          const failedClients = Number(data?.failed_clients ?? 0);
          const failedProjects = Number(data?.failed_projects ?? 0);
          const failedTotal = Number(data?.failed_count ?? failedClients + failedProjects);
          const eligible = Number(data?.eligible ?? 0);
          const sample = Array.isArray(data?.failed_sample) ? data.failed_sample : [];

          totInsertedClients += insClients;
          totReusedClients += reusedClients;
          totInsertedProjects += insProjects;
          totReusedProjects = reusedProjects; // último valor — alreadyExist é cumulativo no DB
          totFailedClients += failedClients;
          totFailedProjects += failedProjects;
          for (const s of sample) {
            allSample.push({
              ref: s.sm_project_id ?? "?",
              reason: s.reason ?? "sem motivo",
              phase: s.phase === "client" ? "client" : "project",
            });
          }
          appendLog(`  Lote ${pass}: +${insClients} clientes (${reusedClients} reaproveitados) · +${insProjects} projetos · ${failedTotal} falha(s)`);

          const remaining = eligible - reusedProjects;
          if (remaining <= 0 || (insProjects + failedTotal === 0)) break;
          if (pass >= 50) break;
        } catch (e: any) {
          fatalError = e?.message ?? String(e);
          appendLog(`  ✖ ${fatalError}`);
          break;
        }
      }

      // Consolidar Fase 3 (clientes)
      const clientSamples = allSample.filter((s) => s.phase === "client");
      updatePhase(
        "createClients",
        {
          status: fatalError ? "error" : (totFailedClients > 0 ? "error" : "success"),
          successCount: totInsertedClients,
          failedCount: totFailedClients + (fatalError ? 1 : 0),
          details: [
            `${totInsertedClients} clientes criados`,
            `${totReusedClients} reaproveitados`,
            ...(totFailedClients > 0 ? [`${totFailedClients} falhas`] : []),
            ...(fatalError ? [fatalError] : []),
          ],
        },
        {
          successCount: state.successCount + totInsertedClients,
          failedCount: state.failedCount + totFailedClients + (fatalError ? 1 : 0),
          failedSample: [
            ...state.failedSample,
            ...clientSamples.map((s) => ({ phase: "Criando clientes", ref: s.ref, reason: s.reason })),
            ...(fatalError ? [{ phase: "Criando clientes", ref: "fatal", reason: fatalError }] : []),
          ].slice(0, 20),
        },
      );

      // Consolidar Fase 4 (projetos)
      const projectSamples = allSample.filter((s) => s.phase === "project");
      updatePhase(
        "createProjects",
        {
          status: fatalError ? "error" : (totFailedProjects > 0 ? "error" : "success"),
          successCount: totInsertedProjects,
          failedCount: totFailedProjects,
          details: [
            `${totInsertedProjects} projetos criados`,
            `${totReusedProjects} já existiam`,
            ...(totFailedProjects > 0 ? [`${totFailedProjects} falhas`] : []),
          ],
        },
        {
          successCount: state.successCount + totInsertedProjects,
          failedCount: state.failedCount + totFailedProjects,
          failedSample: [
            ...state.failedSample,
            ...projectSamples.map((s) => ({ phase: "Criando projetos", ref: s.ref, reason: s.reason })),
          ].slice(0, 20),
        },
      );

      ok34 = !fatalError && totFailedProjects === 0;
    }

    // ── Fase 5: applyFunnels ────────────────────────────────────────
    const ok5 = ok34 && !cancelRef.current
      ? await runPhase("applyFunnels", "Aplicando funil/etapa", async () => {
          const { data, error } = await supabase.functions.invoke("migrate-sm-proposals-v3", {
            body: { tenant_id: tenantId, confirm_apply: true },
          });
          if (error) throw error;
          const c = data?.counters ?? {};
          const updated = Number(c.updated ?? 0);
          const failed = Number(c.failed ?? (Array.isArray(c.errors) ? c.errors.length : 0));
          const errors = Array.isArray(c.errors) ? c.errors : [];
          return {
            success: updated,
            failed,
            sample: errors.slice(0, 10).map((e: any) => ({ ref: e.sm_project_id ?? "?", reason: e.error ?? "erro" })),
            logs: [`Atualizados: ${updated} · Falhas: ${failed}`],
            details: [
              `${updated} projetos com funil/etapa aplicados`,
              ...(failed > 0 ? [`${failed} falhas`] : []),
            ],
          };
        })
      : false;

    // ── Fase 6: createProposals (placeholder) ───────────────────────
    // Não executa nada — permanece como `placeholder`.

    // ── Fase 7: validate (sempre roda, mesmo com falhas anteriores) ─
    if (!cancelRef.current) {
      await runPhase("validate", "Validação final", async () => {
        const { data, error } = await (supabase as any).rpc("validate_sm_migration_integrity", {
          p_tenant_id: tenantId,
        });
        if (error) throw error;
        const semCliente = Number(data?.projetos_sem_cliente ?? 0);
        const semFunil = Number(data?.projetos_sem_funil ?? 0);
        const semEtapa = Number(data?.projetos_sem_etapa ?? 0);
        const funilInv = Number(data?.projetos_funil_invalido ?? 0);
        const etapaInv = Number(data?.projetos_etapa_invalida ?? 0);
        const total = Number(data?.total_validados ?? 0);
        const ok = data?.ok === true;
        const issues = semCliente + semFunil + semEtapa + funilInv + etapaInv;
        const sample: Array<{ ref: string; reason: string }> = [];
        if (semCliente > 0) sample.push({ ref: "cliente_id", reason: `${semCliente} projeto(s) sem cliente` });
        if (semFunil > 0) sample.push({ ref: "funil_id", reason: `${semFunil} projeto(s) sem funil` });
        if (semEtapa > 0) sample.push({ ref: "etapa_id", reason: `${semEtapa} projeto(s) sem etapa` });
        if (funilInv > 0) sample.push({ ref: "funil_fk", reason: `${funilInv} projeto(s) com funil_id inválido` });
        if (etapaInv > 0) sample.push({ ref: "etapa_fk", reason: `${etapaInv} projeto(s) com etapa_id inválido` });
        return {
          success: ok ? total : 0,
          failed: ok ? 0 : issues,
          sample,
          logs: [`Validados: ${total} · Inconsistências: ${issues}`],
          details: ok
            ? [`${total} projetos validados sem inconsistências`]
            : [
                `${total} projetos verificados`,
                ...(semCliente > 0 ? [`${semCliente} sem cliente`] : []),
                ...(semFunil > 0 ? [`${semFunil} sem funil`] : []),
                ...(semEtapa > 0 ? [`${semEtapa} sem etapa`] : []),
                ...(funilInv > 0 ? [`${funilInv} com funil_id inválido`] : []),
                ...(etapaInv > 0 ? [`${etapaInv} com etapa_id inválido`] : []),
              ],
        };
      });
    }

    const finishedAt = new Date().toISOString();
    const wasCancelled = cancelRef.current;
    const allRealOk = state.phases
      .filter((p) => REAL_PHASE_KEYS.includes(p.key))
      .every((p) => p.status === "success");
    state = {
      ...state,
      finishedAt,
      ok: !wasCancelled && state.failedCount === 0 && allRealOk,
      logLines: [
        ...state.logLines,
        `[${fmtTime(finishedAt)}] ${
          wasCancelled
            ? "⛔ Migração cancelada pelo usuário"
            : state.failedCount === 0
              ? "✔ Migração concluída"
              : `✖ Migração com ${state.failedCount} falha(s)`
        }`,
      ],
    };
    setRun({ ...state });
    setIsRunning(false);
    cancelRef.current = false;
    void ok5; // silencia unused

    qc.invalidateQueries({ queryKey: ["sm-migration-v3"] });
  }, [isRunning, qc]);

  return { run, isRunning, start, reset, cancel };
}
