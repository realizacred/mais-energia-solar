import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface WizardStep {
  key: string;
  label: string;
  icon: LucideIcon;
  conditional?: boolean;
}

interface WizardSidebarProps {
  steps: WizardStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
  totalLabel?: string;
}

export function WizardSidebar({ steps, currentStep, onStepClick, totalLabel }: WizardSidebarProps) {
  return (
    <div className="flex flex-col gap-0 py-2">
      {steps.map((step, i) => {
        const Icon = step.icon;
        const isActive = i === currentStep;
        const isDone = i < currentStep;
        const isClickable = isDone;

        return (
          <div key={step.key} className="flex items-stretch gap-3">
            {/* Vertical line + dot */}
            <div className="flex flex-col items-center w-6 shrink-0">
              {/* Dot */}
              <button
                onClick={() => isClickable && onStepClick(i)}
                disabled={!isClickable}
                className={cn(
                  "relative z-10 flex items-center justify-center h-6 w-6 rounded-full border-2 transition-all shrink-0",
                  isActive && "border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20",
                  isDone && "border-primary bg-primary text-primary-foreground cursor-pointer hover:shadow-md",
                  !isActive && !isDone && "border-border bg-card text-muted-foreground",
                )}
              >
                {isDone ? (
                  <Check className="h-3 w-3" />
                ) : (
                  <Icon className="h-3 w-3" />
                )}
              </button>
              {/* Line connector */}
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "w-0.5 flex-1 min-h-[20px]",
                    i < currentStep ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>

            {/* Label */}
            <button
              onClick={() => isClickable && onStepClick(i)}
              disabled={!isClickable}
              className={cn(
                "text-left text-xs font-medium py-1.5 transition-colors",
                isActive && "text-foreground font-bold",
                isDone && "text-primary cursor-pointer hover:text-primary/80",
                !isActive && !isDone && "text-muted-foreground",
              )}
            >
              {step.label}
            </button>
          </div>
        );
      })}

      {/* Step counter */}
      {totalLabel && (
        <div className="mt-3 pt-3 border-t border-border/50 text-right">
          <span className="text-[10px] font-mono text-primary font-bold">{totalLabel}</span>
        </div>
      )}
    </div>
  );
}
