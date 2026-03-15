import { useState, useEffect, useCallback } from "react";
import { useCepLookup } from "@/hooks/useCepLookup";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ShoppingCart, FileText, MapPin, Navigation, Save, WifiOff, AlertTriangle, Receipt, User, Wrench, Signature, CreditCard, Home, Zap } from "lucide-react";
import { CpfCnpjInput } from "@/components/shared/CpfCnpjInput";
import { AddressFields, type AddressData } from "@/components/shared/AddressFields";
import { formatCEP } from "@/lib/validations";
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

// Storage key for offline conversion data
const OFFLINE_CONVERSION_KEY = "offline_lead_conversions";

interface OfflineConversion {
  leadId: string;
  leadNome: string;
  formData: FormData;
  identidadeFiles: DocumentFile[];
  comprovanteFiles: DocumentFile[];
  beneficiariaFiles: DocumentFile[];
  assinaturaFiles?: DocumentFile[];
  savedAt: string;
  synced?: boolean;
}

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
  const [disjuntores, setDisjuntores] = useState<Disjuntor[]>([]);
  const [transformadores, setTransformadores] = useState<Transformador[]>([]);
  const [simulacoes, setSimulacoes] = useState<Simulacao[]>([]);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  // Multiple files support with offline base64 storage
  const [identidadeFiles, setIdentidadeFiles] = useState<DocumentFile[]>([]);
  const [comprovanteFiles, setComprovanteFiles] = useState<DocumentFile[]>([]);
  const [beneficiariaFiles, setBeneficiariaFiles] = useState<DocumentFile[]>([]);
  const [assinaturaFiles, setAssinaturaFiles] = useState<DocumentFile[]>([]);
  
  const [gettingLocation, setGettingLocation] = useState(false);

  const form = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      nome: "",
      telefone: "",
      email: "",
      cpf_cnpj: "",
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

  // Explicit subscription so programmatic setValue always reflects in the UI
  const localizacaoValue = useWatch({ control: form.control, name: "localizacao" });

  // CEP lookup via useCepLookup
  const { lookup: lookupCep } = useCepLookup();
  const handleCEPBlur = useCallback(async (cepValue: string) => {
    const result = await lookupCep(cepValue);
    if (!result) return;
    if (result.estado) form.setValue("estado", result.estado, { shouldValidate: true });
    if (result.cidade) form.setValue("cidade", result.cidade, { shouldValidate: true });
    if (result.bairro) form.setValue("bairro", result.bairro);
    if (result.rua) form.setValue("rua", result.rua);
  }, [form, lookupCep]);

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

  // Track online status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Load equipment options
  useEffect(() => {
    const loadEquipment = async () => {
      if (!navigator.onLine) return;
      
      const [disjuntoresRes, transformadoresRes] = await Promise.all([
        supabase.from("disjuntores").select("id, amperagem, descricao, ativo").eq("ativo", true).order("amperagem"),
        supabase.from("transformadores").select("id, potencia_kva, descricao, ativo").eq("ativo", true).order("potencia_kva"),
      ]);

      if (disjuntoresRes.data) setDisjuntores(disjuntoresRes.data);
      if (transformadoresRes.data) setTransformadores(transformadoresRes.data);
    };

    loadEquipment();
  }, []);

  // Load simulations for this lead
  useEffect(() => {
    const loadSimulacoes = async () => {
      if (!lead || !navigator.onLine) return;
      
      const { data } = await supabase
        .from("simulacoes")
        .select("id, potencia_recomendada_kwp, investimento_estimado, economia_mensal, consumo_kwh, created_at")
        .eq("lead_id", lead.id)
        .order("created_at", { ascending: false });

      if (data) setSimulacoes(data);
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
        form.reset({
          nome: savedData.formData.nome || lead.nome || "",
          telefone: savedData.formData.telefone || lead.telefone || "",
          email: savedData.formData.email || "",
          cpf_cnpj: savedData.formData.cpf_cnpj || "",
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
        
        if (savedData.savedAt) {
          const savedDate = new Date(savedData.savedAt);
          const formattedDate = savedDate.toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          });
          toast({
            title: "Dados restaurados",
            description: `Continuando de onde parou (${formattedDate})`,
          });
        }
      } else {
        form.reset({
          nome: lead.nome || "",
          telefone: lead.telefone || "",
          email: "",
          cpf_cnpj: "",
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
      }

      setFormInitialized(lead.id);
    }
  }, [lead, open, formInitialized, form, toast]);

  // Reset formInitialized when dialog closes
  useEffect(() => {
    if (!open) {
      setFormInitialized(null);
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

  // Save as lead with "Aguardando Documentação" status
  const handleSaveAsLead = async () => {
    if (!lead) return;

    const isValid = await form.trigger(["nome", "telefone", "estado", "cidade"]);
    if (!isValid) return;

    setSavingAsLead(true);

    try {
      const { data: aguardandoStatus } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Aguardando Documentação")
        .single();

      if (!aguardandoStatus) {
        throw new Error("Status 'Aguardando Documentação' não encontrado.");
      }

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

      const partialData = {
        leadId: lead.id,
        formData: {
          ...formData,
          observacoes: novaObservacao,
        },
        identidadeFiles,
        comprovanteFiles,
        beneficiariaFiles,
        savedAt: new Date().toISOString(),
      };

      const storageKey = `lead_conversion_${lead.id}`;
      localStorage.setItem(storageKey, JSON.stringify(partialData));

      const nowIso = new Date().toISOString();

      const [{ error: leadUpdateError }, { error: orcUpdateError }] = await Promise.all([
        supabase
          .from("leads")
          .update({
            status_id: aguardandoStatus.id,
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
                status_id: aguardandoStatus.id,
                ultimo_contato: nowIso,
                updated_at: nowIso,
              })
              .eq("id", orcamentoId)
          : Promise.resolve({ error: null } as any),
      ]);

      if (leadUpdateError && orcUpdateError) throw leadUpdateError;

      toast({
        title: "Lead atualizado!",
        description: `${lead.nome} foi salvo como "Aguardando Documentação". Complete a documentação para converter em cliente.`,
      });

      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error("Error saving lead:", error);
      toast({
        title: "Erro ao salvar",
        description: error.message || "Não foi possível salvar o lead.",
        variant: "destructive",
      });
    } finally {
      setSavingAsLead(false);
    }
  };

  const handleSubmit = async (data: FormData) => {
    if (!lead) return;

    const missingItems = getMissingItems();
    if (missingItems.length > 0) {
      toast({
        title: "Documentação incompleta",
        description: `Itens obrigatórios faltando: ${missingItems.join(", ")}. Use "Aguardando Documentação" para salvar parcialmente.`,
        variant: "destructive",
      });
      return;
    }

    if (!navigator.onLine) {
      saveConversionOffline(data);
      return;
    }

    setLoading(true);

    try {
      const { data: tenantId } = await supabase.rpc("get_user_tenant_id");
      if (!tenantId) throw new Error("Não foi possível identificar o tenant. Faça login novamente.");

      console.debug("[ConvertLead] Starting conversion for lead:", lead.id);
      console.debug("[ConvertLead] Files count:", {
        identidade: identidadeFiles.length,
        comprovante: comprovanteFiles.length,
        beneficiaria: beneficiariaFiles.length,
        assinatura: assinaturaFiles.length,
      });

      const identidadeUrls = await uploadDocumentFiles(identidadeFiles, `${tenantId}/identidade`, supabase);
      const comprovanteUrls = await uploadDocumentFiles(comprovanteFiles, `${tenantId}/comprovante`, supabase);
      const beneficiariaUrls = await uploadDocumentFiles(beneficiariaFiles, `${tenantId}/beneficiaria`, supabase);
      const assinaturaUrls = await uploadDocumentFiles(assinaturaFiles, `${tenantId}/assinatura`, supabase);

      console.debug("[ConvertLead] Upload results:", {
        identidade: identidadeUrls,
        comprovante: comprovanteUrls,
        beneficiaria: beneficiariaUrls,
        assinatura: assinaturaUrls,
      });

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
              console.debug("[ConvertLead] Got data from proposta_nativa:", { potenciaKwp, valorProjeto });
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
        identidade_urls: identidadeUrls.length > 0 ? identidadeUrls : null,
        comprovante_endereco_urls: comprovanteUrls.length > 0 ? comprovanteUrls : null,
        comprovante_beneficiaria_urls: beneficiariaUrls.length > 0 ? beneficiariaUrls : null,
        simulacao_aceita_id: data.simulacao_aceita_id || null,
        assinatura_url: assinaturaUrls.length > 0 ? assinaturaUrls[0] : null,
        potencia_kwp: potenciaKwp,
        valor_projeto: valorProjeto,
      };

      console.debug("[ConvertLead] clientePayload:", {
        ...clientePayload,
        identidade_urls: clientePayload.identidade_urls?.length || 0,
        comprovante_endereco_urls: clientePayload.comprovante_endereco_urls?.length || 0,
      });

      // Check for existing client by lead_id OR by phone (to avoid duplicate cliente_code)
      let existingCliente: { id: string } | null = null;
      
      const { data: byLeadId } = await supabase
        .from("clientes")
        .select("id")
        .eq("lead_id", lead.id)
        .maybeSingle();
      
      existingCliente = byLeadId || null;

      // If not found by lead_id, check by phone to prevent duplicate
      if (!existingCliente && data.telefone) {
        const normalizedPhone = data.telefone.replace(/\D/g, "");
        const { data: byPhone } = await supabase
          .from("clientes")
          .select("id")
          .eq("telefone", data.telefone)
          .maybeSingle();
        
        if (!byPhone && normalizedPhone.length >= 10) {
          const { data: byNormalized } = await supabase
            .from("clientes")
            .select("id")
            .eq("telefone_normalized", normalizedPhone.slice(-11))
            .maybeSingle();
          existingCliente = byNormalized || null;
        } else {
          existingCliente = byPhone || null;
        }
      }

      let cliente: { id: string } | null = null;

      if (existingCliente) {
        console.debug("[ConvertLead] Updating existing cliente:", existingCliente.id);
        const { data: updated, error: updateError } = await supabase
          .from("clientes")
          .update({ ...clientePayload, lead_id: lead.id, updated_at: new Date().toISOString() })
          .eq("id", existingCliente.id)
          .select("id")
          .single();

        if (updateError) throw updateError;
        cliente = updated;
      } else {
        const { data: created, error: insertError } = await supabase
          .from("clientes")
          .insert({ ...clientePayload, lead_id: lead.id } as any)
          .select("id")
          .single();

        if (insertError) throw insertError;
        cliente = created;
      }

      if (!cliente) throw new Error("Falha ao criar/atualizar cliente.");

      const { data: convertidoStatus } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Aguardando Validação")
        .single();

      if (convertidoStatus) {
        const nowIso = new Date().toISOString();

        const [leadStatusUpdate, orcamentoStatusUpdate] = await Promise.all([
          supabase
            .from("leads")
            .update({ status_id: convertidoStatus.id, updated_at: nowIso })
            .eq("id", lead.id),
          orcamentoId
            ? supabase
                .from("orcamentos")
                .update({ status_id: convertidoStatus.id, ultimo_contato: nowIso, updated_at: nowIso })
                .eq("id", orcamentoId)
            : Promise.resolve({ error: null } as any),
        ]);

        if (leadStatusUpdate?.error) throw leadStatusUpdate.error;
        if (orcamentoStatusUpdate?.error) throw orcamentoStatusUpdate.error;
      }

      const storageKey = `lead_conversion_${lead.id}`;
      localStorage.removeItem(storageKey);

      const action = existingCliente ? "atualizado" : "cadastrado";
      toast({
        title: "Venda enviada para validação!",
        description: `${data.nome} foi ${action}. Aguardando aprovação do administrador para gerar comissão.`,
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

  // Save conversion data locally for offline sync
  const saveConversionOffline = (data: FormData) => {
    if (!lead) return;

    try {
      const storedData = localStorage.getItem(OFFLINE_CONVERSION_KEY);
      const conversions: OfflineConversion[] = storedData ? JSON.parse(storedData) : [];

      const existingIndex = conversions.findIndex(c => c.leadId === lead.id);
      const newConversion: OfflineConversion = {
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

      localStorage.setItem(OFFLINE_CONVERSION_KEY, JSON.stringify(conversions));

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-[820px] p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        {/* ── HEADER §25 ─────────────────────────────────────── */}
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <ShoppingCart className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Converter Lead em Venda
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {lead.nome} {lead.lead_code ? `· ${lead.lead_code}` : ""}
            </p>
          </div>
        </DialogHeader>

        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-2 mx-5 mt-4 p-3 bg-warning/10 border border-warning/30 rounded-lg text-sm text-foreground">
            <WifiOff className="w-4 h-4 text-warning shrink-0" />
            <span>Modo offline — Os dados serão salvos localmente e sincronizados quando a conexão voltar.</span>
          </div>
        )}

        {/* ── BODY — 2 colunas §25 ───────────────────────────── */}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)}>
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border flex-1 min-h-0 overflow-y-auto">

              {/* ═══ COLUNA ESQUERDA — dados ═══ */}
              <div className="p-5 space-y-5">

                {/* Dados Pessoais */}
                <div className="space-y-3">
                  <SectionTitle>Dados pessoais</SectionTitle>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <FormField
                      control={form.control}
                      name="nome"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome *</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
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
                          <FormControl>
                            <PhoneInput value={field.value} onChange={field.onChange} />
                          </FormControl>
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
                          <FormControl>
                            <EmailInput value={field.value || ""} onChange={field.onChange} required />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="cpf_cnpj"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>CPF/CNPJ *</FormLabel>
                          <FormControl>
                            <CpfCnpjInput value={field.value || ""} onChange={field.onChange} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <div className="border-t border-border" />

                {/* Endereço — AddressFields §13 */}
                <div className="space-y-3">
                  <SectionTitle>Endereço</SectionTitle>
                  <AddressFields
                    value={addressValue}
                    onChange={handleAddressChange}
                  />
                </div>

                <div className="border-t border-border" />

                {/* Dados Técnicos */}
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
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o disjuntor" />
                              </SelectTrigger>
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
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o transformador" />
                              </SelectTrigger>
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

                  {/* Localização — full width */}
                  <FormField
                    control={form.control}
                    name="localizacao"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2">
                          <MapPin className="h-3.5 w-3.5" />
                          Localização *
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
                            {gettingLocation ? (
                              <Spinner size="sm" />
                            ) : (
                              <Navigation className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>

              {/* ═══ COLUNA DIREITA — documentos e observações ═══ */}
              <div className="p-5 space-y-5">

                {/* Documentos */}
                <div className="space-y-3">
                  <SectionTitle>Documentos</SectionTitle>

                  {/* Identidade */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <CreditCard className="h-3.5 w-3.5 text-primary" />
                        Identidade (RG/CNH)
                      </span>
                      {identidadeFiles.length > 0 ? (
                        <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">Pendente</Badge>
                      )}
                    </div>
                    <DocumentUpload
                      label=""
                      description="Frente e verso"
                      files={identidadeFiles}
                      onFilesChange={setIdentidadeFiles}
                      required
                    />
                  </div>

                  {/* Comprovante de Endereço */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Home className="h-3.5 w-3.5 text-primary" />
                        Comprovante de Endereço
                      </span>
                      {comprovanteFiles.length > 0 ? (
                        <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30 text-xs">Pendente</Badge>
                      )}
                    </div>
                    <DocumentUpload
                      label=""
                      description="Foto ou arquivo digital"
                      files={comprovanteFiles}
                      onFilesChange={setComprovanteFiles}
                      required
                    />
                  </div>

                  {/* Beneficiária (opcional) */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Zap className="h-3.5 w-3.5 text-primary" />
                        Comprovante Beneficiária UC
                      </span>
                      {beneficiariaFiles.length > 0 ? (
                        <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Opcional</Badge>
                      )}
                    </div>
                    <DocumentUpload
                      label=""
                      description="Comprovante da unidade consumidora"
                      files={beneficiariaFiles}
                      onFilesChange={setBeneficiariaFiles}
                    />
                  </div>

                  {/* Assinatura do Cliente */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        <Signature className="h-3.5 w-3.5 text-primary" />
                        Foto da Assinatura
                      </span>
                      {assinaturaFiles.length > 0 ? (
                        <Badge className="bg-success/10 text-success border-0 text-xs">Anexado</Badge>
                      ) : (
                        <Badge variant="outline" className="bg-muted text-muted-foreground text-xs">Opcional</Badge>
                      )}
                    </div>
                    <DocumentUpload
                      label=""
                      description="Foto da assinatura do cliente no contrato"
                      files={assinaturaFiles}
                      onFilesChange={setAssinaturaFiles}
                      accept="image/*"
                    />
                  </div>
                </div>

                <div className="border-t border-border" />

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
                                <SelectTrigger>
                                  <SelectValue placeholder="Selecione a proposta aceita" />
                                </SelectTrigger>
                              </FormControl>
                              <SelectContent>
                                {simulacoes.map((s) => {
                                  const dataFormatada = new Date(s.created_at).toLocaleDateString("pt-BR");
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

                {/* Observações */}
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
                      <p className="text-xs text-warning mt-1">
                        Faltam: {missingItems.join(", ")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* ── FOOTER §25 ─────────────────────────────────── */}
            <div className="flex flex-col sm:flex-row justify-end gap-2 p-4 border-t border-border bg-muted/30">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                disabled={loading || savingAsLead}
              >
                Cancelar
              </Button>
              
              <Button
                type="button"
                variant="outline"
                onClick={handleSaveAsLead}
                disabled={loading || savingAsLead}
              >
                {savingAsLead ? (
                  <>
                    <Spinner size="sm" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Aguardando Documentação
                  </>
                )}
              </Button>

              <Button type="submit" disabled={loading || savingAsLead}>
                {loading ? (
                  <>
                    <Spinner size="sm" />
                    Convertendo...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Converter em Venda
                  </>
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
