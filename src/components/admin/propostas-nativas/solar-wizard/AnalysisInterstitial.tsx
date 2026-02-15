import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sun, Cpu, BarChart3, Zap, CheckCircle2, Shield, Radio } from "lucide-react";

const STEPS = [
  { icon: Sun, label: "Analisando irradiação solar da região...", duration: 1200 },
  { icon: Cpu, label: "Buscando inversores compatíveis...", duration: 1000 },
  { icon: BarChart3, label: "Calculando ROI e payback...", duration: 1400 },
  { icon: Shield, label: "Validando tensão e MPPT...", duration: 900 },
  { icon: Radio, label: "Otimizando layout de módulos...", duration: 800 },
  { icon: Zap, label: "Montando opções de kits...", duration: 600 },
];

interface Props {
  onComplete: () => void;
  kwp: number;
}

export function AnalysisInterstitial({ onComplete, kwp }: Props) {
  const [currentStep, setCurrentStep] = useState(0);
  const [completed, setCompleted] = useState<number[]>([]);

  useEffect(() => {
    if (currentStep >= STEPS.length) {
      const t = setTimeout(onComplete, 400);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => {
      setCompleted(prev => [...prev, currentStep]);
      setCurrentStep(prev => prev + 1);
    }, STEPS[currentStep].duration);
    return () => clearTimeout(t);
  }, [currentStep, onComplete]);

  const progress = (currentStep / STEPS.length) * 100;

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] py-10">
      <motion.div className="relative mb-8" animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }}>
        <Sun className="h-14 w-14 text-primary" />
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary/20"
          style={{ scale: 1.8 }}
          animate={{ scale: [1.6, 2.0, 1.6], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
      </motion.div>

      <div className="text-center mb-5">
        <p className="text-sm font-bold text-foreground">Análise de Engenharia</p>
        <p className="text-[10px] text-muted-foreground font-mono">{kwp} kWp • calc-engine v2.0</p>
      </div>

      <div className="w-full max-w-xs mb-5">
        <div className="h-1 bg-muted rounded-full overflow-hidden">
          <motion.div className="h-full bg-primary rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
        </div>
        <p className="text-[9px] text-muted-foreground text-center mt-1 font-mono">{Math.round(progress)}%</p>
      </div>

      <div className="w-full max-w-xs space-y-1.5">
        <AnimatePresence mode="popLayout">
          {STEPS.map((step, i) => {
            const Icon = step.icon;
            const isActive = i === currentStep;
            const isDone = completed.includes(i);
            return (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: isDone || isActive ? 1 : 0.25, y: 0 }}
                className="flex items-center gap-2.5 py-1"
              >
                {isDone ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                ) : isActive ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                    <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
                  </motion.div>
                ) : (
                  <Icon className="h-3.5 w-3.5 text-muted-foreground/30 shrink-0" />
                )}
                <span className={`text-[11px] ${isDone ? "text-muted-foreground line-through" : isActive ? "text-foreground font-medium" : "text-muted-foreground/30"}`}>
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
