import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
import confetti from "canvas-confetti";
import { 
  User, Phone, MapPin, Home, Zap, BarChart3, MessageSquare, 
  Send, Loader2, CheckCircle, FileText, ArrowLeft, ArrowRight,
  Building, Hash, WifiOff, RefreshCw, ShieldCheck
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import ConsumptionChart from "./ConsumptionChart";
import FileUpload from "./FileUpload";
import { useOfflineLeadSync } from "@/hooks/useOfflineLeadSync";
import { useLeadOrcamento } from "@/hooks/useLeadOrcamento";
import { useFormAutoSave } from "@/hooks/useFormAutoSave";
import { useFormRateLimit } from "@/hooks/useFormRateLimit";
import { useHoneypot } from "@/hooks/useHoneypot";
import { 
  HoneypotField, 
  FormProgressBar, 
  RateLimitWarning,
  AutoSaveIndicator,
  DuplicateLeadWarning,
} from "@/components/form";
import logo from "@/assets/logo.png";
import {
  leadFormSchema,
  LeadFormData,
  formatPhone,
  formatCEP,
  formatName,
  ESTADOS_BRASIL,
  TIPOS_TELHADO,
  REDES_ATENDIMENTO,
} from "@/lib/validations";

const STEPS = [
  { id: 1, title: "Dados Pessoais", icon: <User className="w-4 h-4" /> },
  { id: 2, title: "Endereço", icon: <MapPin className="w-4 h-4" /> },
  { id: 3, title: "Imóvel e Consumo", icon: <Home className="w-4 h-4" /> },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: {
    x: 0,
    opacity: 1,
  },
  exit: (direction: number) => ({
    x: direction < 0 ? 300 : -300,
    opacity: 0,
  }),
};

const fieldVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  },
};

interface LeadFormWizardProps {
  vendorCode?: string;
}

export default function LeadFormWizard({ vendorCode }: LeadFormWizardProps = {}) {
  const [searchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>([]);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [vendedorCodigo, setVendedorCodigo] = useState<string | null>(null);
  const [vendedorNome, setVendedorNome] = useState<string | null>(null);
  const { toast } = useToast();
  
  const { 
    isOnline, 
    pendingCount, 
    isSyncing, 
    saveLead, 
    retrySync,
    refreshPendingCount,
  } = useOfflineLeadSync({ vendedorNome });

  // Lead/Orcamento management with duplicate detection
  const {
    isSubmitting: isSubmittingOrcamento,
    matchingLeads,
    selectedLead,
    showDuplicateWarning,
    submitOrcamento,
    selectLeadFromList,
    confirmUseExistingLead,
    forceCreateNewLead,
    cancelDuplicateWarning,
  } = useLeadOrcamento();

  // Store form data for duplicate handling
  const pendingFormDataRef = useRef<LeadFormData | null>(null);

  // Honeypot anti-bot protection
  const { honeypotValue, handleHoneypotChange, validateHoneypot, resetHoneypot } = useHoneypot();

  // Rate limiting protection
  const { 
    checkRateLimit, 
    recordAttempt, 
    isBlocked, 
    remainingAttempts,
    getRemainingCooldownSeconds,
    reset: resetRateLimit 
  } = useFormRateLimit({ maxAttempts: 5, windowMs: 60000, cooldownMs: 300000 });

  // Captura e valida o vendedor da URL usando RPC segura
  useEffect(() => {
    const validateVendedor = async () => {
      // Prioriza prop vendorCode, depois searchParams
      const codigo = vendorCode || searchParams.get("v") || searchParams.get("vendedor");
      if (!codigo) return;

      try {
        // Use secure RPC function that exposes only code and name
        const { data, error } = await supabase
          .rpc("validate_vendedor_code", { _codigo: codigo });

        if (error) {
          console.log("Erro ao validar vendedor:", error.message);
          return;
        }

        if (data && data.length > 0) {
          const vendedor = data[0];
          setVendedorCodigo(vendedor.codigo);
          setVendedorNome(vendedor.nome);
          console.log("Vendedor validado:", vendedor.nome);
        } else {
          // Fallback: se não encontrou vendedor válido, não salva nada
          console.log("Vendedor não encontrado ou inativo:", codigo);
        }
      } catch (error) {
        console.error("Erro ao validar vendedor:", error);
      }
    };

    validateVendedor();
  }, [searchParams, vendorCode]);

  const form = useForm<LeadFormData>({
    resolver: zodResolver(leadFormSchema),
    mode: "onBlur",
    defaultValues: {
      nome: "",
      telefone: "",
      cep: "",
      estado: "",
      cidade: "",
      bairro: "",
      rua: "",
      numero: "",
      complemento: "",
      area: undefined,
      tipo_telhado: "",
      rede_atendimento: "",
      media_consumo: undefined,
      consumo_previsto: undefined,
      observacoes: "",
    },
  });

  const { watch, setValue, trigger, formState: { errors } } = form;
  const watchedValues = watch();

  const markFieldTouched = (field: string) => {
    setTouchedFields(prev => new Set(prev).add(field));
  };

  const isFieldValid = (field: string): boolean => {
    const value = watchedValues[field as keyof LeadFormData];
    return touchedFields.has(field) && !errors[field as keyof LeadFormData] && Boolean(value);
  };

  const handleCEPBlur = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, "");
    if (cleanCEP.length !== 8) return;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`);
      const data = await response.json();

      if (!data.erro) {
        setValue("estado", data.uf);
        setValue("cidade", data.localidade);
        setValue("bairro", data.bairro || "");
        setValue("rua", data.logradouro || "");
        markFieldTouched("estado");
        markFieldTouched("cidade");
        if (data.bairro) markFieldTouched("bairro");
        if (data.logradouro) markFieldTouched("rua");
      }
    } catch (error) {
      console.error("Erro ao buscar CEP:", error);
    }
  };

  const getFieldsForStep = (step: number): (keyof LeadFormData)[] => {
    switch (step) {
      case 1:
        return ["nome", "telefone"];
      case 2:
        return ["estado", "cidade"];
      case 3:
        return ["area", "tipo_telhado", "rede_atendimento", "media_consumo", "consumo_previsto"];
      default:
        return [];
    }
  };

  const validateCurrentStep = async () => {
    const fields = getFieldsForStep(currentStep);
    const isValid = await trigger(fields);
    
    // Mark all fields as touched to show errors
    if (!isValid) {
      fields.forEach(field => markFieldTouched(field));
    }
    
    return isValid;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextStep = async () => {
    const isValid = await validateCurrentStep();
    if (!isValid) {
      toast({
        title: "Campos obrigatórios",
        description: "Preencha todos os campos obrigatórios para continuar.",
        variant: "destructive",
      });
      return;
    }
    
    if (currentStep < STEPS.length) {
      setDirection(1);
      setCurrentStep(prev => prev + 1);
      scrollToTop();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && currentStep < STEPS.length) {
      e.preventDefault();
      nextStep();
    }
  };

  const prevStep = () => {
    if (currentStep > 1) {
      setDirection(-1);
      setCurrentStep(prev => prev - 1);
      scrollToTop();
    }
  };

  const triggerConfetti = () => {
    const count = 200;
    const defaults = {
      origin: { y: 0.7 },
      zIndex: 9999,
    };

    function fire(particleRatio: number, opts: confetti.Options) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, { spread: 26, startVelocity: 55 });
    fire(0.2, { spread: 60 });
    fire(0.35, { spread: 100, decay: 0.91, scalar: 0.8 });
    fire(0.1, { spread: 120, startVelocity: 25, decay: 0.92, scalar: 1.2 });
    fire(0.1, { spread: 120, startVelocity: 45 });
  };

  // Auto-save draft
  const { clearDraft, hasDraft } = useFormAutoSave(form, { key: "lead_wizard" });

  const onSubmit = async (data: LeadFormData) => {
    // Check for bots
    const honeypotCheck = validateHoneypot();
    if (honeypotCheck.isBot) {
      console.warn("[Security] Bot detected:", honeypotCheck.reason);
      // Silently fail for bots
      toast({
        title: "Cadastro enviado! ☀️",
        description: "Entraremos em contato em breve.",
      });
      return;
    }

    // Check rate limit
    if (!checkRateLimit()) {
      toast({
        title: "Muitas tentativas",
        description: "Por favor, aguarde alguns minutos antes de tentar novamente.",
        variant: "destructive",
      });
      return;
    }

    recordAttempt();
    setIsSubmitting(true);
    setSavedOffline(false);
    
    console.log("[LeadFormWizard] Starting form submission...");
    
    // Store form data for potential duplicate handling
    pendingFormDataRef.current = data;
    
    const orcamentoData = {
      cep: data.cep?.trim() || null,
      estado: data.estado,
      cidade: data.cidade.trim(),
      rua: data.rua?.trim() || null,
      numero: data.numero?.trim() || null,
      bairro: data.bairro?.trim() || null,
      complemento: data.complemento?.trim() || null,
      area: data.area,
      tipo_telhado: data.tipo_telhado,
      rede_atendimento: data.rede_atendimento,
      media_consumo: data.media_consumo,
      consumo_previsto: data.consumo_previsto,
      observacoes: data.observacoes?.trim() || null,
      arquivos_urls: uploadedFiles,
      vendedor: vendedorNome,
    };

    // Helper to save offline (only used when truly offline)
    const saveOfflineFallback = async (): Promise<boolean> => {
      // Only use offline fallback when actually offline
      if (navigator.onLine) {
        console.log("[LeadFormWizard] Still online, not using offline fallback");
        return false;
      }
      
      const leadData = {
        nome: data.nome.trim(),
        telefone: data.telefone.trim(),
        ...orcamentoData,
      };

      console.log("[LeadFormWizard] Device offline, using saveLead for local storage");
      const result = await saveLead(leadData);

      if (result.success && result.offline) {
        clearDraft();
        resetHoneypot();
        resetRateLimit();
        setSavedOffline(true);
        
        toast({
          title: "Cadastro salvo localmente! 📴",
          description: "Será sincronizado automaticamente quando a conexão voltar.",
        });
        
        setIsSubmitting(false);
        setIsSuccess(true);
        return true;
      }
      return false;
    };

    try {
      // If truly offline, use local save
      // NOTE: `isOnline` state can be stale/incorrect on first load in some browsers.
      const trulyOffline = !navigator.onLine;
      if (trulyOffline) {
        const success = await saveOfflineFallback();
        if (!success) {
          toast({
            title: "Erro ao salvar cadastro",
            description: "Não foi possível salvar o cadastro localmente.",
            variant: "destructive",
          });
          setIsSubmitting(false);
        }
        return;
      }

      // Online: use new Lead/Orcamento system
      const result = await submitOrcamento(
        { nome: data.nome.trim(), telefone: data.telefone.trim() },
        orcamentoData
      );

      console.log("[LeadFormWizard] submitOrcamento result:", result);

      if (result.error === "DUPLICATE_DETECTED") {
        // Duplicate detected - dialog will be shown
        setIsSubmitting(false);
        return;
      }

      if (result.success) {
        console.log("[LeadFormWizard] Success! Setting isSuccess to true");
        clearDraft();
        resetHoneypot();
        resetRateLimit();
        setSavedOffline(false);
        triggerConfetti();
        
        toast({
          title: result.isNewLead 
            ? "Cadastro enviado com sucesso! ☀️"
            : "Novo orçamento vinculado! ☀️",
          description: result.isNewLead
            ? "Entraremos em contato em breve."
            : "Orçamento adicionado ao cliente existente.",
        });
        
        setIsSubmitting(false);
        setIsSuccess(true);
        return;
      } else {
        // Online submission failed - show error, don't silently fall back to offline
        console.error("[LeadFormWizard] Online save failed:", result.error);
        toast({
          title: "Erro ao enviar cadastro",
          description: result.error || "Ocorreu um erro. Tente novamente.",
          variant: "destructive",
        });
        setIsSubmitting(false);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro desconhecido";
      console.error("[LeadFormWizard] Exception during submission:", errorMessage);
      
      // Only try offline fallback if we're truly offline now
      if (!navigator.onLine) {
        console.log("[LeadFormWizard] Connection lost, attempting offline fallback");
        const offlineSuccess = await saveOfflineFallback();
        if (offlineSuccess) return;
      }
      
      toast({
        title: "Erro ao enviar cadastro",
        description: "Ocorreu um erro inesperado. Tente novamente.",
        variant: "destructive",
      });
      setIsSubmitting(false);
    }
  };

  // Handle duplicate confirmation - use selected existing lead
  const handleUseExistingLead = async (lead: import("@/types/orcamento").LeadSimplified) => {
    if (!pendingFormDataRef.current) return;
    
    const data = pendingFormDataRef.current;
    setIsSubmitting(true);
    
    const orcamentoData = {
      cep: data.cep?.trim() || null,
      estado: data.estado,
      cidade: data.cidade.trim(),
      rua: data.rua?.trim() || null,
      numero: data.numero?.trim() || null,
      bairro: data.bairro?.trim() || null,
      complemento: data.complemento?.trim() || null,
      area: data.area,
      tipo_telhado: data.tipo_telhado,
      rede_atendimento: data.rede_atendimento,
      media_consumo: data.media_consumo,
      consumo_previsto: data.consumo_previsto,
      observacoes: data.observacoes?.trim() || null,
      arquivos_urls: uploadedFiles,
      vendedor: vendedorNome,
    };

    const result = await confirmUseExistingLead(orcamentoData, lead);
    
    if (result.success) {
      setIsSuccess(true);
      clearDraft();
      resetHoneypot();
      resetRateLimit();
      triggerConfetti();
      
      toast({
        title: "Novo orçamento vinculado! ☀️",
        description: "Orçamento adicionado ao cliente existente.",
      });
    } else {
      toast({
        title: "Erro ao vincular orçamento",
        description: result.error || "Tente novamente.",
        variant: "destructive",
      });
    }
    
    setIsSubmitting(false);
    pendingFormDataRef.current = null;
  };

  // Handle duplicate - force create new lead
  const handleCreateNewLead = async () => {
    if (!pendingFormDataRef.current) return;
    
    const data = pendingFormDataRef.current;
    setIsSubmitting(true);
    
    const orcamentoData = {
      cep: data.cep?.trim() || null,
      estado: data.estado,
      cidade: data.cidade.trim(),
      rua: data.rua?.trim() || null,
      numero: data.numero?.trim() || null,
      bairro: data.bairro?.trim() || null,
      complemento: data.complemento?.trim() || null,
      area: data.area,
      tipo_telhado: data.tipo_telhado,
      rede_atendimento: data.rede_atendimento,
      media_consumo: data.media_consumo,
      consumo_previsto: data.consumo_previsto,
      observacoes: data.observacoes?.trim() || null,
      arquivos_urls: uploadedFiles,
      vendedor: vendedorNome,
    };

    const result = await forceCreateNewLead(
      { nome: data.nome.trim(), telefone: data.telefone.trim() },
      orcamentoData
    );
    
    if (result.success) {
      setIsSuccess(true);
      clearDraft();
      resetHoneypot();
      resetRateLimit();
      triggerConfetti();
      
      toast({
        title: "Cadastro enviado com sucesso! ☀️",
        description: "Novo cliente criado com orçamento.",
      });
    } else {
      toast({
        title: "Erro ao criar cadastro",
        description: result.error || "Tente novamente.",
        variant: "destructive",
      });
    }
    
    setIsSubmitting(false);
    pendingFormDataRef.current = null;
  };

  const handleCancelDuplicate = () => {
    cancelDuplicateWarning();
    pendingFormDataRef.current = null;
  };

  const resetForm = () => {
    form.reset();
    setCurrentStep(1);
    setIsSuccess(false);
    setSavedOffline(false);
    setUploadedFiles([]);
    setTouchedFields(new Set());
    clearDraft();
    resetHoneypot();
    refreshPendingCount();
    pendingFormDataRef.current = null;
  };

  if (isSuccess) {
    return (
      <Card className="max-w-2xl mx-auto border-0 shadow-2xl overflow-hidden">
        <CardContent className="flex flex-col items-center justify-center py-10 sm:py-16 px-4 sm:px-6">
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 15 }}
            className={`w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center mb-4 sm:mb-6 ${
              savedOffline ? "bg-secondary/20" : "bg-primary/20"
            }`}
          >
            {savedOffline ? (
              <WifiOff className="w-10 h-10 sm:w-12 sm:h-12 text-secondary" />
            ) : (
              <CheckCircle className="w-10 h-10 sm:w-12 sm:h-12 text-primary" />
            )}
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-xl sm:text-2xl font-bold text-foreground mb-2 text-center"
          >
            {savedOffline ? "Salvo Localmente!" : "Cadastro Enviado!"}
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-sm sm:text-base text-muted-foreground text-center mb-4 sm:mb-6"
          >
            {savedOffline 
              ? "Seu cadastro foi salvo e será enviado automaticamente quando a conexão for restabelecida."
              : "Obrigado pelo interesse! Nossa equipe entrará em contato em breve."
            }
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto"
          >
            <Button onClick={resetForm} variant="outline" className="w-full sm:w-auto">
              Fazer novo cadastro
            </Button>
            {savedOffline && pendingCount > 0 && isOnline && (
              <Button 
                onClick={retrySync} 
                disabled={isSyncing}
                className="gap-2 w-full sm:w-auto"
              >
                {isSyncing ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <RefreshCw className="w-4 h-4" />
                )}
                Sincronizar Agora
              </Button>
            )}
          </motion.div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-w-2xl mx-auto border-0 shadow-2xl overflow-hidden">
      <CardHeader className="text-center pb-4 bg-gradient-to-b from-primary/5 to-transparent relative px-4 sm:px-6">
        <motion.img
          src={logo}
          alt="Mais Energia Solar"
          className="h-12 sm:h-16 w-auto mx-auto mb-3 sm:mb-4"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
        />
        <div className="flex items-center justify-center gap-2 mb-1">
          <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-brand-blue">
            Solicite seu Orçamento
          </CardTitle>
        </div>
        <CardDescription className="text-sm sm:text-base">
          Preencha o formulário e receba uma proposta personalizada
        </CardDescription>
        
        {/* Auto-save indicator */}
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4">
          <AutoSaveIndicator hasDraft={hasDraft()} isOnline={isOnline} />
        </div>
      </CardHeader>

      <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
        {/* Enhanced Progress Bar */}
        <FormProgressBar steps={STEPS} currentStep={currentStep} className="mb-6 sm:mb-8" />

        {/* Rate limit warning */}
        <RateLimitWarning
          isBlocked={isBlocked}
          remainingSeconds={getRemainingCooldownSeconds()}
          remainingAttempts={remainingAttempts}
        />

        <form onSubmit={form.handleSubmit(onSubmit)} onKeyDown={handleKeyDown}>
          {/* Honeypot field - invisible to users */}
          <HoneypotField value={honeypotValue} onChange={handleHoneypotChange} />

          <AnimatePresence mode="wait" custom={direction}>
            <motion.div
              key={currentStep}
              custom={direction}
              variants={slideVariants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {/* Step 1: Dados Pessoais */}
              {currentStep === 1 && (
                <div className="space-y-5">
                  <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
                    <FloatingInput
                      label="Nome Completo *"
                      icon={<User className="w-4 h-4" />}
                      value={watchedValues.nome}
                      autoComplete="off"
                      onChange={(e) => setValue("nome", formatName(e.target.value))}
                      onBlur={() => {
                        markFieldTouched("nome");
                        trigger("nome");
                      }}
                      error={touchedFields.has("nome") ? errors.nome?.message : undefined}
                      success={isFieldValid("nome")}
                    />
                  </motion.div>

                  <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
                    <FloatingInput
                      label="Telefone *"
                      icon={<Phone className="w-4 h-4" />}
                      value={watchedValues.telefone}
                      maxLength={15}
                      autoComplete="off"
                      onChange={(e) => setValue("telefone", formatPhone(e.target.value))}
                      onBlur={() => {
                        markFieldTouched("telefone");
                        trigger("telefone");
                      }}
                      error={touchedFields.has("telefone") ? errors.telefone?.message : undefined}
                      success={isFieldValid("telefone")}
                    />
                  </motion.div>
                </div>
              )}

              {/* Step 2: Endereço */}
              {currentStep === 2 && (
                <div className="space-y-5">
                  <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
                    <FloatingInput
                      label="CEP (opcional)"
                      icon={<MapPin className="w-4 h-4" />}
                      value={watchedValues.cep}
                      maxLength={9}
                      autoComplete="off"
                      onChange={(e) => setValue("cep", formatCEP(e.target.value))}
                      onBlur={(e) => {
                        markFieldTouched("cep");
                        handleCEPBlur(e.target.value);
                      }}
                      error={touchedFields.has("cep") ? errors.cep?.message : undefined}
                      success={isFieldValid("cep")}
                    />
                  </motion.div>

                  <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FloatingSelect
                      label="Estado *"
                      icon={<Building className="w-4 h-4" />}
                      value={watchedValues.estado}
                      onValueChange={(value) => {
                        setValue("estado", value);
                        markFieldTouched("estado");
                      }}
                      options={ESTADOS_BRASIL.map(e => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))}
                      error={touchedFields.has("estado") ? errors.estado?.message : undefined}
                      success={isFieldValid("estado")}
                    />
                    <FloatingInput
                      label="Cidade *"
                      value={watchedValues.cidade}
                      onChange={(e) => setValue("cidade", e.target.value)}
                      onBlur={() => {
                        markFieldTouched("cidade");
                        trigger("cidade");
                      }}
                      error={touchedFields.has("cidade") ? errors.cidade?.message : undefined}
                      success={isFieldValid("cidade")}
                    />
                  </motion.div>

                  <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
                    <FloatingInput
                      label="Bairro (opcional)"
                      value={watchedValues.bairro}
                      onChange={(e) => setValue("bairro", e.target.value)}
                    />
                  </motion.div>

                  <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <FloatingInput
                        label="Rua (opcional)"
                        value={watchedValues.rua}
                        onChange={(e) => setValue("rua", e.target.value)}
                      />
                    </div>
                    <FloatingInput
                      label="Nº"
                      icon={<Hash className="w-4 h-4" />}
                      value={watchedValues.numero}
                      onChange={(e) => setValue("numero", e.target.value)}
                    />
                  </motion.div>

                  <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
                    <FloatingInput
                      label="Complemento (opcional)"
                      value={watchedValues.complemento}
                      onChange={(e) => setValue("complemento", e.target.value)}
                    />
                  </motion.div>
                </div>
              )}

              {/* Step 3: Imóvel e Consumo */}
              {currentStep === 3 && (
                <div className="space-y-5">
                  <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
                    <FloatingSelect
                      label="Área *"
                      icon={<Home className="w-4 h-4" />}
                      value={watchedValues.area}
                      onValueChange={(value) => {
                        setValue("area", value as "Urbana" | "Rural");
                        markFieldTouched("area");
                        trigger("area");
                      }}
                      options={[
                        { value: "Urbana", label: "Urbana" },
                        { value: "Rural", label: "Rural" },
                      ]}
                      error={touchedFields.has("area") ? errors.area?.message : undefined}
                      success={isFieldValid("area")}
                    />
                  </motion.div>

                  <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
                    <FloatingSelect
                      label="Tipo de Telhado *"
                      icon={<Home className="w-4 h-4" />}
                      value={watchedValues.tipo_telhado}
                      onValueChange={(value) => {
                        setValue("tipo_telhado", value);
                        markFieldTouched("tipo_telhado");
                        trigger("tipo_telhado");
                      }}
                      options={TIPOS_TELHADO.map(t => ({ value: t, label: t }))}
                      error={touchedFields.has("tipo_telhado") ? errors.tipo_telhado?.message : undefined}
                      success={isFieldValid("tipo_telhado")}
                    />
                  </motion.div>

                  <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
                    <FloatingSelect
                      label="Rede de Atendimento *"
                      icon={<Zap className="w-4 h-4" />}
                      value={watchedValues.rede_atendimento}
                      onValueChange={(value) => {
                        setValue("rede_atendimento", value);
                        markFieldTouched("rede_atendimento");
                        trigger("rede_atendimento");
                      }}
                      options={REDES_ATENDIMENTO.map(r => ({ value: r, label: r }))}
                      error={touchedFields.has("rede_atendimento") ? errors.rede_atendimento?.message : undefined}
                      success={isFieldValid("rede_atendimento")}
                    />
                  </motion.div>

                  <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <FloatingInput
                      label="Média de Consumo (kWh) *"
                      icon={<BarChart3 className="w-4 h-4" />}
                      type="number"
                      value={watchedValues.media_consumo || ""}
                      onChange={(e) => setValue("media_consumo", e.target.value ? Number(e.target.value) : undefined)}
                      onBlur={() => {
                        markFieldTouched("media_consumo");
                        trigger("media_consumo");
                      }}
                      error={touchedFields.has("media_consumo") ? errors.media_consumo?.message : undefined}
                      success={isFieldValid("media_consumo")}
                    />
                    <FloatingInput
                      label="Consumo Previsto (kWh) *"
                      icon={<BarChart3 className="w-4 h-4" />}
                      type="number"
                      value={watchedValues.consumo_previsto || ""}
                      onChange={(e) => setValue("consumo_previsto", e.target.value ? Number(e.target.value) : undefined)}
                      onBlur={() => {
                        markFieldTouched("consumo_previsto");
                        trigger("consumo_previsto");
                      }}
                      error={touchedFields.has("consumo_previsto") ? errors.consumo_previsto?.message : undefined}
                      success={isFieldValid("consumo_previsto")}
                    />
                  </motion.div>

                  {watchedValues.media_consumo && watchedValues.consumo_previsto && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3 }}
                    >
                      <ConsumptionChart
                        mediaConsumo={watchedValues.media_consumo}
                        consumoPrevisto={watchedValues.consumo_previsto}
                      />
                    </motion.div>
                  )}

                  {/* Upload de Arquivos */}
                  <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                      <FileText className="w-4 h-4 text-secondary" /> Contas de Luz (opcional)
                    </label>
                    <FileUpload
                      onFilesChange={setUploadedFiles}
                      maxFiles={10}
                      maxSizeMB={10}
                    />
                  </motion.div>

                  {/* Observações */}
                  <motion.div custom={5} variants={fieldVariants} initial="hidden" animate="visible">
                    <label className="flex items-center gap-2 text-sm font-medium mb-2">
                      <MessageSquare className="w-4 h-4 text-secondary" /> Observações (opcional)
                    </label>
                    <Textarea
                      placeholder="Informações adicionais..."
                      className="min-h-[80px] rounded-xl border-2 border-muted-foreground/25 focus:border-primary transition-colors"
                      value={watchedValues.observacoes}
                      onChange={(e) => setValue("observacoes", e.target.value)}
                    />
                  </motion.div>
                </div>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Navigation Buttons */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar
            </Button>

            {currentStep < STEPS.length ? (
              <Button
                type="button"
                onClick={nextStep}
                className="gap-2 gradient-solar hover:opacity-90"
              >
                Próximo
                <ArrowRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                className="gap-2 gradient-solar hover:opacity-90"
                disabled={isSubmitting || isBlocked}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Enviar Cadastro
                  </>
                )}
              </Button>
            )}
          </div>

          {/* Security badge */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="flex items-center justify-center gap-2 mt-6 text-xs text-muted-foreground"
          >
            <ShieldCheck className="w-4 h-4 text-primary" />
            <span>Seus dados estão protegidos e seguros</span>
          </motion.div>
        </form>

        {/* Duplicate Lead Warning Dialog */}
        <DuplicateLeadWarning
          open={showDuplicateWarning}
          matchingLeads={matchingLeads}
          selectedLead={selectedLead}
          onSelectLead={selectLeadFromList}
          onUseExisting={handleUseExistingLead}
          onCreateNew={handleCreateNewLead}
          onCancel={handleCancelDuplicate}
          isSubmitting={isSubmitting || isSubmittingOrcamento}
        />
      </CardContent>
    </Card>
  );
}
