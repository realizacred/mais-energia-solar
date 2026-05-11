/**
 * Banner superior de oportunidades — sumariza a Inbox de recuperação.
 *
 * Total e valor potencial vêm do servidor (RPC get_followup_inbox_summary)
 * para refletir TODA a base que bate nos filtros — não apenas a página visível.
 * "Quentes" e "Críticas" continuam derivando das linhas carregadas (página atual).
 */
import { Flame, AlertTriangle, Sparkles, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { FollowupInboxRow } from "@/hooks/useFollowupComercial";

function formatBRL(v: number) {
  return v.toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  });
}

interface Props {
  rows: FollowupInboxRow[];
  totalReal?: number;
  valorPotencialReal?: number;
}

export function OpportunityBanner({ rows, totalReal, valorPotencialReal }: Props) {
  const valorPotencial =
    valorPotencialReal ?? rows.reduce((acc, r) => acc + (Number(r.valor_total) || 0), 0);
  const quentes = rows.filter((r) => r.temperatura === "quente").length;
  const criticas = rows.filter((r) => (r.dias_parado ?? 0) >= 30).length;
  const total = totalReal ?? rows.length;

  return (
    <Card className="overflow-hidden border-l-[3px] border-l-primary bg-gradient-to-br from-primary/5 via-background to-background">
      <CardContent className="p-4 md:p-5">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="rounded-lg bg-primary/10 p-2.5 shrink-0">
              <TrendingUp className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Valor potencial em recuperação
              </div>
              <div className="text-2xl md:text-3xl font-bold text-foreground tabular-nums leading-tight">
                {formatBRL(valorPotencial)}
              </div>
              <div className="text-xs text-muted-foreground mt-0.5">
                Distribuído em {total} proposta{total === 1 ? "" : "s"} ativa{total === 1 ? "" : "s"}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 md:gap-5 md:border-l md:border-border md:pl-5">
            <Stat
              icon={<Flame className="h-4 w-4 text-success" />}
              label="Quentes"
              value={quentes}
              tone="text-success"
            />
            <Stat
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
              label="Críticas 30d+"
              value={criticas}
              tone="text-destructive"
            />
            <div className="flex flex-col items-start md:items-center justify-center">
              <Badge
                variant="outline"
                className="gap-1 border-info/40 bg-info/5 text-info-foreground text-[10px]"
              >
                <Sparkles className="h-3 w-3" /> IA monitorando
              </Badge>
              <span className="text-[10px] text-muted-foreground mt-1">
                Sugestões em cada envio
              </span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="flex flex-col items-start md:items-center">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className={`text-lg md:text-xl font-bold tabular-nums ${tone}`}>{value}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground mt-0.5">
        {label}
      </span>
    </div>
  );
}
