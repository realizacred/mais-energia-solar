import { useState, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseInvokeError } from "@/lib/supabaseFunctionError";
import { toast } from "sonner";

// ─── Types ──────────────────────────────────────────────

export type SyncStage = "clients" | "projects" | "proposals";

export interface SyncStageStatus {
  stage: SyncStage;
  label: string;
  status: "pending" | "running" | "done" | "error";
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
  clients: "Clientes",
  projects: "Projetos",
  proposals: "Propostas",
};

const STAGE_ORDER: SyncStage[] = ["clients", "projects", "proposals"];

function createInitialStages(): SyncStageStatus[] {
  return STAGE_ORDER.map((stage) => ({
    stage,
    label: STAGE_LABELS[stage],
    status: "pending",
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

  const sync = useCallback(async () => {
    // Validate session first
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

    let totalFetched = 0;
    let totalUpserted = 0;
    let totalErrors = 0;
    let hadFatalError = false;

    for (const stage of STAGE_ORDER) {
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
            errorMessage: isAuthError
              ? "Token SolarMarket inválido/expirado"
              : message,
          });

          if (isAuthError) {
            toast.error("Token SolarMarket inválido/expirado. Revise a chave em Integrações > SolarMarket.");
            hadFatalError = true;
            break;
          }

          totalErrors++;
          continue;
        }

        if (data?.error) {
          updateStage(stage, {
            status: "error",
            errorMessage: data.error,
          });
          totalErrors++;
          continue;
        }

        const fetched = data?.total_fetched || 0;
        const upserted = data?.total_upserted || 0;
        const errors = data?.total_errors || 0;

        totalFetched += fetched;
        totalUpserted += upserted;
        totalErrors += errors;

        updateStage(stage, {
          status: errors > 0 ? "error" : "done",
          fetched,
          upserted,
          errors,
        });

        // Invalidate relevant queries
        if (stage === "clients") qc.invalidateQueries({ queryKey: ["sm-clients"] });
        if (stage === "projects") qc.invalidateQueries({ queryKey: ["sm-projects"] });
        if (stage === "proposals") qc.invalidateQueries({ queryKey: ["sm-proposals"] });
        qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });

        // Pause between stages
        if (STAGE_ORDER.indexOf(stage) < STAGE_ORDER.length - 1) {
          await new Promise((r) => setTimeout(r, 1500));
        }
      } catch (e: any) {
        updateStage(stage, {
          status: "error",
          errorMessage: e.message || "Erro desconhecido",
        });
        totalErrors++;
      }
    }

    setProgress((prev) => ({ ...prev, isRunning: false, currentStage: null }));

    qc.invalidateQueries({ queryKey: ["sm-clients"] });
    qc.invalidateQueries({ queryKey: ["sm-projects"] });
    qc.invalidateQueries({ queryKey: ["sm-proposals"] });
    qc.invalidateQueries({ queryKey: ["sm-sync-logs"] });

    if (!hadFatalError) {
      toast.success(
        `Sincronização concluída! ${totalFetched} encontrados, ${totalUpserted} importados.${totalErrors > 0 ? ` (${totalErrors} erros)` : ""}`
      );
    }
  }, [qc]);

  return { sync, progress };
}
