import { useState, useEffect, useRef, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, AnimatePresence } from "framer-motion";
import { useSearchParams } from "react-router-dom";
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
import { getVendedorWaSettings, buildAutoMessage, sendAutoWelcomeMessage, normalizePhoneDigits, savePipelineDiag, type WaPipelineDiag } from "@/lib/waAutoMessage";
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
  step1Schema,
  step2Schema,
  step3Schema,
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

  // Store last WA params for resend button
  const lastWaParamsRef = useRef<{ telefone: string; leadId?: string; mensagem: string; userId: string } | null>(null);

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
  // OU resolve automaticamente pelo usuário logado (auto-atribuição)
  useEffect(() => {
    const validateVendedor = async () => {
      // Prioriza prop vendorCode, depois searchParams
      const codigo = vendorCode || searchParams.get("v") || searchParams.get("vendedor");
      
      if (codigo) {
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
            console.log("Vendedor não encontrado ou inativo:", codigo);
          }
        } catch (error) {
          console.error("Erro ao validar vendedor:", error);
        }
        return;
      }

      // Se não tem código na URL mas o usuário está logado,
      // resolve o vendedor_id automaticamente (auto-atribuição)
      if (user) {
        try {
          const { data: vendedorRecord } = await supabase
            .from("vendedores")
            .select("id, nome, codigo")
            .eq("user_id", user.id)
            .eq("ativo", true)
            .maybeSingle();

          if (vendedorRecord) {
            setVendedorId(vendedorRecord.id);
            setVendedorNome(vendedorRecord.nome);
            setVendedorCodigo(vendedorRecord.codigo);
            console.log("Vendedor auto-atribuído (logado):", vendedorRecord.nome);
          }
        } catch (error) {
          console.error("Erro ao resolver vendedor logado:", error);
        }
      }
    };

    validateVendedor();
  }, [searchParams, vendorCode, user]);

  // Dynamic resolver: validates ONLY the current step's schema.
  // On step 3 (final submit), RHF's handleSubmit uses the full leadFormSchema.
  const currentStepRef = useRef(1);
  currentStepRef.current = currentStep;

  const dynamicResolver = useCallback(
    (values: any, context: any, options: any) => {
      const step = currentStepRef.current;
      const schema = step === 1 ? step1Schema : step === 2 ? step2Schema : leadFormSchema;
      return zodResolver(schema)(values, context, options);
    },
    []
  );

  const form = useForm<LeadFormData>({
    resolver: dynamicResolver,
    mode: "onSubmit",
    reValidateMode: "onSubmit",
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

  const { watch, setValue, formState: { errors } } = form;
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

  // Canonical field arrays per step — single source of truth
  const STEP_FIELDS: Record<number, (keyof LeadFormData)[]> = {
    1: ["nome", "telefone"],
    2: ["cep", "estado", "cidade", "bairro", "rua", "numero", "complemento"],
    3: ["area", "tipo_telhado", "rede_atendimento", "media_consumo", "consumo_previsto", "observacoes"],
  };

  const getFieldsForStep = (step: number): (keyof LeadFormData)[] => {
    return STEP_FIELDS[step] || [];
  };

  const validateCurrentStep = async () => {
    const fields = getFieldsForStep(currentStep);
    if (fields.length === 0) return true;

    // trigger() now uses the dynamic resolver which only knows about current step fields
    const isValid = await form.trigger(fields, { shouldFocus: true });

    if (!isValid) {
      fields.forEach(f => markFieldTouched(f));
    }

    return isValid;
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const nextStep = async () => {
    // Force blur on the active element so Enter and Click behave identically.
    // Without this, clicking "Próximo" triggers onBlur (marking fields touched),
    // but pressing Enter does not — causing inconsistent error visibility.
    const active = document.activeElement as HTMLElement | null;
    if (active && active.tagName && /^(INPUT|TEXTAREA|SELECT)$/i.test(active.tagName)) {
      active.blur();
    }

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
      // Dynamic resolver handles scope — no need to clear other step errors
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
      // Clear errors for the step being left so they don't persist
      const leavingStepFields = getFieldsForStep(currentStep);
      form.clearErrors(leavingStepFields);
      setCurrentStep(prev => prev - 1);
      // Reset submitAttempted so Step 3 errors don't persist after going back
      setSubmitAttempted(false);
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
   * Handle post-lead WhatsApp actions in the background (fire-and-forget).
   * 1) Sends auto welcome message via existing pipeline (creates REAL conversation)
   * 2) Auto-assigns matching WA conversation to the vendor (with retry/backoff)
   * NEVER redirects. NEVER blocks UI. NEVER changes instance_id.
   */

  /** Retry assign with exponential backoff — webhook may lag behind */
  const retryAssignConversation = async (phoneDigits: string, diag: WaPipelineDiag, maxRetries = 4): Promise<string | null> => {
    const delays = [400, 1200, 2500, 5000];
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      if (attempt > 0) {
        await new Promise(r => setTimeout(r, delays[attempt - 1] || 5000));
      }
      try {
        const { data: convId, error } = await supabase
          .rpc("assign_wa_conversation_by_phone", { _phone_digits: phoneDigits });
        
        diag.assignAttempts = attempt + 1;

        if (!error && convId) {
          diag.assignResult = "ok";
          diag.assignConvId = convId as string;
          savePipelineDiag(diag);
          console.log(`[retryAssign] attempt=${attempt + 1} ✅ convId=${convId}`);
          return convId as string;
        }

        // Classify error
        if (error) {
          const msg = error.message || "";
          if (msg.includes("permission") || msg.includes("RLS") || error.code === "42501") {
            diag.assignResult = "permission_denied";
            diag.assignError = msg;
            savePipelineDiag(diag);
            console.error(`[retryAssign] attempt=${attempt + 1} ❌ PERMISSION DENIED: ${msg}`);
            return null; // Don't retry permission errors
          }
          console.log(`[retryAssign] attempt=${attempt + 1} not found (will retry): ${msg}`);
        } else {
          console.log(`[retryAssign] attempt=${attempt + 1} returned null (conversation not yet created)`);
        }

        diag.assignResult = "not_found";
        savePipelineDiag(diag);
      } catch (err: any) {
        diag.assignAttempts = attempt + 1;
        diag.assignResult = "error";
        diag.assignError = err?.message || "unknown";
        savePipelineDiag(diag);
        console.warn(`[retryAssign] attempt=${attempt + 1} exception:`, err);
      }
    }
    return null;
  };

  const handlePostLeadWhatsApp = async (data: LeadFormData, leadId?: string) => {
    // Fire-and-forget wrapper — never blocks UI
    try {
      const phoneDigits = normalizePhoneDigits(data.telefone);
      if (phoneDigits.length < 10) return;

      // Initialize pipeline diagnostics
      const diag: WaPipelineDiag = {
        leadId,
        phone: phoneDigits,
        assignAttempts: 0,
        assignResult: "pending",
      };

      // Resolve vendedor settings from DB (works for both auth and public contexts)
      let resolvedVendedorId = vendedorId;
      if (!resolvedVendedorId && user) {
        const { data: v } = await supabase
          .from("vendedores")
          .select("id")
          .eq("user_id", user.id)
          .eq("ativo", true)
          .maybeSingle();
        resolvedVendedorId = v?.id || null;
      }

      // Check toggle from DB settings
      if (resolvedVendedorId) {
        const settings = await getVendedorWaSettings(resolvedVendedorId);
        if (!settings.wa_auto_message_enabled) {
          console.log("[handlePostLeadWhatsApp] Auto-message disabled in vendedor settings, skipping");
          return;
        }

        const mensagem = buildAutoMessage({
          nome: data.nome.trim(),
          cidade: data.cidade?.trim(),
          estado: data.estado,
          consumo: data.media_consumo,
          tipo_telhado: data.tipo_telhado,
          consultor_nome: vendedorNome || undefined,
          template: settings.wa_auto_message_template || undefined,
        });

        // Send message — requires auth session
        if (user) {
          lastWaParamsRef.current = { telefone: data.telefone.trim(), leadId, mensagem, userId: user.id };
          const result = await sendAutoWelcomeMessage({
            telefone: data.telefone.trim(),
            leadId,
            mensagem,
            userId: user.id,
          });
          diag.sentAt = new Date().toISOString();
          diag.sentOk = result.sent;
          savePipelineDiag(diag);
          console.log("[handlePostLeadWhatsApp] sendAutoWelcomeMessage result:", result, "leadId:", leadId);
          if (result.sent) {
            if (result.conversation_id) {
              diag.assignConvId = result.conversation_id;
              diag.assignResult = "ok";
              savePipelineDiag(diag);
              toast({
                title: "Conversa aberta no Inbox ✅",
                description: "Mensagem enviada e conversa criada automaticamente.",
              });
            } else {
              toast({
                title: "WhatsApp encaminhado ✅",
                description: "Mensagem de boas-vindas encaminhada para envio.",
              });
            }
          } else if (result.blocked === "cooldown") {
            console.log("[handlePostLeadWhatsApp] Bloqueado por cooldown:", result.reason);
          }
        } else {
          // Public form — no auth session, call server-side welcome endpoint
          console.log("[handlePostLeadWhatsApp] No auth session — calling send-wa-welcome (public form)");
          if (leadId) {
            try {
              const welcomeRes = await supabase.functions.invoke("send-wa-welcome", {
                body: { lead_id: leadId },
              });
              const welcomeData = welcomeRes.data as { success?: boolean; conversation_id?: string; already_sent?: boolean } | null;
              if (welcomeData?.success) {
                diag.sentOk = true;
                diag.sentAt = new Date().toISOString();
                if (welcomeData.conversation_id) {
                  diag.assignConvId = welcomeData.conversation_id;
                  diag.assignResult = "ok";
                }
                savePipelineDiag(diag);
                console.log("[handlePostLeadWhatsApp] send-wa-welcome ✅", welcomeData);
              } else {
                console.warn("[handlePostLeadWhatsApp] send-wa-welcome failed:", welcomeRes.error || welcomeData);
              }
            } catch (welcErr) {
              console.warn("[handlePostLeadWhatsApp] send-wa-welcome error (non-blocking):", welcErr);
            }
          }
        }
      } else {
        console.log("[handlePostLeadWhatsApp] No vendedor resolved — skipping auto-message");
      }

      // Retry assign only if edge function didn't already create conversation
      if (user && !diag.assignConvId) {
        const convId = await retryAssignConversation(phoneDigits, diag);
        if (convId) {
          console.log("[handlePostLeadWhatsApp] Conversation assigned after retry:", convId);
        } else {
          console.warn("[handlePostLeadWhatsApp] Assign failed after all retries — conversation may appear later via webhook");
        }
      }
    } catch (err) {
      console.warn("[handlePostLeadWhatsApp] Background WA failed (non-blocking):", err);
      toast({
        title: "Lead salvo ✅",
        description: "WhatsApp não pôde ser enviado, mas o lead foi cadastrado.",
      });
    }
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
          handlePostLeadWhatsApp(data, result.leadId);
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
        handlePostLeadWhatsApp(data, result.leadId);
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
      handlePostLeadWhatsApp(data, result.leadId);
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
      handlePostLeadWhatsApp(data, result.leadId);
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
    const handleResendWhatsApp = user && lastWaParamsRef.current
      ? async (): Promise<boolean> => {
          const params = lastWaParamsRef.current!;
          const result = await sendAutoWelcomeMessage({ ...params, forceResend: true });
          if (result.sent) {
            toast({ title: "WhatsApp reenviado ✅", description: "Mensagem enviada com sucesso." });
          } else {
            toast({ title: "Falha no reenvio", description: result.reason || "Tente novamente.", variant: "destructive" });
          }
          return result.sent;
        }
      : undefined;

    return (
      <WizardSuccessScreen
        savedOffline={savedOffline}
        pendingCount={pendingCount}
        isOnline={isOnline}
        isSyncing={isSyncing}
        onReset={resetForm}
        onRetrySync={retrySync}
        onResendWhatsApp={handleResendWhatsApp}
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
                      onChange={(e) => {
                        setValue("nome", formatName(e.target.value));
                        if (errors.nome) form.clearErrors("nome");
                      }}
                      onBlur={() => {
                        const trimmed = watchedValues.nome?.replace(/\s+/g, " ").trim() || "";
                        if (trimmed !== watchedValues.nome) {
                          setValue("nome", trimmed);
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
                      onChange={(e) => {
                        setValue("telefone", formatPhone(e.target.value));
                        if (errors.telefone) form.clearErrors("telefone");
                      }}
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
                          setValue("cidade", "");
                        }
                        setValue("estado", value);
                        if (errors.estado) form.clearErrors("estado");
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
                          setValue("cidade", value);
                          if (errors.cidade) form.clearErrors("cidade");
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
                        onChange={(e) => {
                          setValue("cidade", e.target.value);
                          if (errors.cidade) form.clearErrors("cidade");
                        }}
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
                        if (errors.area) form.clearErrors("area");
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
                        if (errors.tipo_telhado) form.clearErrors("tipo_telhado");
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
                        if (errors.rede_atendimento) form.clearErrors("rede_atendimento");
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
                      onChange={(e) => {
                        setValue("media_consumo", e.target.value ? Number(e.target.value) : undefined);
                        if (errors.media_consumo) form.clearErrors("media_consumo");
                      }}
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
                      onChange={(e) => {
                        setValue("consumo_previsto", e.target.value ? Number(e.target.value) : undefined);
                        if (errors.consumo_previsto) form.clearErrors("consumo_previsto");
                      }}
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
