/**
 * BlocoDistribuicao — Read-only distribution from sm_project_classification.
 * Sem inputs. Reflete exatamente onde os projetos elegíveis serão direcionados.
 */
import { GitBranch } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { SectionCard, EmptyState } from "@/components/ui-kit";
import type { DistributionRow } from "@/hooks/useSmMigrationV3";

interface Props {
  rows: DistributionRow[] | undefined;
  isLoading: boolean;
}

export function BlocoDistribuicao({ rows, isLoading }: Props) {
  return (
    <SectionCard
      icon={GitBranch}
      title="Distribuição automática"
      description="Funil/etapa que cada projeto receberá ao aplicar a migração. Calculado por classify-sm-projects."
      variant="neutral"
    >
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-9 w-full rounded-md" />
          ))}
        </div>
      ) : !rows || rows.length === 0 ? (
        <EmptyState
          icon={GitBranch}
          title="Nenhuma classificação ainda"
          description='Rode "Classificar" para calcular a distribuição automática.'
        />
      ) : (
        <ul className="divide-y divide-border rounded-md border bg-card">
          {rows.map((r) => (
            <li
              key={`${r.funilNome}::${r.etapaNome}`}
              className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant="outline" className="text-[10px] shrink-0">{r.funilNome}</Badge>
                <span className="text-muted-foreground">/</span>
                <span className="truncate">{r.etapaNome}</span>
              </div>
              <span className="tabular-nums text-sm font-medium">{r.total}</span>
            </li>
          ))}
        </ul>
      )}
    </SectionCard>
  );
}
