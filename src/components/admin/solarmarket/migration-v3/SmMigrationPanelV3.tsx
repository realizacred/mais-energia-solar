/**
 * SmMigrationPanelV3 — Experiência de migração SolarMarket (rebuild).
 *
 * Princípios:
 *   - 1 botão único: "Migrar dados do SolarMarket"
 *   - SSOT: useSmMigrationRun → UnifiedRunResult alimenta TODA a UI
 *   - Sem pipeline/etapa global. Sem background. Sem botões técnicos.
 */
import { Sun } from "lucide-react";
import { PageHeader } from "@/components/ui-kit";
import { useSmClassificationDistribution } from "@/hooks/useSmMigrationV3";
import { useSmMigrationRun } from "@/hooks/useSmMigrationRun";
import { BlocoResumo } from "./BlocoResumo";
import { BlocoDistribuicao } from "./BlocoDistribuicao";
import { BlocoExecucao } from "./BlocoExecucao";
import { BlocoResultado } from "./BlocoResultado";

export default function SmMigrationPanelV3() {
  const { run, isRunning, start, reset, cancel } = useSmMigrationRun();
  const { data: distribution, isLoading: loadingDist } = useSmClassificationDistribution();

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Sun}
        title="Importar dados do SolarMarket"
        description="Sincronize, classifique e migre seus dados para o sistema nativo em um único fluxo."
      />

      <BlocoResumo run={run} isRunning={isRunning} />

      <div className="grid gap-4 lg:grid-cols-2">
        <BlocoDistribuicao rows={distribution} isLoading={loadingDist} />
        <BlocoExecucao run={run} isRunning={isRunning} onStart={start} onReset={reset} onCancel={cancel} />
      </div>

      <BlocoResultado run={run} />
    </div>
  );
}
