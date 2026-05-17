/**
 * Reutiliza:
 * - Tabelas: analise_credito, project_documents, credit_bank_configs, credit_bank_checklists, credit_analysis_events
 * - Hooks: useCreateAnaliseCredito, useUpdateAnaliseCredito, useAnaliseCreditoDocumentos, useVincularDocumentoCredito, useProjectDocuments, useCreditBankConfigs, useCreditBankChecklist
 * - Libs: formatBRL, formatDateTime, cn, isValidCpf, isValidCnpj
 */
import { useState, useMemo } from "react";
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
  UserPlus
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
import { formatBRL } from "@/lib/formatters";
import { formatDateTime } from "@/lib/dateUtils";
import { isValidCpf, isValidCnpj, formatCpfCnpj } from "@/lib/cpfCnpjUtils";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { toast } from "@/hooks/use-toast";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  dealId?: string | null;
  leadId?: string | null;
  clienteId?: string | null;
  initialData?: AnaliseCredito;
  clienteCpfCnpj?: string | null;
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
  valorReferencia 
}: Props) {
  const [step, setStep] = useState<Step>(1);
  const [formData, setFormData] = useState({
    tipo_pessoa: initialData?.tipo_pessoa || (clienteCpfCnpj?.length && clienteCpfCnpj.length > 14 ? 'PJ' : 'PF'),
    cpf_cnpj: initialData?.cpf_cnpj || clienteCpfCnpj || "",
    renda_mensal: initialData?.renda_mensal?.toString() || "",
    bank_config_id: initialData?.bank_config_id || "",
    banco: initialData?.banco || "",
    valor_solicitado: initialData?.valor_solicitado?.toString() || valorReferencia?.toString() || "",
    entrada: initialData?.entrada?.toString() || "0",
    prazo_meses: initialData?.prazo_meses?.toString() || "60",
    observacoes: initialData?.observacoes || "",
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
    cliente_nome: initialData?.cliente_nome || "",
    cliente_email: initialData?.cliente_email || "",
    cliente_telefone: initialData?.cliente_telefone || "",
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

  const { data: banks } = useCreditBankConfigs();
  const { data: checklist } = useCreditBankChecklist(formData.bank_config_id || undefined);
  const { data: creditDocs } = useAnaliseCreditoDocumentos(initialData?.id || "");
  const { data: projectDocs } = useProjectDocuments({ dealId });

  const createMutation = useCreateAnaliseCredito();
  const updateMutation = useUpdateAnaliseCredito();
  const vincularDocMutation = useVincularDocumentoCredito();

  const [isLinkingDoc, setIsLinkingDoc] = useState<{checklistId: string, itemName: string} | null>(null);

  const handleNext = () => setStep((s) => (s + 1) as Step);
  const handleBack = () => setStep((s) => (s - 1) as Step);

  const handleSave = async (asDraft = true) => {
    const status: AnaliseCreditoStatus = asDraft ? 'rascunho' : 'pendente_documentos';
    const data: any = {
      ...formData,
      renda_mensal: parseFloat(formData.renda_mensal) || 0,
      valor_solicitado: parseFloat(formData.valor_solicitado) || 0,
      entrada: parseFloat(formData.entrada) || 0,
      prazo_meses: parseInt(formData.prazo_meses) || 0,
      carencia: parseInt(formData.carencia) || 1,
      patrimonio: parseFloat(formData.patrimonio) || 0,
      avalista_renda_mensal: parseFloat(formData.avalista_renda_mensal) || 0,
      avalista_patrimonio: parseFloat(formData.avalista_patrimonio) || 0,
      deal_id: dealId,
      lead_id: leadId,
      cliente_id: clienteId,
      status
    };

    try {
      // RB-62, RB-63: Validação de CPF/CNPJ antes de salvar
      if (formData.cpf_cnpj) {
        const digits = formData.cpf_cnpj.replace(/\D/g, "");
        const isValid = formData.tipo_pessoa === 'pf' ? isValidCpf(digits) : isValidCnpj(digits);
        if (!isValid) {
          toast({
            title: "Documento inválido",
            description: `O ${formData.tipo_pessoa.toUpperCase()} informado não é válido.`,
            variant: "destructive"
          });
          return;
        }
      }

      if (initialData?.id) {
        await updateMutation.mutateAsync({ id: initialData.id, ...data });
      } else {
        await createMutation.mutateAsync(data);
      }
      onClose();
    } catch (e) {
      // toast handled in hook
    }
  };

  const filteredChecklist = useMemo(() => {
    if (!checklist) return [];
    return checklist.filter(item => 
      item.applicable_to === 'both' || item.applicable_to === formData.tipo_pessoa
    );
  }, [checklist, formData.tipo_pessoa]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-card border-border/40 shadow-2xl h-[95vh] sm:h-[80vh] flex flex-col">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <CreditCard className="h-5 w-5 text-primary" />
            {initialData ? "Editar Análise" : "Nova Solicitação de Crédito"}
          </DialogTitle>
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3, 4].map((s) => (
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
                {s < 4 && <div className={cn("h-1 flex-1 mx-2 rounded-full", step > s ? "bg-success" : "bg-muted")} />}
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
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Tipo de Proponente</Label>
                    <Select 
                      value={formData.tipo_pessoa} 
                      onValueChange={v => setFormData({...formData, tipo_pessoa: v as any})}
                    >
                      <SelectTrigger className="bg-muted/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pf">Pessoa Física (PF)</SelectItem>
                        <SelectItem value="pj">Pessoa Jurídica (PJ)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{formData.tipo_pessoa === 'pf' ? 'CPF' : 'CNPJ'}</Label>
                    <Input 
                      placeholder="000.000.000-00" 
                      value={formData.cpf_cnpj} 
                      onChange={e => setFormData({...formData, cpf_cnpj: formatCpfCnpj(e.target.value)})}
                      className="bg-muted/30"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">{formData.tipo_pessoa === 'pf' ? 'Renda Mensal' : 'Faturamento Mensal'}</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                      <Input 
                        type="number"
                        placeholder="0,00" 
                        value={formData.renda_mensal} 
                        onChange={e => setFormData({...formData, renda_mensal: e.target.value})}
                        className="pl-9 bg-muted/30"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Patrimônio Aproximado</Label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">R$</span>
                      <Input 
                        type="number"
                        placeholder="0,00" 
                        value={formData.patrimonio} 
                        onChange={e => setFormData({...formData, patrimonio: e.target.value})}
                        className="pl-9 bg-muted/30"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Carência (Meses)</Label>
                  <Select 
                    value={formData.carencia} 
                    onValueChange={v => setFormData({...formData, carencia: v})}
                  >
                    <SelectTrigger className="bg-muted/30">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {[0, 1, 2, 3, 4, 5, 6].map(m => (
                        <SelectItem key={m} value={m.toString()}>{m === 0 ? "Sem carência" : `${m} meses`}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {formData.tipo_pessoa === 'pj' && (
                  <div className="space-y-4 border-t pt-4">
                    <h5 className="text-sm font-bold flex items-center gap-2">
                      <UserPlus className="h-4 w-4 text-primary" />
                      Dados do Avalista (Sócio/Interveniente)
                    </h5>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">Nome Completo</Label>
                        <Input 
                          value={formData.avalista_nome} 
                          onChange={e => setFormData({...formData, avalista_nome: e.target.value})}
                          className="bg-muted/30 h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">CPF</Label>
                        <Input 
                          value={formData.avalista_cpf} 
                          onChange={e => setFormData({...formData, avalista_cpf: formatCpfCnpj(e.target.value)})}
                          className="bg-muted/30 h-8 text-xs"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs">E-mail</Label>
                        <Input 
                          type="email"
                          value={formData.avalista_email} 
                          onChange={e => setFormData({...formData, avalista_email: e.target.value})}
                          className="bg-muted/30 h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-xs">Telefone</Label>
                        <Input 
                          value={formData.avalista_telefone} 
                          onChange={e => setFormData({...formData, avalista_telefone: e.target.value})}
                          className="bg-muted/30 h-8 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {step === 2 && (
              <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Instituição Financeira</Label>
                  <Select 
                    value={formData.bank_config_id} 
                    onValueChange={v => {
                      const bank = banks?.find(b => b.id === v);
                      setFormData({...formData, bank_config_id: v, banco: bank?.bank_name || ""});
                    }}
                  >
                    <SelectTrigger className="bg-muted/30">
                      <SelectValue placeholder="Selecione o Banco" />
                    </SelectTrigger>
                    <SelectContent>
                      {banks?.map(bank => (
                        <SelectItem key={bank.id} value={bank.id}>{bank.bank_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Valor Solicitado</Label>
                    <Input 
                      type="number"
                      value={formData.valor_solicitado} 
                      onChange={e => setFormData({...formData, valor_solicitado: e.target.value})}
                      className="bg-muted/30"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold">Prazo (meses)</Label>
                    <Select 
                      value={formData.prazo_meses} 
                      onValueChange={v => setFormData({...formData, prazo_meses: v})}
                    >
                      <SelectTrigger className="bg-muted/30">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[12, 24, 36, 48, 60, 72, 84, 96, 120].map(m => (
                          <SelectItem key={m} value={m.toString()}>{m} meses</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-semibold text-muted-foreground">Valor de Referência (Proposta)</Label>
                  <p className="text-lg font-bold text-foreground">{formatBRL(valorReferencia || 0)}</p>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                <div className="bg-primary/5 p-4 rounded-lg border border-primary/10 flex items-start gap-3">
                  <ShieldCheck className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <h5 className="text-sm font-bold text-primary">Checklist Documental: {formData.banco}</h5>
                    <p className="text-xs text-muted-foreground">Vincule os documentos do projeto para análise.</p>
                  </div>
                </div>

                <div className="space-y-3">
                  {filteredChecklist.length === 0 ? (
                    <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                      <FileText className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
                      <p className="text-sm text-muted-foreground">Nenhum requisito documental configurado para este banco.</p>
                    </div>
                  ) : (
                    filteredChecklist.map((item) => {
                      const linkedDoc = creditDocs?.find((cd: any) => cd.checklist_item_id === item.id);
                      return (
                        <div key={item.id} className="p-3 bg-muted/20 border border-border/50 rounded-lg flex items-center justify-between group">
                          <div className="flex items-center gap-3">
                            {linkedDoc ? (
                              <CheckCircle2 className="h-5 w-5 text-success" />
                            ) : (
                              <Circle className="h-5 w-5 text-muted-foreground/30" />
                            )}
                            <div>
                              <p className="text-sm font-bold flex items-center gap-1.5">
                                {item.document_type_name}
                                {item.is_required && <Badge variant="destructive" className="text-[9px] h-3 px-1">Obrigatório</Badge>}
                              </p>
                              <p className="text-[11px] text-muted-foreground">{item.description || "Sem descrição"}</p>
                              {linkedDoc && (
                                <p className="text-[10px] text-success font-medium flex items-center gap-1 mt-0.5">
                                  <Paperclip className="h-3 w-3" /> {linkedDoc.document?.display_name || linkedDoc.document?.file_name}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <Button 
                            variant="outline" 
                            size="sm" 
                            className={cn("h-8 gap-1.5", linkedDoc ? "opacity-40 hover:opacity-100" : "opacity-0 group-hover:opacity-100")}
                            onClick={() => setIsLinkingDoc({ checklistId: item.id, itemName: item.document_type_name })}
                            disabled={!initialData?.id}
                          >
                            <Paperclip className="h-3.5 w-3.5" /> {linkedDoc ? "Trocar" : "Vincular"}
                          </Button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}

            {step === 4 && (
              <div className="space-y-6 animate-in slide-in-from-right-2 duration-300">
                <div className="bg-success/5 p-4 rounded-lg border border-success/10">
                  <h5 className="text-sm font-bold text-success flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-4 w-4" /> Resumo da Solicitação
                  </h5>
                  <div className="grid grid-cols-2 gap-y-3 text-sm">
                    <div className="text-muted-foreground">Banco:</div>
                    <div className="font-semibold text-right">{formData.banco}</div>
                    <div className="text-muted-foreground">Proponente:</div>
                    <div className="font-semibold text-right uppercase">{formData.tipo_pessoa} ({formData.cpf_cnpj})</div>
                    <div className="text-muted-foreground">Valor Solicitado:</div>
                    <div className="font-bold text-right text-primary">{formatBRL(parseFloat(formData.valor_solicitado) || 0)}</div>
                    <div className="text-muted-foreground">Prazo:</div>
                    <div className="font-semibold text-right">{formData.prazo_meses} meses</div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label className="text-sm font-semibold">Observações Internas</Label>
                  <Input 
                    placeholder="Informações relevantes para a mesa de crédito..." 
                    value={formData.observacoes} 
                    onChange={e => setFormData({...formData, observacoes: e.target.value})}
                    className="bg-muted/30"
                  />
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
                Salvar
              </Button>
              {step < 4 ? (
                <Button onClick={handleNext} className="gap-1.5 flex-1 sm:flex-none">
                  Próximo <ChevronRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button 
                  onClick={() => handleSave(false)} 
                  className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/20 gap-1.5 flex-1 sm:flex-none"
                  disabled={createMutation.isPending || updateMutation.isPending || (filteredChecklist.some(item => item.is_required && !creditDocs?.some((cd: any) => cd.checklist_item_id === item.id)))}
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
