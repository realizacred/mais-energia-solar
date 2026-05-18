import { useState, useEffect, useMemo, useCallback } from "react";
import { ShoppingCart, User, FileText, Wallet, Check, AlertTriangle, Wifi, WifiOff, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";
import { useOfflineConversionSync } from "@/hooks/useOfflineConversionSync";
import { uploadDocumentFiles, type DocumentFile } from "./DocumentUpload";
import type { Lead } from "@/types/lead";
import { isValidCpfCnpj } from "@/lib/cpfCnpjUtils";
import { createEmptyItem, type PaymentItemInput } from "@/services/paymentComposition/types";
import { StepDadosPessoais, type Step1Data } from "./conversion/StepDadosPessoais";
import { StepTecnico, type Step2Data } from "./conversion/StepTecnico";
import { StepFinanceiro } from "./conversion/StepFinanceiro";
import { useVendaFinanceSnapshot } from "@/hooks/useVendaFinanceSnapshot";

interface ConvertLeadToClientDialogProps {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
  orcamentoId?: string | null;
}

export function ConvertLeadToClientDialog({ lead, open, onOpenChange, onSuccess, orcamentoId }: ConvertLeadToClientDialogProps) {
  const { toast } = useToast();
  const isMobile = useIsMobile();
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

  const { isOnline, pendingCount: offlinePendingCount, isSyncing: isOfflineSyncing, syncAllConversions } = useOfflineConversionSync();

  // Load latest proposal value
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

  const valorVenda = useMemo(() => {
    if (step2Data.simulacao_aceita_id) {
      // Logic for simulation value could be here or simplified
    }
    return propostaVersaoValor || (lead as any)?.valor_projeto || 0;
  }, [propostaVersaoValor, lead, step2Data.simulacao_aceita_id]);

  const finance = useVendaFinanceSnapshot(valorVenda, paymentItems);

  // 1. Initial Load Effect
  useEffect(() => {
    if (lead && open) {
      const storageKey = `lead_conversion_${lead.id}`;
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const data = JSON.parse(saved);
        setStep1Data(data.step1Data || { nome: lead.nome, telefone: lead.telefone, email: lead.email, cep: lead.cep });
        setStep2Data(data.step2Data || {});
        setIdentidadeFiles(data.identidadeFiles || []);
        setComprovanteFiles(data.comprovanteFiles || []);
        setPaymentItems(data.paymentItems || [createEmptyItem()]);
      } else {
        setStep1Data({ nome: lead.nome, telefone: lead.telefone, email: lead.email, cep: lead.cep });
      }
    } else if (!open) {
      setCurrentStep(0);
    }
  }, [lead, open]);

  const handleSubmit = async () => {
    if (!lead || !isStep1Valid || !isStep2Valid || !finance.isValid) {
      toast({ title: "Verifique os dados", description: "Preencha todos os campos obrigatórios e valide o financeiro.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const { data: tenantId } = await supabase.rpc("get_user_tenant_id");
      const [identidadeUrls, comprovanteUrls, beneficiariaUrls, assinaturaUrls] = await Promise.all([
        uploadDocumentFiles(identidadeFiles, `${tenantId}/identidade`, supabase),
        uploadDocumentFiles(comprovanteFiles, `${tenantId}/comprovante`, supabase),
        uploadDocumentFiles(beneficiariaFiles, `${tenantId}/beneficiaria`, supabase),
        uploadDocumentFiles(assinaturaFiles, `${tenantId}/assinatura`, supabase),
      ]);

      const payload = { ...step1Data, ...step2Data, identidade_urls: identidadeUrls, comprovante_endereco_urls: comprovanteUrls, comprovante_beneficiaria_urls: beneficiariaUrls, assinatura_url: assinaturaUrls[0] || null };
      const { data: res, error } = await supabase.rpc("convert_lead_to_venda_v2", { _lead_id: lead.id, _payload: payload as any, _payment_composition: paymentItems as any, _idempotency_key: lead.id });
      
      if (error || !(res as any)?.success) throw new Error((res as any)?.message || "Erro na conversão");

      localStorage.removeItem(`lead_conversion_${lead.id}`);
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
    { label: "Pessoal", icon: User, comp: <StepDadosPessoais initialData={step1Data} onChange={(d, v) => { setStep1Data(d); setIsStep1Valid(v); }} /> },
    { label: "Técnico", icon: FileText, comp: <StepTecnico initialData={step2Data} identidadeFiles={identidadeFiles} comprovanteFiles={comprovanteFiles} beneficiariaFiles={beneficiariaFiles} assinaturaFiles={assinaturaFiles} onFilesChange={(type, files) => { if (type === "identidade") setIdentidadeFiles(files); if (type === "comprovante") setComprovanteFiles(files); if (type === "beneficiaria") setBeneficiariaFiles(files); if (type === "assinatura") setAssinaturaFiles(files); }} onChange={(d, v) => { setStep2Data(d); setIsStep2Valid(v); }} /> },
    { label: "Financeiro", icon: Wallet, comp: <StepFinanceiro valorVenda={valorVenda} paymentItems={paymentItems} onCompositionChange={setPaymentItems} /> }
  ];

  const canAdvance = currentStep === 0 ? isStep1Valid : currentStep === 1 ? isStep2Valid : true;

  const Title = () => (
    <div className="flex items-center gap-3 p-5 border-b shrink-0">
      <div className="w-9 h-9 rounded-lg bg-teal-500/10 flex items-center justify-center"><ShoppingCart className="w-5 h-5 text-teal-600" /></div>
      <div>
        <h2 className="text-base font-semibold">Converter Lead em Venda</h2>
        <p className="text-xs text-muted-foreground">{lead?.nome} {lead?.lead_code ? `· ${lead.lead_code}` : ""}</p>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[700px] p-0 flex flex-col h-[90vh]">
        <Title />
        <div className="flex gap-2 p-3 bg-muted/20 border-b">
          {STEPS.map((s, i) => (
            <Button key={i} variant="ghost" onClick={() => i <= currentStep && setCurrentStep(i)} className={`flex-1 gap-2 ${i === currentStep ? "bg-teal-500/10 text-teal-600" : ""}`}>
              <s.icon className="w-4 h-4" /> <span className="hidden sm:inline">{s.label}</span>
            </Button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {STEPS[currentStep].comp}
        </div>
        <div className="p-4 border-t flex justify-between bg-muted/10">
          <Button variant="outline" onClick={() => setCurrentStep(s => Math.max(0, s - 1))} disabled={currentStep === 0}>Anterior</Button>
          {currentStep < 2 ? (
            <Button onClick={() => setCurrentStep(s => s + 1)} disabled={!canAdvance}>Próximo</Button>
          ) : (
            <Button onClick={handleSubmit} disabled={loading || !finance.isValid}>{loading ? <RefreshCw className="animate-spin mr-2" /> : "Finalizar"}</Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
