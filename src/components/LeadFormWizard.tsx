import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import confetti from "canvas-confetti";
import { 
  User, Phone, MapPin, Home, Zap, BarChart3, MessageSquare, 
  Send, Loader2, CheckCircle, FileText, ArrowLeft, ArrowRight,
  Building, Hash, WifiOff, RefreshCw, ShieldCheck
} from "lucide-react";
import { useCidadesPorEstado } from "@/hooks/useCidadesPorEstado";
import { WizardSuccessScreen, StepPersonalData, StepAddress, StepConsumption } from "@/components/wizard";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { FloatingInput } from "@/components/ui/floating-input";
import { FloatingSelect } from "@/components/ui/floating-select";
import ConsumptionChart from "./ConsumptionChart";
import FileUploadOffline, { type OfflineFile, uploadOfflineFiles } from "./FileUploadOffline";
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
  step1Schema,
  step2Schema,
  step3Schema,
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
  const navigate = useNavigate();
  const { user } = useAuth();
  const [currentStep, setCurrentStep] = useState(1);
  const [direction, setDirection] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [savedOffline, setSavedOffline] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<OfflineFile[]>([]);
  const [touchedFields, setTouchedFields] = useState<Set<string>>(new Set());
  const [vendedorCodigo, setVendedorCodigo] = useState<string | null>(null);
  const [vendedorNome, setVendedorNome] = useState<string | null>(null);
  const [vendedorId, setVendedorId] = useState<string | null>(null);
  const [isCheckingDuplicate, setIsCheckingDuplicate] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  // Store the user's duplicate decision so final submit skips re-check
  const [duplicateDecision, setDuplicateDecision] = useState<
    { type: "use_existing"; leadId: string } | { type: "create_new" } | null
  >(null);
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
    checkExistingLeads,
    triggerDuplicateWarning,
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
          // Resolve vendedor_id for proper attribution
          const { data: vendedorRecord } = await supabase
            .from("vendedores")
            .select("id")
            .eq("codigo", vendedor.codigo)
            .eq("ativo", true)
            .maybeSingle();
          if (vendedorRecord) {
            setVendedorId(vendedorRecord.id);
          }
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
    mode: "onChange",
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

  // City dropdown by state (IBGE API)
  const { cidades, isLoading: cidadesLoading } = useCidadesPorEstado(watchedValues.estado);

  const markFieldTouched = (field: string) => {
    setTouchedFields(prev => new Set(prev).add(field));
  };

  const isFieldValid = (field: string): boolean => {
    const value = watchedValues[field as keyof LeadFormData];
    return touchedFields.has(field) && !errors[field as keyof LeadFormData] && Boolean(value);
  };

  // CEP lookup: debounce, AbortController, in-memory cache
  const cepCacheRef = useRef<Map<string, { uf: string; localidade: string; bairro: string; logradouro: string }>>(new Map());
  const cepAbortRef = useRef<AbortController | null>(null);
  const cepDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Flag to prevent Estado onValueChange from clearing cidade after CEP auto-fill
  const cepJustFilledRef = useRef(false);

  const applyCepData = (data: { uf: string; localidade: string; bairro: string; logradouro: string }) => {
    cepJustFilledRef.current = true;
    setValue("estado", data.uf);
    setValue("cidade", data.localidade);
    setValue("bairro", data.bairro || "");
    setValue("rua", data.logradouro || "");
    markFieldTouched("estado");
    markFieldTouched("cidade");
    if (data.bairro) markFieldTouched("bairro");
    if (data.logradouro) markFieldTouched("rua");
    // Reset flag after React processes the state updates
    setTimeout(() => { cepJustFilledRef.current = false; }, 100);
  };

  const handleCEPBlur = async (cep: string) => {
    const cleanCEP = cep.replace(/\D/g, "");

    // Cancel any pending debounce
    if (cepDebounceRef.current) clearTimeout(cepDebounceRef.current);

    // If empty, it's optional - no error, just clear
    if (cleanCEP.length === 0) {
      setValue("cep", "");
      return;
    }

    // If partially typed but not 8 digits, clear the field
    if (cleanCEP.length !== 8) {
      toast({
        title: "CEP inválido",
        description: "O CEP deve ter 8 dígitos. Campo limpo para nova digitação.",
        variant: "destructive",
      });
      setValue("cep", "");
      return;
    }

    // Check cache first
    const cached = cepCacheRef.current.get(cleanCEP);
    if (cached) {
      applyCepData(cached);
      return;
    }

    // Abort only a previous in-flight request
    if (cepAbortRef.current) cepAbortRef.current.abort();

    const controller = new AbortController();
    cepAbortRef.current = controller;

    try {
      const response = await fetch(`https://viacep.com.br/ws/${cleanCEP}/json/`, {
        signal: controller.signal,
      });
      const data = await response.json();

      if (data.erro) {
        toast({
          title: "CEP não encontrado",
          description: "Verifique o CEP digitado. Campo limpo para nova digitação.",
          variant: "destructive",
        });
        setValue("cep", "");
        return;
      }

      // Cache the result
      const cepData = {
        uf: data.uf,
        localidade: data.localidade,
        bairro: data.bairro || "",
        logradouro: data.logradouro || "",
      };
      cepCacheRef.current.set(cleanCEP, cepData);
      applyCepData(cepData);
    } catch (error: any) {
      if (error?.name === "AbortError") return;
      console.error("Erro ao buscar CEP:", error);
      toast({
        title: "Erro ao buscar CEP",
        description: "Não foi possível consultar o CEP. Preencha o endereço manualmente.",
        variant: "destructive",
      });
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
    // Validate ONLY the current step's fields using step-specific Zod schemas
    // This prevents Step 3 fields from blocking Step 2 → Step 3 navigation
    const currentValues = form.getValues();
    let stepSchema;
    switch (currentStep) {
      case 1: stepSchema = step1Schema; break;
      case 2: stepSchema = step2Schema; break;
      case 3: stepSchema = step3Schema; break;
      default: return true;
    }

    const result = stepSchema.safeParse(currentValues);
    
    if (!result.success) {
      // Mark fields as touched so errors become visible
      const errorFields = Object.keys(result.error.flatten().fieldErrors);
      errorFields.forEach(field => markFieldTouched(field));
      
      // Also trigger react-hook-form errors for those specific fields only
      const fields = getFieldsForStep(currentStep);
      await trigger(fields);
      
      // Scroll and focus the first invalid field
      requestAnimationFrame(() => {
        const firstError = document.querySelector('[data-field-error="true"]');
        if (firstError) {
          firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const input = firstError.querySelector('input, select, textarea, [role="combobox"]') as HTMLElement;
          input?.focus();
        }
      });
      
      return false;
    }
    
    return true;
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

    // Check for duplicate phone on step 1 → 2 transition
    if (currentStep === 1) {
      const telefone = form.getValues("telefone");
      if (telefone && navigator.onLine) {
        setIsCheckingDuplicate(true);
        try {
          const existing = await checkExistingLeads(telefone);
          if (existing && existing.hasDuplicate) {
            // Store form data for after the user decides
            pendingFormDataRef.current = form.getValues();
            triggerDuplicateWarning(existing.leads);
            setIsCheckingDuplicate(false);
            return; // Don't advance — wait for user decision
          }
        } catch (err) {
          console.warn("[nextStep] Duplicate check failed, continuing:", err);
        }
        setIsCheckingDuplicate(false);
      }
    }
    
    if (currentStep < STEPS.length) {
      setDirection(1);
      const nextStepNum = currentStep + 1;
      setCurrentStep(nextStepNum);
      scrollToTop();
      // Auto-focus first field of next step
      focusStepField(nextStepNum);
    }
  };

  // Auto-focus the primary field of each step
  const focusStepField = (step: number) => {
    setTimeout(() => {
      let el: HTMLElement | null = null;
      switch (step) {
        case 1:
          // Focus the Nome input (first visible input in step 1)
          el = document.querySelector('[data-field-error] input, form input') as HTMLElement;
          break;
        case 2:
          el = document.querySelector('[data-field="cep"] input') as HTMLElement;
          break;
        case 3:
          el = document.querySelector('[data-field="area"] [role="combobox"]') as HTMLElement;
          break;
      }
      if (el) {
        el.focus();
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 450); // Wait for AnimatePresence transition
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

  // Auto-focus Nome on initial mount
  useEffect(() => {
    focusStepField(1);
  }, []);

  // Handle draft clear with confirmation
  const handleClearDraft = () => {
    if (window.confirm("Deseja apagar o rascunho e recomeçar do zero?")) {
      clearDraft();
      form.reset({
        nome: "", telefone: "", cep: "", estado: "", cidade: "",
        bairro: "", rua: "", numero: "", complemento: "",
        area: undefined, tipo_telhado: "", rede_atendimento: "",
        media_consumo: undefined, consumo_previsto: undefined, observacoes: "",
      });
      setTouchedFields(new Set());
      setSubmitAttempted(false);
      setDuplicateDecision(null);
      setCurrentStep(1);
      setDirection(-1);
      toast({
        title: "Rascunho apagado",
        description: "Formulário limpo. Comece novamente.",
      });
      focusStepField(1);
    }
  };

  /**
   * Redirect authenticated vendor to WhatsApp inbox after lead creation.
   * 1) Auto-assigns the matching WA conversation to the vendor (DB function)
   * 2) Stores lead data in sessionStorage so WaInbox can auto-open + prefill message
   * 3) Redirects to WhatsApp tab
   * NEVER changes instance_id.
   */
  const redirectToInbox = async (data: LeadFormData) => {
    if (!user) return; // Only for authenticated users

    // 1) Auto-assign conversation via SECURITY DEFINER function
    const phoneDigits = data.telefone.replace(/\D/g, "");
    let assignedConvId: string | null = null;
    if (phoneDigits.length >= 10) {
      try {
        const { data: convId, error } = await supabase
          .rpc("assign_wa_conversation_by_phone", { _phone_digits: phoneDigits });
        if (!error && convId) {
          assignedConvId = convId as string;
          console.log("[redirectToInbox] Conversation assigned:", assignedConvId);
        } else {
          console.log("[redirectToInbox] No existing conversation found for", phoneDigits);
        }
      } catch (err) {
        console.warn("[redirectToInbox] Failed to assign conversation:", err);
      }
    }

    // 2) Store lead data for WaInbox auto-open + prefill
    const autoOpenData = {
      phone: data.telefone.trim(),
      nome: data.nome.trim(),
      cidade: data.cidade?.trim() || undefined,
      estado: data.estado || undefined,
      consumo: data.media_consumo || undefined,
      tipo_telhado: data.tipo_telhado || undefined,
      rede_atendimento: data.rede_atendimento || undefined,
      consultor_nome: vendedorNome || undefined,
      assignedConvId: assignedConvId || undefined,
    };
    sessionStorage.setItem("wa_auto_open_lead", JSON.stringify(autoOpenData));

    toast({
      title: "Lead criado ✅",
      description: assignedConvId
        ? "Conversa atribuída. Abrindo..."
        : "Abrindo conversa...",
    });

    // 3) Redirect to WhatsApp tab
    setTimeout(() => {
      const currentPath = window.location.pathname;
      if (currentPath.startsWith("/vendedor")) {
        navigate("/vendedor?tab=whatsapp", { replace: true });
      } else if (currentPath.startsWith("/app")) {
        navigate("/app", { replace: true });
      } else {
        navigate("/vendedor?tab=whatsapp", { replace: true });
      }
    }, 300);
  };

  // Helper to build orcamento payload from form data
  const buildOrcamentoData = (data: LeadFormData, urls: string[]) => ({
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
    arquivos_urls: urls,
    vendedor: vendedorNome || "Site",
    vendedor_id: vendedorId || undefined,
  });

  // Handler for when form validation fails (fields have errors but user can't see them)
  const onFormInvalid = (fieldErrors: Record<string, any>) => {
    console.warn("[LeadFormWizard] Form validation failed:", Object.keys(fieldErrors));
    setSubmitAttempted(true);
    // Mark ALL fields as touched so validation errors become visible
    const allFieldNames = Object.keys(fieldErrors);
    setTouchedFields(prev => {
      const next = new Set(prev);
      allFieldNames.forEach(f => next.add(f));
      return next;
    });
    toast({
      title: "Campos obrigatórios",
      description: "Preencha todos os campos obrigatórios para enviar.",
      variant: "destructive",
    });
    // Scroll to first invalid field
    requestAnimationFrame(() => {
      const firstError = document.querySelector('[data-field-error="true"]');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
        const input = firstError.querySelector('input, select, textarea, [role="combobox"]') as HTMLElement;
        input?.focus();
      }
    });
  };

  const onSubmit = async (data: LeadFormData) => {
    // Check for bots
    const honeypotCheck = validateHoneypot();
    if (honeypotCheck.isBot) {
      console.warn("[Security] Bot detected:", honeypotCheck.reason);
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

    // Upload files if online, otherwise store as base64 for later
    let fileUrls: string[] = [];
    const hasFiles = uploadedFiles.length > 0;

    // Helper to save offline (used when offline or when online submission fails)
    const saveOfflineFallback = async (): Promise<boolean> => {
      const leadData = {
        nome: data.nome.trim(),
        telefone: data.telefone.trim(),
        ...buildOrcamentoData(data, []),
        offlineFiles: hasFiles ? uploadedFiles : undefined,
      };

      console.log("[LeadFormWizard] Using saveLead for local storage");
      const result = await saveLead(leadData);

      if (result.success && result.offline) {
        clearDraft();
        resetHoneypot();
        resetRateLimit();
        setSavedOffline(true);
        
        toast({
          title: "Cadastro salvo localmente! 📴",
          description: hasFiles 
            ? "Cadastro e arquivos serão enviados quando a conexão voltar."
            : "Será sincronizado automaticamente quando a conexão voltar.",
        });
        
        setIsSubmitting(false);
        setIsSuccess(true);
        return true;
      }
      return false;
    };

    try {
      // If truly offline, use local save
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

      // Online: upload files first, then submit
      if (hasFiles) {
        try {
          fileUrls = await uploadOfflineFiles(uploadedFiles);
        } catch (err) {
          console.warn("[LeadFormWizard] File upload failed, continuing without files");
        }
      }

      const orcamentoData = buildOrcamentoData(data, fileUrls);

      // If user already made a duplicate decision on step 1, use it
      if (duplicateDecision) {
        const opts = duplicateDecision.type === "use_existing"
          ? { useExistingLeadId: duplicateDecision.leadId }
          : { forceNew: true };

        const result = await submitOrcamento(
          { nome: data.nome.trim(), telefone: data.telefone.trim(), vendedor_id: vendedorId || undefined },
          orcamentoData,
          opts
        );

        if (result.success) {
          clearDraft();
          resetHoneypot();
          resetRateLimit();
          setSavedOffline(false);
          triggerConfetti();

          toast({
            title: duplicateDecision.type === "use_existing"
              ? "Novo orçamento vinculado! ☀️"
              : "Cadastro enviado com sucesso! ☀️",
            description: duplicateDecision.type === "use_existing"
              ? "Orçamento adicionado ao cliente existente."
              : "Entraremos em contato em breve.",
          });

          setIsSubmitting(false);
          setIsSuccess(true);
          setDuplicateDecision(null);
          redirectToInbox(data);
          return;
        } else {
          toast({
            title: "Erro ao enviar cadastro",
            description: result.error || "Ocorreu um erro. Tente novamente.",
            variant: "destructive",
          });
          setIsSubmitting(false);
          setDuplicateDecision(null);
          return;
        }
      }

      // No prior decision — normal flow (will check for duplicates)
      const result = await submitOrcamento(
        { nome: data.nome.trim(), telefone: data.telefone.trim(), vendedor_id: vendedorId || undefined },
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
        redirectToInbox(data);
        return;
      } else {
        // Online submission failed — try offline fallback
        console.warn("[LeadFormWizard] Online save failed, attempting offline fallback:", result.error);
        const offlineSuccess = await saveOfflineFallback();
        if (offlineSuccess) return;

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
      
      // Try offline fallback for any network failure
      console.log("[LeadFormWizard] Attempting offline fallback after exception");
      const offlineSuccess = await saveOfflineFallback();
      if (offlineSuccess) return;
      
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
    // If we're still on step 1 (early check), store decision and advance
    if (currentStep === 1) {
      setDuplicateDecision({ type: "use_existing", leadId: lead.id });
      cancelDuplicateWarning();
      pendingFormDataRef.current = null;
      setDirection(1);
      setCurrentStep(2);
      scrollToTop();
      return;
    }

    // Otherwise, we're on final submit — execute immediately
    if (!pendingFormDataRef.current) return;
    
    const data = pendingFormDataRef.current;
    setIsSubmitting(true);
    
    let fileUrls: string[] = [];
    if (uploadedFiles.length > 0) {
      try {
        fileUrls = await uploadOfflineFiles(uploadedFiles);
      } catch (err) {
        console.warn("[handleUseExistingLead] File upload failed");
      }
    }

    const orcamentoData = buildOrcamentoData(data, fileUrls);
    const result = await confirmUseExistingLead(orcamentoData, lead);
    
    if (result.success) {
      setIsSuccess(true);
      redirectToInbox(data);
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
    // If we're still on step 1 (early check), store decision and advance
    if (currentStep === 1) {
      setDuplicateDecision({ type: "create_new" });
      cancelDuplicateWarning();
      pendingFormDataRef.current = null;
      setDirection(1);
      setCurrentStep(2);
      scrollToTop();
      return;
    }

    // Otherwise, we're on final submit — execute immediately
    if (!pendingFormDataRef.current) return;
    
    const data = pendingFormDataRef.current;
    setIsSubmitting(true);
    
    let fileUrls: string[] = [];
    if (uploadedFiles.length > 0) {
      try {
        fileUrls = await uploadOfflineFiles(uploadedFiles);
      } catch (err) {
        console.warn("[handleCreateNewLead] File upload failed");
      }
    }

    const orcamentoData = buildOrcamentoData(data, fileUrls);
    const result = await forceCreateNewLead(
      { nome: data.nome.trim(), telefone: data.telefone.trim(), vendedor_id: vendedorId || undefined },
      orcamentoData
    );
    
    if (result.success) {
      setIsSuccess(true);
      redirectToInbox(data);
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
    setDuplicateDecision(null);
    setSubmitAttempted(false);
    clearDraft();
    resetHoneypot();
    refreshPendingCount();
    pendingFormDataRef.current = null;
  };

  // After sync completes, update the success screen from "offline" to "sent"
  const hasSynced = savedOffline && pendingCount === 0 && isOnline;
  const showOfflineState = savedOffline && !hasSynced;

  if (isSuccess) {
    return (
      <WizardSuccessScreen
        savedOffline={savedOffline}
        pendingCount={pendingCount}
        isOnline={isOnline}
        isSyncing={isSyncing}
        onReset={resetForm}
        onRetrySync={retrySync}
      />
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
        
        {/* Vendor name highlight */}
        {vendedorNome && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mb-3"
          >
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full">
              <User className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-primary">
                Consultor: {vendedorNome}
              </span>
            </div>
          </motion.div>
        )}

        <div className="flex items-center justify-center gap-2 mb-1">
          <CardTitle className="text-xl sm:text-2xl md:text-3xl font-bold text-secondary">
            Solicite seu Orçamento
          </CardTitle>
        </div>
        <CardDescription className="text-sm sm:text-base">
          Preencha o formulário e receba uma proposta personalizada
        </CardDescription>
        
        {/* Auto-save indicator */}
        <div className="absolute top-3 sm:top-4 right-3 sm:right-4">
          <AutoSaveIndicator hasDraft={hasDraft} isOnline={isOnline} onClear={handleClearDraft} />
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

        <form onSubmit={form.handleSubmit(onSubmit, onFormInvalid)} onKeyDown={handleKeyDown} autoComplete="off">
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
                  <div data-field-error={!!errors.nome && touchedFields.has("nome")} className="space-y-0">
                    <FloatingInput
                      label="Nome Completo *"
                      icon={<User className="w-4 h-4" />}
                      value={watchedValues.nome}
                      autoComplete="nope"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => setValue("nome", formatName(e.target.value), { shouldValidate: touchedFields.has("nome") })}
                      onBlur={() => {
                        const trimmed = watchedValues.nome?.replace(/\s+/g, " ").trim() || "";
                        if (trimmed !== watchedValues.nome) {
                          setValue("nome", trimmed, { shouldValidate: true });
                        }
                        markFieldTouched("nome");
                      }}
                      error={touchedFields.has("nome") ? errors.nome?.message : undefined}
                      success={isFieldValid("nome")}
                    />
                  </div>
                  </motion.div>

                  <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
                  <div data-field-error={!!errors.telefone && touchedFields.has("telefone")} className="space-y-0">
                    <FloatingInput
                      label="Telefone *"
                      icon={<Phone className="w-4 h-4" />}
                      value={watchedValues.telefone}
                      maxLength={15}
                      autoComplete="nope"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => setValue("telefone", formatPhone(e.target.value), { shouldValidate: touchedFields.has("telefone") })}
                      error={touchedFields.has("telefone") ? errors.telefone?.message : undefined}
                      success={isFieldValid("telefone")}
                    />
                  </div>
                  </motion.div>
                </div>
              )}

              {/* Step 2: Endereço */}
              {currentStep === 2 && (
                <div className="space-y-5">
                  <motion.div custom={0} variants={fieldVariants} initial="hidden" animate="visible">
                    <div data-field="cep">
                     <FloatingInput
                      label="CEP (opcional)"
                      icon={<MapPin className="w-4 h-4" />}
                      value={watchedValues.cep}
                      maxLength={9}
                      autoComplete="nope"
                      autoCorrect="off"
                      spellCheck={false}
                      onChange={(e) => setValue("cep", formatCEP(e.target.value))}
                      onBlur={(e) => {
                        handleCEPBlur(e.target.value);
                      }}
                      error={touchedFields.has("cep") ? errors.cep?.message : undefined}
                      success={isFieldValid("cep")}
                    />
                    </div>
                  </motion.div>

                  <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div data-field-error={!!errors.estado && touchedFields.has("estado")}>
                    <FloatingSelect
                      label="Estado *"
                      icon={<Building className="w-4 h-4" />}
                      value={watchedValues.estado}
                      onValueChange={(value) => {
                        // Only clear cidade if user manually changed estado (not CEP auto-fill)
                        const prevEstado = form.getValues("estado");
                        if (value !== prevEstado && !cepJustFilledRef.current) {
                          setValue("cidade", "", { shouldValidate: false });
                        }
                        setValue("estado", value, { shouldValidate: touchedFields.has("estado") });
                      }}
                      options={ESTADOS_BRASIL.map(e => ({ value: e.sigla, label: `${e.sigla} - ${e.nome}` }))}
                      error={touchedFields.has("estado") ? errors.estado?.message : undefined}
                      success={isFieldValid("estado")}
                    />
                    </div>
                    <div data-field-error={!!errors.cidade && touchedFields.has("cidade")}>
                    {cidades.length > 0 ? (
                      <FloatingSelect
                        label={cidadesLoading ? "Carregando cidades..." : "Cidade *"}
                        value={watchedValues.cidade}
                        onValueChange={(value) => {
                          setValue("cidade", value, { shouldValidate: touchedFields.has("cidade") });
                        }}
                        options={cidades.map(c => ({ value: c, label: c }))}
                        error={touchedFields.has("cidade") ? errors.cidade?.message : undefined}
                        success={isFieldValid("cidade")}
                      />
                    ) : (
                   <FloatingInput
                      label={cidadesLoading ? "Carregando cidades..." : "Cidade *"}
                      autoComplete="nope"
                        value={watchedValues.cidade}
                        onChange={(e) => setValue("cidade", e.target.value, { shouldValidate: touchedFields.has("cidade") })}
                        error={touchedFields.has("cidade") ? errors.cidade?.message : undefined}
                        success={isFieldValid("cidade")}
                      />
                    )}
                    </div>
                  </motion.div>

                  <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
                     <FloatingInput
                      label="Bairro (opcional)"
                      autoComplete="nope"
                      autoCorrect="off"
                      spellCheck={false}
                      value={watchedValues.bairro}
                      onChange={(e) => setValue("bairro", e.target.value)}
                    />
                  </motion.div>

                  <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                       <FloatingInput
                        label="Rua (opcional)"
                        autoComplete="nope"
                        autoCorrect="off"
                        spellCheck={false}
                        value={watchedValues.rua}
                        onChange={(e) => setValue("rua", e.target.value)}
                      />
                    </div>
                    <FloatingInput
                      label="Nº"
                      icon={<Hash className="w-4 h-4" />}
                      autoComplete="nope"
                      value={watchedValues.numero}
                      onChange={(e) => setValue("numero", e.target.value)}
                    />
                  </motion.div>

                  <motion.div custom={4} variants={fieldVariants} initial="hidden" animate="visible">
                    <FloatingInput
                      label="Complemento (opcional)"
                      autoComplete="nope"
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
                    <div data-field="area" data-field-error={!!errors.area && submitAttempted}>
                    <FloatingSelect
                      label="Área *"
                      icon={<Home className="w-4 h-4" />}
                      value={watchedValues.area}
                      onValueChange={(value) => {
                        setValue("area", value as "Urbana" | "Rural");
                      }}
                      options={[
                        { value: "Urbana", label: "Urbana" },
                        { value: "Rural", label: "Rural" },
                      ]}
                      error={submitAttempted ? errors.area?.message : undefined}
                      success={false}
                    />
                    </div>
                  </motion.div>

                  <motion.div custom={1} variants={fieldVariants} initial="hidden" animate="visible">
                    <div data-field-error={!!errors.tipo_telhado && submitAttempted}>
                    <FloatingSelect
                      label="Tipo de Telhado *"
                      icon={<Home className="w-4 h-4" />}
                      value={watchedValues.tipo_telhado}
                      onValueChange={(value) => {
                        setValue("tipo_telhado", value);
                      }}
                      options={TIPOS_TELHADO.map(t => ({ value: t, label: t }))}
                      error={submitAttempted ? errors.tipo_telhado?.message : undefined}
                      success={false}
                    />
                    </div>
                  </motion.div>

                  <motion.div custom={2} variants={fieldVariants} initial="hidden" animate="visible">
                    <div data-field-error={!!errors.rede_atendimento && submitAttempted}>
                    <FloatingSelect
                      label="Rede de Atendimento *"
                      icon={<Zap className="w-4 h-4" />}
                      value={watchedValues.rede_atendimento}
                      onValueChange={(value) => {
                        setValue("rede_atendimento", value);
                      }}
                      options={REDES_ATENDIMENTO.map(r => ({ value: r, label: r }))}
                      error={submitAttempted ? errors.rede_atendimento?.message : undefined}
                      success={false}
                    />
                    </div>
                  </motion.div>

                  <motion.div custom={3} variants={fieldVariants} initial="hidden" animate="visible" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div data-field-error={!!errors.media_consumo && submitAttempted}>
                    <FloatingInput
                      label="Média de Consumo (kWh) *"
                      icon={<BarChart3 className="w-4 h-4" />}
                      type="number"
                      autoComplete="nope"
                      value={watchedValues.media_consumo || ""}
                      onChange={(e) => setValue("media_consumo", e.target.value ? Number(e.target.value) : undefined)}
                      error={submitAttempted ? errors.media_consumo?.message : undefined}
                      success={false}
                    />
                    </div>
                    <div data-field-error={!!errors.consumo_previsto && submitAttempted}>
                    <FloatingInput
                      label="Consumo Previsto (kWh) *"
                      icon={<BarChart3 className="w-4 h-4" />}
                      type="number"
                      autoComplete="nope"
                      value={watchedValues.consumo_previsto || ""}
                      onChange={(e) => setValue("consumo_previsto", e.target.value ? Number(e.target.value) : undefined)}
                      error={submitAttempted ? errors.consumo_previsto?.message : undefined}
                      success={false}
                    />
                    </div>
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
                    <FileUploadOffline
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
                      autoComplete="nope"
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
                disabled={isCheckingDuplicate}
                className="gap-2 gradient-solar hover:opacity-90"
              >
                {isCheckingDuplicate ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Verificando...
                  </>
                ) : (
                  <>
                    Próximo
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
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
