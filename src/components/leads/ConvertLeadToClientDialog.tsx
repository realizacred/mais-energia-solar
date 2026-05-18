import { useState, useEffect, useMemo } from "react";
import { ShoppingCart, User, FileText, Wallet, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOfflineConversionSync } from "@/hooks/useOfflineConversionSync";
import { uploadDocumentFiles, type DocumentFile } from "./DocumentUpload";
import type { Lead } from "@/types/lead";
import { createEmptyItem, type PaymentItemInput } from "@/services/paymentComposition/types";
import { StepDadosPessoais, type Step1Data } from "./conversion/StepDadosPessoais";
import { StepTecnico, type Step2Data } from "./conversion/StepTecnico";
import { StepFinanceiro } from "./conversion/StepFinanceiro";
import { useVendaFinanceSnapshot } from "@/hooks/useVendaFinanceSnapshot";
import { mapSelectedOrcamentoToConversionData } from "@/services/leads/mapSelectedOrcamentoToConversionData";

import type { OrcamentoDisplayItem } from "@/types/orcamento";

interface ConvertLeadToClientDialogProps {
  lead: Lead | null;
  selectedOrcamento?: OrcamentoDisplayItem | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  orcamentoId?: string | null;
}

export function ConvertLeadToClientDialog({ 
  lead, 
  selectedOrcamento, 
  open, 
  onOpenChange, 
  onSuccess, 
  orcamentoId 
}: ConvertLeadToClientDialogProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [step1Data, setStep1Data] = useState<Partial<Step1Data>>({});
  const [step2Data, setStep2Data] = useState<Partial<Step2Data>>({});
  const [isStep1Valid, setIsStep1Valid] = useState(false);
  const [isStep2Valid, setIsStep2Valid] = useState(false);
  
  const [identidadeFiles, setIdentidadeFiles] = useState<DocumentFile[]>([]);
  const [comprovanteFiles, setComprovanteFiles] = useState<DocumentFile[]>([]);
  const [beneficiariaFiles, setBeneficiariaFiles] = useState<DocumentFile[]>([]);
  const [assinaturaFiles, setAssinaturaFiles] = useState<DocumentFile[]>([]);
  const [paymentItems, setPaymentItems] = useState<PaymentItemInput[]>([createEmptyItem()]);

  const { isOnline } = useOfflineConversionSync();

  const { data: propostaVersaoValor = 0 } = useQuery({
    queryKey: ["convert-lead-proposta-valor", lead?.id],
    enabled: !!lead?.id && open,
    queryFn: async () => {
      const { data: propostas } = await supabase.from("propostas_nativas").select("id").eq("lead_id", lead?.id);
      const ids = (propostas ?? []).map(p => p.id);
      if (ids.length === 0) return 0;
      const { data: versao } = await supabase.from("proposta_versoes").select("valor_total").in("proposta_id", ids).order("created_at", { ascending: false }).limit(1).maybeSingle();
      return Number(versao?.valor_total ?? 0);
    },
  });

  const valorVenda = useMemo(() => propostaVersaoValor || (lead as any)?.valor_projeto || 0, [propostaVersaoValor, lead]);
  const finance = useVendaFinanceSnapshot(valorVenda, paymentItems);

  const mappedHydration = useMemo(
    () => mapSelectedOrcamentoToConversionData(selectedOrcamento, lead),
    [selectedOrcamento, lead],
  );
  const hydrationKey = mappedHydration._orcamento_id || mappedHydration._lead_id || orcamentoId || null;
  const mappedStep1Data = useMemo<Partial<Step1Data>>(() => ({
    nome: mappedHydration.nome,
    telefone: mappedHydration.telefone,
    email: mappedHydration.email,
    cpf_cnpj: mappedHydration.cpf_cnpj,
    data_nascimento: mappedHydration.data_nascimento,
    cep: mappedHydration.cep,
    estado: mappedHydration.estado,
    cidade: mappedHydration.cidade,
    bairro: mappedHydration.bairro,
    rua: mappedHydration.rua,
    numero: mappedHydration.numero,
    complemento: mappedHydration.complemento,
  }), [mappedHydration]);
  const mappedStep2Data = useMemo<Partial<Step2Data>>(() => ({
    localizacao: mappedHydration.localizacao,
    observacoes: mappedHydration.observacoes,
    media_consumo: mappedHydration.media_consumo,
    consumo_previsto: mappedHydration.consumo_previsto,
  }), [mappedHydration]);

  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      return;
    }

    // Purge legacy localStorage caches from older wizard versions.
    // They used `{}` placeholders that overrode the orçamento fallback,
    // causing the form to render empty. Mapper is now the only source.
    try {
      const legacyKeys = [
        `lead_conversion_${lead?.id}`,
        `lead_conversion_step1_${lead?.id}`,
        `lead_conversion_step2_${lead?.id}`,
        `convert_lead_wizard_${lead?.id}`,
        `convert_wizard_${lead?.id}`,
      ];
      legacyKeys.forEach((k) => localStorage.removeItem(k));
    } catch {
      /* localStorage indisponível — ignorar */
    }

    setStep1Data(mappedStep1Data);
    setStep2Data(mappedStep2Data);
    setIdentidadeFiles([]);
    setComprovanteFiles([]);
    setBeneficiariaFiles([]);
    setAssinaturaFiles([]);
    setPaymentItems([createEmptyItem()]);
  }, [lead?.id, open, hydrationKey, mappedStep1Data, mappedStep2Data]);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      const { data: tenantId } = await supabase.rpc("get_user_tenant_id");
      const [identidadeUrls, comprovanteUrls, beneficiariaUrls, assinaturaUrls] = await Promise.all([
        uploadDocumentFiles(identidadeFiles, `${tenantId}/identidade`, supabase),
        uploadDocumentFiles(comprovanteFiles, `${tenantId}/comprovante`, supabase),
        uploadDocumentFiles(beneficiariaFiles, `${tenantId}/beneficiaria`, supabase),
        uploadDocumentFiles(assinaturaFiles, `${tenantId}/assinatura`, supabase),
      ]);

      const payload = { 
        ...step1Data, 
        ...step2Data, 
        identidade_urls: identidadeUrls, 
        comprovante_endereco_urls: comprovanteUrls, 
        comprovante_beneficiaria_urls: beneficiariaUrls, 
        assinatura_url: assinaturaUrls[0] || null,
        media_consumo: step2Data.media_consumo ?? mappedHydration.media_consumo,
        consumo_previsto: step2Data.consumo_previsto ?? mappedHydration.consumo_previsto
      };


      const { data: res, error } = await supabase.rpc("convert_lead_to_venda_v2", { 
        _lead_id: lead?.id, 
        _payload: payload as any, 
        _payment_composition: paymentItems as any, 
        _idempotency_key: lead?.id,
        _orcamento_id: mappedHydration._orcamento_id || orcamentoId 
      });
      
      if (error || !(res as any)?.success) throw new Error((res as any)?.message || "Erro na conversão");

      localStorage.removeItem(`lead_conversion_${lead?.id}`);
      toast({ title: "Venda convertida!", description: "O lead foi processado com sucesso." });
      onOpenChange(false);
      onSuccess?.();
    } catch (err: any) {
      toast({ title: "Erro na conversão", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const STEPS = [
    { label: "Pessoal", icon: User, comp: <StepDadosPessoais initialData={step1Data} hydrationKey={hydrationKey} onChange={(d, v) => { setStep1Data(d); setIsStep1Valid(v); }} /> },
    { label: "Técnico", icon: FileText, comp: <StepTecnico leadId={lead?.id} initialData={step2Data} hydrationKey={hydrationKey} identidadeFiles={identidadeFiles} comprovanteFiles={comprovanteFiles} beneficiariaFiles={beneficiariaFiles} assinaturaFiles={assinaturaFiles} onFilesChange={(type, files) => { if (type === "identidade") setIdentidadeFiles(files); if (type === "comprovante") setComprovanteFiles(files); if (type === "beneficiaria") setBeneficiariaFiles(files); if (type === "assinatura") setAssinaturaFiles(files); }} onChange={(d, v) => { setStep2Data(d); setIsStep2Valid(v); }} /> },
    { label: "Financeiro", icon: Wallet, comp: <StepFinanceiro valorVenda={valorVenda} paymentItems={paymentItems} onCompositionChange={setPaymentItems} /> }
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] p-0 flex flex-col h-[90vh]">
        <div className="flex items-center gap-3 p-5 border-b shrink-0">
          <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center"><ShoppingCart className="w-5 h-5 text-teal-600" /></div>
          <div><h2 className="text-base font-semibold">Converter {selectedOrcamento?.orc_code || orcamentoId || "Orçamento"} em Venda</h2><p className="text-xs text-muted-foreground">Lead: {selectedOrcamento?.nome || lead?.nome}</p></div>
        </div>
        <div className="flex gap-2 p-3 bg-muted/20 border-b">
          {STEPS.map((s, i) => (
            <Button key={i} variant="ghost" onClick={() => i <= currentStep && setCurrentStep(i)} className={`flex-1 gap-2 ${i === currentStep ? "bg-teal-500/10 text-teal-600" : ""}`}>
              <s.icon className="w-4 h-4" /> <span className="hidden sm:inline">{s.label}</span>
            </Button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5">{STEPS[currentStep].comp}</div>
        <div className="p-4 border-t flex justify-between bg-muted/10">
          <Button variant="outline" onClick={() => setCurrentStep(s => Math.max(0, s - 1))} disabled={currentStep === 0}>Anterior</Button>
          {currentStep < 2 ? (
            <Button onClick={() => setCurrentStep(s => s + 1)} disabled={currentStep === 0 ? !isStep1Valid : !isStep2Valid}>Próximo</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading || !finance.isValid}>{loading ? <RefreshCw className="animate-spin mr-2" /> : "Converter orçamento"}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
