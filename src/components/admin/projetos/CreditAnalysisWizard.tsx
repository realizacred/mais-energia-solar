/**
 * Reutiliza:
 * - Tabelas: analise_credito, project_documents, credit_bank_configs, credit_bank_checklists, credit_analysis_events
 * - Hooks: useCreateAnaliseCredito, useUpdateAnaliseCredito, useAnaliseCreditoDocumentos, useVincularDocumentoCredito, useProjectDocuments, useCreditBankConfigs, useCreditBankChecklist
 * - Libs: formatBRL, formatDateTime, cn, isValidCpf, isValidCnpj
 */
import { useState, useMemo, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { 
  Check, 
  ChevronRight, 
  ChevronLeft, 
  FileText, 
  ShieldCheck, 
  Paperclip,
  CheckCircle2,
  Circle,
  AlertCircle,
  CreditCard,
  UserPlus,
  Building,
  User,
  MapPin,
  Calendar as CalendarIcon,
  Calculator,
  Edit2,
  Zap,
  Loader2,
  Search
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { 
  useCreateAnaliseCredito, 
  useUpdateAnaliseCredito,
  useAnaliseCreditoDocumentos,
  useVincularDocumentoCredito,
  type AnaliseCredito,
  type AnaliseCreditoStatus
} from "@/hooks/useAnaliseCredito";
import { useProjectDocuments } from "@/hooks/useProjectDocuments";
import { useCreditBankConfigs, useCreditBankChecklist } from "@/hooks/useCreditConfigs";
import { formatBRL, parseBRNumber, displayCpfCnpj, displayDate, displayPhone } from "@/lib/formatters/index";
import { formatDateTime } from "@/lib/dateUtils";
import { isValidCpf, isValidCnpj, formatCpfCnpj } from "@/lib/cpfCnpjUtils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";
import { Switch } from "@/components/ui/switch";
import { validateEmail, formatCEP } from "@/lib/validations";
import { 
  CpfCnpjInput, 
  PhoneInput, 
  CurrencyInput, 
  CepInput,
  DateInput
} from "@/components/ui-kit/inputs";
import { onlyDigits } from "@/lib/cpfCnpjUtils";


interface Props {
  isOpen: boolean;
  onClose: () => void;
  dealId?: string | null;
  leadId?: string | null;
  clienteId?: string | null;
  initialData?: AnaliseCredito;
  clienteCpfCnpj?: string | null;
  clienteNome?: string | null;
  clienteTelefone?: string | null;
  valorReferencia?: number | null;
}

type Step = 1 | 2 | 3 | 4 | 5;

export function CreditAnalysisWizard({ 
  isOpen, 
  onClose, 
  dealId, 
  leadId, 
  clienteId, 
  initialData,
  clienteCpfCnpj,
  clienteNome,
  clienteTelefone,
  valorReferencia 
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState({
    tipo_pessoa: initialData?.tipo_pessoa || (clienteCpfCnpj?.length && clienteCpfCnpj.length > 14 ? 'PJ' : 'PF'),
    cpf_cnpj: initialData?.cpf_cnpj || clienteCpfCnpj || "",
    renda_mensal: initialData?.renda_mensal?.toString() || "",
    bancos_selecionados: initialData?.bank_config_id ? [initialData.bank_config_id] : [] as string[],
    bancos_config: {} as Record<string, { prazo_meses: string, carencia: string }>,
    bank_config_id: initialData?.bank_config_id || "",
    banco: initialData?.banco || "",
    valor_solicitado: initialData?.valor_solicitado?.toString() || valorReferencia?.toString() || "",
    entrada: initialData?.entrada?.toString() || "0",
    prazo_meses: initialData?.prazo_meses?.toString() || "60",
    carencia: initialData?.carencia?.toString() || "1",
    patrimonio: initialData?.patrimonio?.toString() || "0",
    avalista_nome: initialData?.avalista_nome || "",
    avalista_cpf: initialData?.avalista_cpf || "",
    avalista_email: initialData?.avalista_email || "",
    avalista_telefone: initialData?.avalista_telefone || "",
    avalista_renda_mensal: initialData?.avalista_renda_mensal?.toString() || "",
    avalista_patrimonio: initialData?.avalista_patrimonio?.toString() || "",
    avalista_data_nascimento: initialData?.avalista_data_nascimento || "",
    avalista_cep: initialData?.avalista_cep || "",
    avalista_rua: initialData?.avalista_rua || "",
    avalista_bairro: initialData?.avalista_bairro || "",
    avalista_cidade: initialData?.avalista_cidade || "",
    avalista_estado: initialData?.avalista_estado || "",
    avalista_numero: initialData?.avalista_numero || "",
    // Novos campos EOS
    cliente_nome: initialData?.cliente_nome || clienteNome || "",
    cliente_email: initialData?.cliente_email || "",
    cliente_telefone: initialData?.cliente_telefone || clienteTelefone || "",
    cliente_data_nascimento: initialData?.cliente_data_nascimento || "",
    cnpj: initialData?.cnpj || "",
    razao_social: initialData?.razao_social || "",
    kit_fotovoltaico: initialData?.kit_fotovoltaico?.toString() || valorReferencia?.toString() || "",
    mao_obra: initialData?.mao_obra?.toString() || "0",
    potencia_instalada: initialData?.potencia_instalada?.toString() || "",
    media_conta_energia: initialData?.media_conta_energia?.toString() || "",
    area_instalacao: initialData?.area_instalacao?.toString() || "",
    situacao_imovel: initialData?.situacao_imovel || "QUITADO",
    endereco_cep: initialData?.endereco_cep || "",
    endereco_logradouro: initialData?.endereco_logradouro || "",
    endereco_numero: initialData?.endereco_numero || "",
    endereco_bairro: initialData?.endereco_bairro || "",
    endereco_cidade: initialData?.endereco_cidade || "",
    endereco_estado: initialData?.endereco_estado || "",
    endereco_complemento: initialData?.endereco_complemento || "",
    com_seguro: initialData?.com_seguro ?? false,
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [searchStatus, setSearchStatus] = useState<'idle' | 'found' | 'not_found'>('idle');

  const handleSearchCliente = async (val: string) => {
    if (!val) return;
    const digits = val.replace(/\D/g, "");
    if (digits.length !== 11 && digits.length !== 14) {
      toast({ title: "Formato inválido", description: "CPF deve ter 11 dígitos e CNPJ 14.", variant: "destructive" });
      return;
    }

    try {
      // 1. Buscar em clientes
      const { data: cliente } = await supabase
        .from("clientes")
        .select("*")
        .or(`cpf_cnpj.eq.${digits},cpf_cnpj.eq.${val}`)
        .limit(1)
        .single();

      if (cliente) {
        setFormData(prev => ({
          ...prev,
          cliente_nome: cliente.nome || "",
          cpf_cnpj: cliente.cpf_cnpj || digits,
          cliente_email: cliente.email || "",
          cliente_telefone: onlyDigits(cliente.telefone || ""),
          cliente_data_nascimento: cliente.data_nascimento || "",
          renda_mensal: (cliente.payment_composition as any)?.renda_mensal?.toString() || prev.renda_mensal,
          patrimonio: (cliente.payment_composition as any)?.patrimonio?.toString() || prev.patrimonio,
          razao_social: cliente.empresa || cliente.nome || "",
          cnpj: digits.length === 14 ? digits : prev.cnpj,
        }));

        setSearchStatus('found');
        toast({ title: "Cliente encontrado", description: "Dados preenchidos automaticamente." });
        return;
      }

      // 2. Fallback em leads
      const { data: lead } = await supabase
        .from("leads")
        .select("*")
        .or(`telefone_normalized.ilike.%${digits.slice(-8)}%,email.eq.${val}`)
        .limit(1)
        .single();
      
      // Se não achou por telefone/email, tentar CPF se a tabela leads tivesse (não tem por padrão no dump, mas vamos tentar se existir coluna)
      // O dump mostra que leads tem 'cpf' ou 'cpf_cnpj'? Não, mostra leads.email e leads.telefone_normalized.
      
      if (lead) {
        setFormData(prev => ({
          ...prev,
          cliente_nome: lead.nome || "",
          cliente_email: lead.email || "",
          cliente_telefone: onlyDigits(lead.telefone || ""),
        }));

        setSearchStatus('found');
        toast({ title: "Lead encontrado", description: "Dados parciais preenchidos." });
        return;
      }

      setSearchStatus('not_found');
    } catch (e) {
      setSearchStatus('not_found');
    }
  };

  const { data: banks } = useCreditBankConfigs();
  const { data: checklist } = useCreditBankChecklist(formData.bank_config_id || undefined);
  const { data: creditDocs } = useAnaliseCreditoDocumentos(initialData?.id || "");
  const { data: projectDocs } = useProjectDocuments({ dealId });

  const createMutation = useCreateAnaliseCredito();
  const updateMutation = useUpdateAnaliseCredito();
  const vincularDocMutation = useVincularDocumentoCredito();

  const [isLinkingDoc, setIsLinkingDoc] = useState<{checklistId: string, itemName: string} | null>(null);

  const validateStep = (currentStep: number): boolean => {
    const newErrors: Record<string, string> = {};

    if (currentStep === 2) {
      if (formData.tipo_pessoa === 'PF') {
        if (!formData.cliente_nome || formData.cliente_nome.length < 3) 
          newErrors.cliente_nome = "Nome completo é obrigatório";
        if (!formData.cpf_cnpj) 
          newErrors.cpf_cnpj = "CPF é obrigatório";
        else if (!isValidCpf(formData.cpf_cnpj.replace(/\D/g, "")))
          newErrors.cpf_cnpj = "CPF inválido";
        
        if (!formData.cliente_data_nascimento) {
          newErrors.cliente_data_nascimento = "Data de nascimento é obrigatória";
        } else {
          const birthDate = new Date(formData.cliente_data_nascimento);
          const today = new Date();
          let age = today.getFullYear() - birthDate.getFullYear();
          const m = today.getMonth() - birthDate.getMonth();
          if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
          if (age < 18 || age > 90) newErrors.cliente_data_nascimento = "Idade entre 18 e 90 anos";
        }

        const phoneDigits = formData.cliente_telefone.replace(/\D/g, "");
        if (!phoneDigits) newErrors.cliente_telefone = "Telefone é obrigatório";
        else if (phoneDigits.length < 10 || phoneDigits.length > 11) newErrors.cliente_telefone = "Telefone inválido";

        if (!formData.cliente_email) newErrors.cliente_email = "E-mail é obrigatório";
        else if (validateEmail(formData.cliente_email)) newErrors.cliente_email = "E-mail inválido";

        if (!formData.renda_mensal || parseFloat(formData.renda_mensal.replace(/[^\d,]/g, "").replace(",", ".")) <= 0) 
          newErrors.renda_mensal = "Renda mensal é obrigatória";
      } else {
        // PJ validation
        if (!formData.cnpj) newErrors.cnpj = "CNPJ é obrigatório";
        else if (!isValidCnpj(formData.cnpj.replace(/\D/g, ""))) newErrors.cnpj = "CNPJ inválido";
        if (!formData.razao_social) newErrors.razao_social = "Razão social é obrigatória";
        
        const phoneDigits = formData.cliente_telefone.replace(/\D/g, "");
        if (!phoneDigits) newErrors.cliente_telefone = "Telefone é obrigatório";
        else if (phoneDigits.length < 10 || phoneDigits.length > 11) newErrors.cliente_telefone = "Telefone inválido";
        
        if (!formData.cliente_email) newErrors.cliente_email = "E-mail é obrigatório";
        else if (validateEmail(formData.cliente_email)) newErrors.cliente_email = "E-mail inválido";

        // Avalista
        if (!formData.avalista_nome) newErrors.avalista_nome = "Nome do avalista é obrigatório";
        if (!formData.avalista_cpf) newErrors.avalista_cpf = "CPF do avalista é obrigatório";
        else if (!isValidCpf(formData.avalista_cpf.replace(/\D/g, ""))) newErrors.avalista_cpf = "CPF inválido";
      }
    }

    if (currentStep === 3) {
      if (!formData.kit_fotovoltaico || parseFloat(formData.kit_fotovoltaico) <= 0) 
        newErrors.kit_fotovoltaico = "Valor do kit é obrigatório";
      if (!formData.potencia_instalada || parseFloat(formData.potencia_instalada) <= 0)
        newErrors.potencia_instalada = "Potência do sistema é obrigatória";
      if (!formData.situacao_imovel)
        newErrors.situacao_imovel = "Situação do imóvel é obrigatória";
      
      const cepDigits = formData.endereco_cep.replace(/\D/g, "");
      if (cepDigits.length !== 8) newErrors.endereco_cep = "CEP inválido";
      if (!formData.endereco_numero) newErrors.endereco_numero = "Número é obrigatório";
    }

    if (currentStep === 4) {
      if (formData.bancos_selecionados.length === 0) {
        newErrors.bancos = "Selecione pelo menos um banco";
      }
      formData.bancos_selecionados.forEach(bankId => {
        const config = formData.bancos_config[bankId] || { prazo_meses: formData.prazo_meses, carencia: formData.carencia };
        if (!config.prazo_meses) newErrors[`prazo_${bankId}`] = "Selecione um prazo";
      });
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateStep(step)) {
      setStep((s) => (s + 1) as Step);
    }
  };

  const handleBack = () => setStep((s) => (s - 1) as Step);

  const handleSave = async (asDraft = true) => {
    if (!asDraft && !validateStep(step)) return;

    const status: AnaliseCreditoStatus = asDraft ? 'rascunho' : 'pendente_documentos';
    
    // Converte data para ISO 8601 se existir
    const isoNascimento = formData.cliente_data_nascimento 
      ? new Date(formData.cliente_data_nascimento).toISOString() 
      : null;
    
    const commonData: any = {
      ...formData,
      cliente_data_nascimento: isoNascimento,
      renda_mensal: parseBRNumber(formData.renda_mensal) || 0,
      valor_solicitado: parseFloat(formData.valor_solicitado) || 0,
      entrada: parseBRNumber(formData.entrada) || 0,
      patrimonio: parseBRNumber(formData.patrimonio) || 0,
      avalista_renda_mensal: parseBRNumber(formData.avalista_renda_mensal) || 0,
      avalista_patrimonio: parseBRNumber(formData.avalista_patrimonio) || 0,
      kit_fotovoltaico: parseBRNumber(formData.kit_fotovoltaico) || 0,
      mao_obra: parseBRNumber(formData.mao_obra) || 0,
      potencia_instalada: parseFloat(formData.potencia_instalada.toString().replace(",", ".")) || 0,
      media_conta_energia: parseBRNumber(formData.media_conta_energia) || 0,
      area_instalacao: parseFloat(formData.area_instalacao.toString().replace(",", ".")) || 0,
      deal_id: dealId,
      lead_id: leadId,
      cliente_id: clienteId,
      status
    };

    try {
      if (initialData?.id) {
        // Edit mode: updating the existing record (only first bank supported for now in edit)
        const bankId = formData.bancos_selecionados[0];
        const bank = banks?.find(b => b.id === bankId);
        const config = formData.bancos_config[bankId] || { prazo_meses: formData.prazo_meses, carencia: formData.carencia };
        
        await updateMutation.mutateAsync({ 
          id: initialData.id, 
          ...commonData, 
          bank_config_id: bankId,
          banco: bank?.bank_name,
          prazo_meses: parseInt(config.prazo_meses),
          carencia: parseInt(config.carencia)
        });
      } else {
        // Multi-insert for new applications
        for (const bankId of formData.bancos_selecionados) {
          const bank = banks?.find(b => b.id === bankId);
          const config = formData.bancos_config[bankId] || { prazo_meses: formData.prazo_meses, carencia: formData.carencia };
          const timestamp = Date.now();
          const idempotency_key = `${dealId || leadId}:${bank?.slug || bankId}:${timestamp}`;

          const result = await createMutation.mutateAsync({
            ...commonData,
            bank_config_id: bankId,
            banco: bank?.bank_name,
            prazo_meses: parseInt(config.prazo_meses),
            carencia: parseInt(config.carencia),
            idempotency_key
          } as any);

          // If EOS and not draft, trigger simulation
          if (!asDraft && bank?.slug?.toLowerCase() === 'eos' && result?.id) {
            supabase.functions.invoke('eos-simular', {
              body: { analise_id: result.id }
            }).catch(err => console.error("Simulação EOS falhou", err));
          }

          // Notificar Hub
          if (!asDraft) {
            const statusEvento = 'credito_aguardando_documentos'; // Status inicial ao sair do rascunho
            supabase.functions.invoke('notification-hub', {
              body: {
                evento: statusEvento,
                tenant_id: bank?.tenant_id, // assuming bank has tenant_id or resolve from profile
                dados: {
                  projeto_id: dealId,
                  analise_id: result?.id,
                  cliente_id: clienteId,
                  banco: bank?.bank_name,
                  valor: commonData.valor_solicitado
                }
              }
            }).catch(err => console.error("[notification-hub] Erro ao invocar:", err));
          }
        }
      }
      onClose();
    } catch (e) {
      // toast handled in hook
    }
  };

  const fetchCep = async (cep: string, isInstallation = true) => {
    const digits = cep.replace(/\D/g, "");
    if (digits.length !== 8) return;
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`);
      const data = await res.json();
      if (!data.erro) {
        if (isInstallation) {
          setFormData(prev => ({
            ...prev,
            endereco_cep: formatCEP(cep),
            endereco_logradouro: data.logradouro,
            endereco_bairro: data.bairro,
            endereco_cidade: data.localidade,
            endereco_estado: data.uf
          }));
        } else {
          setFormData(prev => ({
            ...prev,
            avalista_cep: formatCEP(cep),
            avalista_rua: data.logradouro,
            avalista_bairro: data.bairro,
            avalista_cidade: data.localidade,
            avalista_estado: data.uf
          }));
        }
      }
    } catch (e) {
      console.error("ViaCEP error", e);
    }
  };

  const filteredChecklist = useMemo(() => {
    if (!checklist) return [];
    return checklist.filter(item => 
      item.applicable_to === 'both' || item.applicable_to === formData.tipo_pessoa.toLowerCase()
    );
  }, [checklist, formData.tipo_pessoa]);

  const valorTotalProjeto = useMemo(() => {
    return (parseBRNumber(formData.kit_fotovoltaico || '0') + parseBRNumber(formData.mao_obra || '0'));
  }, [formData.kit_fotovoltaico, formData.mao_obra]);

  const valorFinanciado = useMemo(() => {
    return valorTotalProjeto - parseBRNumber(formData.entrada || '0');
  }, [valorTotalProjeto, formData.entrada]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-card border-border/40 shadow-2xl h-[95vh] sm:h-[80vh] flex flex-col">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {initialData ? "Editar Análise" : "Nova Solicitação de Crédito"}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4, 5].map((s) => (
              <div key={s} className="flex items-center flex-1">
                <div 
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all duration-300",
                    step === s ? "bg-primary text-primary-foreground scale-110 shadow-lg" : 
                    step > s ? "bg-success text-success-foreground" : "bg-muted text-muted-foreground"
                  )}
                >
                  {step > s ? <Check className="h-4 w-4" /> : s}
                </div>
                {s < 5 && <div className={cn("h-1 flex-1 mx-2 rounded-full", step > s ? "bg-success" : "bg-muted")} />}
              </div>
            ))}
          </div>
        </DialogHeader>

        <div className="p-0 flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-6">
              {step === 1 && (
                <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                  <div className="grid grid-cols-2 gap-4">
                    <div 
                      className={cn(
                        "p-8 rounded-xl border-2 flex flex-col items-center gap-4 cursor-pointer transition-all",
                        formData.tipo_pessoa === 'PF' ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-muted-foreground/30"
                      )}
                      onClick={() => setFormData({...formData, tipo_pessoa: 'PF'})}
                    >
                      <User className="h-10 w-10 text-primary" />
                      <div className="text-center">
                        <span className="font-bold block">Pessoa Física</span>
                        <span className="text-xs text-muted-foreground">Para clientes individuais (CPF)</span>
                      </div>
                    </div>
                    <div 
                      className={cn(
                        "p-8 rounded-xl border-2 flex flex-col items-center gap-4 cursor-pointer transition-all",
                        formData.tipo_pessoa === 'PJ' ? "border-primary bg-primary/5 shadow-md" : "border-border hover:border-muted-foreground/30"
                      )}
                      onClick={() => setFormData({...formData, tipo_pessoa: 'PJ'})}
                    >
                      <Building className="h-10 w-10 text-primary" />
                      <div className="text-center">
                        <span className="font-bold block">Pessoa Jurídica</span>
                        <span className="text-xs text-muted-foreground">Para empresas (CNPJ). Requer avalista.</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                  <div className="flex flex-col gap-4">
                    <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Search className="h-4 w-4" />
                        Buscar cliente por CPF/CNPJ
                      </Label>
                      <div className="flex gap-2">
                        <CpfCnpjInput 
                          value={formData.cpf_cnpj}
                          onChange={(val) => {
                            setFormData({...formData, cpf_cnpj: val});
                            if (val.length === 11 || val.length === 14) {
                              handleSearchCliente(val);
                            }
                          }}
                        />
                        <Button 
                          type="button" 
                          variant="secondary"
                          onClick={() => handleSearchCliente(formData.cpf_cnpj)}
                        >
                          Buscar
                        </Button>
                      </div>
                      {searchStatus === 'found' && (
                        <div className="flex items-center gap-2 text-xs text-success font-medium animate-in fade-in slide-in-from-top-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          Cliente encontrado: {formData.cliente_nome} — dados preenchidos automaticamente
                        </div>
                      )}
                      {searchStatus === 'not_found' && (
                        <div className="flex items-center gap-2 text-xs text-amber-600 font-medium animate-in fade-in slide-in-from-top-1">
                          <AlertCircle className="h-3.5 w-3.5" />
                          Cliente não encontrado — preencha os dados manualmente
                        </div>
                      )}
                    </div>

                    <h3 className="font-bold text-lg">Dados do Cliente</h3>
                  </div>


                  {formData.tipo_pessoa === 'PF' ? (
                    <div className="grid grid-cols-2 gap-4">
                       <div className="col-span-2 space-y-1">
                         <Label>Nome Completo *</Label>
                         <Input 
                            value={formData.cliente_nome} 
                            onChange={e => setFormData({...formData, cliente_nome: e.target.value})} 
                            placeholder="Nome completo" 
                            className={errors.cliente_nome ? "border-red-500" : ""}
                         />
                         {errors.cliente_nome && <p className="text-red-500 text-xs mt-1">{errors.cliente_nome}</p>}
                       </div>
                       <div className="space-y-1">
                         <Label>CPF *</Label>
                         <CpfCnpjInput 
                            value={formData.cpf_cnpj} 
                            onChange={val => setFormData({...formData, cpf_cnpj: val})} 
                            error={errors.cpf_cnpj}
                         />
                       </div>
                       <div className="space-y-1">
                         <Label>Data de Nascimento *</Label>
                         <DateInput 
                            value={formData.cliente_data_nascimento} 
                            onChange={val => setFormData({...formData, cliente_data_nascimento: val})} 
                            className={errors.cliente_data_nascimento ? "border-red-500" : ""}
                         />
                         {errors.cliente_data_nascimento && <p className="text-red-500 text-xs mt-1">{errors.cliente_data_nascimento}</p>}
                       </div>

                       <div className="space-y-1">
                         <Label>Telefone *</Label>
                         <PhoneInput 
                            value={formData.cliente_telefone} 
                            onChange={val => setFormData({...formData, cliente_telefone: val})} 
                            className={errors.cliente_telefone ? "border-red-500" : ""}
                         />
                         {errors.cliente_telefone && <p className="text-red-500 text-xs mt-1">{errors.cliente_telefone}</p>}
                       </div>

                       <div className="space-y-1">
                         <Label>E-mail *</Label>
                         <Input 
                            value={formData.cliente_email} 
                            onChange={e => setFormData({...formData, cliente_email: e.target.value})} 
                            placeholder="email@exemplo.com" 
                            className={errors.cliente_email ? "border-red-500" : ""}
                         />
                         {errors.cliente_email && <p className="text-red-500 text-xs mt-1">{errors.cliente_email}</p>}
                       </div>
                       <div className="space-y-1">
                         <Label>Renda Mensal *</Label>
                         <CurrencyInput 
                            value={parseBRNumber(formData.renda_mensal)} 
                            onChange={val => setFormData({...formData, renda_mensal: val.toString()})} 
                            className={errors.renda_mensal ? "border-red-500" : ""}
                         />
                         {errors.renda_mensal && <p className="text-red-500 text-xs mt-1">{errors.renda_mensal}</p>}
                       </div>
                       <div className="space-y-1">
                         <Label>Patrimônio Estimado</Label>
                         <CurrencyInput 
                            value={parseBRNumber(formData.patrimonio)} 
                            onChange={val => setFormData({...formData, patrimonio: val.toString()})} 
                         />
                       </div>

                    </div>
                  ) : (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <Label>CNPJ *</Label>
                          <CpfCnpjInput 
                            value={formData.cnpj} 
                            onChange={val => setFormData({...formData, cnpj: val})} 
                            error={errors.cnpj}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label>Nome Fantasia *</Label>
                          <Input 
                            value={formData.razao_social} 
                            onChange={e => setFormData({...formData, razao_social: e.target.value})} 
                            placeholder="Nome da Empresa" 
                            className={errors.razao_social ? "border-red-500" : ""}
                          />
                          {errors.razao_social && <p className="text-red-500 text-xs mt-1">{errors.razao_social}</p>}
                        </div>
                        <div className="space-y-1">
                          <Label>Telefone *</Label>
                          <PhoneInput 
                            value={formData.cliente_telefone} 
                            onChange={val => setFormData({...formData, cliente_telefone: val})} 
                            className={errors.cliente_telefone ? "border-red-500" : ""}
                          />
                          {errors.cliente_telefone && <p className="text-red-500 text-xs mt-1">{errors.cliente_telefone}</p>}
                        </div>

                        <div className="space-y-1">
                          <Label>E-mail *</Label>
                          <Input 
                            value={formData.cliente_email} 
                            onChange={e => setFormData({...formData, cliente_email: e.target.value})} 
                            placeholder="email@empresa.com" 
                            className={errors.cliente_email ? "border-red-500" : ""}
                          />
                          {errors.cliente_email && <p className="text-red-500 text-xs mt-1">{errors.cliente_email}</p>}
                        </div>
                      </div>

                      <div className="pt-4 border-t space-y-4">
                        <h4 className="font-bold flex items-center gap-2"><UserPlus className="h-4 w-4" /> Dados do Avalista</h4>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div className="col-span-2 space-y-1">
                            <Label>Nome Completo *</Label>
                            <Input 
                              className={cn("h-8", errors.avalista_nome ? "border-red-500" : "")} 
                              value={formData.avalista_nome} 
                              onChange={e => setFormData({...formData, avalista_nome: e.target.value})} 
                            />
                            {errors.avalista_nome && <p className="text-red-500 text-xs mt-1">{errors.avalista_nome}</p>}
                          </div>
                          <div className="space-y-1">
                            <Label>CPF *</Label>
                            <CpfCnpjInput 
                              className={cn("h-8")} 
                              value={formData.avalista_cpf} 
                              onChange={val => setFormData({...formData, avalista_cpf: val})} 
                              error={errors.avalista_cpf}
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Data de Nascimento *</Label>
                            <DateInput className="h-8" value={formData.avalista_data_nascimento} onChange={val => setFormData({...formData, avalista_data_nascimento: val})} />
                          </div>
                          <div className="space-y-1">
                            <Label>Telefone *</Label>
                            <PhoneInput className="h-8" value={formData.avalista_telefone} onChange={val => setFormData({...formData, avalista_telefone: val})} />
                          </div>
                          <div className="space-y-1">
                            <Label>E-mail *</Label>
                            <Input className="h-8" value={formData.avalista_email} onChange={e => setFormData({...formData, avalista_email: e.target.value})} />
                          </div>

                          <div className="space-y-1">
                            <Label>Renda Mensal *</Label>
                            <CurrencyInput 
                              className="h-8" 
                              value={parseBRNumber(formData.avalista_renda_mensal)} 
                              onChange={val => setFormData({...formData, avalista_renda_mensal: val.toString()})} 
                            />
                          </div>
                          <div className="space-y-1">
                            <Label>Patrimônio *</Label>
                            <CurrencyInput 
                              className="h-8" 
                              value={parseBRNumber(formData.avalista_patrimonio)} 
                              onChange={val => setFormData({...formData, avalista_patrimonio: val.toString()})} 
                            />
                          </div>

                          <div className="space-y-1">
                            <Label>CEP *</Label>
                            <CepInput 
                              className="h-8" 
                              value={formData.avalista_cep} 
                              onChange={val => setFormData({...formData, avalista_cep: val})} 
                              onAddressFound={(addr) => setFormData(prev => ({
                                ...prev,
                                avalista_rua: addr.logradouro,
                                avalista_bairro: addr.bairro,
                                avalista_cidade: addr.localidade,
                                avalista_estado: addr.uf
                              }))}
                            />
                          </div>

                          <div className="col-span-2 grid grid-cols-3 gap-2">
                             <div className="col-span-2 space-y-1">
                               <Label>Logradouro</Label>
                               <Input className="h-8" value={formData.avalista_rua} readOnly />
                             </div>
                             <div className="space-y-1">
                               <Label>Número</Label>
                               <Input className="h-8" value={formData.avalista_numero} onChange={e => setFormData({...formData, avalista_numero: e.target.value})} />
                             </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                  <h3 className="font-bold text-lg">Dados do Projeto</h3>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                       <Label>Valor do Kit Fotovoltaico *</Label>
                       <CurrencyInput 
                          value={parseBRNumber(formData.kit_fotovoltaico)} 
                          onChange={val => setFormData({...formData, kit_fotovoltaico: val.toString()})} 
                          className={errors.kit_fotovoltaico ? "border-red-500" : ""}
                       />
                       {errors.kit_fotovoltaico && <p className="text-red-500 text-xs mt-1">{errors.kit_fotovoltaico}</p>}
                     </div>
                     <div className="space-y-1">
                       <Label>Valor da Mão de Obra *</Label>
                       <CurrencyInput 
                          value={parseBRNumber(formData.mao_obra)} 
                          onChange={val => setFormData({...formData, mao_obra: val.toString()})} 
                       />
                     </div>

                     <div className="col-span-2 bg-primary/10 p-4 rounded-xl flex justify-between items-center border border-primary/20">
                        <div className="flex items-center gap-2">
                          <Calculator className="h-5 w-5 text-primary" />
                          <span className="font-bold text-primary">Valor Total do Projeto</span>
                        </div>
                        <span className="text-xl font-black text-primary">{formatBRL(valorTotalProjeto)}</span>
                     </div>
                     <div className="space-y-1">
                        <Label>Potência do Sistema (kWp) *</Label>
                        <Input 
                            className={errors.potencia_instalada ? "border-red-500" : ""} 
                            value={formData.potencia_instalada} 
                            onChange={e => setFormData({...formData, potencia_instalada: e.target.value.replace(",", ".")})} 
                        />
                        {errors.potencia_instalada && <p className="text-red-500 text-xs mt-1">{errors.potencia_instalada}</p>}
                     </div>
                     <div className="space-y-1">
                        <Label>Valor da Conta de Energia (R$)</Label>
                        <CurrencyInput 
                            value={parseBRNumber(formData.media_conta_energia)} 
                            onChange={val => setFormData({...formData, media_conta_energia: val.toString()})} 
                        />
                      </div>

                     <div className="space-y-1">
                        <Label>Área de Instalação (m²)</Label>
                        <Input value={formData.area_instalacao} onChange={e => setFormData({...formData, area_instalacao: e.target.value.replace(",", ".")})} />
                     </div>
                     <div className="space-y-1">
                        <Label>Situação do Imóvel *</Label>
                        <Select value={formData.situacao_imovel} onValueChange={v => setFormData({...formData, situacao_imovel: v})}>
                          <SelectTrigger className={errors.situacao_imovel ? "border-red-500" : ""}>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="QUITADO">Quitado</SelectItem>
                            <SelectItem value="FINANCIADO">Financiado</SelectItem>
                            <SelectItem value="ALUGADO">Alugado</SelectItem>
                          </SelectContent>
                        </Select>
                        {errors.situacao_imovel && <p className="text-red-500 text-xs mt-1">{errors.situacao_imovel}</p>}
                     </div>
                  </div>

                  <div className="pt-4 border-t space-y-4">
                    <h4 className="font-bold flex items-center gap-2"><MapPin className="h-4 w-4" /> Endereço de Instalação</h4>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1">
                          <Label>CEP *</Label>
                          <CepInput 
                             value={formData.endereco_cep} 
                             onChange={val => setFormData({...formData, endereco_cep: val})} 
                             onAddressFound={(addr) => setFormData(prev => ({
                               ...prev,
                               endereco_logradouro: addr.logradouro,
                               endereco_bairro: addr.bairro,
                               endereco_cidade: addr.localidade,
                               endereco_estado: addr.uf
                             }))}
                             className={errors.endereco_cep ? "border-red-500" : ""} 
                          />
                          {errors.endereco_cep && <p className="text-red-500 text-xs mt-1">{errors.endereco_cep}</p>}
                        </div>

                       <div className="space-y-1">
                         <Label>Cidade / UF</Label>
                         <Input value={`${formData.endereco_cidade} / ${formData.endereco_estado}`} readOnly className="bg-muted" />
                       </div>
                       <div className="col-span-2 grid grid-cols-3 gap-2">
                          <div className="col-span-2 space-y-1">
                            <Label>Logradouro</Label>
                             <Input value={formData.endereco_logradouro} onChange={e => setFormData({...formData, endereco_logradouro: e.target.value})} />
                           </div>
                           <div className="space-y-1">
                             <Label>Número *</Label>
                             <Input 
                                className={errors.endereco_numero ? "border-red-500" : ""} 
                                value={formData.endereco_numero} 
                                onChange={e => setFormData({...formData, endereco_numero: e.target.value})} 
                             />
                             {errors.endereco_numero && <p className="text-red-500 text-xs mt-1">{errors.endereco_numero}</p>}
                           </div>
                       </div>
                    </div>
                  </div>
                </div>
              )}

              {step === 4 && (
                <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-bold text-lg">Bancos para Análise</h3>
                    <p className="text-sm text-muted-foreground">Selecione as instituições para enviar esta ficha</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-3">
                    {banks?.map((bank) => {
                      const isSelected = formData.bancos_selecionados.includes(bank.id);
                      const metadata = (bank as any).technical_metadata;
                      const type = metadata?.tipo === 'api_integrada' ? 'API Integrada' : 
                                   metadata?.fonte_sync === 'manual' ? 'Manual' : 'Parcial';
                      
                      return (
                        <div 
                          key={bank.id}
                          onClick={() => {
                            const newBancos = isSelected 
                              ? formData.bancos_selecionados.filter(id => id !== bank.id)
                              : [...formData.bancos_selecionados, bank.id];
                            setFormData({...formData, bancos_selecionados: newBancos});
                          }}
                          className={cn(
                            "p-4 rounded-xl border-2 cursor-pointer transition-all relative overflow-hidden group",
                            isSelected 
                              ? "border-primary bg-primary/5 shadow-md" 
                              : "border-border hover:border-muted-foreground/30 bg-muted/5"
                          )}
                        >
                          <div className="flex flex-col gap-1">
                            <div className="flex justify-between items-center">
                              <span className="font-bold text-sm truncate pr-6">{bank.bank_name}</span>
                              {isSelected && <CheckCircle2 className="h-4 w-4 text-primary absolute top-4 right-4 animate-in zoom-in-50" />}
                            </div>
                            <Badge variant={type === 'API Integrada' ? 'success' : 'outline'} className="w-fit text-[9px] h-4">
                              {type}
                            </Badge>
                            <span className="text-[10px] text-muted-foreground mt-1">
                              {bank.prazo_medio ? `Até ${bank.prazo_medio}` : 'Prazo flexível'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                  {errors.bancos && <p className="text-red-500 text-xs mt-1">{errors.bancos}</p>}

                  <Separator />

                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border bg-muted/30">
                      <span className="text-xs text-muted-foreground block mb-1">Valor do projeto</span>
                      <span className="text-lg font-bold">{formatBRL(valorTotalProjeto)}</span>
                    </div>
                    <div className="p-4 rounded-xl border bg-primary/5 border-primary/20">
                      <span className="text-xs text-primary block mb-1">Valor a financiar</span>
                      <span className="text-lg font-bold text-primary">{formatBRL(valorFinanciado)}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Valor de Entrada (R$)</Label>
                    <CurrencyInput 
                      value={parseBRNumber(formData.entrada)} 
                      onChange={val => setFormData({...formData, entrada: val.toString()})} 
                    />
                  </div>


                  {formData.bancos_selecionados.length > 0 && (
                    <div className="space-y-6 pt-4">
                      <h4 className="font-bold text-sm flex items-center gap-2">
                        <Calculator className="h-4 w-4" /> Configuração por Banco
                      </h4>
                      {formData.bancos_selecionados.map(bankId => {
                        const bank = banks?.find(b => b.id === bankId);
                        const config = formData.bancos_config[bankId] || { prazo_meses: formData.prazo_meses, carencia: formData.carencia };
                        
                        return (
                          <div key={bankId} className="p-4 rounded-xl border bg-muted/10 space-y-4">
                            <span className="text-sm font-bold text-primary">{bank?.bank_name}</span>
                            <div className="grid grid-cols-2 gap-4">
                              <div className="space-y-2">
                                <Label className="text-xs">Prazo (meses)</Label>
                                <Select 
                                  value={config.prazo_meses} 
                                  onValueChange={(val) => setFormData({
                                    ...formData, 
                                    bancos_config: { ...formData.bancos_config, [bankId]: { ...config, prazo_meses: val } }
                                  })}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[12, 24, 36, 48, 60, 72, 84, 96, 120].map(p => (
                                      <SelectItem key={p} value={p.toString()}>{p} meses</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-2">
                                <Label className="text-xs">Carência (meses)</Label>
                                <Select 
                                  value={config.carencia} 
                                  onValueChange={(val) => setFormData({
                                    ...formData, 
                                    bancos_config: { ...formData.bancos_config, [bankId]: { ...config, carencia: val } }
                                  })}
                                >
                                  <SelectTrigger className="h-9">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {[0, 1, 2, 3, 4, 5, 6].map(c => (
                                      <SelectItem key={c} value={c.toString()}>{c} {c === 1 ? 'mês' : 'meses'}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  <div className="flex items-center justify-between p-4 rounded-xl border bg-muted/10">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-5 w-5 text-success" />
                      <div>
                        <span className="font-bold block text-sm">Incluir Seguro</span>
                        <span className="text-xs text-muted-foreground italic">Proteção adicional contra imprevistos</span>
                      </div>
                    </div>
                    <Switch checked={formData.com_seguro} onCheckedChange={v => setFormData({...formData, com_seguro: v})} />
                  </div>
                </div>
              )}

              {step === 5 && (
                <div className="space-y-6 animate-in slide-in-from-right-2 duration-300 pb-10">
                  <h3 className="font-bold text-lg">Revisão e Simulação</h3>
                  
                  <div className="space-y-4">
                    <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-sm uppercase text-muted-foreground tracking-wider">Dados do Cliente</h4>
                        <Button variant="ghost" size="sm" onClick={() => setStep(2)} className="h-7 gap-1 text-xs"><Edit2 className="h-3 w-3" /> Editar</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <span className="text-muted-foreground">Nome:</span>
                        <span className="font-medium text-right">{formData.cliente_nome || formData.razao_social}</span>
                        <span className="text-muted-foreground">CPF/CNPJ:</span>
                        <span className="font-medium text-right">{displayCpfCnpj(formData.cpf_cnpj || formData.cnpj)}</span>
                        <span className="text-muted-foreground">Renda Mensal:</span>
                        <span className="font-medium text-right">{formatBRL(parseBRNumber(formData.renda_mensal || '0'))}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-sm uppercase text-muted-foreground tracking-wider">Dados do Projeto</h4>
                        <Button variant="ghost" size="sm" onClick={() => setStep(3)} className="h-7 gap-1 text-xs"><Edit2 className="h-3 w-3" /> Editar</Button>
                      </div>
                      <div className="grid grid-cols-2 gap-y-2 text-sm">
                        <span className="text-muted-foreground">Valor Total:</span>
                        <span className="font-bold text-primary text-right">{formatBRL(valorTotalProjeto)}</span>
                        <span className="text-muted-foreground">Potência:</span>
                        <span className="font-medium text-right">{formData.potencia_instalada} kWp</span>
                        <span className="text-muted-foreground">Local:</span>
                        <span className="font-medium text-right truncate">{formData.endereco_cidade} / {formData.endereco_estado}</span>
                      </div>
                    </div>

                    <div className="p-4 rounded-xl border bg-muted/10 space-y-3">
                      <div className="flex justify-between items-center mb-1">
                        <h4 className="font-bold text-sm uppercase text-muted-foreground tracking-wider">Pagamento e Bancos</h4>
                        <Button variant="ghost" size="sm" onClick={() => setStep(4)} className="h-7 gap-1 text-xs"><Edit2 className="h-3 w-3" /> Editar</Button>
                      </div>
                      <div className="space-y-3">
                        {formData.bancos_selecionados.map(bankId => {
                          const bank = banks?.find(b => b.id === bankId);
                          const config = formData.bancos_config[bankId] || { prazo_meses: formData.prazo_meses, carencia: formData.carencia };
                          const type = (bank as any).technical_metadata?.tipo === 'api_integrada' ? 'API' : 'Manual';
                          
                          return (
                            <div key={bankId} className="flex justify-between items-center text-sm border-b border-border/40 pb-2 last:border-0 last:pb-0">
                              <div className="flex flex-col">
                                <span className="font-bold">{bank?.bank_name}</span>
                                <span className="text-[10px] text-muted-foreground uppercase">{type}</span>
                              </div>
                              <div className="text-right">
                                <span className="font-medium block">{config.prazo_meses} meses</span>
                                <span className="text-[10px] text-muted-foreground italic">Carência: {config.carencia} m</span>
                              </div>
                            </div>
                          );
                        })}
                        {formData.bancos_selecionados.length === 0 && (
                          <span className="text-sm text-destructive font-medium">Nenhum banco selecionado!</span>
                        )}
                        <Separator />
                        <div className="grid grid-cols-2 text-sm pt-1">
                          <span className="text-muted-foreground">Seguro:</span>
                          <span className="font-medium text-right">{formData.com_seguro ? 'Sim' : 'Não'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t space-y-4">
                     <Button className="w-full h-12 text-lg font-bold gap-2 shadow-lg shadow-primary/20" onClick={() => toast({ title: "Simulação Iniciada", description: "Consultando opções na EOS..." })}>
                        <Zap className="h-5 w-5 fill-current" /> Simular Financiamento
                     </Button>

                     <div className="rounded-xl border border-dashed p-8 text-center bg-muted/5">
                        <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2 text-primary/50" />
                        <p className="text-sm text-muted-foreground">Os resultados da simulação EOS aparecerão aqui.</p>
                     </div>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </div>

        <Separator className="bg-border/40" />
        
        <DialogFooter className="p-6 bg-muted/10">
          <div className="flex items-center justify-between w-full flex-wrap gap-2">
            <Button variant="ghost" onClick={handleBack} disabled={step === 1} className="gap-1.5">
              <ChevronLeft className="h-4 w-4" /> Anterior
            </Button>
            
            <div className="flex gap-2 flex-1 sm:flex-initial">
              <Button variant="outline" onClick={() => handleSave(true)} disabled={createMutation.isPending || updateMutation.isPending} className="flex-1 sm:flex-none">
                Salvar Rascunho
              </Button>
              {step < 5 ? (
                <Button onClick={handleNext} className="gap-1.5 flex-1 sm:flex-none">
                  Próximo <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  onClick={() => handleSave(false)} 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-1.5 flex-1 sm:flex-none"
                  disabled={createMutation.isPending || updateMutation.isPending}
                >
                  <Check className="h-4 w-4" /> Finalizar
                </Button>
              )}
            </div>
          </div>
        </DialogFooter>
      </DialogContent>

      <Dialog open={!!isLinkingDoc} onOpenChange={(open) => !open && setIsLinkingDoc(null)}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Vincular Documento: {isLinkingDoc?.itemName}</DialogTitle>
          </DialogHeader>
          <ScrollArea className="max-h-[50vh] pr-4 py-4">
            <div className="space-y-2">
              {projectDocs?.documents.length === 0 ? (
                <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                  <p className="text-sm text-muted-foreground">Nenhum documento encontrado no projeto.</p>
                </div>
              ) : (
                projectDocs?.documents.map((doc) => (
                  <Button
                    key={doc.id}
                    variant="outline"
                    className="w-full justify-start h-auto py-3 px-4 flex-col items-start gap-1"
                    onClick={async () => {
                      if (isLinkingDoc && initialData?.id) {
                        await vincularDocMutation.mutateAsync({
                          analise_credito_id: initialData.id,
                          project_document_id: doc.id,
                          checklist_item_id: isLinkingDoc.checklistId
                        });
                        setIsLinkingDoc(null);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2 w-full">
                      <FileText className="h-4 w-4 text-primary shrink-0" />
                      <span className="font-semibold truncate flex-1 text-left">{doc.display_name || doc.file_name}</span>
                      <Badge variant="outline" className="text-[9px] shrink-0 uppercase">{doc.categoria}</Badge>
                    </div>
                    <span className="text-[10px] text-muted-foreground ml-6">Enviado em {formatDateTime(doc.created_at)}</span>
                  </Button>
                ))
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
