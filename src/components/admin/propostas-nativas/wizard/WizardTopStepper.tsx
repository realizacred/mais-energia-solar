import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

export interface WizardTopStep {
  key: string;
  label: string;
  icon: LucideIcon;
}

interface WizardTopStepperProps {
  steps: WizardTopStep[];
  currentStep: number;
  onStepClick: (index: number) => void;
}

/**
 * Stepper horizontal premium — substitui a sidebar vertical pobre.
 * - Compacto, denso, com progresso claro
 * - Etapas anteriores são clicáveis (voltar)
 * - Etapas futuras são bloqueadas (precisa avançar)
 * - Responsivo: scroll horizontal em telas pequenas
 */
export function WizardTopStepper({ steps, currentStep, onStepClick }: WizardTopStepperProps) {
  const progress = ((currentStep + 1) / steps.length) * 100;

  return (
    <div className="w-full">
      {/* Progress bar fina (linha contínua) */}
      <div className="relative h-1 bg-border/40 rounded-full overflow-hidden mb-4">
        <div
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-primary to-primary/70 transition-all duration-500 ease-out"
          style={{ width: `${progress}%` }}
        />
      </div>

      {/* Stepper items */}
      <div className="flex items-center gap-1 overflow-x-auto no-scrollbar -mx-1 px-1">
        {steps.map((step, i) => {
          const Icon = step.icon;
          const isActive = i === currentStep;
          const isDone = i < currentStep;
          const isClickable = isDone;

          return (
            <div key={step.key} className="flex items-center shrink-0">
              <button
                type="button"
                onClick={() => isClickable && onStepClick(i)}
                disabled={!isClickable && !isActive}
                className={cn(
                  "group flex items-center gap-2 px-3 py-2 rounded-lg transition-all whitespace-nowrap",
                  isActive && "bg-primary/10 ring-1 ring-primary/30",
                  isDone && "hover:bg-muted/60 cursor-pointer",
                  !isActive && !isDone && "opacity-50",
                )}
              >
                <div
                  className={cn(
                    "flex items-center justify-center h-6 w-6 rounded-full border-2 shrink-0 transition-all",
                    isActive && "border-primary bg-primary text-primary-foreground shadow-sm shadow-primary/30",
                    isDone && "border-primary bg-primary text-primary-foreground",
                    !isActive && !isDone && "border-border bg-background text-muted-foreground",
                  )}
                >
                  {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                </div>
                <div className="flex flex-col items-start leading-tight">
                  <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground/80">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <span
                    className={cn(
                      "text-xs font-bold",
                      isActive && "text-foreground",
                      isDone && "text-primary",
                      !isActive && !isDone && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                  </span>
                </div>
              </button>

              {/* Conector visual (apenas decorativo entre etapas) */}
              {i < steps.length - 1 && (
                <div
                  className={cn(
                    "h-px w-2 mx-0.5 shrink-0",
                    i < currentStep ? "bg-primary/50" : "bg-border/40",
                  )}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
