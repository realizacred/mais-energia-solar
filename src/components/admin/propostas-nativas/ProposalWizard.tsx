import React, { useState } from "react";
import { WizardProvider, useWizardContext } from "./wizard/WizardContext";
import { WizardSidebar } from "./wizard/WizardSidebar";
import { ProposalLiveSummary } from "./wizard/ProposalLiveSummary";
import { useSolarCalculation } from "./wizard/hooks/useSolarCalculation";

import { StepCliente } from "./wizard/StepCliente";
import { StepLocalizacao } from "./wizard/StepLocalizacao";
import { StepUCsEnergia } from "./wizard/StepUCsEnergia";
import { StepConsumptionIntelligence } from "./wizard/StepConsumptionIntelligence";
import { StepKitSelection } from "./wizard/StepKitSelection";
import { StepAdicionais } from "./wizard/StepAdicionais";
import { StepServicos } from "./wizard/StepServicos";
import { StepPagamento } from "./wizard/StepPagamento";
import { StepDocumento } from "./wizard/StepDocumento";
import { StepComercial } from "./wizard/StepComercial";
import { Button } from "@/components/ui/button";

import {
  User,
  MapPin,
  Zap,
  Settings2,
  Package,
  Box,
  Wrench,
  CreditCard,
  FileText,
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Sparkles,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  { key: "cliente", label: "Cliente", icon: User },
  { key: "comercial", label: "Comercial", icon: Briefcase },
  { key: "localizacao", label: "Localização", icon: MapPin },
  { key: "ucs", label: "Unidades", icon: Zap },
  { key: "dimensionamento", label: "Dimensionamento", icon: Settings2 },
  { key: "kit", label: "Kit Gerador", icon: Package },
  { key: "adicionais", label: "Adicionais", icon: Box },
  { key: "servicos", label: "Serviços", icon: Wrench },
  { key: "pagamento", label: "Pagamento", icon: CreditCard },
  { key: "documento", label: "Documento", icon: FileText },
];

function SummaryPill() {
  const { potenciaSugeridaKwp, geracaoMensalEstimada, precoFinal, offset } = useSolarCalculation();
  return (
    <div className="flex gap-4 items-center">
      <div className="flex flex-col shrink-0">
        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Potência</span>
        <span className="text-xs font-black text-foreground">{potenciaSugeridaKwp.toFixed(2)} kWp</span>
      </div>
      <div className="flex flex-col shrink-0 border-l border-border/40 pl-4">
        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Geração</span>
        <span className="text-xs font-black text-foreground">{Math.round(geracaoMensalEstimada)} kWh</span>
      </div>
      <div className="flex flex-col shrink-0 border-l border-border/40 pl-4">
        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Offset</span>
        <span className="text-xs font-black text-foreground">{offset.toFixed(0)}%</span>
      </div>
      <div className="flex flex-col shrink-0 border-l border-border/40 pl-4">
        <span className="text-[9px] uppercase font-bold text-muted-foreground tracking-widest">Investimento</span>
        <span className="text-xs font-black text-primary">R$ {Math.round(precoFinal / 1000)}k</span>
      </div>
    </div>
  );
}

function WizardContent() {
  const [currentStep, setCurrentStep] = useState(0);
  const { selectedLead, comercial, setComercial } = useWizardContext();
  const leadFase = selectedLead?.rede_atendimento;

  const renderStep = () => {
    switch (currentStep) {
      case 0: return <StepCliente />;
      case 1: return <StepComercial comercial={comercial} onComercialChange={setComercial} />;
      case 2: return <StepLocalizacao />;
      case 3: return <StepUCsEnergia onNext={() => setCurrentStep(4)} onBack={() => setCurrentStep(2)} />;
      case 4: return <StepConsumptionIntelligence leadFase={leadFase} />;
      case 5: return <StepKitSelection onNext={() => setCurrentStep(6)} onBack={() => setCurrentStep(4)} />;
      case 6: return <StepAdicionais onNext={() => setCurrentStep(7)} onBack={() => setCurrentStep(5)} />;
      case 7: return <StepServicos onNext={() => setCurrentStep(8)} onBack={() => setCurrentStep(6)} />;
      case 8: return <StepPagamento onNext={() => setCurrentStep(9)} onBack={() => setCurrentStep(7)} />;
      case 9: return <StepDocumento onBack={() => setCurrentStep(8)} />;
      default: return null;
    }
  };

  const currentStepMeta = STEPS[currentStep];
  const totalLabel = `${String(currentStep + 1).padStart(2, "0")} / ${String(STEPS.length).padStart(2, "0")}`;

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-muted/30 via-background to-background">
      {/* Header compacto */}
      <header className="sticky top-0 z-40 bg-background/85 backdrop-blur-xl border-b border-border/60 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-3 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary to-primary/60 flex items-center justify-center shadow-lg shadow-primary/20">
              <Sparkles className="h-4 w-4 text-primary-foreground" />
            </div>
            <div>
              <span className="text-[10px] uppercase font-black tracking-[0.18em] text-primary">
                Etapa {totalLabel} · Nova Proposta
              </span>
              <h1 className="text-lg md:text-xl font-black tracking-tight text-foreground leading-tight">
                {currentStepMeta?.label}
              </h1>
            </div>
          </div>

          <div className="hidden md:flex items-center bg-card/60 border border-border/60 rounded-xl px-4 py-2 shadow-sm">
            <SummaryPill />
          </div>
        </div>
        <div className="md:hidden border-t border-border/40 bg-card/40 px-4 py-2 overflow-x-auto no-scrollbar">
          <SummaryPill />
        </div>
      </header>

      {/* Shell com sidebar de etapas à esquerda */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1600px] mx-auto px-4 md:px-8 py-6 md:py-8 pb-32">
          <div className="grid grid-cols-1 lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[220px_minmax(0,1fr)_320px] gap-6 lg:gap-8 items-start">
            {/* Sidebar vertical de etapas */}
            <aside className="hidden lg:block sticky top-[120px]">
              <div className="bg-card border border-border/60 rounded-2xl p-4 shadow-sm">
                <div className="text-[10px] uppercase font-bold tracking-widest text-muted-foreground mb-3 px-1">
                  Etapas
                </div>
                <WizardSidebar
                  steps={STEPS}
                  currentStep={currentStep}
                  onStepClick={setCurrentStep}
                  totalLabel={totalLabel}
                />
              </div>
            </aside>

            {/* Conteúdo da etapa */}
            <div className="min-w-0">
              <AnimatePresence mode="wait">
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.25, ease: "easeOut" }}
                  className="bg-card border border-border/60 rounded-2xl shadow-sm shadow-black/[0.02] p-4 md:p-6 lg:p-8"
                >
                  {renderStep()}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Live summary apenas a partir da etapa de Localização */}
            {currentStep >= 2 && (
              <aside className="hidden xl:block sticky top-[120px]">
                <ProposalLiveSummary />
              </aside>
            )}
          </div>
        </div>
      </main>

      {/* Footer de navegação */}
      <div className="fixed bottom-0 inset-x-0 bg-background/90 backdrop-blur-xl border-t border-border/60 shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.08)] z-50">
        <div className="max-w-[1600px] mx-auto flex justify-between items-center px-4 md:px-8 py-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep((prev) => Math.max(0, prev - 1))}
            className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground gap-1.5"
            disabled={currentStep === 0}
          >
            <ChevronLeft className="h-4 w-4" /> Voltar
          </Button>

          <div className="hidden md:flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
            Auto-save ativo
          </div>

          <Button
            onClick={() => setCurrentStep((prev) => Math.min(STEPS.length - 1, prev + 1))}
            className="bg-primary hover:bg-primary/90 text-primary-foreground px-6 md:px-8 h-10 font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20 gap-1.5"
            disabled={currentStep === STEPS.length - 1}
          >
            Próximo Passo <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

export function ProposalWizard() {
  return (
    <WizardProvider>
      <WizardContent />
    </WizardProvider>
  );
}
