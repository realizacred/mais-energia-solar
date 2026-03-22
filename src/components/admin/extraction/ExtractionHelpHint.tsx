import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface ExtractionHelpHintProps {
  text: string;
}

export function ExtractionHelpHint({ text }: ExtractionHelpHintProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-5 w-5 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
          >
            <Info className="h-3.5 w-3.5" />
          </Button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[260px] text-xs leading-relaxed">
          {text}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
