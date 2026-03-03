import React from "react";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type DataOrigin = "ssot" | "raw";

const ORIGIN_CONFIG: Record<DataOrigin, { label: string; bg: string; text: string; tooltip: string }> = {
  ssot: {
    label: "SSOT",
    bg: "bg-primary/10",
    text: "text-primary",
    tooltip: "Dado consolidado pelo sistema com base nas métricas diárias persistidas.",
  },
  raw: {
    label: "RAW",
    bg: "bg-muted",
    text: "text-muted-foreground",
    tooltip: "Dado direto do provedor do inversor. Pode divergir momentaneamente do consolidado.",
  },
};

interface DataOriginBadgeProps {
  type: DataOrigin;
  className?: string;
}

export function DataOriginBadge({ type, className }: DataOriginBadgeProps) {
  const config = ORIGIN_CONFIG[type];
  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <span
            className={cn(
              "inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider cursor-help",
              config.bg,
              config.text,
              className
            )}
          >
            {config.label}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[240px] text-xs">
          {config.tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** Fixed footer legend explaining SSOT vs RAW */
export function DataOriginLegend() {
  return (
    <div className="flex items-center gap-4 px-4 py-2.5 rounded-xl bg-muted/30 border border-border/30 text-[11px] text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-primary" />
        <span className="font-medium">Sistema</span>
        <span>= dados consolidados</span>
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-muted-foreground" />
        <span className="font-medium">Inversor</span>
        <span>= dados diretos do provedor</span>
      </span>
    </div>
  );
}
