import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { WRITING_ACTIONS, type WritingAction } from "@/hooks/useWritingAssistant";

interface WritingAssistantButtonProps {
  onAction: (action: WritingAction) => void;
  isLoading: boolean;
  disabled: boolean;
  /** Currently active (toggled-on) action */
  activeAction: WritingAction | null;
  /** Called when user toggles off the active action */
  onDeactivate: () => void;
}

export function WritingAssistantButton({
  onAction,
  isLoading,
  disabled,
  activeAction,
  onDeactivate,
}: WritingAssistantButtonProps) {
  const isDisabled = disabled || isLoading;
  const isActive = activeAction !== null;

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className={`h-7 w-7 transition-colors ${
                isActive
                  ? "text-warning bg-warning/15 hover:bg-warning/25"
                  : "text-muted-foreground hover:text-primary"
              }`}
              disabled={isDisabled}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          {isLoading
            ? "Processando..."
            : isActive
            ? `Ativo: ${WRITING_ACTIONS.find((a) => a.key === activeAction)?.label || activeAction}`
            : "Assistente de escrita"}
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="top" align="start" className="w-56">
        {WRITING_ACTIONS.map((a) => {
          const isSelected = activeAction === a.key;
          return (
            <DropdownMenuItem
              key={a.key}
              onClick={() => {
                if (isSelected) {
                  onDeactivate();
                } else {
                  onAction(a.key);
                }
              }}
              className={`text-xs gap-2 cursor-pointer ${
                isSelected
                  ? "bg-warning/10 text-warning font-medium"
                  : ""
              }`}
            >
              <span>{a.emoji}</span>
              <span className="flex-1">{a.label}</span>
              {isSelected && (
                <span className="text-[10px] text-warning/70">✓ ativo</span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
