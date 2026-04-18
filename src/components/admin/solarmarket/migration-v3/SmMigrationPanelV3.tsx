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
import { useSmMigrationRun } from "@/hooks/useSmMigrationRun";
import { BlocoResumo } from "./BlocoResumo";
import { BlocoExecucao } from "./BlocoExecucao";
import { BlocoResultado } from "./BlocoResultado";

export default function SmMigrationPanelV3() {
  const { run, isRunning, start, reset, cancel } = useSmMigrationRun();

  return (
    <div className="space-y-4">
      <PageHeader
        icon={Sun}
        title="Importar dados do SolarMarket"
        description="Sincronize, classifique e migre seus dados para o sistema nativo em um único fluxo."
      />

      <BlocoResumo run={run} isRunning={isRunning} />

      <BlocoExecucao run={run} isRunning={isRunning} onStart={start} onReset={reset} onCancel={cancel} />

      <BlocoResultado run={run} />
    </div>
  );
}
