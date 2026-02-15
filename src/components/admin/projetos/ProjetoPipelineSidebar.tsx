import { cn } from "@/lib/utils";
import { Layers, Search, UserSearch, FileCheck, DollarSign, Wrench } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useIsMobile } from "@/hooks/use-mobile";
import type { Pipeline } from "@/hooks/useDealPipeline";

interface Props {
  pipelines: Pipeline[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

// Map pipeline names to icons based on common solar industry patterns
function getPipelineIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower.includes("sdr") || lower.includes("prospecção") || lower.includes("prospeccao")) return Search;
  if (lower.includes("venda") || lower.includes("comercial")) return UserSearch;
  if (lower.includes("técnico") || lower.includes("tecnico") || lower.includes("estudo")) return FileCheck;
  if (lower.includes("financ")) return DollarSign;
  if (lower.includes("instalação") || lower.includes("instalacao") || lower.includes("pós") || lower.includes("pos")) return Wrench;
  return Layers;
}

export function ProjetoPipelineSidebar({ pipelines, selectedId, onSelect }: Props) {
  const isMobile = useIsMobile();
  const activePipelines = pipelines.filter(p => p.is_active);

  // Hide sidebar on mobile (tabs handle navigation there)
  if (isMobile || activePipelines.length <= 1) return null;

  return (
    <div className="w-14 shrink-0 hidden lg:flex flex-col gap-1 pt-1">
      {activePipelines.map(pipeline => {
        const Icon = getPipelineIcon(pipeline.name);
        const isSelected = selectedId === pipeline.id;

        return (
          <Tooltip key={pipeline.id}>
            <TooltipTrigger asChild>
              <button
                onClick={() => onSelect(pipeline.id)}
                className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all border",
                  isSelected
                    ? "bg-primary/10 border-primary/30 text-primary shadow-sm"
                    : "bg-muted/30 border-border/40 text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <Icon className="h-4.5 w-4.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right" className="text-xs font-medium">
              {pipeline.name}
            </TooltipContent>
          </Tooltip>
        );
      })}
    </div>
  );
}
