import { Skeleton } from "@/components/ui/skeleton";

export function ProjetoKanbanSkeleton() {
  return (
    <div className="space-y-3">
      {/* Arrow progress skeleton */}
      <div className="flex gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-9 flex-1 rounded-md" />
        ))}
      </div>
      
      {/* Columns skeleton */}
      <div className="flex gap-3 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="w-[290px] flex-shrink-0 rounded-xl border border-border/60 bg-muted/20 p-3 space-y-3">
            {/* Header */}
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <div className="flex gap-2">
                <Skeleton className="h-3 w-16" />
                <Skeleton className="h-3 w-12" />
              </div>
            </div>
            {/* Cards */}
            {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
              <Skeleton key={j} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
