import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

interface TableSkeletonProps {
  /** Linhas exibidas no skeleton */
  rows?: number;
  /** Colunas exibidas no skeleton */
  columns?: number;
  /** Mostrar barra de header */
  showHeader?: boolean;
  className?: string;
}

/**
 * Skeleton genérico para tabelas/listas em estado de carregamento.
 * Usa apenas tokens semânticos (bg-muted) — sem cores hardcoded.
 */
export function TableSkeleton({
  rows = 6,
  columns = 5,
  showHeader = true,
  className,
}: TableSkeletonProps) {
  return (
    <div
      className={cn("w-full space-y-3", className)}
      role="status"
      aria-busy="true"
      aria-label="Carregando dados"
    >
      {showHeader && (
        <div
          className="grid gap-3 pb-3 border-b border-border"
          style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: columns }).map((_, i) => (
            <Skeleton key={`h-${i}`} className="h-4 w-3/4" />
          ))}
        </div>
      )}
      <div className="space-y-2">
        {Array.from({ length: rows }).map((_, r) => (
          <div
            key={`r-${r}`}
            className="grid gap-3 py-2"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {Array.from({ length: columns }).map((_, c) => (
              <Skeleton
                key={`r-${r}-c-${c}`}
                className={cn("h-4", c === 0 ? "w-5/6" : "w-2/3")}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
