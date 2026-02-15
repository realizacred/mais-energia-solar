import { HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useTour } from "./TourProvider";

interface HelpButtonProps {
  className?: string;
}

export function HelpButton({ className }: HelpButtonProps) {
  const { startTour } = useTour();

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={className}
          onClick={() => startTour()}
          aria-label="Ajuda - Ver tutorial"
        >
          <HelpCircle className="h-4.5 w-4.5 text-muted-foreground hover:text-primary transition-colors" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p className="text-xs">Ver tutorial desta página</p>
      </TooltipContent>
    </Tooltip>
  );
}
