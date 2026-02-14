import { Sparkles, Loader2 } from "lucide-react";
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
}

export function WritingAssistantButton({
  onAction,
  isLoading,
  disabled,
}: WritingAssistantButtonProps) {
  if (isLoading) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-primary" disabled>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Processando...
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-primary"
              disabled={disabled}
            >
              <Sparkles className="h-3.5 w-3.5" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs">
          Assistente de escrita
        </TooltipContent>
      </Tooltip>
      <DropdownMenuContent side="top" align="start" className="w-52">
        {WRITING_ACTIONS.map((a) => (
          <DropdownMenuItem
            key={a.key}
            onClick={() => onAction(a.key)}
            className="text-xs gap-2 cursor-pointer"
          >
            <span>{a.emoji}</span>
            <span>{a.label}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
