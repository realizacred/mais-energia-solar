import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────

export type SyncStage = "funnels" | "custom_fields" | "clients" | "projects" | "proposals" | "backfill_cf_raw";

export interface SyncStageStatus {
  stage: SyncStage;
  label: string;
  status: "pending" | "running" | "done" | "error" | "skipped" | "partial";
  fetched: number;
  upserted: number;
  errors: number;
  errorMessage?: string;
}

export interface SyncProgress {
  isRunning: boolean;
  stages: SyncStageStatus[];
  currentStage: SyncStage | null;
}

const STAGE_LABELS: Record<SyncStage, string> = {
  funnels: "Funis",
  custom_fields: "Campos Custom",
  clients: "Clientes",
  projects: "Projetos",
  proposals: "Propostas",
  backfill_cf_raw: "Backfill CF Raw",
};

const STAGE_QUERY_KEYS: Record<SyncStage, string> = {
  funnels: "sm-funnels",
  custom_fields: "sm-custom-fields",
  clients: "sm-clients",
  projects: "sm-projects",
  proposals: "sm-proposals",
  backfill_cf_raw: "sm-proposals",
};

const ALL_STAGES: SyncStage[] = ["funnels", "custom_fields", "clients", "projects", "proposals", "backfill_cf_raw"];

function createInitialStages(onlyStage?: SyncStage): SyncStageStatus[] {
  return ALL_STAGES.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    status: onlyStage && stage !== onlyStage ? "skipped" : "pending",
    fetched: 0,
    upserted: 0,
    errors: 0,
  }));
}

// ─── Hook ───────────────────────────────────────────────

export function useSolarMarketSync() {
  const qc = useQueryClient();
  const [progress, setProgress] = useState<SyncProgress>({
    isRunning: false,
    stages: createInitialStages(),
    currentStage: null,
  });

  const updateStage = (stage: SyncStage, update: Partial<SyncStageStatus>) => {
    setProgress((prev) => ({
      ...prev,
      stages: prev.stages.map((s) =>
        s.stage === stage ? { ...s, ...update } : s
      ),
    }));
  };

  const syncStage = useCallback(async (stage: SyncStage) => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    setProgress({
      isRunning: true,
      stages: createInitialStages(stage),
      currentStage: stage,
    });

    updateStage(stage, { status: "running" });

    try {
      const { data, error } = await supabase.functions.invoke("solarmarket-sync", {
        body: { sync_type: stage },
      });

      if (error) {
        const parsed = await parseInvokeError(error);
        const message = parsed.message || `Erro na etapa ${STAGE_LABELS[stage]}`;
        const isAuthError = parsed.status === 401 || /401|unauthorized/i.test(message);

        updateStage(stage, {
          status: "error",
          errorMessage: isAuthError
            ? "Token SolarMarket inválido/expirado"
            : message,
        });

        if (isAuthError) {
          toast.error("Token SolarMarket inválido/expirado. Revise a chave em Integrações > SolarMarket.");
        }
      } else if (data?.error) {
        updateStage(stage, { status: "error", errorMessage: data.error });
      } else {
        const fetched = data?.total_fetched || 0;
        const upserted = data?.total_upserted || 0;
        const errors = data?.total_errors || 0;
        const isPartial = data?.status === "partial";
        const remaining = data?.remaining || 0;

        updateStage(stage, {
          status: isPartial ? "partial" : (errors > 0 ? "error" : "done"),
          fetched,
          upserted,
          errors,
        });

        if (isPartial) {
          toast.warning(
            `${STAGE_LABELS[stage]}: ${upserted} importados. ${remaining} projetos restantes — clique em Sincronizar para continuar.`,
            { duration: 8000 }
          );
        } else {
          toast.success(
            `${STAGE_LABELS[stage]}: ${fetched} encontrados, ${upserted} importados.${errors > 0 ? ` (${errors} erros)` : ""}`
          );
        }
      }

      qc.invalidateQueries({ queryKey: [STAGE_QUERY_KEYS[stage]] });
      qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });
    } catch (e: any) {
      updateStage(stage, {
        status: "error",
        errorMessage: e.message || "Erro desconhecido",
      });
    }

    setProgress((prev) => ({ ...prev, isRunning: false, currentStage: null }));
  }, [qc]);

  const syncAll = useCallback(async () => {
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      toast.error("Sessão expirada. Faça login novamente.");
      return;
    }

    setProgress({
      isRunning: true,
      stages: createInitialStages(),
      currentStage: "clients",
    });

    let hadFatalError = false;
    let skipReason = "";

    for (const stage of ALL_STAGES) {
      if (hadFatalError) {
        updateStage(stage, { status: "skipped", errorMessage: skipReason || "Etapa anterior falhou" });
        continue;
      }

      setProgress((prev) => ({ ...prev, currentStage: stage }));
      updateStage(stage, { status: "running" });

      try {
        const { data, error } = await supabase.functions.invoke("solarmarket-sync", {
          body: { sync_type: stage },
        });

        if (error) {
          const parsed = await parseInvokeError(error);
          const message = parsed.message || `Erro na etapa ${STAGE_LABELS[stage]}`;
          const isAuthError = parsed.status === 401 || /401|unauthorized/i.test(message);

          updateStage(stage, {
            status: "error",
            errorMessage: isAuthError ? "Token inválido/expirado" : message,
          });

          if (isAuthError) {
            toast.error("Token SolarMarket inválido/expirado.");
            hadFatalError = true;
            skipReason = "Token inválido";
            continue;
          }

          // C2: clients error → skip projects + proposals
          if (stage === "clients") {
            hadFatalError = true;
            skipReason = `Etapa "${STAGE_LABELS.clients}" falhou — projetos e propostas não serão sincronizados`;
            toast.error(skipReason, { duration: 8000 });
            continue;
          }

          continue;
        }

        if (data?.error) {
          updateStage(stage, { status: "error", errorMessage: data.error });

          if (stage === "clients") {
            hadFatalError = true;
            skipReason = `Etapa "${STAGE_LABELS.clients}" falhou — projetos e propostas não serão sincronizados`;
            toast.error(skipReason, { duration: 8000 });
          }

          continue;
        }

        const fetched = data?.total_fetched || 0;
        const upserted = data?.total_upserted || 0;
        const errors = data?.total_errors || 0;
        const isPartial = data?.status === "partial";

        updateStage(stage, {
          status: isPartial ? "partial" : (errors > 0 ? "error" : "done"),
          fetched,
          upserted,
          errors,
        });

        // C2: projects with >50% error rate → skip proposals
        if (stage === "projects" && fetched > 0) {
          const errorRate = errors / fetched;
          if (errorRate > 0.5) {
            hadFatalError = true;
            skipReason = `Etapa "${STAGE_LABELS.projects}" com ${Math.round(errorRate * 100)}% de erros — propostas não serão sincronizadas`;
            toast.error(skipReason, { duration: 8000 });
          }
        }

        qc.invalidateQueries({ queryKey: [STAGE_QUERY_KEYS[stage]] });
        qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });

        // Pause between stages
        if (ALL_STAGES.indexOf(stage) < ALL_STAGES.length - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch (e: any) {
        updateStage(stage, {
          status: "error",
          errorMessage: e.message || "Erro desconhecido",
        });

        if (stage === "clients" || stage === "projects") {
          hadFatalError = true;
          skipReason = `Etapa "${STAGE_LABELS[stage]}" falhou — etapas seguintes puladas`;
          toast.error(skipReason, { duration: 8000 });
        }
      }
    }

    setProgress((prev) => ({ ...prev, isRunning: false, currentStage: null }));

    qc.invalidateQueries({ queryKey: ["sm-clients"] });
    qc.invalidateQueries({ queryKey: ["sm-projects"] });
    qc.invalidateQueries({ queryKey: ["sm-proposals"] });
    qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });

    if (!hadFatalError) {
      toast.success("Sincronização completa finalizada!");
    }
  }, [qc]);

  // ─── Sync Completo (loop automático) ──────────────────
  const [fullSyncStatus, setFullSyncStatus] = useState<{
    running: boolean;
    round: number;
    maxRounds: number;
    propostas: number;
    totalProjetos: number;
    projetosVarridos: number;
    projetosRestantes: number;
    comFunis: number;
    pctFunis: number;
    message: string;
    stopRequested: boolean;
  }>({
    running: false,
    round: 0,
    maxRounds: 20,
    propostas: 0,
    totalProjetos: 0,
    projetosVarridos: 0,
    projetosRestantes: 0,
    comFunis: 0,
    pctFunis: 0,
    message: "",
    stopRequested: false,
  });

  const stopFullSyncRef = { current: false };

  const requestStopFullSync = useCallback(() => {
    stopFullSyncRef.current = true;
    setFullSyncStatus((prev) => ({ ...prev, stopRequested: true }));
  }, []);

  const syncUntilComplete = useCallback(async () => {
    const MAX_ROUNDS = 25;
    const MAX_STAGNANT = 3;
    stopFullSyncRef.current = false;

    // ── Pre-check: are there actually unscanned projects? ──
    const [projCheck, scannedCheck] = await Promise.all([
      (supabase as any).from("solar_market_projects").select("id", { count: "exact", head: true }),
      (supabase as any).from("solar_market_projects").select("id", { count: "exact", head: true }).not("proposals_synced_at", "is", null),
    ]);
    const totalBefore = projCheck.count ?? 0;
    const scannedBefore = scannedCheck.count ?? 0;
    if (totalBefore > 0 && scannedBefore >= totalBefore) {
      toast.info(`Todos os ${totalBefore} projetos já estão sincronizados.`);
      return;
    }

    setFullSyncStatus({
      running: true,
      round: 0,
      maxRounds: MAX_ROUNDS,
      propostas: 0,
      totalProjetos: 0,
      projetosVarridos: 0,
      projetosRestantes: 0,
      comFunis: 0,
      pctFunis: 0,
      message: "Iniciando sync completo...",
      stopRequested: false,
    });

    let lastVarridos = -1;
    let stagnantRounds = 0;

    for (let round = 1; round <= MAX_ROUNDS; round++) {
      if (stopFullSyncRef.current) {
        setFullSyncStatus((prev) => ({
          ...prev,
          running: false,
          message: `Parado na rodada ${round - 1}/${MAX_ROUNDS}. Clique novamente para continuar.`,
        }));
        return;
      }

      // Round 1: full sync. Round 2+: only proposals (funis/clientes/projetos already done)
      const onlyProposals = round > 1;

      setFullSyncStatus((prev) => ({
        ...prev,
        round,
        message: onlyProposals
          ? `Rodada ${round}/${MAX_ROUNDS} — sincronizando propostas...`
          : `Rodada ${round}/${MAX_ROUNDS} — sincronizando tudo...`,
      }));

      if (onlyProposals) {
        await syncStage("proposals");
      } else {
        await syncAll();
      }

      // Wait before checking progress
      await new Promise((r) => setTimeout(r, 3000));

      // Check progress — use projects scanned (proposals_synced_at IS NOT NULL) as the real metric
      const [propRes, projRes, funisRes, scannedRes] = await Promise.all([
        supabase.from("solar_market_proposals").select("id", { count: "exact", head: true }),
        supabase.from("solar_market_projects").select("id", { count: "exact", head: true }),
        supabase.from("solar_market_projects").select("id", { count: "exact", head: true }).not("all_funnels", "is", null),
        (supabase as any).from("solar_market_projects").select("id", { count: "exact", head: true }).not("proposals_synced_at", "is", null),
      ]);

      const propostas = propRes.count ?? 0;
      const totalProjetos = projRes.count ?? 0;
      const comFunis = funisRes.count ?? 0;
      const projetosVarridos = scannedRes.count ?? 0;
      const projetosRestantes = totalProjetos - projetosVarridos;
      const pctFunis = totalProjetos > 0 ? Math.round((comFunis / totalProjetos) * 1000) / 10 : 0;

      // Stagnation detection — based on projects scanned, NOT proposals count
      if (projetosVarridos > lastVarridos) {
        stagnantRounds = 0;
      } else {
        stagnantRounds++;
      }
      lastVarridos = projetosVarridos;

      setFullSyncStatus((prev) => ({
        ...prev,
        propostas,
        totalProjetos,
        projetosVarridos,
        projetosRestantes,
        comFunis,
        pctFunis,
        message: `Rodada ${round}/${MAX_ROUNDS} — ${projetosVarridos} de ${totalProjetos} projetos varridos (${propostas} propostas encontradas)`,
      }));

      // Check completion — all projects scanned
      if (projetosRestantes <= 0) {
        setFullSyncStatus((prev) => ({
          ...prev,
          running: false,
          message: `✅ Sync completo! ${projetosVarridos} projetos varridos, ${propostas} propostas encontradas, ${pctFunis}% com funis.`,
        }));
        toast.success(`Sync completo! ${propostas} propostas importadas de ${totalProjetos} projetos.`);
        return;
      }

      // Stop if stagnant — projects scanned didn't increase for 3 rounds
      if (stagnantRounds >= MAX_STAGNANT) {
        setFullSyncStatus((prev) => ({
          ...prev,
          running: false,
          message: `Sync estagnado — ${projetosVarridos}/${totalProjetos} projetos varridos, sem avanço por ${MAX_STAGNANT} rodadas. Verifique erros no log.`,
        }));
        toast.warning(`Sync parou: sem avanço por ${MAX_STAGNANT} rodadas consecutivas.`, { duration: 8000 });
        return;
      }
    }

    setFullSyncStatus((prev) => ({
      ...prev,
      running: false,
      message: `Sync parcial — ${prev.projetosVarridos}/${prev.totalProjetos} projetos varridos (${prev.propostas} propostas). Clique novamente para continuar.`,
    }));
    toast.warning("Sync parcial — clique novamente para continuar.", { duration: 8000 });
  }, [syncAll, syncStage]);

  return { syncAll, syncStage, progress, syncUntilComplete, requestStopFullSync, fullSyncStatus };
}
