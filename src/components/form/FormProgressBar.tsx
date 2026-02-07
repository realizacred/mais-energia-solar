import { motion } from "framer-motion";
import { CheckCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface Step {
  id: number;
  title: string;
  icon: React.ReactNode;
}

interface FormProgressBarProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function FormProgressBar({ steps, currentStep, className }: FormProgressBarProps) {
  const progressPercentage = ((currentStep - 1) / (steps.length - 1)) * 100;

  return (
    <div className={cn("relative", className)}>
      {/* Progress bar background */}
      <div className="absolute top-5 left-0 right-0 h-1 bg-muted rounded-full overflow-hidden">
        <motion.div
          className="h-full bg-gradient-to-r from-primary to-primary/80"
          initial={{ width: 0 }}
          animate={{ width: `${progressPercentage}%` }}
          transition={{ duration: 0.4, ease: "easeOut" }}
        />
      </div>

      {/* Steps */}
      <div className="relative flex justify-between">
        {steps.map((step, index) => {
          const isCompleted = currentStep > step.id;
          const isCurrent = currentStep === step.id;

          return (
            <div
              key={step.id}
              className="flex flex-col items-center"
            >
              {/* Step circle */}
              <motion.div
                className={cn(
                  "relative z-10 flex items-center justify-center w-10 h-10 rounded-full border-2 transition-all duration-300",
                  isCompleted && "bg-primary border-primary text-primary-foreground",
                  isCurrent && "bg-background border-primary text-primary shadow-lg shadow-primary/20",
                  !isCompleted && !isCurrent && "bg-muted border-muted-foreground/30 text-muted-foreground"
                )}
                initial={{ scale: 0.8 }}
                animate={{ 
                  scale: isCurrent ? 1.1 : 1,
                }}
                transition={{ duration: 0.3 }}
              >
                {isCompleted ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 300 }}
                  >
                    <CheckCircle className="w-5 h-5" />
                  </motion.div>
                ) : (
                  <motion.span 
                    className="text-sm font-semibold"
                    animate={{ opacity: 1 }}
                  >
                    {step.id}
                  </motion.span>
                )}

                {/* Pulse animation for current step */}
                {isCurrent && (
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-primary"
                    initial={{ scale: 1, opacity: 1 }}
                    animate={{ scale: 1.4, opacity: 0 }}
                    transition={{ 
                      duration: 1.5, 
                      repeat: Infinity,
                      ease: "easeOut"
                    }}
                  />
                )}
              </motion.div>

              {/* Step label */}
              <motion.div
                className={cn(
                  "mt-2 text-xs font-medium text-center max-w-[80px]",
                  isCurrent && "text-primary",
                  isCompleted && "text-primary/80",
                  !isCompleted && !isCurrent && "text-muted-foreground"
                )}
                animate={{ 
                  y: isCurrent ? -2 : 0,
                  fontWeight: isCurrent ? 600 : 500 
                }}
              >
                {step.title}
              </motion.div>

              {/* Icon below label for current step */}
              {isCurrent && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-1 text-primary"
                >
                  {step.icon}
                </motion.div>
              )}
            </div>
          );
        })}
      </div>

      {/* Progress percentage */}
      <motion.div
        className="text-center mt-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.2 }}
      >
        <span className="text-sm text-muted-foreground">
          Passo {currentStep} de {steps.length}
        </span>
        <span className="mx-2 text-muted-foreground/50">•</span>
        <span className="text-sm font-medium text-primary">
          {Math.round(progressPercentage)}% concluído
        </span>
      </motion.div>
    </div>
  );
}
