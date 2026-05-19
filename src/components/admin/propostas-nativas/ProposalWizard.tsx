import React, { useState, useEffect } from "react";
import { WizardProvider, useWizardContext } from "./wizard/WizardContext";
import { WizardSidebar } from "./wizard/WizardSidebar";
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
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto p-4 md:p-6 lg:p-8 pb-24">
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

          {/* Navigation - Footer fixed or at end of content */}
          <div className="fixed bottom-0 right-0 left-0 lg:left-72 bg-background/80 backdrop-blur-md border-t border-border/40 p-4 z-50">
            <div className="max-w-[1400px] mx-auto flex justify-between items-center px-4 md:px-8">
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
