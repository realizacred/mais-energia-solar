import { motion, AnimatePresence } from "framer-motion";
import { Check, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type StepStatus = "pending" | "active" | "completed" | "error";

export interface WizardStep {
  id: string;
  label: string;
  icon: React.ReactNode;
  status: StepStatus;
  detail?: string;
}

interface ImportWizardProgressProps {
  steps: WizardStep[];
  className?: string;
}

export function ImportWizardProgress({ steps, className }: ImportWizardProgressProps) {
  const completedCount = steps.filter(s => s.status === "completed").length;
  const activeIdx = steps.findIndex(s => s.status === "active");
  const progressPercent = steps.length > 1
    ? Math.round((completedCount / (steps.length - 1)) * 100)
    : 0;

  return (
    <div className={cn("w-full", className)}>
      {/* Track line */}
      <div className="relative mb-2">
        <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-gradient-to-r from-primary to-primary/70 rounded-full"
            initial={{ width: "0%" }}
            animate={{ width: `${progressPercent}%` }}
            transition={{ duration: 0.5, ease: "easeInOut" }}
          />
        </div>

        {/* Step nodes */}
        <div className="relative flex justify-between">
          {steps.map((step, i) => (
            <div key={step.id} className="flex flex-col items-center" style={{ width: `${100 / steps.length}%` }}>
              <motion.div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-300 z-10 bg-background",
                  step.status === "completed" && "bg-primary border-primary text-primary-foreground",
                  step.status === "active" && "border-primary text-primary shadow-md shadow-primary/20",
                  step.status === "error" && "bg-destructive border-destructive text-destructive-foreground",
                  step.status === "pending" && "border-muted-foreground/20 text-muted-foreground/40",
                )}
                animate={{ scale: step.status === "active" ? 1.15 : 1 }}
                transition={{ duration: 0.3 }}
              >
                <AnimatePresence mode="wait">
                  {step.status === "completed" && (
                    <motion.div
                      key="check"
                      initial={{ scale: 0, rotate: -90 }}
                      animate={{ scale: 1, rotate: 0 }}
                      exit={{ scale: 0 }}
                      transition={{ type: "spring", stiffness: 500, damping: 25 }}
                    >
                      <Check className="w-4 h-4" />
                    </motion.div>
                  )}
                  {step.status === "active" && (
                    <motion.div
                      key="loader"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <Loader2 className="w-4 h-4 animate-spin" />
                    </motion.div>
                  )}
                  {step.status === "error" && (
                    <motion.div
                      key="error"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0 }}
                    >
                      <XCircle className="w-4 h-4" />
                    </motion.div>
                  )}
                  {step.status === "pending" && (
                    <motion.span
                      key="icon"
                      className="text-[10px]"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                    >
                      {step.icon}
                    </motion.span>
                  )}
                </AnimatePresence>
              </motion.div>

              {/* Label */}
              <motion.span
                className={cn(
                  "mt-1 text-[9px] font-medium text-center leading-tight max-w-[60px] select-none",
                  step.status === "active" && "text-primary font-semibold",
                  step.status === "completed" && "text-primary/70",
                  step.status === "error" && "text-destructive",
                  step.status === "pending" && "text-muted-foreground/50",
                )}
                animate={{ opacity: step.status === "pending" ? 0.5 : 1 }}
              >
                {step.label}
              </motion.span>

              {/* Detail text for active step */}
              <AnimatePresence>
                {step.status === "active" && step.detail && (
                  <motion.span
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="text-[8px] text-primary/60 mt-0.5 text-center max-w-[80px] truncate"
                  >
                    {step.detail}
                  </motion.span>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
