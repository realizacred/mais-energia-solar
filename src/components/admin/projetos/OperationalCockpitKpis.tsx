import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import {
  Lock,
  Clock,
  ShieldAlert,
  Zap,
  CircleDollarSign,
  FolderKanban,
  type LucideIcon,
} from "lucide-react";
import { formatBRLCompact } from "@/lib/formatters";

interface CockpitKpis {
  blocked: number;
  overdueSLA: number;
  criticalToday: number;
  awaitingUtility: number;
  revenueLocked: number;
  activeProjects: number;
}

interface Props {
  kpis: CockpitKpis;
}

type Tone = "destructive" | "warning" | "info" | "primary" | "success" | "secondary";

interface KpiDef {
  key: keyof CockpitKpis;
  label: string;
  hint: string;
  icon: LucideIcon;
  tone: Tone;
  format?: (n: number) => string;
  pulse?: boolean;
}

const TONE: Record<Tone, { border: string; bg: string; icon: string; ring: string }> = {
  destructive: { border: "border-l-destructive", bg: "bg-destructive/10", icon: "text-destructive", ring: "ring-destructive/20" },
  warning:     { border: "border-l-warning",     bg: "bg-warning/10",     icon: "text-warning",     ring: "ring-warning/20" },
  info:        { border: "border-l-info",        bg: "bg-info/10",        icon: "text-info",        ring: "ring-info/20" },
  primary:     { border: "border-l-primary",     bg: "bg-primary/10",     icon: "text-primary",     ring: "ring-primary/20" },
  success:     { border: "border-l-success",     bg: "bg-success/10",     icon: "text-success",     ring: "ring-success/20" },
  secondary:   { border: "border-l-secondary",   bg: "bg-secondary/10",   icon: "text-secondary",   ring: "ring-secondary/20" },
};

export function OperationalCockpitKpis({ kpis }: Props) {
  const items: KpiDef[] = [
    { key: "criticalToday",    label: "Críticos",        hint: "Atenção imediata",         icon: ShieldAlert,      tone: "destructive", pulse: kpis.criticalToday > 0 },
    { key: "blocked",          label: "Bloqueados",      hint: "Fluxo impedido",            icon: Lock,             tone: "destructive" },
    { key: "overdueSLA",       label: "SLA Vencido",     hint: "Tempo de etapa estourado",  icon: Clock,            tone: "warning" },
    { key: "awaitingUtility",  label: "Concessionária",  hint: "Vistoria ou parecer",       icon: Zap,              tone: "info" },
    { key: "revenueLocked",    label: "Receita Travada", hint: "Valor em risco operacional", icon: CircleDollarSign, tone: "warning", format: formatBRLCompact },
    { key: "activeProjects",   label: "Projetos Ativos", hint: "Em execução agora",         icon: FolderKanban,     tone: "primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
      {items.map((it) => {
        const value = kpis[it.key];
        const tone = TONE[it.tone];
        const display = it.format ? it.format(value as number) : String(value);
        const isZero = !value || value === 0;

        return (
          <Card
            key={it.key}
            className={cn(
              "border border-border bg-card border-l-[3px] shadow-sm transition-all",
              tone.border,
              isZero && "opacity-60",
              it.pulse && "ring-2 ring-offset-1 ring-offset-background animate-pulse",
              it.pulse && tone.ring,
            )}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center shrink-0", tone.bg)}>
                <it.icon className={cn("h-5 w-5", tone.icon)} />
              </div>
              <div className="min-w-0">
                <p className="text-xl font-bold tracking-tight text-foreground leading-none tabular-nums truncate">
                  {display}
                </p>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground mt-1 truncate">
                  {it.label}
                </p>
                <p className="text-[10px] text-muted-foreground/70 truncate hidden lg:block">
                  {it.hint}
                </p>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
