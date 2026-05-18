import { useState, useEffect, useCallback, useMemo } from "react";

import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShoppingCart, FileText, MapPin, Navigation, Save, WifiOff, Wifi, AlertTriangle, Receipt, User, Wrench, Signature, CreditCard, Home, Zap, Wallet, ChevronLeft, ChevronRight, Check, RefreshCw } from "lucide-react";
import { MissingDocsConfirmModal } from "./MissingDocsConfirmModal";
import { PaymentComposer } from "@/components/admin/vendas/PaymentComposer";
import { PaymentComposerBoundary } from "@/components/admin/vendas/PaymentComposerBoundary";
import { useQuery } from "@tanstack/react-query";
import type { PaymentItemInput } from "@/services/paymentComposition/types";
import { useVendaFinanceSnapshot } from "@/hooks/useVendaFinanceSnapshot";
import { useOfflineConversionSync, getCachedEquipment, setCachedEquipment } from "@/hooks/useOfflineConversionSync";
import { useConversionEquipment } from "@/hooks/useConvertLeadToClient";
import { createEmptyItem } from "@/services/paymentComposition/types";
import { validateComposition, computeSummary } from "@/services/paymentComposition/calculator";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { AddressFields, type AddressData } from "@/components/shared/AddressFields";

import { Spinner } from "@/components/ui-kit/Spinner";
import { PhoneInput } from "@/components/ui-kit/inputs/PhoneInput";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmailInput } from "@/components/ui/EmailInput";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { DocumentUpload, DocumentFile, uploadDocumentFiles } from "./DocumentUpload";
import type { Lead } from "@/types/lead";

interface Disjuntor {
  id: string;
  amperagem: number;
  descricao: string | null;
}

interface Transformador {
  id: string;
  potencia_kva: number;
  descricao: string | null;
}

interface Simulacao {
  id: string;
  potencia_recomendada_kwp: number | null;
  investimento_estimado: number | null;
  economia_mensal: number | null;
  consumo_kwh: number | null;
  created_at: string;
}

const formSchema = z.object({
  nome: z.string().min(2, "Nome é obrigatório"),
  telefone: z.string().min(10, "Telefone é obrigatório"),
  email: z.string().min(1, "E-mail é obrigatório").email("E-mail inválido"),
  cpf_cnpj: z.string().min(11, "CPF/CNPJ é obrigatório"),
  data_nascimento: z.string().optional(),
  cep: z.string().optional(),
  estado: z.string().min(2, "Estado é obrigatório"),
  cidade: z.string().min(2, "Cidade é obrigatória"),
  bairro: z.string().min(1, "Bairro é obrigatório"),
  rua: z.string().min(1, "Rua é obrigatória"),
  numero: z.string().min(1, "Número é obrigatório"),
  complemento: z.string().optional(),
  disjuntor_id: z.string().min(1, "Disjuntor é obrigatório"),
  transformador_id: z.string().min(1, "Transformador é obrigatório"),
  localizacao: z.string().min(1, "Localização é obrigatória"),
  observacoes: z.string().optional(),
  simulacao_aceita_id: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

interface ConvertLeadToClientDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  /** Quando aberto a partir do portal do vendedor (lista de orçamentos), permite refletir status também no orçamento */
  orcamentoId?: string | null;
}

/* ─── Section title helper ─── */
function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </p>
  );
}

export function ConvertLeadToClientDialog({
  lead,
  open,
  onOpenChange,
  onSuccess,
  orcamentoId,
}: ConvertLeadToClientDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [savingAsLead, setSavingAsLead] = useState(false);
  const { data: equipmentData } = useConversionEquipment();
  const [disjuntores, setDisjuntores] = useState<Disjuntor[]>([]);
  const [transformadores, setTransformadores] = useState<Transformador[]>([]);
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([]);
  const [currentStep, setCurrentStep] = useState(0);
  const isMobile = useIsMobile();


  // Offline sync hook
  const {
    isOnline,
    pendingCount: offlinePendingCount,
    isSyncing: isOfflineSyncing,
    syncAllConversions,
  } = useOfflineConversionSync();
  
  // Multiple files support with offline base64 storage
  const [identidadeFiles, setIdentidadeFiles] = useState<DocumentFile[]>([]);
  const [comprovanteFiles, setComprovanteFiles] = useState<DocumentFile[]>([]);
  const [beneficiariaFiles, setBeneficiariaFiles] = useState<DocumentFile[]>([]);
  const [assinaturaFiles, setAssinaturaFiles] = useState<DocumentFile[]>([]);
  
  const [gettingLocation, setGettingLocation] = useState(false);
  const [showMissingDocsModal, setShowMissingDocsModal] = useState(false);
  const [paymentItems, setPaymentItems] = useState<PaymentItemInput[]>([createEmptyItem()]);
  const [aguardandoStatusAvailable, setAguardandoStatusAvailable] = useState<boolean | null>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    mode: "onSubmit",
    reValidateMode: "onSubmit",
    defaultValues: {
      nome: "",
      telefone: "",
      email: "",
      cpf_cnpj: "",
      data_nascimento: "",
      cep: "",
      estado: "",
      cidade: "",
      bairro: "",
      rua: "",
      numero: "",
      complemento: "",
      disjuntor_id: "",
      transformador_id: "",
      localizacao: "",
      observacoes: "",
      simulacao_aceita_id: "",
    },
  });

  // Compute valorVenda from selected simulation, native proposal, or lead fallback
  const simulacaoAceitaId = useWatch({ control: form.control, name: "simulacao_aceita_id" });

  // Fetch latest native proposal value for this lead (RB-76 / proposalTotals SSOT not available here)
  // Fetch latest native proposal value for this lead (RB-76 / proposalTotals SSOT not available here)
  const { data: propostaVersaoValor = 0 } = useQuery({
    queryKey: ["convert-lead-proposta-valor", (lead as any)?.id],
    enabled: !!(lead as any)?.id,
    staleTime: 60_000,
    gcTime: 300_000,
    retry: 1,
    meta: {
      errorMessage: "Erro ao carregar valor da proposta"
    },
    queryFn: async (): Promise<number> => {
      try {
        const leadId = (lead as any).id as string;
        
        // Use a timeout to avoid hanging the modal
        const fetchPromise = (async () => {
          const { data: propostas } = await supabase
            .from("propostas_nativas")
            .select("id")
            .eq("lead_id", leadId);
          
          const ids = (propostas ?? []).map((p: any) => p.id);
          if (ids.length === 0) return 0;
          
          const { data: versao } = await supabase
            .from("proposta_versoes")
            .select("valor_total, status, created_at")
            .in("proposta_id", ids)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
            
          return Number((versao as any)?.valor_total ?? 0) || 0;
        })();

        // Race against a 10s timeout
        return await Promise.race([
          fetchPromise,
          new Promise<number>((_, reject) => 
            setTimeout(() => reject(new Error("Timeout carregando proposta")), 10000)
          )
        ]);
      } catch (err) {
        console.warn("[ConvertLead] Query timeout or error, using defaults:", err);
        return 0;
      }
    },
  });

  const valorVenda = useMemo(() => {
    // 1. Simulação aceita
    if (simulacaoAceitaId) {
      const sim = simulacoes.find(s => s.id === simulacaoAceitaId);
      if (sim?.investimento_estimado) return sim.investimento_estimado;
    }
    // 2. Proposta nativa (última versão)
    if (propostaVersaoValor && propostaVersaoValor > 0) return propostaVersaoValor;
    // 3. Fallback: leads.valor_projeto
    return (lead as any)?.valor_projeto ?? 0;
  }, [simulacaoAceitaId, simulacoes, lead, propostaVersaoValor]);

  // ── SSOT Financial State §25 ──
  const finance = useVendaFinanceSnapshot(valorVenda, paymentItems);

  // Explicit subscription so programmatic setValue always reflects in the UI
  const localizacaoValue = useWatch({ control: form.control, name: "localizacao" });

  // CEP lookup is handled internally by AddressFields component

  // Bridge AddressFields ↔ react-hook-form
  const addressValue: AddressData = {
    cep: form.watch("cep") || "",
    rua: form.watch("rua") || "",
    numero: form.watch("numero") || "",
    complemento: form.watch("complemento") || "",
    bairro: form.watch("bairro") || "",
    cidade: form.watch("cidade") || "",
    estado: form.watch("estado") || "",
  };

  const handleAddressChange = useCallback(
    (addr: AddressData) => {
      form.setValue("cep", addr.cep, { shouldValidate: true });
      form.setValue("rua", addr.rua, { shouldValidate: true });
      form.setValue("numero", addr.numero, { shouldValidate: true });
      form.setValue("complemento", addr.complemento);
      form.setValue("bairro", addr.bairro, { shouldValidate: true });
      form.setValue("cidade", addr.cidade, { shouldValidate: true });
      form.setValue("estado", addr.estado, { shouldValidate: true });
    },
    [form]
  );

  // Online status is now provided by useOfflineConversionSync

  // Sync equipment from hook into local state
  useEffect(() => {
    if (equipmentData) {
      setDisjuntores(equipmentData.disjuntores);
      setTransformadores(equipmentData.transformadores);
    }
  }, [equipmentData]);

  // Check if "Aguardando Documentação" status exists
  useEffect(() => {
    const checkAguardandoStatus = async () => {
      if (!navigator.onLine) return;
      try {
        const { data: status } = await supabase
          .from("lead_status")
          .select("id")
          .or("nome.eq.Aguardando Documentação,nome.ilike.%aguardando%document%")
          .limit(1)
          .maybeSingle();
        setAguardandoStatusAvailable(!!status);
      } catch {
        setAguardandoStatusAvailable(false);
      }
    };
    checkAguardandoStatus();
  }, []);

  // Load simulations for this lead
  useEffect(() => {
    const loadSimulacoes = async () => {
      if (!lead || !navigator.onLine) return;
      
      try {
        const { data, error } = await supabase
          .from("simulacoes")
          .select("id, potencia_recomendada_kwp, investimento_estimado, economia_mensal, consumo_kwh, created_at")
          .eq("lead_id", lead.id)
          .order("created_at", { ascending: false });

        if (error) {
          console.warn("[ConvertLead] simulacoes error:", error);
          return;
        }
        if (data) setSimulacoes(data);
      } catch (err) {
        console.error("[ConvertLead] loadSimulacoes crash:", err);
      }
    };

    if (open && lead) {
      loadSimulacoes();
    }
  }, [lead, open]);

  // Track if form was already initialized for this lead/open session
  const [formInitialized, setFormInitialized] = useState<string | null>(null);

  // Pre-fill form when lead changes - restore saved partial data if available
  useEffect(() => {
    if (lead && open) {
      if (formInitialized === lead.id) return;

      const storageKey = `lead_conversion_${lead.id}`;
      let savedData: {
        formData?: FormData;
        identidadeFiles?: DocumentFile[];
        comprovanteFiles?: DocumentFile[];
        beneficiariaFiles?: DocumentFile[];
        paymentItems?: PaymentItemInput[];
        savedAt?: string;
      } | null = null;

      try {
        const stored = localStorage.getItem(storageKey);
        if (stored) {
          savedData = JSON.parse(stored);
        }
      } catch (e) {
        console.warn("Could not parse saved conversion data:", e);
      }

      if (savedData?.formData) {
        const leadEmail = lead.email && lead.email.includes('@') ? lead.email : "";
        form.reset({
          nome: savedData.formData.nome || lead.nome || "",
          telefone: savedData.formData.telefone || lead.telefone || "",
          email: savedData.formData.email || leadEmail,
          cpf_cnpj: savedData.formData.cpf_cnpj || (lead as any).cpf_cnpj || "",
          data_nascimento: savedData.formData.data_nascimento || "",
          cep: savedData.formData.cep || lead.cep || "",
          estado: savedData.formData.estado || lead.estado || "",
          cidade: savedData.formData.cidade || lead.cidade || "",
          bairro: savedData.formData.bairro || lead.bairro || "",
          rua: savedData.formData.rua || lead.rua || "",
          numero: savedData.formData.numero || lead.numero || "",
          complemento: savedData.formData.complemento || lead.complemento || "",
          disjuntor_id: savedData.formData.disjuntor_id || "",
          transformador_id: savedData.formData.transformador_id || "",
          localizacao: savedData.formData.localizacao || "",
          observacoes: savedData.formData.observacoes || lead.observacoes || "",
          simulacao_aceita_id: savedData.formData.simulacao_aceita_id || "",
        });
        
        setIdentidadeFiles(savedData.identidadeFiles || []);
        setComprovanteFiles(savedData.comprovanteFiles || []);
        setBeneficiariaFiles(savedData.beneficiariaFiles || []);
        if (savedData.paymentItems?.length) {
          setPaymentItems(savedData.paymentItems);
        }
        
        if (savedData.savedAt) {
          const savedDate = new Date(savedData.savedAt);
          const formattedDate = savedDate.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            timeZone: "America/Sao_Paulo",
          });
          toast({
            title: "Dados restaurados",
            description: `Continuando de onde parou (${formattedDate})`,
          });
        }
      } else {
        const leadEmail = lead.email && lead.email.includes('@') ? lead.email : "";
        form.reset({
          nome: lead.nome || "",
          telefone: lead.telefone || "",
          email: leadEmail,
          cpf_cnpj: (lead as any).cpf_cnpj || "",
          data_nascimento: "",
          cep: lead.cep || "",
          estado: lead.estado || "",
          cidade: lead.cidade || "",
          bairro: lead.bairro || "",
          rua: lead.rua || "",
          numero: lead.numero || "",
          complemento: lead.complemento || "",
          disjuntor_id: "",
          transformador_id: "",
          localizacao: "",
          observacoes: lead.observacoes || "",
          simulacao_aceita_id: "",
        });
        setIdentidadeFiles([]);
        setComprovanteFiles([]);
        setBeneficiariaFiles([]);
        setPaymentItems([createEmptyItem()]);
      }

      setFormInitialized(lead.id);
    }
  }, [lead, open, formInitialized, form, toast]);

  // Reset formInitialized when dialog closes
  useEffect(() => {
    if (!open) {
      setFormInitialized(null);
      setCurrentStep(0);
      setPaymentItems([createEmptyItem()]);
      setIdentidadeFiles([]);
      setComprovanteFiles([]);
      setBeneficiariaFiles([]);
      setAssinaturaFiles([]);
    }
  }, [open]);

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast({
        title: "Erro",
        description: "Geolocalização não é suportada pelo seu navegador.",
        variant: "destructive",
      });
      return;
    }

    setGettingLocation(true);

    const fallbackTimeout = setTimeout(() => {
      setGettingLocation(false);
      toast({
        title: "Erro",
        description: "Não foi possível obter a localização. Verifique as permissões do navegador.",
        variant: "destructive",
      });
    }, 15000);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        clearTimeout(fallbackTimeout);
        const { latitude, longitude } = position.coords;
        const googleMapsLink = `https://www.google.com/maps?q=${latitude},${longitude}`;
        form.setValue("localizacao", googleMapsLink, { 
          shouldValidate: true, 
          shouldDirty: true,
          shouldTouch: true 
        });
        setGettingLocation(false);
        toast({
          title: "Localização obtida!",
          description: `Coordenadas: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        });
      },
      (error) => {
        clearTimeout(fallbackTimeout);
        setGettingLocation(false);
        let message = "Erro ao obter localização.";
        switch (error.code) {
          case error.PERMISSION_DENIED:
            message = "Permissão de localização negada. Habilite nas configurações do navegador.";
            break;
          case error.POSITION_UNAVAILABLE:
            message = "Localização indisponível no momento.";
            break;
          case error.TIMEOUT:
            message = "Tempo esgotado ao obter localização. Tente novamente.";
            break;
        }
        toast({
          title: "Erro de Geolocalização",
          description: message,
          variant: "destructive",
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 0,
      }
    );
  };

  // Check if required documents are complete
  const isDocumentationComplete = () => {
    return (
      identidadeFiles.length > 0 &&
      comprovanteFiles.length > 0 &&
      !!form.getValues("email") &&
      !!form.getValues("cpf_cnpj") &&
      !!form.getValues("bairro") &&
      !!form.getValues("rua") &&
      !!form.getValues("numero") &&
      !!form.getValues("disjuntor_id") &&
      !!form.getValues("transformador_id") &&
      !!form.getValues("localizacao")
    );
  };

  // Get list of missing required items
  const getMissingItems = () => {
    const missing: string[] = [];
    if (!form.getValues("email")) missing.push("E-mail");
    if (!form.getValues("cpf_cnpj")) missing.push("CPF/CNPJ");
    if (!form.getValues("bairro")) missing.push("Bairro");
    if (!form.getValues("rua")) missing.push("Rua");
    if (!form.getValues("numero")) missing.push("Número");
    if (identidadeFiles.length === 0) missing.push("Identidade (RG/CNH)");
    if (comprovanteFiles.length === 0) missing.push("Comprovante de Endereço");
    if (!form.getValues("disjuntor_id")) missing.push("Disjuntor");
    if (!form.getValues("transformador_id")) missing.push("Transformador");
    if (!form.getValues("localizacao")) missing.push("Localização");
    return missing;
  };

  // Save as lead with "Aguardando Documentação" status — works offline
  const handleSaveAsLead = async () => {
    if (!lead) return;

    const isValid = await form.trigger(["nome", "telefone", "estado", "cidade"]);
    if (!isValid) return;

    setSavingAsLead(true);

    try {
      const missing: string[] = [];
      if (!form.getValues("email")) missing.push("E-mail");
      if (!form.getValues("cpf_cnpj")) missing.push("CPF/CNPJ");
      if (!form.getValues("bairro")) missing.push("Bairro");
      if (!form.getValues("rua")) missing.push("Rua");
      if (!form.getValues("numero")) missing.push("Número");
      if (identidadeFiles.length === 0) missing.push("Identidade");
      if (comprovanteFiles.length === 0) missing.push("Comprovante de Endereço");
      if (!form.getValues("disjuntor_id")) missing.push("Disjuntor");
      if (!form.getValues("transformador_id")) missing.push("Transformador");
      if (!form.getValues("localizacao")) missing.push("Localização");

      const observacoesAtuais = form.getValues("observacoes") || "";
      const observacoesSemPendencia = observacoesAtuais
        .replace(/^\[Documentação Pendente:[^\]]*\]\s*/i, "")
        .trim();

      const novaObservacao = missing.length > 0 
        ? `[Documentação Pendente: ${missing.join(", ")}]${observacoesSemPendencia ? ` ${observacoesSemPendencia}` : ""}`
        : observacoesSemPendencia;

      const formData = form.getValues();

      // Always save partial data to localStorage (works offline)
      const partialData = {
        leadId: lead.id,
        formData: {
          ...formData,
          observacoes: novaObservacao,
        },
        identidadeFiles,
        comprovanteFiles,
        beneficiariaFiles,
        paymentItems,
        savedAt: new Date().toISOString(),
      };

      const storageKey = `lead_conversion_${lead.id}`;
      localStorage.setItem(storageKey, JSON.stringify(partialData));

      // If offline, just save locally and exit
      if (!navigator.onLine) {
        toast({
          title: "Salvo localmente! 📴",
          description: `${lead.nome} foi salvo offline. Os dados serão sincronizados quando a conexão voltar.`,
        });
        onOpenChange(false);
        onSuccess?.();
        return;
      }

      // Online: persist to Supabase
      const { data: aguardandoStatus } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Aguardando Documentação")
        .maybeSingle();

      let resolvedStatus = aguardandoStatus;

      if (!resolvedStatus) {
        const { data: altStatus } = await supabase
          .from("lead_status")
          .select("id")
          .ilike("nome", "%aguardando%document%")
          .maybeSingle();
        
        if (!altStatus) {
          toast({
            title: "Configuração necessária",
            description: "O status 'Aguardando Documentação' não existe. Peça ao administrador para criá-lo na configuração de status.",
            variant: "destructive",
          });
          setSavingAsLead(false);
          return;
        }
        resolvedStatus = altStatus;
      }

      const statusId = resolvedStatus.id;
      const nowIso = new Date().toISOString();

      const [{ error: leadUpdateError }, { error: orcUpdateError }] = await Promise.all([
        supabase
          .from("leads")
          .update({
            status_id: statusId,
            cep: formData.cep || null,
            estado: formData.estado || lead.estado,
            cidade: formData.cidade || lead.cidade,
            bairro: formData.bairro || null,
            rua: formData.rua || null,
            numero: formData.numero || null,
            complemento: formData.complemento || null,
            observacoes: novaObservacao,
            updated_at: nowIso,
          })
          .eq("id", lead.id),
        orcamentoId
          ? supabase
              .from("orcamentos")
              .update({
                status_id: statusId,
                ultimo_contato: nowIso,
                updated_at: nowIso,
              })
              .eq("id", orcamentoId)
          : Promise.resolve({ error: null } as any),
      ]);

      if (leadUpdateError || orcUpdateError) throw leadUpdateError || orcUpdateError;

      toast({
        title: "Lead atualizado!",
        description: `${lead.nome} foi salvo como "Aguardando Documentação". Complete a documentação para converter em cliente.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error saving lead:", error);
      // If network error, save offline
      if (!navigator.onLine || error?.message?.includes("fetch")) {
        const formData = form.getValues();
        const storageKey = `lead_conversion_${lead.id}`;
        localStorage.setItem(storageKey, JSON.stringify({
          leadId: lead.id,
          formData,
          identidadeFiles,
          comprovanteFiles,
          beneficiariaFiles,
          paymentItems,
          savedAt: new Date().toISOString(),
        }));
        toast({
          title: "Salvo localmente! 📴",
          description: "Falha na conexão. Os dados foram salvos e serão sincronizados automaticamente.",
        });
        onOpenChange(false);
        onSuccess?.();
      } else {
        toast({
          title: "Erro ao salvar",
          description: error.message || "Não foi possível salvar o lead.",
          variant: "destructive",
        });
      }
    } finally {
      setSavingAsLead(false);
    }
  };

  const handleSubmit = async (data: FormData) => {
    if (!lead) return;

    const missingItems = getMissingItems();
    if (missingItems.length > 0) {
      toast({
        title: "Dados obrigatórios faltando",
        description: `Para converter em venda, os seguintes campos são obrigatórios: ${missingItems.join(", ")}.`,
        variant: "destructive",
      });
      
      // Auto-navigate to the step with missing info
      if (missingItems.some(item => ["E-mail", "CPF/CNPJ", "Bairro", "Rua", "Número"].includes(item))) {
        setCurrentStep(0);
      } else if (missingItems.some(item => ["Identidade (RG/CNH)", "Comprovante de Endereço", "Disjuntor", "Transformador", "Localização"].includes(item))) {
        setCurrentStep(1);
      }
      return;
    }

    // Validate payment composition — using SSOT snapshot §25
    if (valorVenda > 0 || paymentItems.some(item => item.valor_base > 0)) {
      if (!finance.isValid) {
        toast({
          title: "Atenção no Financeiro",
          description: finance.errors[0] || "Composição de pagamento inválida.",
          variant: "destructive",
        });
        setCurrentStep(2); // Navigate to payment step
        return;
      }
    }

    if (!navigator.onLine) {
      saveConversionOffline(data);
      return;
    }

    setLoading(true);
    let tenantId = "";

    try {
      try {
        const { data, error } = await supabase.rpc("get_user_tenant_id");
        if (error) throw error;
        if (!data) throw new Error("Tenant ID não retornado pelo servidor.");
        tenantId = data;
      } catch (err: any) {
        console.error("Erro ao buscar tenant_id:", err);
        throw new Error(`Erro de autenticação: ${err.message || "Não foi possível identificar o tenant. Faça login novamente."}`);
      }

      let identidadeUrls: string[] = [];
      let comprovanteUrls: string[] = [];
      let beneficiariaUrls: string[] = [];
      let assinaturaUrls: string[] = [];

      try {
        identidadeUrls = await uploadDocumentFiles(identidadeFiles, `${tenantId}/identidade`, supabase);
        comprovanteUrls = await uploadDocumentFiles(comprovanteFiles, `${tenantId}/comprovante`, supabase);
        beneficiariaUrls = await uploadDocumentFiles(beneficiariaFiles, `${tenantId}/beneficiaria`, supabase);
        assinaturaUrls = await uploadDocumentFiles(assinaturaFiles, `${tenantId}/assinatura`, supabase);
      } catch (uploadErr: any) {
        console.warn("[ConvertLead] Document upload partial failure or issue:", uploadErr);
        // We continue if at least some docs are uploaded or if the user wants to proceed
        // But if it's a critical error (like bucket not found), we should probably let it throw or handle specifically
        if (uploadErr.message?.includes("bucket") || uploadErr.message?.includes("permission")) {
          throw new Error(`Erro de permissão no armazenamento: ${uploadErr.message}`);
        }
      }

      //   identidade: identidadeUrls,
      //   comprovante: comprovanteUrls,
      //   beneficiaria: beneficiariaUrls,
      //   assinatura: assinaturaUrls,
      // });

      let potenciaKwp: number | null = null;
      let valorProjeto: number | null = null;
      if (data.simulacao_aceita_id && simulacoes.length > 0) {
        const selectedSim = simulacoes.find(s => s.id === data.simulacao_aceita_id);
        if (selectedSim) {
          potenciaKwp = selectedSim.potencia_recomendada_kwp;
          valorProjeto = selectedSim.investimento_estimado;
        }
      }

      // If no simulation selected, try to get values from propostas_nativas
      if (!potenciaKwp && !valorProjeto && lead.id) {
        try {
          const { data: propostaNativa } = await supabase
            .from("propostas_nativas")
            .select("id")
            .eq("lead_id", lead.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (propostaNativa) {
            const { data: versao } = await supabase
              .from("proposta_versoes")
              .select("valor_total, potencia_kwp")
              .eq("proposta_id", propostaNativa.id)
              .order("versao_numero", { ascending: false })
              .limit(1)
              .maybeSingle();

            if (versao) {
              potenciaKwp = versao.potencia_kwp || null;
              valorProjeto = versao.valor_total || null;
            }
          }
        } catch (e) {
          console.warn("[ConvertLead] Could not fetch proposta_nativa data:", e);
        }
      }

      const clientePayload = {
        nome: data.nome,
        telefone: data.telefone,
        email: data.email || null,
        cpf_cnpj: data.cpf_cnpj || null,
        data_nascimento: data.data_nascimento || null,
        cep: data.cep || null,
        estado: data.estado,
        cidade: data.cidade,
        bairro: data.bairro || null,
        rua: data.rua || null,
        numero: data.numero || null,
        complemento: data.complemento || null,
        disjuntor_id: data.disjuntor_id || null,
        transformador_id: data.transformador_id || null,
        localizacao: data.localizacao || null,
        observacoes: data.observacoes || null,
        identidade_urls: identidadeUrls,
        comprovante_endereco_urls: comprovanteUrls,
        comprovante_beneficiaria_urls: beneficiariaUrls,
        simulacao_aceita_id: data.simulacao_aceita_id || null,
        assinatura_url: assinaturaUrls.length > 0 ? assinaturaUrls[0] : null,
        potencia_kwp: potenciaKwp,
        valor_projeto: valorProjeto,
      };

      // SSOT — Use atomic RPC for conversion
      const { data: rpcRes, error: rpcError } = await supabase.rpc("convert_lead_to_venda_v2", {
        _lead_id: lead.id,
        _payload: clientePayload as any,
        _payment_composition: paymentItems as any,
        _idempotency_key: lead.id // Use lead_id as idempotency key for now
      });

      const result = rpcRes as { success?: boolean; message?: string } | null;

      if (rpcError) throw rpcError;
      if (!result?.success) throw new Error(result?.message || "Falha na conversão");


      const storageKey = `lead_conversion_${lead.id}`;
      localStorage.removeItem(storageKey);
      localStorage.removeItem(`lead_payment_composition_${lead.id}`);

      toast({
        title: "Venda enviada para validação!",
        description: `${data.nome} foi processado com sucesso. Aguardando aprovação do administrador.`,
      });

      onOpenChange(false);
      onSuccess?.();

    } catch (error: any) {
      console.error("Error converting lead:", error);
      toast({
        title: "Erro ao converter lead",
        description: error.message || "Não foi possível converter o lead em cliente.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  // Save conversion data locally for offline sync — uses the existing hook
  const saveConversionOffline = (data: FormData) => {
    if (!lead) return;

    try {
      const OFFLINE_KEY = "offline_lead_conversions";
      const storedData = localStorage.getItem(OFFLINE_KEY);
      const conversions: Array<{
        leadId: string;
        leadNome: string;
        formData: FormData;
        identidadeFiles: DocumentFile[];
        comprovanteFiles: DocumentFile[];
        beneficiariaFiles: DocumentFile[];
        assinaturaFiles?: DocumentFile[];
        savedAt: string;
        synced?: boolean;
      }> = storedData ? JSON.parse(storedData) : [];

      const existingIndex = conversions.findIndex(c => c.leadId === lead.id);
      const newConversion = {
        leadId: lead.id,
        leadNome: lead.nome,
        formData: data,
        identidadeFiles,
        comprovanteFiles,
        beneficiariaFiles,
        assinaturaFiles,
        savedAt: new Date().toISOString(),
        synced: false,
      };

      if (existingIndex >= 0) {
        conversions[existingIndex] = newConversion;
      } else {
        conversions.push(newConversion);
      }

      localStorage.setItem(OFFLINE_KEY, JSON.stringify(conversions));

      toast({
        title: "Salvo localmente! 📴",
        description: "A conversão será finalizada quando você estiver online.",
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error) {
      console.error("Error saving offline:", error);
      toast({
        title: "Erro",
        description: "Não foi possível salvar localmente.",
        variant: "destructive",
      });
    }
  };

  if (!lead) return null;

  const missingItems = getMissingItems();

  const STEPS = [
    { label: "Dados Pessoais", icon: User, description: "Nome, contato e endereço" },
    { label: "Técnico & Docs", icon: FileText, description: "Equipamentos e documentos" },
    { label: "Pagamento", icon: Wallet, description: "Forma de pagamento e proposta" },
  ];

  const canAdvanceStep = (step: number): boolean => {
    if (step === 0) {
      const v = form.getValues();
      return !!(v.nome && v.telefone && v.cpf_cnpj && v.cpf_cnpj.replace(/\D/g, '').length >= 11);
    }
    return true;
  };

  /** Check if a visited step has all required fields filled */
  const isStepComplete = (step: number): boolean => {
    const v = form.getValues();
    if (step === 0) {
      return !!(v.nome && v.telefone && v.email && v.cpf_cnpj && v.estado && v.cidade && v.bairro && v.rua && v.numero);
    }
    if (step === 1) {
      return !!(v.disjuntor_id && v.transformador_id && v.localizacao && identidadeFiles.length > 0 && comprovanteFiles.length > 0);
    }
    return true;
  };

  const handleNext = () => {
    setCurrentStep((s) => Math.min(s + 1, STEPS.length - 1));
  };

  const handleBack = () => setCurrentStep((s) => Math.max(s - 1, 0));

  const Title = () => (
    <div className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
      <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center shrink-0">
        <ShoppingCart className="w-5 h-5 text-teal-600" />
      </div>
      <div className="flex-1">
        <h2 className="text-base font-semibold text-foreground leading-none">
          Converter Lead em Venda
        </h2>
        <p className="text-xs text-muted-foreground mt-1.5">
          {lead.nome} {lead.lead_code ? `· ${lead.lead_code}` : ""}
        </p>
      </div>
    </div>
  );

  const FormWrapper = ({ children }: { children: React.ReactNode }) => {
    if (isMobile) {
      return (
        <Sheet open={open} onOpenChange={(v) => { if (!v) setCurrentStep(0); onOpenChange(v); }}>
          <SheetContent side="bottom" className="w-full h-[95vh] sm:h-[100dvh] p-0 flex flex-col overflow-hidden border-none rounded-t-xl">
            <SheetHeader className="sr-only">
              <SheetTitle>Converter Lead em Venda</SheetTitle>
            </SheetHeader>
            <Title />
            {children}
          </SheetContent>
        </Sheet>
      );
    }
    return (
      <Dialog open={open} onOpenChange={(v) => { if (!v) setCurrentStep(0); onOpenChange(v); }}>
        <DialogContent className="w-full sm:w-[90vw] max-w-[700px] p-0 gap-0 overflow-hidden flex flex-col h-[100dvh] sm:h-auto max-h-[100dvh] sm:max-h-[calc(100dvh-2rem)] rounded-none sm:rounded-lg border-none sm:border">
          <DialogHeader className="sr-only">
            <DialogTitle>Converter Lead em Venda</DialogTitle>
          </DialogHeader>
          <Title />
          {children}
        </DialogContent>
      </Dialog>
    );
  };

  return (
    <>
    <FormWrapper>


        {/* ── STEPPER ── */}
        <div className="flex items-center gap-1 px-5 py-3 border-b border-border bg-muted/20 shrink-0">
          {STEPS.map((step, idx) => {
            const StepIcon = step.icon;
            const isActive = idx === currentStep;
            const isDone = idx < currentStep;
            const isVisited = idx <= currentStep;
            const stepComplete = isVisited && isStepComplete(idx);
            const stepIncomplete = isVisited && !stepComplete;
            const canAccess = idx === 0 || canAdvanceStep(idx - 1);
            return (
              <div key={idx} className="flex items-center gap-1 flex-1 min-w-0">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => canAccess && setCurrentStep(idx)}
                  className={`flex items-center gap-2 px-2 sm:px-3 py-2 rounded-lg transition-colors w-full min-w-0 h-auto ${
                    isActive
                      ? "bg-teal-500/10 text-teal-600 hover:bg-teal-500/15"
                      : stepComplete
                      ? "text-success cursor-pointer hover:bg-muted/50"
                      : stepIncomplete
                      ? "text-warning cursor-pointer hover:bg-muted/50"
                      : "text-muted-foreground hover:bg-transparent"
                  }`}
                  disabled={!canAccess}
                >
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${
                    isActive
                      ? "bg-teal-600 text-white"
                      : stepComplete
                      ? "bg-success/10 text-success"
                      : stepIncomplete
                      ? "bg-warning/10 text-warning"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {stepComplete ? <Check className="w-3.5 h-3.5" /> : stepIncomplete ? <AlertTriangle className="w-3.5 h-3.5" /> : <StepIcon className="w-3.5 h-3.5" />}
                  </div>
                  <div className="min-w-0 text-left hidden sm:block">
                    <p className="text-xs font-semibold truncate">{step.label}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{step.description}</p>
                  </div>
                </Button>
                {idx < STEPS.length - 1 && (
                  <div className={`w-4 h-px shrink-0 ${stepComplete ? "bg-success" : stepIncomplete ? "bg-warning" : "bg-teal-200"}`} />
                )}
              </div>
            );
          })}
        </div>

        {/* Offline status bar — same pattern as OfflineStatusBar in lead registration */}
        <div className={`flex items-center justify-between gap-2 mx-5 mt-3 p-3 rounded-lg text-sm shrink-0 border ${
          isOnline ? "bg-success/10 border-success/30" : "bg-warning/10 border-warning/30"
        }`}>
          <div className="flex items-center gap-2">
            {isOnline ? (
              <Wifi className="w-4 h-4 text-success shrink-0" />
            ) : (
              <WifiOff className="w-4 h-4 text-warning animate-pulse shrink-0" />
            )}
            <span className={`text-sm font-semibold ${isOnline ? "text-success" : "text-warning"}`}>
              {isOnline ? "Online" : "Sem Internet"}
            </span>
            {offlinePendingCount > 0 && (
              <>
                <div className="w-px h-4 bg-border" />
                <span className="text-xs text-muted-foreground">
                  Pendentes:{" "}
                  <span className="inline-flex items-center justify-center min-w-[18px] h-4 px-1 rounded-full text-[10px] font-bold bg-warning text-warning-foreground">
                    {offlinePendingCount}
                  </span>
                </span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {offlinePendingCount > 0 && isOnline && (
              <Button
                type="button"
                size="sm"
                onClick={() => syncAllConversions()}
                disabled={isOfflineSyncing}
                className="gap-1.5 h-6 text-[10px] px-2"
              >
                {isOfflineSyncing ? (
                  <><RefreshCw className="w-3 h-3 animate-spin" /> Sincronizando...</>
                ) : (
                  <><RefreshCw className="w-3 h-3" /> Sincronizar</>
                )}
              </Button>
            )}
            {!isOnline && (
              <span className="text-[10px] text-warning font-medium">
                Dados salvos localmente
              </span>
            )}
          </div>
        </div>

        {/* ── BODY — steps ── */}
        <Form {...form}>
          <form onSubmit={(e) => e.preventDefault()} className="flex flex-col flex-1 min-h-0">
            <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-5">

              {/* ═══ STEP 1: Dados Pessoais + Endereço ═══ */}
              {currentStep === 0 && (
                <>
                  <div className="space-y-3">
                    <SectionTitle>Dados pessoais</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="nome"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Nome *</FormLabel>
                            <FormControl><Input {...field} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="telefone"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Telefone *</FormLabel>
                            <FormControl><PhoneInput value={field.value} onChange={field.onChange} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="email"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>E-mail *</FormLabel>
                            <FormControl><EmailInput value={field.value || ""} onChange={field.onChange} required /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="cpf_cnpj"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel className="flex items-center gap-1">
                              CPF/CNPJ *
                              {(!field.value || field.value.length < 11) && (
                                <span className="text-[10px] text-destructive animate-pulse">(Obrigatório para converter em venda)</span>
                              )}
                            </FormLabel>
                            <FormControl><CpfCnpjInput value={field.value || ""} onChange={field.onChange} label="" /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="data_nascimento"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Data de nascimento</FormLabel>
                            <FormControl><Input type="date" value={field.value || ""} onChange={field.onChange} /></FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>

                  <div className="border-t border-border" />

                  <div className="space-y-3">
                    <SectionTitle>Endereço</SectionTitle>
                    <AddressFields value={addressValue} onChange={handleAddressChange} />
                  </div>
                </>
              )}

              {/* ═══ STEP 2: Dados Técnicos + Documentos ═══ */}
              {currentStep === 1 && (
                <>
                  <div className="space-y-3">
                    <SectionTitle>Dados técnicos</SectionTitle>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <FormField
                        control={form.control}
                        name="disjuntor_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Disjuntor *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Selecione o disjuntor" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {disjuntores.map((d) => (
                                  <SelectItem key={d.id} value={d.id}>
                                    {d.amperagem}A {d.descricao ? `- ${d.descricao}` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="transformador_id"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Transformador *</FormLabel>
                            <Select onValueChange={field.onChange} value={field.value}>
                              <FormControl>
                                <SelectTrigger><SelectValue placeholder="Selecione o transformador" /></SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {transformadores.map((t) => (
                                  <SelectItem key={t.id} value={t.id}>
                                    {t.potencia_kva} kVA {t.descricao ? `- ${t.descricao}` : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>

                    <FormField
                      control={form.control}
                      name="localizacao"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" /> Localização *
                          </FormLabel>
                          <div className="flex gap-2">
                            <FormControl>
                              <Input
                                {...field}
                                value={localizacaoValue ?? ""}
                                placeholder="Link do Google Maps ou coordenadas"
                                className="flex-1"
                              />
                            </FormControl>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              onClick={getCurrentLocation}
                              disabled={gettingLocation}
                              className="shrink-0"
                              aria-label="Obter localização atual"
                            >
                              {gettingLocation ? <Spinner size="sm" /> : <Navigation className="h-4 w-4" />}
                            </Button>
                          </div>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  <div className="border-t border-border" />

                  <div className="space-y-3">
                    <SectionTitle>Documentos</SectionTitle>

                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <CreditCard className="h-3.5 w-3.5 text-primary" /> Identidade (RG/CNH)
                        </span>
                        {identidadeFiles.length > 0 ? (
                          <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">Pendente</Badge>
                        )}
                      </div>
                      <DocumentUpload label="" description="Frente e verso" files={identidadeFiles} onFilesChange={setIdentidadeFiles} required />
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Home className="h-3.5 w-3.5 text-primary" /> Comprovante de Endereço
                        </span>
                        {comprovanteFiles.length > 0 ? (
                          <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">Pendente</Badge>
                        )}
                      </div>
                      <DocumentUpload label="" description="Foto ou arquivo digital" files={comprovanteFiles} onFilesChange={setComprovanteFiles} required />
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Zap className="h-3.5 w-3.5 text-primary" /> Comprovante Beneficiária UC
                        </span>
                        {beneficiariaFiles.length > 0 ? (
                          <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Opcional</Badge>
                        )}
                      </div>
                      <DocumentUpload label="" description="Comprovante da unidade consumidora" files={beneficiariaFiles} onFilesChange={setBeneficiariaFiles} />
                    </div>

                    <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                          <Signature className="h-3.5 w-3.5 text-primary" /> Foto da Assinatura
                        </span>
                        {assinaturaFiles.length > 0 ? (
                          <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
                        ) : (
                          <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Opcional</Badge>
                        )}
                      </div>
                      <DocumentUpload label="" description="Foto da assinatura do cliente no contrato" files={assinaturaFiles} onFilesChange={setAssinaturaFiles} accept="image/*" />
                    </div>
                  </div>
                </>
              )}

              {/* ═══ STEP 3: Pagamento + Proposta + Observações ═══ */}
              {currentStep === 2 && (
                <>
                  {/* Proposta Aceita */}
                  {simulacoes.length > 0 && (
                    <>
                      <div className="space-y-3">
                        <SectionTitle>Proposta aceita</SectionTitle>
                        <FormField
                          control={form.control}
                          name="simulacao_aceita_id"
                          render={({ field }) => (
                            <FormItem>
                              <Select onValueChange={field.onChange} value={field.value}>
                                <FormControl>
                                  <SelectTrigger><SelectValue placeholder="Selecione a proposta aceita" /></SelectTrigger>
                                </FormControl>
                                <SelectContent>
                                  {simulacoes.map((s) => {
                                    const dataFormatada = new Date(s.created_at).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
                                    const potencia = s.potencia_recomendada_kwp ? `${s.potencia_recomendada_kwp.toFixed(2)} kWp` : "N/A";
                                    const investimento = s.investimento_estimado
                                      ? `R$ ${s.investimento_estimado.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                                      : "N/A";
                                    return (
                                      <SelectItem key={s.id} value={s.id}>
                                        {dataFormatada} — {potencia} — {investimento}
                                      </SelectItem>
                                    );
                                  })}
                                </SelectContent>
                              </Select>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                      <div className="border-t border-border" />
                    </>
                  )}

                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Wallet className="w-4 h-4 text-primary" />
                      <SectionTitle>Composição de Pagamento</SectionTitle>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Defina como o cliente vai pagar. Valor da venda:{" "}
                      <span className="font-semibold text-foreground">
                        {valorVenda > 0
                          ? `R$ ${valorVenda.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}`
                          : "Selecione a proposta aceita"}
                      </span>
                    </p>
                    <PaymentComposerBoundary>
                      <PaymentComposer valorVenda={valorVenda} items={paymentItems} onChange={setPaymentItems} />
                    </PaymentComposerBoundary>
                    {/* Inline Validation §25 */}
                    {!finance.isValid && finance.items.length > 0 && (
                      <div className="mt-4 p-4 rounded-lg bg-destructive/10 border border-destructive/20 space-y-2">
                        <div className="flex items-center gap-2 text-destructive">
                          <AlertTriangle className="h-4 w-4" />
                          <span className="text-sm font-bold">Problemas detectados:</span>
                        </div>
                        <ul className="list-disc list-inside space-y-1">
                          {finance.errors.map((err, i) => (
                            <li key={i} className="text-xs text-destructive/90 font-medium">
                              {err}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  <div className="border-t border-border" />

                  <div className="space-y-3">
                    <SectionTitle>Observações</SectionTitle>
                    <FormField
                      control={form.control}
                      name="observacoes"
                      render={({ field }) => (
                        <FormItem>
                          <FormControl>
                            <Textarea
                              {...field}
                              rows={3}
                              placeholder="Informações adicionais sobre o cliente ou instalação..."
                              className="bg-muted/50 min-h-[80px]"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>

                  {/* Missing items warning */}
                  {missingItems.length > 0 && (
                    <div className="bg-warning/10 border border-warning/30 rounded-lg p-3 flex items-start gap-2">
                      <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0 text-warning" />
                      <div>
                        <p className="text-sm font-medium text-foreground">Documentação incompleta</p>
                        <p className="text-xs text-warning mt-1">Faltam: {missingItems.join(", ")}</p>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>

            {/* ── FOOTER §25 — navigation + actions ── */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 border-t border-border bg-card/95 backdrop-blur-md shrink-0 sticky bottom-0 z-50 pb-[calc(1rem+safe-area-inset-bottom)] sm:pb-4">
              <div>
                {currentStep > 0 && (
                  <Button type="button" variant="ghost" onClick={handleBack} disabled={loading || savingAsLead}>
                    <ChevronLeft className="w-4 h-4 mr-1" /> Voltar
                  </Button>
                )}
              </div>

              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
                {currentStep < STEPS.length - 1 ? (
                  <Button 
                    type="button" 
                    onClick={handleNext} 
                    className="w-full sm:w-auto h-11 sm:h-9 bg-teal-600 hover:bg-teal-700 text-white"
                  >
                    Próximo <ChevronRight className="w-4 h-4 ml-1" />
                  </Button>
                ) : (
                  <>
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full sm:w-auto h-11 sm:h-9"
                      onClick={() => {
                        if (aguardandoStatusAvailable === false) {
                          toast({
                            title: "Status não configurado",
                            description: "O status 'Aguardando Documentação' não existe. Peça ao administrador para criá-lo na configuração de status.",
                            variant: "destructive",
                          });
                          return;
                        }
                        handleSaveAsLead();
                      }}
                      disabled={loading || savingAsLead || aguardandoStatusAvailable === false}
                    >
                      {savingAsLead ? (
                        <><Spinner size="sm" /> Salvando...</>
                      ) : (
                        <><Save className="mr-2 h-4 w-4" /> Aguardar Docs</>
                      )}
                    </Button>
                    <Button
                      type="button"
                      className="w-full sm:w-auto h-11 sm:h-9 bg-teal-600 hover:bg-teal-700 text-white"
                      disabled={loading || savingAsLead}
                      onClick={async () => {
                        const valid = await form.trigger();
                        if (!valid) {
                          const errors = form.formState.errors;
                          const step0Fields = ["nome", "telefone", "email", "cpf_cnpj", "cep", "estado", "cidade", "bairro", "rua", "numero", "complemento"] as const;
                          const step1Fields = ["disjuntor_id", "transformador_id", "localizacao"] as const;
                          
                          const hasStep0Error = step0Fields.some(f => f in errors);
                          const hasStep1Error = step1Fields.some(f => f in errors);
                          
                          if (hasStep0Error) {
                            setCurrentStep(0);
                            toast({
                              title: "Dados incompletos",
                              description: "Preencha os campos obrigatórios na etapa de Dados Pessoais.",
                              variant: "destructive",
                            });
                          } else if (hasStep1Error) {
                            setCurrentStep(1);
                            toast({
                              title: "Dados incompletos",
                              description: "Preencha os campos obrigatórios na etapa Técnico & Docs.",
                              variant: "destructive",
                            });
                          } else {
                            toast({
                              title: "Dados incompletos",
                              description: "Verifique os campos obrigatórios em todas as etapas.",
                              variant: "destructive",
                            });
                          }
                          return;
                        }

                        // Check for missing documentation items
                        const currentMissing = getMissingItems();
                        if (currentMissing.length > 0) {
                          setShowMissingDocsModal(true);
                          return;
                        }

                        const data = form.getValues();
                        handleSubmit(data);
                      }}
                    >
                      {loading ? (
                        <><Spinner size="sm" /> Convertendo...</>
                      ) : (
                        <><ShoppingCart className="mr-2 h-4 w-4" /> Converter em Venda</>
                      )}
                    </Button>
                  </>
                )}
              </div>
            </div>
          </form>
        </Form>
        </FormWrapper>


    <MissingDocsConfirmModal
      open={showMissingDocsModal}
      onOpenChange={setShowMissingDocsModal}
      missingItems={missingItems}
      leadNome={lead.nome}
      onSaveAsPending={() => {
        setShowMissingDocsModal(false);
        handleSaveAsLead();
      }}
      onBack={() => setShowMissingDocsModal(false)}
      isSaving={savingAsLead}
    />
    </>
  );
}
