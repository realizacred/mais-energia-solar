import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  label: string;
  description: string;
}

interface WizardStepperProps {
  steps: Step[];
  currentStep: number;
}

export function WizardStepper({ steps, currentStep }: WizardStepperProps) {
  return (
    <div className="flex items-center gap-0 w-full px-2">
      {steps.map((step, i) => {
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        return (
          <div key={i} className="flex items-center flex-1 last:flex-none">
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full border-2 text-xs font-bold shrink-0 transition-all",
                  isActive && "border-primary bg-primary text-primary-foreground",
                  isDone && "border-primary bg-primary/10 text-primary",
                  !isActive && !isDone && "border-border bg-card text-muted-foreground",
                )}
              >
                {isDone ? <Check className="h-4 w-4" /> : i + 1}
              </div>
              <div className="hidden sm:block min-w-0">
                <p className={cn("text-xs font-semibold leading-tight", isActive ? "text-foreground" : "text-muted-foreground")}>
                  {step.label}
                </p>
                <p className="text-[10px] text-muted-foreground leading-tight truncate">{step.description}</p>
              </div>
            </div>
            {i < steps.length - 1 && (
              <div className={cn("flex-1 h-0.5 mx-3", isDone ? "bg-primary" : "bg-border")} />
            )}
          </div>
        );
      })}
    </div>
  );
}
