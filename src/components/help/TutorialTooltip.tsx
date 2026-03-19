/**
 * Contextual tutorial tooltip for onboarding steps.
 * §22: Botões shadcn obrigatórios
 */

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronRight, X } from "lucide-react";

export interface TutorialStep {
  titulo: string;
  descricao: string;
  acao?: string;
}

interface Props {
  steps: TutorialStep[];
  currentStep: number;
  onNext: () => void;
  onSkip: () => void;
  isOpen: boolean;
  children: React.ReactNode;
}

export function TutorialTooltip({
  steps,
  currentStep,
  onNext,
  onSkip,
  isOpen,
  children,
}: Props) {
  if (!steps[currentStep]) return <>{children}</>;

  const step = steps[currentStep];

  return (
    <Popover open={isOpen}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        className="w-80 p-4 bg-card border-border shadow-lg"
        side="bottom"
        align="center"
      >
        <div className="flex items-center justify-between mb-2">
          <Badge variant="outline" className="text-[10px]">
            Passo {currentStep + 1} de {steps.length}
          </Badge>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onSkip}
          >
            <X className="w-3 h-3" />
          </Button>
        </div>

        <h4 className="font-semibold text-foreground mb-1">{step.titulo}</h4>
        <p className="text-sm text-muted-foreground mb-3">{step.descricao}</p>

        {step.acao && (
          <p className="text-xs text-primary mb-3 font-medium">
            👉 {step.acao}
          </p>
        )}

        <div className="flex justify-between">
          <Button variant="ghost" size="sm" onClick={onSkip}>
            Pular
          </Button>
          <Button size="sm" onClick={onNext} className="gap-1">
            {currentStep === steps.length - 1 ? "Concluir" : "Próximo"}
            <ChevronRight className="w-3 h-3" />
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
