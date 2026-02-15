import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Cpu, BarChart3, Zap, CheckCircle2, Shield } from "lucide-react";

const ANALYSIS_STEPS = [
  { icon: Sun, label: "Calculando irradiação solar...", duration: 1800 },
  { icon: Cpu, label: "Otimizando razão CC/CA do inversor...", duration: 1500 },
  { icon: BarChart3, label: "Executando simulação financeira (25 anos)...", duration: 2000 },
  { icon: Shield, label: "Validando compatibilidade de equipamentos...", duration: 1200 },
  { icon: Zap, label: "Montando opções de kit otimizadas...", duration: 1000 },
];

interface Props {
  onComplete: () => void;
  potenciaKwp: number;
}

export function StepEngineeringAnalysis({ onComplete, potenciaKwp }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);

  useEffect(() => {
    if (currentStep >= ANALYSIS_STEPS.length) {
      const t = setTimeout(onComplete, 600);
      return () => clearTimeout(t);
    }

    const t = setTimeout(() => {
      setCompleted(prev => [...prev, currentStep]);
      setCurrentStep(prev => prev + 1);
    }, ANALYSIS_STEPS[currentStep].duration);

    return () => clearTimeout(t);
  }, [currentStep, onComplete]);

  const progress = ((currentStep) / ANALYSIS_STEPS.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] py-8">
      {/* Central spinner */}
      <motion.div
        className="relative mb-8"
        animate={{ rotate: 360 }}
        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
      >
        <Sun className="h-16 w-16 text-primary" />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary/30"
          style={{ scale: 1.8 }}
          animate={{ scale: [1.6, 2.0, 1.6], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      {/* System info */}
      <div className="text-center mb-6">
        <p className="text-sm font-bold text-foreground">Análise de Engenharia</p>
        <p className="text-xs text-muted-foreground font-mono">{potenciaKwp} kWp • calc-engine v2.0</p>
      </div>

      {/* Progress bar */}
      <div className="w-full max-w-sm mb-6">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <motion.div
            className="h-full bg-primary rounded-full"
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Steps list */}
      <div className="w-full max-w-sm space-y-2">
        <AnimatePresence mode="popLayout">
          {ANALYSIS_STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = completed.includes(i);

            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: isDone || isActive ? 1 : 0.3, y: 0 }}
                className="flex items-center gap-3 py-1.5"
              >
                {isDone ? (
                  <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                ) : isActive ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Icon className="h-4 w-4 text-primary shrink-0" />
                  </motion.div>
                ) : (
                  <Icon className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                )}
                <span className={`text-xs ${isDone ? "text-muted-foreground line-through" : isActive ? "text-foreground font-medium" : "text-muted-foreground/40"}`}>
                  {step.label}
                </span>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </div>
  );
}
