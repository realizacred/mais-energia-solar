/**
 * MigrationKpiCards — KPIs do Centro de Migração com mini-tendência (últimos 7 jobs).
 */
import type { MigrationJobRow } from "@/hooks/useMigrationJobs";
import { cn } from "@/lib/utils";
import { Activity, CheckCircle2, AlertTriangle, Database } from "lucide-react";

interface Props {
  jobs: MigrationJobRow[];
}

function Sparkline({ values, tone = "text-primary" }: { values: number[]; tone?: string }) {
  if (values.length === 0) return <div className="h-6" />;
  const max = Math.max(1, ...values);
  const w = 80;
  const h = 24;
  const step = w / Math.max(1, values.length - 1);
  const pts = values
    .map((v, i) => `${i * step},${h - (v / max) * h}`)
    .join(" ");
  return (
    <svg width={w} height={h} className={cn("overflow-visible", tone)}>
      <polyline
        points={pts}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function durationMin(j: MigrationJobRow): number | null {
  if (!j.started_at || !j.completed_at) return null;
  const ms = new Date(j.completed_at).getTime() - new Date(j.started_at).getTime();
  return ms > 0 ? ms / 60000 : null;
}

export function MigrationKpiCards({ jobs }: Props) {
  const total = jobs.length;
  const running = jobs.filter((j) => j.status === "running" || j.status === "pending").length;
  const completed = jobs.filter((j) => j.status === "completed").length;
  const failed = jobs.filter((j) => j.status === "failed").length;
  const successRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  const last7 = [...jobs]
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .slice(-7);

  const trendCompleted = last7.map((j) => (j.status === "completed" ? 1 : 0));
  const trendFailed = last7.map((j) => (j.status === "failed" ? 1 : 0));
  const durations = last7.map((j) => durationMin(j) ?? 0);
  const avgDuration =
    durations.filter((d) => d > 0).reduce((a, b) => a + b, 0) /
    Math.max(1, durations.filter((d) => d > 0).length);

  const cards = [
    {
      label: "Total de jobs",
      value: total,
      sub: `${running} ativos`,
      icon: Database,
      tone: "text-foreground",
      spark: last7.map((_, i) => i + 1),
    },
    {
      label: "Taxa de sucesso",
      value: `${successRate}%`,
      sub: `${completed} concluídos`,
      icon: CheckCircle2,
      tone: "text-success",
      spark: trendCompleted,
    },
    {
      label: "Falhas",
      value: failed,
      sub: failed > 0 ? "requer atenção" : "tudo ok",
      icon: AlertTriangle,
      tone: failed > 0 ? "text-destructive" : "text-muted-foreground",
      spark: trendFailed,
    },
    {
      label: "Duração média",
      value: avgDuration > 0 ? `${avgDuration.toFixed(1)} min` : "—",
      sub: `últimos ${last7.length}`,
      icon: Activity,
      tone: "text-primary",
      spark: durations,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {cards.map((c) => {
        const Icon = c.icon;
        return (
          <div
            key={c.label}
            className="rounded-lg border bg-card p-3 flex items-start justify-between gap-2"
          >
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                <Icon className="h-3.5 w-3.5" />
                <span className="truncate">{c.label}</span>
              </div>
              <p className={cn("text-2xl font-semibold tabular-nums leading-tight mt-1", c.tone)}>
                {c.value}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
            </div>
            <Sparkline values={c.spark} tone={c.tone} />
          </div>
        );
      })}
    </div>
  );
}
