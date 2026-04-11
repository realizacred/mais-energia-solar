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
  status: "pending" | "running" | "done" | "error" | "skipped";
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
          status: isPartial ? "done" : (errors > 0 ? "error" : "done"),
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
          status: isPartial ? "done" : (errors > 0 ? "error" : "done"),
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

  return { syncAll, syncStage, progress };
}
