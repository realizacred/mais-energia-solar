/**
 * Block Action Bar — Floating toolbar on selected blocks
 */

import { Trash2, Copy, ArrowUp, ArrowDown, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface BlockActionBarProps {
  blockType: string;
  isVisible: boolean;
  canMoveUp: boolean;
  canMoveDown: boolean;
  onDelete: () => void;
  onDuplicate: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onToggleVisibility: () => void;
}

export function BlockActionBar({
  blockType,
  isVisible,
  canMoveUp,
  canMoveDown,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onToggleVisibility,
}: BlockActionBarProps) {
  return (
    <div
      className="absolute -top-8 right-1 z-20 flex items-center gap-0.5 bg-card border border-border rounded-md shadow-md px-1 py-0.5"
      onClick={e => e.stopPropagation()}
    >
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveUp} disabled={!canMoveUp}>
            <ArrowUp className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">Mover acima</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onMoveDown} disabled={!canMoveDown}>
            <ArrowDown className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">Mover abaixo</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDuplicate}>
            <Copy className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">Duplicar</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onToggleVisibility}>
            {isVisible ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3 text-destructive" />}
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">{isVisible ? "Ocultar" : "Mostrar"}</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-[10px]">Excluir</TooltipContent>
      </Tooltip>
    </div>
  );
}
