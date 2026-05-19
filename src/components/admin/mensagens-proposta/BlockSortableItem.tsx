import React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { GripVertical, Settings2, Eye, Info, Smartphone, Mail, Globe, Variable } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { BlockConfig } from "@/hooks/useProposalMessageConfig";

interface Props {
  id: string;
  config: BlockConfig;
  label: string;
  description: string;
  suggestedVars: string[];
  onToggle: (enabled: boolean) => void;
  onEdit: () => void;
  previewContent: string;
}

export function BlockSortableItem({ id, config, label, description, suggestedVars, onToggle, onEdit, previewContent }: Props) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 0,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group relative bg-background border rounded-xl overflow-hidden transition-all duration-200",
        config.enabled ? "shadow-sm border-primary/20" : "opacity-60 grayscale border-muted-foreground/20",
        isDragging && "shadow-xl ring-2 ring-primary border-primary opacity-90 scale-[1.02] z-50 cursor-grabbing"
      )}
    >
      <div className="flex items-stretch min-h-[140px]">
        {/* Drag Handle */}
        <div 
          {...attributes} 
          {...listeners}
          className="w-10 flex items-center justify-center bg-muted/30 border-r group-hover:bg-muted/50 transition-colors cursor-grab active:cursor-grabbing"
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Content */}
        <div className="flex-1 p-4 flex flex-col gap-3">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-xl">{config.prefix || "📄"}</span>
                <h4 className="text-sm font-bold tracking-tight">{config.title || label}</h4>
                {config.enabled && <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 text-[9px] h-4 uppercase px-1 font-bold">Ativo</Badge>}
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed max-w-[280px]">{description}</p>
            </div>
            
            <div className="flex items-center gap-1.5 bg-muted/50 p-1 rounded-lg">
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-md hover:bg-background shadow-none" onClick={onEdit}>
                      <Settings2 className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Configurar bloco</TooltipContent>
                </Tooltip>
              </TooltipProvider>
              <Switch 
                checked={config.enabled} 
                onCheckedChange={onToggle} 
                className="scale-75 data-[state=checked]:bg-primary"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-auto">
            {/* Variables and Source */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Variable className="h-3 w-3 text-primary/60" />
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Variáveis</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {suggestedVars.slice(0, 3).map(v => (
                  <Badge key={v} variant="outline" className="text-[8px] font-mono px-1 py-0 h-4 bg-muted/20 border-muted-foreground/20">
                    {v}
                  </Badge>
                ))}
                {suggestedVars.length > 3 && (
                  <Badge variant="outline" className="text-[8px] px-1 py-0 h-4 bg-muted/20 border-muted-foreground/20">
                    +{suggestedVars.length - 3}
                  </Badge>
                )}
              </div>
            </div>

            {/* Preview Mini */}
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Eye className="h-3 w-3 text-primary/60" />
                <span className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider">Preview</span>
              </div>
              <div className="text-[10px] text-muted-foreground line-clamp-2 italic bg-muted/30 p-1.5 rounded border border-dashed leading-tight h-8 flex items-center">
                "{previewContent || "Vazio"}"
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-3 pt-2 border-t mt-1 opacity-70">
            <div className="flex items-center gap-1 text-[9px] font-medium">
              <Smartphone className="h-2.5 w-2.5" /> WhatsApp
            </div>
            <div className="flex items-center gap-1 text-[9px] font-medium">
              <Mail className="h-2.5 w-2.5" /> E-mail
            </div>
            <div className="flex items-center gap-1 text-[9px] font-medium ml-auto">
              <Globe className="h-2.5 w-2.5" /> Público
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
