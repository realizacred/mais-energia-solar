/**
 * BlocoResultado — Resultado da última rodada.
 * Tudo aqui deriva do mesmo RunResult que alimenta o card "Erros última rodada".
 */
import { AlertTriangle, CheckCircle2, Inbox } from "lucide-react";
import { SectionCard, EmptyState } from "@/components/ui-kit";
import { SmTerminalLog } from "@/components/admin/solarmarket/SmTerminalLog";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { RunResult } from "@/hooks/useSmMigrationV3";

interface Props {
  lastRun: RunResult | null;
}

const KIND_LABEL: Record<RunResult["kind"], string> = {
  classify: "Classificação",
  create: "Criação de projetos nativos",
  apply: "Aplicação de funil/etapa",
};

export function BlocoResultado({ lastRun }: Props) {
  if (!lastRun) {
    return (
      <SectionCard icon={Inbox} title="Resultado da última rodada" variant="neutral">
        <EmptyState
          icon={Inbox}
          title="Nenhuma rodada executada ainda"
          description="Rode uma das ações no bloco de Execução para ver o resultado aqui."
        />
      </SectionCard>
    );
  }

  const failed = lastRun.failedCount;
  const ok = lastRun.ok && failed === 0;

  return (
    <SectionCard
      icon={ok ? CheckCircle2 : AlertTriangle}
      title="Resultado da última rodada"
      variant="neutral"
      actions={
        <Badge variant="outline" className={cn("text-[10px]", ok ? "border-success/40 text-success" : "border-destructive/40 text-destructive")}>
          {KIND_LABEL[lastRun.kind]} · {ok ? "OK" : `${failed} falha(s)`}
        </Badge>
      }
    >
      <div className="space-y-3">
        {failed > 0 && (
          <div className="rounded-md border border-destructive/30 bg-destructive/5 p-3">
            <p className="text-sm font-medium text-destructive flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              {failed} item(ns) falharam nesta rodada
            </p>
            {lastRun.failedSample.length > 0 && (
              <ul className="mt-2 space-y-1 text-xs font-mono text-destructive/90 max-h-40 overflow-y-auto">
                {lastRun.failedSample.map((s, i) => (
                  <li key={i} className="truncate">
                    <span className="text-muted-foreground">[{String(s.ref)}]</span> {s.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="grid gap-2 sm:grid-cols-3 text-xs">
          <Stat label="Sucesso" value={lastRun.successCount} tone={lastRun.successCount > 0 ? "success" : "muted"} />
          <Stat label="Falhas" value={failed} tone={failed > 0 ? "destructive" : "muted"} />
          <Stat label="Tipo" value={KIND_LABEL[lastRun.kind]} tone="info" />
        </div>

        <SmTerminalLog logs={lastRun.logLines} maxHeight="max-h-56" />
      </div>
    </SectionCard>
  );
}

function Stat({ label, value, tone }: { label: string; value: number | string; tone: "success" | "destructive" | "muted" | "info" }) {
  const toneClass =
    tone === "success" ? "border-l-success" :
    tone === "destructive" ? "border-l-destructive" :
    tone === "info" ? "border-l-info" : "border-l-muted";
  return (
    <div className={cn("rounded-md border bg-card border-l-4 p-2", toneClass)}>
      <p className="text-[10px] text-muted-foreground uppercase tracking-wide">{label}</p>
      <p className="text-sm font-semibold tabular-nums truncate">{value}</p>
    </div>
  );
}
