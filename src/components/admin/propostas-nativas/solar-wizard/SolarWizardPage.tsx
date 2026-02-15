import { useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronLeft, ChevronRight, User, BarChart3, Package, DollarSign, Check, Cpu } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { INITIAL_STATE, calcSuggestedKwp, type SolarWizardState } from "./wizardState";
import { ORIENTACAO_OPTIONS } from "./mockData";
import { StepClienteObra } from "./StepClienteObra";
import { StepDimensionamento } from "./StepDimensionamento";
import { AnalysisInterstitial } from "./AnalysisInterstitial";
import { StepKitSelection } from "./StepKitSelection";
import { StepFinanceiro } from "./StepFinanceiro";

const STEPS = [
  { label: "Cliente & Obra", icon: User },
  { label: "Dimensionamento", icon: BarChart3 },
  { label: "Análise", icon: Cpu },
  { label: "Kit", icon: Package },
  { label: "Financeiro", icon: DollarSign },
];

function StepAnim({ children }: { children: React.ReactNode }) {
  return (
    <motion.div initial={{ opacity: 0, x: 16 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -16 }} transition={{ duration: 0.18 }}>
      {children}
    </motion.div>
  );
}

export function SolarWizardPage() {
  const navigate = useNavigate();
  const [state, setState] = useState<SolarWizardState>(INITIAL_STATE);

  const { step } = state;
  const set = <K extends keyof SolarWizardState>(key: K, val: SolarWizardState[K]) =>
    setState(prev => ({ ...prev, [key]: val }));

  const mediaMensal = useMemo(() => {
    const total = state.consumo.meses.reduce((a, b) => a + b, 0);
    return total > 0 ? total / 12 : 0;
  }, [state.consumo.meses]);

  const kwp = calcSuggestedKwp(mediaMensal);
  const orientFator = ORIENTACAO_OPTIONS.find(o => o.value === state.tecnico.orientacao)?.fator ?? 1;

  const canStep = [
    !!state.cliente.nome.trim() && state.cliente.telefone.replace(/\D/g, "").length >= 10,
    mediaMensal > 0,
    true,
    !!state.selectedKitId,
    true,
  ];

  const handleAnalysisComplete = useCallback(() => {
    setState(prev => ({ ...prev, analysisComplete: true, step: 3 }));
  }, []);

  const goToStep = (target: number) => {
    if (target === 2 && state.analysisComplete) { setState(prev => ({ ...prev, step: 3 })); return; }
    setState(prev => ({ ...prev, step: target }));
  };

  const goNext = () => { if (step === 2) return; goToStep(step + 1); };
  const goPrev = () => {
    if (step === 3 && state.analysisComplete) { setState(prev => ({ ...prev, step: 1 })); return; }
    setState(prev => ({ ...prev, step: Math.max(0, prev.step - 1) }));
  };

  return (
    <div className="space-y-4 max-w-5xl mx-auto">
      {/* Stepper */}
      <div className="flex items-center gap-0.5 overflow-x-auto pb-1 px-1 -mx-1">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step || (i === 2 && state.analysisComplete && step > 2);
          return (
            <div key={s.label} className="flex items-center gap-0.5 flex-shrink-0">
              <button
                onClick={() => { if (isDone) goToStep(i); }}
                className={cn(
                  "flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-semibold transition-all whitespace-nowrap",
                  isActive && "bg-primary text-primary-foreground shadow-sm",
                  isDone && "bg-primary/10 text-primary cursor-pointer hover:bg-primary/15",
                  !isActive && !isDone && "bg-muted/50 text-muted-foreground cursor-default",
                )}
              >
                <span className={cn("flex items-center justify-center h-5 w-5 rounded-full text-[9px] shrink-0", isActive && "bg-primary-foreground/20", isDone && "bg-primary/20", !isActive && !isDone && "bg-muted")}>
                  {isDone ? <Check className="h-2.5 w-2.5" /> : <Icon className="h-2.5 w-2.5" />}
                </span>
                <span className="hidden sm:block">{s.label}</span>
              </button>
              {i < STEPS.length - 1 && <div className="w-3 h-px bg-border shrink-0" />}
            </div>
          );
        })}
      </div>

      {/* Content */}
      <Card className="border-border/60 overflow-hidden">
        <CardContent className="pt-5 pb-5 px-4 sm:px-6">
          <AnimatePresence mode="wait">
            {step === 0 && (
              <StepAnim key="s0">
                <StepClienteObra cliente={state.cliente} onClienteChange={c => set("cliente", c)} obra={state.obra} onObraChange={o => set("obra", o)} />
              </StepAnim>
            )}
            {step === 1 && (
              <StepAnim key="s1">
                <StepDimensionamento consumo={state.consumo} onConsumoChange={c => set("consumo", c)} tecnico={state.tecnico} onTecnicoChange={t => set("tecnico", t)} estado={state.cliente.estado || state.obra.estado} />
              </StepAnim>
            )}
            {step === 2 && (
              <StepAnim key="s2">
                <AnalysisInterstitial onComplete={handleAnalysisComplete} kwp={kwp} />
              </StepAnim>
            )}
            {step === 3 && (
              <StepAnim key="s3">
                <StepKitSelection mediaMensal={mediaMensal} selectedKitId={state.selectedKitId} orientacaoFator={orientFator} onSelectKit={(id, items, custo) => setState(prev => ({ ...prev, selectedKitId: id, kitItems: items, financeiro: { ...prev.financeiro, custoEquipamentos: custo } }))} />
              </StepAnim>
            )}
            {step === 4 && (
              <StepAnim key="s4">
                <StepFinanceiro financeiro={state.financeiro} onFinanceiroChange={f => set("financeiro", f)} kwp={kwp} />
              </StepAnim>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>

      {/* Nav Footer */}
      {step !== 2 && (
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 0} className="gap-1 h-8 text-xs">
            <ChevronLeft className="h-3.5 w-3.5" /> Voltar
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground font-mono">{step + 1}/{STEPS.length}</span>
            {step < 4 ? (
              <Button size="sm" onClick={goNext} disabled={!canStep[step]} className="gap-1 h-8 text-xs">
                Próximo <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button size="sm" className="gap-1 h-8 text-xs bg-success hover:bg-success/90 text-success-foreground" onClick={() => navigate("/admin/projetos")}>
                <Check className="h-3.5 w-3.5" /> Finalizar Proposta
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
