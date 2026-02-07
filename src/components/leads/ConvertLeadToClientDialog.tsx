import { useState, useEffect } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, ShoppingCart, FileText, MapPin, Navigation, Save, WifiOff, AlertCircle, Receipt } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
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
  email: z.string().email("Email inválido").optional().or(z.literal("")),
  cpf_cnpj: z.string().optional(),
  cep: z.string().optional(),
  estado: z.string().min(2, "Estado é obrigatório"),
  cidade: z.string().min(2, "Cidade é obrigatória"),
  bairro: z.string().optional(),
  rua: z.string().optional(),
  numero: z.string().optional(),
  complemento: z.string().optional(),
  disjuntor_id: z.string().optional(),
  transformador_id: z.string().optional(),
  localizacao: z.string().optional(), // Optional - required only for final conversion
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
        supabase.from("disjuntores").select("*").eq("ativo", true).order("amperagem"),
        supabase.from("transformadores").select("*").eq("ativo", true).order("potencia_kva"),
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
  // Only run once per lead+open combination to avoid overwriting user input
  useEffect(() => {
    if (lead && open) {
      // Skip if already initialized for this lead
      if (formInitialized === lead.id) return;

      // Check if there's saved partial conversion data for this lead
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

      // If we have saved data, restore it; otherwise use lead data
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
        
        // Restore document files if saved
        setIdentidadeFiles(savedData.identidadeFiles || []);
        setComprovanteFiles(savedData.comprovanteFiles || []);
        setBeneficiariaFiles(savedData.beneficiariaFiles || []);
        
        // Show toast that we restored saved data
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
        // No saved data - use lead data as defaults
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

      // Mark as initialized for this lead
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
    console.log("[Geolocation] Requesting current position...");

    // Fallback timeout in case the browser never invokes either callback
    const fallbackTimeout = setTimeout(() => {
      console.warn("[Geolocation] Fallback timeout triggered (15s without response).");
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
        console.log("[Geolocation] Success:", latitude, longitude, "Link:", googleMapsLink);
        toast({
          title: "Localização obtida!",
          description: `Coordenadas: ${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        });
      },
      (error) => {
        clearTimeout(fallbackTimeout);
        setGettingLocation(false);
        console.error("[Geolocation] Error:", error.code, error.message);
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
      form.getValues("disjuntor_id") &&
      form.getValues("transformador_id") &&
      form.getValues("localizacao")
    );
  };

  // Get list of missing required items
  const getMissingItems = () => {
    const missing: string[] = [];
    if (identidadeFiles.length === 0) missing.push("Identidade (RG/CNH)");
    if (comprovanteFiles.length === 0) missing.push("Comprovante de Endereço");
    if (!form.getValues("disjuntor_id")) missing.push("Disjuntor");
    if (!form.getValues("transformador_id")) missing.push("Transformador");
    if (!form.getValues("localizacao")) missing.push("Localização");
    return missing;
  };

  // Save as lead with "Aguardando Documentação" status
  // This saves partial data ONLY to the lead record (not creating a client yet)
  const handleSaveAsLead = async () => {
    if (!lead) return;

    // Only validate basic required fields (nome, telefone, estado, cidade)
    // Don't require documents or localizacao for partial save
    const isValid = await form.trigger(["nome", "telefone", "estado", "cidade"]);
    if (!isValid) return;

    setSavingAsLead(true);

    try {
      // Get "Aguardando Documentação" status
      const { data: aguardandoStatus } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Aguardando Documentação")
        .single();

      if (!aguardandoStatus) {
        throw new Error("Status 'Aguardando Documentação' não encontrado.");
      }

      // Build observation note about what's missing
      const missing: string[] = [];
      if (identidadeFiles.length === 0) missing.push("Identidade");
      if (comprovanteFiles.length === 0) missing.push("Comprovante de Endereço");
      if (!form.getValues("disjuntor_id")) missing.push("Disjuntor");
      if (!form.getValues("transformador_id")) missing.push("Transformador");
      if (!form.getValues("localizacao")) missing.push("Localização");

      // Get current observations and remove any existing "[Documentação Pendente: ...]" prefix
      const observacoesAtuais = form.getValues("observacoes") || "";
      const observacoesSemPendencia = observacoesAtuais
        .replace(/^\[Documentação Pendente:[^\]]*\]\s*/i, "")
        .trim();

      // Build new observation with pending items (only if there are missing items)
      const novaObservacao = missing.length > 0 
        ? `[Documentação Pendente: ${missing.join(", ")}]${observacoesSemPendencia ? ` ${observacoesSemPendencia}` : ""}`
        : observacoesSemPendencia;

      const formData = form.getValues();

      // Store partial conversion data in localStorage for later completion
      // This allows continuing the conversion process without creating a client yet
      const partialData = {
        leadId: lead.id,
        formData: {
          ...formData,
          observacoes: novaObservacao,
        },
        identidadeFiles: identidadeFiles,
        comprovanteFiles: comprovanteFiles,
        beneficiariaFiles: beneficiariaFiles,
        savedAt: new Date().toISOString(),
      };

      // Save to localStorage for persistence
      const storageKey = `lead_conversion_${lead.id}`;
      localStorage.setItem(storageKey, JSON.stringify(partialData));

      // Update lead status (and also the current orcamento when provided)
      const nowIso = new Date().toISOString();

      const [{ error: leadUpdateError }, { error: orcUpdateError }] = await Promise.all([
        supabase
          .from("leads")
          .update({
            status_id: aguardandoStatus.id,
            cep: formData.cep || null,
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

      // If BOTH failed, treat as error. If at least one succeeded, keep UX flowing.
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

    // Validate required documents before submission
    const missingItems = getMissingItems();
    if (missingItems.length > 0) {
      toast({
        title: "Documentação incompleta",
        description: `Itens obrigatórios faltando: ${missingItems.join(", ")}. Use "Aguardando Documentação" para salvar parcialmente.`,
        variant: "destructive",
      });
      return;
    }

    // Check if we're offline
    if (!navigator.onLine) {
      // Save locally for later sync
      saveConversionOffline(data);
      return;
    }

    setLoading(true);

    try {
      // Upload all documents using the new utility function
      const identidadeUrls = await uploadDocumentFiles(identidadeFiles, "identidade", supabase);
      const comprovanteUrls = await uploadDocumentFiles(comprovanteFiles, "comprovante", supabase);
      const beneficiariaUrls = await uploadDocumentFiles(beneficiariaFiles, "beneficiaria", supabase);

      // Create client with selected simulation
      const { data: cliente, error: clienteError } = await supabase
        .from("clientes")
        .insert({
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
          lead_id: lead.id,
          disjuntor_id: data.disjuntor_id || null,
          transformador_id: data.transformador_id || null,
          localizacao: data.localizacao || null,
          observacoes: data.observacoes || null,
          identidade_urls: identidadeUrls.length > 0 ? identidadeUrls : null,
          comprovante_endereco_urls: comprovanteUrls.length > 0 ? comprovanteUrls : null,
          comprovante_beneficiaria_urls: beneficiariaUrls.length > 0 ? beneficiariaUrls : null,
          simulacao_aceita_id: data.simulacao_aceita_id || null,
        })
        .select()
        .single();

      if (clienteError) throw clienteError;

      // Update lead status to "Aguardando Validação" (admin needs to approve)
      const { data: convertidoStatus } = await supabase
        .from("lead_status")
        .select("id")
        .eq("nome", "Aguardando Validação")
        .single();

      if (convertidoStatus) {
        const nowIso = new Date().toISOString();

        await Promise.all([
          supabase
            .from("leads")
            .update({ status_id: convertidoStatus.id, updated_at: nowIso })
            .eq("id", lead.id),
          orcamentoId
            ? supabase
                .from("orcamentos")
                .update({ status_id: convertidoStatus.id, ultimo_contato: nowIso, updated_at: nowIso })
                .eq("id", orcamentoId)
            : Promise.resolve(null as any),
        ]);
      }

      // Commission will be created when admin validates the sale

      // Clear saved partial conversion data since conversion is complete
      const storageKey = `lead_conversion_${lead.id}`;
      localStorage.removeItem(storageKey);

      toast({
        title: "Venda enviada para validação!",
        description: `${data.nome} foi cadastrado. Aguardando aprovação do administrador para gerar comissão.`,
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

      // Add or update conversion for this lead
      const existingIndex = conversions.findIndex(c => c.leadId === lead.id);
      const newConversion: OfflineConversion = {
        leadId: lead.id,
        leadNome: lead.nome,
        formData: data,
        identidadeFiles,
        comprovanteFiles,
        beneficiariaFiles,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-primary" />
            Converter Lead em Venda
          </DialogTitle>
          <DialogDescription>
            Preencha os dados para transformar o lead em cliente. Se faltarem documentos, você pode salvar como "Aguardando Documentação".
          </DialogDescription>
        </DialogHeader>

        {/* Offline indicator */}
        {!isOnline && (
          <div className="flex items-center gap-2 p-3 bg-warning/20 text-warning-foreground rounded-lg text-sm">
            <WifiOff className="w-4 h-4" />
            <span>Modo offline - Os dados serão salvos localmente e sincronizados automaticamente quando a conexão voltar.</span>
          </div>
        )}

        <Form {...form}>
          <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-6">
            {/* Dados Pessoais */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
                Dados Pessoais
              </h3>
              <div className="grid grid-cols-2 gap-4">
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
                        <Input {...field} />
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
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} />
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
                      <FormLabel>CPF/CNPJ</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Endereço */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
                Endereço
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={form.control}
                  name="cep"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>CEP</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="estado"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Estado *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="cidade"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cidade *</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="bairro"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Bairro</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="rua"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rua</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="numero"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Número</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="complemento"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Complemento</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            {/* Documentos */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2 flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Documentos
              </h3>
              <div className="space-y-4">
                <DocumentUpload
                  label="Identidade (RG/CNH)"
                  description="Tire uma foto ou selecione arquivos (frente e verso)"
                  files={identidadeFiles}
                  onFilesChange={setIdentidadeFiles}
                  required
                />
                <DocumentUpload
                  label="Comprovante de Endereço"
                  description="Tire uma foto ou selecione arquivos"
                  files={comprovanteFiles}
                  onFilesChange={setComprovanteFiles}
                  required
                />
                <DocumentUpload
                  label="Comprovante Beneficiária da UC"
                  description="Comprovante da unidade consumidora (opcional)"
                  files={beneficiariaFiles}
                  onFilesChange={setBeneficiariaFiles}
                />
              </div>
            </div>

            {/* Proposta Aceita */}
            {simulacoes.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground border-b pb-2 flex items-center gap-2">
                  <Receipt className="h-4 w-4" />
                  Proposta Aceita
                </h3>
                <FormField
                  control={form.control}
                  name="simulacao_aceita_id"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Selecione a simulação/proposta aceita pelo cliente</FormLabel>
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
                            const economia = s.economia_mensal 
                              ? `R$ ${s.economia_mensal.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/mês`
                              : "";
                            
                            return (
                              <SelectItem key={s.id} value={s.id}>
                                {dataFormatada} - {potencia} - {investimento} {economia && `(${economia})`}
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
            )}

            {/* Dados Técnicos */}
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-muted-foreground border-b pb-2">
                Dados Técnicos
              </h3>
              <div className="grid grid-cols-2 gap-4">
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
              <FormField
                control={form.control}
                name="localizacao"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="flex items-center gap-2">
                      <MapPin className="h-4 w-4" />
                      Localização (Coordenadas/Link do Mapa)
                    </FormLabel>
                    <div className="flex gap-2">
                      <FormControl>
                        <Input 
                          {...field} 
                          value={localizacaoValue ?? ""}
                          placeholder="Ex: -23.5505, -46.6333 ou link do Google Maps"
                          className="flex-1"
                        />
                      </FormControl>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={getCurrentLocation}
                        disabled={gettingLocation}
                        className="shrink-0"
                      >
                        {gettingLocation ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Navigation className="h-4 w-4" />
                        )}
                        <span className="ml-2 hidden sm:inline">
                          {gettingLocation ? "Obtendo..." : "Minha Localização"}
                        </span>
                      </Button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            {/* Observações */}
            <FormField
              control={form.control}
              name="observacoes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Observações</FormLabel>
                  <FormControl>
                    <Textarea 
                      {...field} 
                      rows={3}
                      placeholder="Informações adicionais sobre o cliente ou instalação..."
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* Missing items warning */}
            {getMissingItems().length > 0 && (
              <div className="w-full p-3 mb-2 bg-warning/20 text-warning-foreground rounded-lg text-sm flex items-start gap-2">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="font-medium">Documentação incompleta</p>
                  <p className="text-xs mt-1">
                    Faltam: {getMissingItems().join(", ")}
                  </p>
                </div>
              </div>
            )}

            <DialogFooter className="flex-col sm:flex-row gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={loading || savingAsLead}
              >
                Cancelar
              </Button>
              
              {/* Save as Lead button - shown when documentation is incomplete */}
              <Button
                type="button"
                variant="secondary"
                onClick={handleSaveAsLead}
                disabled={loading || savingAsLead}
              >
                {savingAsLead ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
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
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Convertendo...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="mr-2 h-4 w-4" />
                    Converter em Venda
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
