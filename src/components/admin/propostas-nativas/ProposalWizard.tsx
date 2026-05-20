import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft, ChevronRight, Check,
  RefreshCw, SunMedium, Zap, DollarSign, MapPin,
  ClipboardList, LayoutGrid, FileText,
  User, CreditCard, Settings2, Briefcase, Package, Box, Wrench, BarChart3,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useToast } from "@/hooks/use-toast";
import { formatBRLInteger as formatBRL, formatNumberBR } from "@/lib/formatters";
import { cn } from "@/lib/utils";

import { WizardProvider, useWizardContext } from "./wizard/WizardContext";
import { useSolarCalculation } from "./wizard/hooks/useSolarCalculation";

import { StepCliente } from "./wizard/StepCliente";
import { StepComercial } from "./wizard/StepComercial";
import { StepLocalizacao } from "./wizard/StepLocalizacao";
import { StepUCsEnergia } from "./wizard/StepUCsEnergia";
import { StepConsumptionIntelligence } from "./wizard/StepConsumptionIntelligence";
import { StepKitSelection } from "./wizard/StepKitSelection";
import { StepAdicionais } from "./wizard/StepAdicionais";
import { StepServicos } from "./wizard/StepServicos";
import { StepPagamento } from "./wizard/StepPagamento";
import { StepDocumento } from "./wizard/StepDocumento";

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

function WizardShell() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const {
    selectedLead,
    cliente,
    ucs,
    handleUCsChange,
    potenciaKwp,
    comercial,
    setComercial,
  } = useWizardContext();

  const leadFase = selectedLead?.rede_atendimento;

  const { consumoTotal, geracaoMensalEstimada, precoFinal } = useSolarCalculation();

  const [step, setStep] = useState(0);
  const activeSteps = STEPS;
  const isLastStep = step === activeSteps.length - 1;

  const goPrev = () => setStep((s) => Math.max(0, s - 1));
  const goNext = () => setStep((s) => Math.min(activeSteps.length - 1, s + 1));
  const goToStep = (target: number) => setStep(target);

  // ─── ClientContextPanel — restored literally from canonical
  const ClientContextPanel = useMemo(() => {
    if (!selectedLead) return null;
    const geracao = (selectedLead as any).geracao_estimada_kwh;
    const consumo = (selectedLead as any).media_consumo;
    const telhado = (selectedLead as any).tipo_telhado;
    const fase = (selectedLead as any).rede_atendimento;
    const cidade = (selectedLead as any).cidade;
    const uf = (selectedLead as any).estado;
    const obsLead = (selectedLead as any).observacoes;
    const obsOrc = (selectedLead as any).orc_observacoes;
    const source = (selectedLead as any).source_type || "lead";

    return (
      <div className="bg-card border-b border-border shadow-sm sticky top-0 z-20 overflow-hidden">
        <div className="max-w-[1400px] mx-auto px-4 py-2 flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1.5 mr-2">
              <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-[10px] uppercase font-bold py-0 h-5">
                {source === "orcamento" ? "Orçamento" : "Lead"}
              </Badge>
              <span className="text-sm font-bold truncate max-w-[180px]">{selectedLead.nome}</span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {consumo && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="secondary" className="h-5 text-[10px] gap-1 px-1.5 font-medium">
                        <Zap className="h-3 w-3" /> {consumo} kWh
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>Consumo atual informado</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {geracao && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center">
                        <Badge variant="secondary" className="h-5 text-[10px] gap-1 px-1.5 font-medium bg-blue-50 text-blue-700 border-blue-100">
                          <SunMedium className="h-3 w-3" /> {geracao} kWh/mês
                        </Badge>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-5 w-5 ml-0.5 text-blue-600 hover:text-blue-700 hover:bg-blue-100"
                          onClick={() => {
                            if (!ucs.length) return;
                            handleUCsChange((prev) => {
                              const updated = [...prev];
                              updated[0] = { ...updated[0], consumo_mensal: geracao };
                              return updated;
                            });
                            toast({ title: "Geração aplicada", description: `A UC geradora foi ajustada para ${geracao} kWh.` });
                          }}
                        >
                          <RefreshCw className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>Geração desejada. Clique em repetir para usar na UC.</TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}

              {telhado && (
                <Badge variant="outline" className="h-5 text-[10px] gap-1 px-1.5 border-border/60">
                  <LayoutGrid className="h-3 w-3" /> {telhado}
                </Badge>
              )}

              {fase && (
                <Badge variant="outline" className="h-5 text-[10px] gap-1 px-1.5 border-border/60">
                  <Zap className="h-3 w-3" /> {fase}
                </Badge>
              )}

              {(cidade || uf) && (
                <Badge variant="outline" className="h-5 text-[10px] gap-1 px-1.5 border-border/60">
                  <MapPin className="h-3 w-3" /> {cidade}{uf ? `/${uf}` : ""}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {(obsLead || obsOrc) && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="flex items-center gap-1.5 text-muted-foreground cursor-help">
                      <ClipboardList className="h-3.5 w-3.5" />
                      <span className="text-[11px] truncate max-w-[200px] lg:max-w-[400px]">
                        {obsOrc || obsLead}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <div className="space-y-2 py-1">
                      {obsLead && (
                        <div>
                          <p className="font-bold text-[10px] uppercase text-primary">Obs. Lead</p>
                          <p className="text-xs">{obsLead}</p>
                        </div>
                      )}
                      {obsOrc && (
                        <div>
                          <p className="font-bold text-[10px] uppercase text-primary">Obs. Orçamento</p>
                          <p className="text-xs">{obsOrc}</p>
                        </div>
                      )}
                    </div>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
          </div>
        </div>
      </div>
    );
  }, [selectedLead, ucs, handleUCsChange, toast]);

  // ─── Step render — keeps current Step* signatures
  const renderStepContent = () => {
    switch (step) {
      case 0: return <StepCliente />;
      case 1: return <StepComercial comercial={comercial} onComercialChange={setComercial} />;
      case 2: return <StepLocalizacao />;
      case 3: return <StepUCsEnergia onNext={goNext} onBack={goPrev} />;
      case 4: return <StepConsumptionIntelligence leadFase={leadFase} />;
      case 5: return <StepKitSelection onBack={goPrev} onNext={goNext} />;
      case 6: return <StepAdicionais onBack={goPrev} onNext={goNext} />;
      case 7: return <StepServicos onBack={goPrev} onNext={goNext} />;
      case 8: return <StepPagamento onBack={goPrev} onNext={goNext} />;
      case 9: return <StepDocumento onBack={goPrev} />;
      default: return null;
    }
  };

  // ─── Render — canonical shell (c2f6d8ca3) restored literally
  return (
    <div className="proposal-wizard-root flex flex-col h-[calc(100dvh-3.5rem)] overflow-hidden">
      {/* ── Sticky Header — breadcrumb + client + metrics */}
      <div className="shrink-0 border-b border-border/60 bg-card px-4 lg:px-6 py-2.5 space-y-1">
        {/* Breadcrumb row */}
        <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <Link to="/admin/propostas-nativas" className="text-[11px] text-muted-foreground hover:text-foreground hover:underline">
            Propostas
          </Link>
          <ChevronRight className="h-3 w-3 text-muted-foreground/50" />
          <span className="font-medium text-foreground">Nova Proposta</span>
        </div>

        {/* Client name + metrics row */}
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-lg font-bold text-foreground truncate">
            {cliente.nome || selectedLead?.nome || "Nova Proposta"}
          </h1>
          <div className="flex items-center gap-3 sm:gap-5 shrink-0">
            {potenciaKwp > 0 && (
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <Zap className="h-3.5 w-3.5 text-primary" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Potência Total</p>
                  <p className="text-xs font-bold text-foreground">{(Number(potenciaKwp) || 0).toFixed(2)} kWp</p>
                </div>
              </div>
            )}
            {consumoTotal > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <BarChart3 className="h-3.5 w-3.5 text-secondary" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Consumo</p>
                  <p className="text-xs font-bold text-foreground">{formatNumberBR(consumoTotal)} kWh</p>
                </div>
              </div>
            )}
            {!!(selectedLead as any)?.geracao_estimada_kwh && (
              <div
                className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-warning/40 bg-warning/5"
                title="Geração prevista informada pelo cliente no lead (referência visual)"
              >
                <SunMedium className="h-3.5 w-3.5 text-warning" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Cliente quer (Geração Prev.)</p>
                  <p className="text-xs font-bold text-foreground">
                    {formatNumberBR(Math.round(Number((selectedLead as any).geracao_estimada_kwh) || 0))} kWh
                  </p>
                </div>
              </div>
            )}
            {geracaoMensalEstimada > 0 && (
              <div className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <SunMedium className="h-3.5 w-3.5 text-warning" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Geração Estimada</p>
                  <p className="text-xs font-bold text-foreground">{formatNumberBR(Math.round(geracaoMensalEstimada))} kWh/mês</p>
                </div>
              </div>
            )}
            {precoFinal > 0 && (
              <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-border/50 bg-muted/30">
                <DollarSign className="h-3.5 w-3.5 text-success" />
                <div className="text-right">
                  <p className="text-[9px] text-muted-foreground leading-none">Preço do Projeto</p>
                  <p className="text-xs font-bold text-foreground">
                    {formatBRL(precoFinal)}{" "}
                    {potenciaKwp > 0 && (
                      <span className="text-[9px] font-normal text-muted-foreground">
                        R$ {((Number(precoFinal) || 0) / (Number(potenciaKwp) || 1) / 1000).toFixed(2)}/Wp
                      </span>
                    )}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {ClientContextPanel}

      {/* ── Pipeline stepper — responsive: scrollable on mobile, full on desktop */}
      <div className="relative shrink-0 border-b-2 border-secondary/10 bg-gradient-to-b from-card to-muted/20">
        {/* Progress track */}
        <div className="absolute bottom-0 left-0 right-0 h-1 bg-muted/40">
          <motion.div
            className="h-full bg-gradient-to-r from-secondary via-secondary to-primary rounded-r-full shadow-sm shadow-secondary/30"
            initial={{ width: "0%" }}
            animate={{ width: `${(step / (activeSteps.length - 1)) * 100}%` }}
            transition={{ duration: 0.6, ease: "easeInOut" }}
          />
        </div>
        {/* Scrollable container on mobile */}
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex items-center px-2 sm:px-4 py-3 gap-0 min-w-max sm:min-w-0 sm:justify-center lg:justify-start">
            {activeSteps.map((s, i) => {
              const Icon = s.icon;
              const isActive = i === step;
              const isDone = i < step;
              return (
                <div key={s.key} className="flex items-center flex-shrink-0">
                  <motion.button
                    onClick={() => { if (isDone) goToStep(i); }}
                    className={cn(
                      "relative flex items-center gap-1 sm:gap-1.5 px-2 sm:px-3 py-1.5 sm:py-2 rounded-xl text-[10px] sm:text-xs font-bold transition-colors whitespace-nowrap border",
                      isActive && "bg-primary text-primary-foreground shadow-sm border-primary",
                      isDone && "bg-secondary/10 text-secondary border-secondary/20 cursor-pointer hover:bg-secondary/15",
                      !isActive && !isDone && "text-muted-foreground border-transparent cursor-default",
                    )}
                    initial={false}
                    animate={{ scale: 1 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    whileHover={isDone ? { scale: 1.02 } : undefined}
                  >
                    <span className={cn(
                      "flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 rounded-full text-[10px] shrink-0 transition-colors",
                      isActive && "bg-primary-foreground/25",
                      isDone && "bg-secondary/20 text-secondary",
                      !isActive && !isDone && "bg-muted",
                    )}>
                      {isDone ? (
                        <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ duration: 0.2, ease: "easeOut" }}>
                          <Check className="h-3 w-3" />
                        </motion.span>
                      ) : (
                        <Icon className="h-3 w-3" />
                      )}
                    </span>
                    <span className="hidden md:block">{s.label}</span>
                  </motion.button>
                  {i < activeSteps.length - 1 && (
                    <div className="flex items-center mx-0.5 sm:mx-1">
                      <ChevronRight className={cn(
                        "h-3 w-3 sm:h-4 sm:w-4 transition-colors duration-300",
                        isDone ? "text-secondary" : "text-muted-foreground/30",
                      )} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Body: Content — responsive padding, full width (no max-w cap) */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-thin">
        <div className="w-full px-2 sm:px-3 lg:px-4 py-2 lg:py-3 pb-24 sm:pb-20">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              transition={{ duration: 0.2 }}
            >
              {renderStepContent()}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>

      {/* ── Sticky Footer Navigation — full-width, no sidebar inset */}
      <div className="fixed bottom-0 left-0 right-0 sm:sticky sm:bottom-auto flex items-center justify-between px-4 lg:px-6 py-3 border-t border-border/60 bg-card shrink-0 z-20 shadow-[0_-2px_8px_rgba(0,0,0,0.06)] sm:shadow-none">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="gap-1.5 h-9 text-xs font-medium text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
        >
          Cancelar
        </Button>
        <div className="flex items-center gap-2 sm:gap-3">
          <span className="text-[10px] font-mono text-muted-foreground hidden sm:inline">
            Etapa {step + 1}/{activeSteps.length}
          </span>

          <div className="h-6 w-px bg-border/50 hidden sm:block" />

          <Button variant="ghost" size="sm" onClick={goPrev} disabled={step === 0} className="gap-1.5 h-9 text-xs font-medium">
            <ChevronLeft className="h-3.5 w-3.5" /> <span className="hidden sm:inline">Voltar</span>
          </Button>
          {!isLastStep && (
            <Button
              size="sm"
              onClick={goNext}
              className="gap-1.5 h-9 px-5 text-xs font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-sm shadow-primary/20 transition-all duration-200"
            >
              Prosseguir
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export function ProposalWizard() {
  return (
    <WizardProvider>
      <WizardShell />
    </WizardProvider>
  );
}
