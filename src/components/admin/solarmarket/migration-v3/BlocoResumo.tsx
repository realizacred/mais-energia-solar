/**
 * BlocoResumo — KPI cards (SSOT: useSmMigrationCounters + última rodada).
 * Border-l semântico, sem cores hardcoded.
 */
import { Users, FolderKanban, ListChecks, Target, Sparkles, AlertOctagon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { MigrationCounters, RunResult } from "@/hooks/useSmMigrationV3";

interface Props {
  counters: MigrationCounters | undefined;
  isLoading: boolean;
  /** Última rodada concluída (qualquer kind). Define "Erros última rodada". */
  lastRun: RunResult | null;
}

interface Card {
  icon: React.ElementType;
  label: string;
  value: number | string;
  borderClass: string;
  iconClass: string;
}

export function BlocoResumo({ counters, isLoading, lastRun }: Props) {
  if (isLoading || !counters) {
    return (
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-lg" />
        ))}
      </div>
    );
  }

  const lastFailed = lastRun?.failedCount ?? 0;

  const cards: Card[] = [
    { icon: Sparkles, label: "Elegíveis", value: counters.eligible, borderClass: "border-l-info", iconClass: "text-info" },
    { icon: ListChecks, label: "Classificados", value: counters.classified, borderClass: "border-l-secondary", iconClass: "text-secondary" },
    { icon: FolderKanban, label: "Projetos criados", value: counters.projectsCreated, borderClass: "border-l-primary", iconClass: "text-primary" },
    { icon: Users, label: "Clientes criados", value: counters.clientsCreated, borderClass: "border-l-primary", iconClass: "text-primary" },
    { icon: Target, label: "Funis aplicados", value: counters.funnelsApplied, borderClass: "border-l-success", iconClass: "text-success" },
    {
      icon: AlertOctagon,
      label: "Erros última rodada",
      value: lastFailed,
      borderClass: lastFailed > 0 ? "border-l-destructive" : "border-l-muted",
      iconClass: lastFailed > 0 ? "text-destructive" : "text-muted-foreground",
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-6 gap-3">
      {cards.map((c) => (
        <div
          key={c.label}
          className={cn(
            "rounded-lg border bg-card p-3 border-l-4 flex items-start gap-3 transition-colors",
            c.borderClass,
          )}
        >
          <c.icon className={cn("h-5 w-5 mt-0.5 shrink-0", c.iconClass)} />
          <div className="min-w-0">
            <p className="text-2xl font-semibold tabular-nums leading-none">{c.value}</p>
            <p className="text-[11px] text-muted-foreground mt-1 leading-tight">{c.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
