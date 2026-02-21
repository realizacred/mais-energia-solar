import { useMemo } from "react";
import { motion } from "framer-motion";
import {
  FileText,
  Cpu,
  ShieldCheck,
  Wrench,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

export interface ProgressStep {
  id: string;
  label: string;
  icon?: LucideIcon;
}

type StepState = "completed" | "current" | "upcoming";

interface ProjectProgressStepperProps {
  /** Ordered list of stages */
  steps: ProgressStep[];
  /** ID of the current active step */
  currentStepId: string;
  /** Optional className for the root container */
  className?: string;
}

/* ─── Default steps (solar workflow) ─── */

export const DEFAULT_SOLAR_STEPS: ProgressStep[] = [
  { id: "docs", label: "Documentação", icon: FileText },
  { id: "eng", label: "Engenharia", icon: Cpu },
  { id: "homol", label: "Homologação", icon: ShieldCheck },
  { id: "install", label: "Instalação", icon: Wrench },
  { id: "done", label: "Finalizado", icon: CheckCircle2 },
];

/* ─── Component ─── */

export function ProjectProgressStepper({
  steps = DEFAULT_SOLAR_STEPS,
  currentStepId,
  className,
}: ProjectProgressStepperProps) {
  const currentIndex = useMemo(
    () => Math.max(0, steps.findIndex((s) => s.id === currentStepId)),
    [steps, currentStepId]
  );

  const getState = (i: number): StepState =>
    i < currentIndex ? "completed" : i === currentIndex ? "current" : "upcoming";

  return (
    <div className={cn("w-full", className)}>
      {/* Desktop: horizontal stepper */}
      <div className="hidden sm:flex items-start gap-0 w-full">
        {steps.map((step, i) => {
          const state = getState(i);
          const isLast = i === steps.length - 1;
          return (
            <div key={step.id} className="flex items-start flex-1 min-w-0">
              <StepNode step={step} state={state} index={i} />
              {!isLast && <StepConnector completed={state === "completed"} />}
            </div>
          );
        })}
      </div>

      {/* Mobile: vertical stepper */}
      <div className="flex sm:hidden flex-col gap-0">
        {steps.map((step, i) => {
          const state = getState(i);
          const isLast = i === steps.length - 1;
          return (
            <div key={step.id} className="flex items-stretch gap-3">
              <div className="flex flex-col items-center">
                <StepNode step={step} state={state} index={i} compact />
                {!isLast && <VerticalConnector completed={state === "completed"} />}
              </div>
              <div className="pb-6 pt-1 min-w-0">
                <p
                  className={cn(
                    "text-sm font-medium truncate",
                    state === "current" && "text-primary",
                    state === "completed" && "text-success",
                    state === "upcoming" && "text-muted-foreground"
                  )}
                >
                  {step.label}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ─── Step Node (circle + icon) ─── */

function StepNode({
  step,
  state,
  index,
  compact,
}: {
  step: ProgressStep;
  state: StepState;
  index: number;
  compact?: boolean;
}) {
  const Icon = step.icon || FileText;
  const size = compact ? "h-9 w-9" : "h-10 w-10";
  const iconSize = compact ? "h-4 w-4" : "h-[18px] w-[18px]";

  return (
    <div className="flex flex-col items-center gap-1.5">
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: index * 0.08, duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        className={cn(
          "relative rounded-full flex items-center justify-center shrink-0 transition-all duration-250 ease-in-out",
          size,
          state === "completed" && "bg-success/15 ring-2 ring-success/30",
          state === "current" &&
            "bg-primary/12 ring-2 ring-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.15)]",
          state === "upcoming" && "bg-muted ring-1 ring-border"
        )}
      >
        {/* Soft inner highlight for current step */}
        {state === "current" && (
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background:
                "radial-gradient(circle at 35% 30%, hsl(var(--primary) / 0.1), transparent 60%)",
            }}
            animate={{ opacity: [0.5, 0.8, 0.5] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <Icon
          className={cn(
            iconSize,
            "relative z-10 transition-colors duration-200",
            state === "completed" && "text-success",
            state === "current" && "text-primary",
            state === "upcoming" && "text-muted-foreground/50"
          )}
          strokeWidth={state === "current" ? 2.25 : 1.75}
        />
      </motion.div>

      {/* Label — desktop only */}
      {!compact && (
        <motion.p
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.08 + 0.1, duration: 0.3 }}
          className={cn(
            "text-[11px] font-medium text-center leading-tight max-w-[80px] truncate",
            state === "current" && "text-primary font-semibold",
            state === "completed" && "text-success",
            state === "upcoming" && "text-muted-foreground/60"
          )}
        >
          {step.label}
        </motion.p>
      )}
    </div>
  );
}

/* ─── Horizontal Connector ─── */

function StepConnector({ completed }: { completed: boolean }) {
  return (
    <div className="flex-1 flex items-center pt-5 px-1">
      <div className="relative w-full h-[2px] bg-border/50 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-y-0 left-0 bg-success rounded-full"
          initial={{ width: "0%" }}
          animate={{ width: completed ? "100%" : "0%" }}
          transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}

/* ─── Vertical Connector ─── */

function VerticalConnector({ completed }: { completed: boolean }) {
  return (
    <div className="flex-1 flex justify-center py-0.5">
      <div className="relative w-[2px] min-h-[20px] bg-border/50 rounded-full overflow-hidden">
        <motion.div
          className="absolute inset-x-0 top-0 bg-success rounded-full"
          initial={{ height: "0%" }}
          animate={{ height: completed ? "100%" : "0%" }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
    </div>
  );
}
