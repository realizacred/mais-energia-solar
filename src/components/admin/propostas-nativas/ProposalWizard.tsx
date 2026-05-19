import React, { useState, useEffect } from "react";
import { WizardProvider, useWizardContext } from "./wizard/WizardContext";
import { WizardSidebar } from "./wizard/WizardSidebar";
import { ProposalLiveSummary } from "./wizard/ProposalLiveSummary";
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
  Briefcase
} from "lucide-react";
import { useSearchParams } from "react-router-dom";
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
  const { 
    potenciaSugeridaKwp, 
    geracaoMensalEstimada, 
    precoFinal,
    offset 
  } = useSolarCalculation();
  
  return (
    <div className="flex gap-4 items-center">
      <div className="flex flex-col shrink-0">
        <span className="text-[8px] uppercase font-bold text-muted-foreground">Potência</span>
        <span className="text-[10px] font-black">{potenciaSugeridaKwp.toFixed(2)} kWp</span>
      </div>
      <div className="flex flex-col shrink-0 border-l pl-4">
        <span className="text-[8px] uppercase font-bold text-muted-foreground">Geração</span>
        <span className="text-[10px] font-black">{Math.round(geracaoMensalEstimada)} kWh</span>
      </div>
      <div className="flex flex-col shrink-0 border-l pl-4">
        <span className="text-[8px] uppercase font-bold text-muted-foreground">Offset</span>
        <span className="text-[10px] font-black">{offset.toFixed(0)}%</span>
      </div>
      <div className="flex flex-col shrink-0 border-l pl-4">
        <span className="text-[8px] uppercase font-bold text-muted-foreground">Investimento</span>
        <span className="text-[10px] font-black">R$ {Math.round(precoFinal/1000)}k</span>
      </div>
    </div>
  );
}

function WizardContent() {

  const [currentStep, setCurrentStep] = useState(0);
  const { selectedLead, handleUCsChange, ucs, comercial, setComercial } = useWizardContext();
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

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-screen bg-background">
      {/* Sidebar - Desktop */}
      <div className="w-full lg:w-72 border-b lg:border-r bg-card/50 backdrop-blur-sm p-6 sticky top-0 h-fit lg:h-screen">
        <div className="mb-8">
          <h1 className="text-xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
            Nova Proposta
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Siga os passos para gerar o documento</p>
        </div>
        
        <WizardSidebar 
          steps={STEPS} 
          currentStep={currentStep} 
          onStepClick={setCurrentStep} 
          totalLabel={`${currentStep + 1} de ${STEPS.length} etapas`}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Summary Header */}
        <div className="xl:hidden bg-card border-b px-4 py-2 flex items-center justify-between sticky top-[65px] z-40 shadow-sm">
          <div className="flex gap-4 overflow-x-auto no-scrollbar py-1">
            <SummaryPill />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto overflow-x-hidden">

          <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8 pb-32">
            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 items-start">
              {/* Step Content */}
              <div className="xl:col-span-8 2xl:col-span-9 w-full">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentStep}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -10 }}
                    transition={{ duration: 0.2 }}
                  >
                    {renderStep()}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Live Summary Sidebar - Visible from Step 2 onwards (when calculation starts to matter) */}
              {currentStep >= 2 && (
                <div className="hidden xl:block xl:col-span-4 2xl:col-span-3 sticky top-8">
                  <ProposalLiveSummary />
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Navigation - Footer fixed */}
        <div className="fixed bottom-0 right-0 left-0 lg:left-72 bg-background/80 backdrop-blur-md border-t border-border/40 p-4 z-50">
          <div className="max-w-7xl mx-auto flex justify-between items-center px-4 md:px-8">
            <Button 
              variant="ghost"
              size="sm"
              onClick={() => setCurrentStep(prev => Math.max(0, prev - 1))}
              className="text-xs font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground"
              disabled={currentStep === 0}
            >
              Voltar
            </Button>

            <div className="flex gap-2">
              <Button 
                onClick={() => setCurrentStep(prev => Math.min(STEPS.length - 1, prev + 1))}
                className="bg-primary hover:bg-primary/90 text-primary-foreground px-8 h-10 font-bold text-xs uppercase tracking-widest shadow-lg shadow-primary/20"
                disabled={currentStep === STEPS.length - 1}
              >
                Próximo Passo
              </Button>
            </div>
          </div>
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
