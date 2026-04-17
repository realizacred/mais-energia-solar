/**
 * SmMigrationPanelV3 — Painel reconstruído do módulo de Migração SolarMarket.
 *
 * Substitui o fluxo legado (pipeline global / etapa global / drawer com background).
 * Toda a UI deriva da mesma fonte de verdade:
 *   - useSmMigrationCounters         → KPIs (Bloco A)
 *   - useSmClassificationDistribution → distribuição (Bloco B)
 *   - mutations classify/create/apply → terminal + erros (Bloco D)
 *
 * Sem pipeline_id / stage_id globais. O destino vem de sm_project_classification.
 */
import { useState, useCallback } from "react";
import { Sun } from "lucide-react";
import { PageHeader } from "@/components/ui-kit";
import {
  useSmMigrationCounters,
  useSmClassificationDistribution,
  useClassifyMutation,
  useCreateProjetosMutation,
  useApplyFunilMutation,
  type RunResult,
} from "@/hooks/useSmMigrationV3";
import { toast } from "sonner";
import { BlocoResumo } from "./BlocoResumo";
import { BlocoDistribuicao } from "./BlocoDistribuicao";
import { BlocoExecucao } from "./BlocoExecucao";
import { BlocoResultado } from "./BlocoResultado";

export default function SmMigrationPanelV3() {
  const [lastRun, setLastRun] = useState<RunResult | null>(null);

  const { data: counters, isLoading: loadingCounters } = useSmMigrationCounters();
  const { data: distribution, isLoading: loadingDist } = useSmClassificationDistribution();

  const classify = useClassifyMutation();
  const createMut = useCreateProjetosMutation();
  const applyMut = useApplyFunilMutation();

  const handleResult = useCallback((r: RunResult) => {
    setLastRun(r);
    if (r.ok && r.failedCount === 0) {
      toast.success(`${labelKind(r.kind)} concluída`, { description: `${r.successCount} item(ns) processados.` });
    } else {
      toast.error(`${labelKind(r.kind)} com falhas`, { description: `${r.failedCount} item(ns) falharam.` });
    }
  }, []);

  const onClassify = useCallback(() => {
    classify.mutate({ reclassifyAll: false }, { onSuccess: handleResult });
  }, [classify, handleResult]);

  const onCreate = useCallback(
    (confirmApply: boolean) => {
      createMut.mutate({ confirmApply }, { onSuccess: handleResult });
    },
    [createMut, handleResult],
  );

  const onApply = useCallback(
    (confirmApply: boolean) => {
      applyMut.mutate({ confirmApply }, { onSuccess: handleResult });
    },
    [applyMut, handleResult],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Sun}
        title="Migração SolarMarket"
        description="Classificação por registro · sem pipeline global · execução por etapas"
      />

      <BlocoResumo counters={counters} isLoading={loadingCounters} lastRun={lastRun} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BlocoDistribuicao rows={distribution} isLoading={loadingDist} />
        <BlocoExecucao
          classifying={classify.isPending}
          creating={createMut.isPending}
          applying={applyMut.isPending}
          onClassify={onClassify}
          onCreate={onCreate}
          onApply={onApply}
        />
      </div>

      <BlocoResultado lastRun={lastRun} />
    </div>
  );
}

function labelKind(k: RunResult["kind"]): string {
  return k === "classify" ? "Classificação" : k === "create" ? "Criação de projetos" : "Aplicação de funil/etapa";
}
