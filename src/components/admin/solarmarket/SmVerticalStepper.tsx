/**
 * SmVerticalStepper — Animated vertical stepper for migration steps.
 * Uses framer-motion for state transitions and shimmer for processing.
 */
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import { Check, Loader2, X, Clock, SkipForward } from "lucide-react";

type StepState = "pending" | "running" | "done" | "error" | "skipped";

interface StepItem {
  name: string;
  label: string;
  icon: React.ElementType;
  state: StepState;
  detail?: string;
}

interface SmVerticalStepperProps {
  steps: StepItem[];
  className?: string;
}

function StepStatusIcon({ state }: { state: StepState }) {
  const base = "h-4 w-4";
  switch (state) {
    case "running":
      return <Loader2 className={cn(base, "text-primary animate-spin")} />;
    case "done":
      return (
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400 }}>
          <Check className={cn(base, "text-success")} />
        </motion.div>
      );
    case "error":
      return <X className={cn(base, "text-destructive")} />;
    case "skipped":
      return <SkipForward className={cn(base, "text-muted-foreground/50")} />;
    default:
      return <Clock className={cn(base, "text-muted-foreground/30")} />;
  }
}

export function SmVerticalStepper({ steps, className }: SmVerticalStepperProps) {
  return (
    <div className={cn("space-y-0.5", className)}>
      {steps.map((step, idx) => {
        const isLast = idx === steps.length - 1;
        return (
          <motion.div
            key={step.name}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.04, duration: 0.25 }}
            className="flex gap-3"
          >
            {/* Connector line + icon */}
            <div className="flex flex-col items-center w-8 shrink-0">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300",
                  step.state === "running" && "border-primary bg-primary/10 shadow-sm shadow-primary/20",
                  step.state === "done" && "border-success bg-success/10",
                  step.state === "error" && "border-destructive bg-destructive/10",
                  step.state === "skipped" && "border-border bg-muted/30",
                  step.state === "pending" && "border-border bg-muted/10",
                )}
              >
                <StepStatusIcon state={step.state} />
              </div>
              {!isLast && (
                <div className={cn(
                  "w-px flex-1 min-h-[16px] transition-colors duration-300",
                  step.state === "done" ? "bg-success/40" :
                  step.state === "error" ? "bg-destructive/30" :
                  "bg-border"
                )} />
              )}
            </div>

            {/* Content */}
            <div className={cn(
              "flex-1 min-w-0 pb-3 rounded-lg px-3 py-2 transition-all duration-200",
              step.state === "running" && "bg-primary/5 border border-primary/15",
              step.state === "error" && "bg-destructive/5",
            )}>
              <p className={cn(
                "text-xs font-semibold",
                step.state === "running" ? "text-primary" :
                step.state === "done" ? "text-foreground" :
                step.state === "error" ? "text-destructive" :
                "text-muted-foreground"
              )}>
                {step.label}
              </p>

              <AnimatePresence mode="wait">
                {step.state === "running" && !step.detail && (
                  <motion.div
                    key="shimmer"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="mt-1.5 space-y-1"
                  >
                    <div className="h-2.5 w-3/4 rounded-sm bg-primary/10 animate-pulse" />
                    <div className="h-2.5 w-1/2 rounded-sm bg-primary/10 animate-pulse" />
                  </motion.div>
                )}
                {step.detail && (
                  <motion.p
                    key="detail"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="text-[10px] text-muted-foreground mt-0.5 truncate"
                  >
                    {step.detail}
                  </motion.p>
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
