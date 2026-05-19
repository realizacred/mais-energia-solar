import { useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Clock,
  Construction,
  FileText,
  Building2,
  Truck,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatBRLCompact as formatBRL } from "@/lib/formatters";
import type { ProjetoItem, ProjetoEtapa } from "@/hooks/useProjetoPipeline";
import { differenceInDays } from "date-fns";

interface Props {
  projetos: ProjetoItem[];
  etapas: ProjetoEtapa[];
}

type Tone = "info" | "warning" | "secondary" | "primary";

interface Bucket {
  count: number;
  value: number;
  avgDays: number;
  daysTotal: number;
}

const TONE: Record<Tone, { border: string; bg: string; icon: string; bar: string }> = {
  info:      { border: "border-l-info",      bg: "bg-info/10",      icon: "text-info",      bar: "bg-info" },
  warning:   { border: "border-l-warning",   bg: "bg-warning/10",   icon: "text-warning",   bar: "bg-warning" },
  secondary: { border: "border-l-secondary", bg: "bg-secondary/10", icon: "text-secondary", bar: "bg-secondary" },
  primary:   { border: "border-l-primary",   bg: "bg-primary/10",   icon: "text-primary",   bar: "bg-primary" },
};

export function BottleneckCenter({ projetos, etapas }: Props) {
  const bottlenecks = useMemo(() => {
    const stats: Record<string, Bucket> = {
      engenharia:     { count: 0, value: 0, avgDays: 0, daysTotal: 0 },
      documentos:     { count: 0, value: 0, avgDays: 0, daysTotal: 0 },
      concessionaria: { count: 0, value: 0, avgDays: 0, daysTotal: 0 },
      instalacao:     { count: 0, value: 0, avgDays: 0, daysTotal: 0 },
    };

    const now = new Date();

    projetos.forEach((p) => {
      const etapa = etapas.find((e) => e.id === p.etapa_id);
      if (!etapa || etapa.categoria !== "aberto") return;

      const stageName = etapa.nome.toLowerCase();
      const days = differenceInDays(now, new Date(p.data_entrada_etapa || p.updated_at));
      const value = p.valor_total || 0;

      const add = (key: keyof typeof stats) => {
        stats[key].count++;
        stats[key].value += value;
        stats[key].daysTotal += days;
      };

      if (stageName.includes("engenharia") || stageName.includes("projeto técnico")) add("engenharia");
      else if (stageName.includes("documento") || stageName.includes("contrato") || stageName.includes("assinatura")) add("documentos");
      else if (stageName.includes("concessionária") || stageName.includes("vistoria") || stageName.includes("parecer")) add("concessionaria");
      else if (stageName.includes("instalação") || stageName.includes("obra")) add("instalacao");
    });

    (Object.keys(stats) as (keyof typeof stats)[]).forEach((k) => {
      stats[k].avgDays = stats[k].count > 0 ? Math.round(stats[k].daysTotal / stats[k].count) : 0;
    });

    return stats;
  }, [projetos, etapas]);

  const cards: Array<{ title: string; icon: LucideIcon; bucket: Bucket; tone: Tone }> = [
    { title: "Engenharia",     icon: Construction, bucket: bottlenecks.engenharia,     tone: "info" },
    { title: "Documentação",   icon: FileText,     bucket: bottlenecks.documentos,     tone: "warning" },
    { title: "Concessionária", icon: Building2,    bucket: bottlenecks.concessionaria, tone: "secondary" },
    { title: "Instalação",     icon: Truck,        bucket: bottlenecks.instalacao,     tone: "primary" },
  ];

  const hasAny = cards.some((c) => c.bucket.count > 0);
  if (!hasAny) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold uppercase tracking-wider text-foreground">
          Gargalos Operacionais
        </h3>
        <span className="text-[11px] text-muted-foreground font-medium">
          Onde a receita está parada agora
        </span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {cards.map((c) => (
          <BottleneckCard key={c.title} {...c} />
        ))}
      </div>
    </div>
  );
}

function BottleneckCard({
  title,
  icon: Icon,
  bucket,
  tone,
}: {
  title: string;
  icon: LucideIcon;
  bucket: Bucket;
  tone: Tone;
}) {
  const t = TONE[tone];
  const isEmpty = bucket.count === 0;
  const severity =
    bucket.avgDays > 10 ? "text-destructive" : bucket.avgDays > 5 ? "text-warning" : "text-foreground";

  return (
    <Card className={cn("border border-border bg-card border-l-[3px] shadow-sm", t.border, isEmpty && "opacity-60")}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <div className={cn("h-8 w-8 rounded-md flex items-center justify-center shrink-0", t.bg)}>
              <Icon className={cn("h-4 w-4", t.icon)} />
            </div>
            <span className="text-[11px] font-bold uppercase tracking-wide text-muted-foreground truncate">
              {title}
            </span>
          </div>
          <Badge variant="secondary" className="font-bold tabular-nums">
            {bucket.count}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground">Travado</span>
            <span className="text-base font-bold tabular-nums text-foreground truncate">
              {formatBRL(bucket.value)}
            </span>
          </div>
          <div className="flex items-baseline justify-between gap-2">
            <span className="text-[10px] uppercase tracking-wide font-semibold text-muted-foreground inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              Média parado
            </span>
            <span className={cn("text-sm font-bold tabular-nums", severity)}>
              {bucket.avgDays}d
            </span>
          </div>
        </div>

        <div className="w-full bg-muted rounded-full h-1 overflow-hidden">
          <div
            className={cn("h-full rounded-full transition-all", t.bar)}
            style={{ width: `${Math.min(100, bucket.avgDays * 5)}%` }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
