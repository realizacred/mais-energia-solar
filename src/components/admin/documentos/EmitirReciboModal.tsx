import { useEffect, useMemo, useState, useRef } from "react";
import { Loader2, Send, FileText, Calculator, Landmark, ShieldCheck, History, Trash2, Download, RefreshCw, AlertCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDocumentTemplates } from "./useDocumentTemplates";
import { useClientes } from "@/hooks/useClientes";
import { useEmitirRecibo, useRecibos, type Recibo, useReciboPDF, useDeleteRecibo, getReciboSignedUrl } from "@/hooks/useRecibos";
import type { DocumentTemplate, FormFieldSchema } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatBRL, formatDateTime, formatNameCapitalize } from "@/lib/formatters/index";
import { formatCpfCnpj } from "@/lib/formatters/index";
import { toast } from "sonner";

interface EmitirReciboModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClienteId?: string;
  defaultProjetoId?: string;
  defaultDealId?: string;
  onEmitted?: (reciboId: string) => void;
  showHistory?: boolean;
}

function ReciboHistoryList({ projetoId }: { projetoId: string }) {
  const { data: recibos, isLoading } = useRecibos({ projeto_id: projetoId });
  const regen = useReciboPDF();
  const del = useDeleteRecibo();
  const requestIdRef = useRef(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);

  async function handleOpenPdf(r: Recibo) {
    const currentId = ++requestIdRef.current;
    const toastId = toast.loading("Preparando PDF...");
    
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (currentId === requestIdRef.current) {
        toast.dismiss(toastId);
        toast.error("Tempo esgotado ao abrir PDF. Tente regerar o arquivo.");
      }
    }, 8000);

    try {
      let path = r.pdf_url;
      if (!path) {
        const res = await regen.mutateAsync(r.id);
        path = res.pdf_url;
      }
      
      if (currentId !== requestIdRef.current) {
        toast.dismiss(toastId);
        return;
      }

      const url = await getReciboSignedUrl(path!);
      
      if (currentId !== requestIdRef.current) {
        toast.dismiss(toastId);
        return;
      }

      window.open(url, "_blank", "noopener,noreferrer");
      toast.dismiss(toastId);
    } catch (e: any) {
      if (currentId === requestIdRef.current) {
        toast.dismiss(toastId);
        toast.error(e?.message || "Não foi possível abrir o PDF");
      }
    } finally {
      if (currentId === requestIdRef.current && timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    }
  }

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  if (isLoading) return <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" /> Carregando histórico...</div>;
  if (!recibos?.length) return <p className="text-xs text-muted-foreground italic">Nenhum recibo emitido para este projeto.</p>;

  return (
    <div className="space-y-2">
      {recibos.map((r) => (
        <div key={r.id} className="flex items-center justify-between p-2 rounded border bg-background/50 text-xs">
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <span className="font-bold">{formatBRL(Number(r.valor))}</span>
              <Badge variant="outline" className={cn("text-[9px] uppercase", r.status === 'emitido' ? "text-success border-success/20 bg-success/5" : "text-destructive border-destructive/20 bg-destructive/5")}>
                {formatNameCapitalize(r.status)}
              </Badge>
              {r.numero && <span className="text-muted-foreground">Nº {r.numero}</span>}
            </div>
            <span className="text-muted-foreground">{formatDateTime(r.created_at)} • {formatNameCapitalize(r.forma_pagamento)}</span>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleOpenPdf(r)} title="Ver PDF">
              <Download className="h-3.5 w-3.5" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => regen.mutate(r.id)} disabled={regen.isPending} title="Regerar">
              <RefreshCw className={cn("h-3.5 w-3.5", regen.isPending && "animate-spin")} />
            </Button>
            {r.status !== 'cancelado' && (
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => { if(confirm("Cancelar recibo?")) del.mutate(r.id); }} title="Cancelar">
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * Modal de emissão de recibo.
 */
export function EmitirReciboModal({
  open,
  onOpenChange,
  defaultClienteId,
  defaultProjetoId,
  defaultDealId,
  onEmitted,
}: EmitirReciboModalProps) {
  const { data: templates, isLoading: loadingTpls } = useDocumentTemplates("recibo");
  const { data: clientes, isLoading: loadingClientes } = useClientes();
  const emitir = useEmitirRecibo();
  const requestIdRefMain = useRef(0);
  const timeoutRefMain = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRefMain.current) clearTimeout(timeoutRefMain.current);
    };
  }, []);

  const [templateId, setTemplateId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>(defaultClienteId ?? "");
  const [projetoId, setProjetoId] = useState<string | null>(defaultProjetoId ?? null);
  const [valor, setValor] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [numero, setNumero] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>(new Date().toISOString().slice(0, 10));
  const [instituicaoFinanceira, setInstituicaoFinanceira] = useState<string>("");
  
  // Detalhes da Forma de Pagamento
  const [pixChave, setPixChave] = useState<string>("");
  const [pixComprovante, setPixComprovante] = useState<string>("");
  const [rastreio, setRastreio] = useState<string>("");
  
  const [chequeBanco, setChequeBanco] = useState<string>("");
  const [chequeAgencia, setChequeAgencia] = useState<string>("");
  const [chequeConta, setChequeConta] = useState<string>("");
  const [chequeNumero, setChequeNumero] = useState<string>("");
  const [chequeTitular, setChequeTitular] = useState<string>("");
  const [chequeTitularCpf, setChequeTitularCpf] = useState<string>("");
  const [isChequeTerceiro, setIsChequeTerceiro] = useState(false);
  const [isChequePreDatado, setIsChequePreDatado] = useState(false);
  const [chequeData, setChequeData] = useState<string>("");
  const [chequeDataDeposito, setChequeDataDeposito] = useState<string>("");

  const [cartaoBandeira, setCartaoBandeira] = useState<string>("");
  const [cartaoParcelas, setCartaoParcelas] = useState<string>("1");
  const [cartaoUltimosDigitos, setCartaoUltimosDigitos] = useState<string>("");
  const [cartaoNsu, setCartaoNsu] = useState<string>("");

  const [boletoNumero, setBoletoNumero] = useState<string>("");
  const [boletoVencimento, setBoletoVencimento] = useState<string>("");
  const [boletoBanco, setBoletoBanco] = useState<string>("");
  const [boletoLinhaDigitavel, setBoletoLinhaDigitavel] = useState<string>("");

  const [dynFields, setDynFields] = useState<Record<string, string>>({});
  const [loadingContext, setLoadingContext] = useState(false);
  const [projectContext, setProjectContext] = useState<any>(null);
  const [proposalContext, setProposalContext] = useState<any>(null);
  const [totalPagoHistorico, setTotalPagoHistorico] = useState(0);
  const [ultimoNumeroRecibo, setUltimoNumeroRecibo] = useState(0);

  useEffect(() => {
    if (open) {
      setTemplateId("");
      setClienteId(defaultClienteId ?? "");
      setProjetoId(defaultProjetoId ?? null);
      setValor("");
      setDescricao("");
      setNumero("");
      setFormaPagamento("");
      setDataPagamento(new Date().toISOString().slice(0, 10));
      setDynFields({});
      setProjectContext(null);
      setProposalContext(null);
      setTotalPagoHistorico(0);
      setUltimoNumeroRecibo(0);
      setInstituicaoFinanceira("");
      
      // Reset campos específicos
      setPixChave(""); setPixComprovante(""); setRastreio("");
      setChequeBanco(""); setChequeAgencia(""); setChequeConta(""); setChequeNumero("");
      setChequeTitular(""); setChequeTitularCpf(""); setIsChequeTerceiro(false);
      setIsChequePreDatado(false); setChequeData(""); setChequeDataDeposito("");
      setCartaoBandeira(""); setCartaoParcelas("1"); setCartaoUltimosDigitos(""); setCartaoNsu("");
      setBoletoNumero(""); setBoletoVencimento(""); setBoletoBanco(""); setBoletoLinhaDigitavel("");

      if (defaultProjetoId) {
        setLoadingContext(true);
        (async () => {
          try {
            const [projRes, recibosRes] = await Promise.all([
              supabase
                .from("projetos")
                .select("*, clientes(*)")
                .eq("id", defaultProjetoId)
                .maybeSingle(),
              supabase
                .from("recibos")
                .select("valor, numero")
                .eq("projeto_id", defaultProjetoId)
                .eq("status", "emitido")
            ]);

            if (projRes.data) {
              const projeto = projRes.data;
              setProjectContext(projeto);
              if (!defaultClienteId && projeto.cliente_id) {
                setClienteId(projeto.cliente_id);
              }

              // Calcular total pago e pegar último número
              const pago = (recibosRes.data || []).reduce((acc, r) => acc + Number(r.valor), 0);
              setTotalPagoHistorico(pago);
              
              const numeros = (recibosRes.data || [])
                .map(r => parseInt(r.numero || "0"))
                .filter(n => !isNaN(n));
              setUltimoNumeroRecibo(numeros.length > 0 ? Math.max(...numeros) : 0);

              // Buscar proposta aceita
              const dealId = defaultDealId ?? (projeto as any).deal_id;
              if (dealId) {
                const [propRes, creditRes] = await Promise.all([
                  supabase
                    .from("propostas_nativas")
                    .select("id, deal_id, status, created_at")
                    .eq("deal_id", dealId)
                    .eq("status", "aceita")
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle(),
                  supabase
                    .from("analise_credito")
                    .select("banco")
                    .eq("deal_id", dealId)
                    .order("created_at", { ascending: false })
                    .limit(1)
                    .maybeSingle()
                ]);

                if (creditRes.data?.banco) {
                  setInstituicaoFinanceira(creditRes.data.banco);
                }

                if (propRes.data) {
                  const prop = propRes.data;
                  const { data: versao } = await supabase
                    .from("proposta_versoes")
                    .select("id, valor_total, potencia_kwp")
                    .eq("proposta_id", prop.id)
                    .order("versao_numero", { ascending: false })
                    .limit(1)
                    .maybeSingle();
                  
                  const { data: opcao } = versao
                    ? await supabase
                        .from("proposta_pagamento_opcoes")
                        .select("num_parcelas, valor_parcela, valor_financiado, entrada")
                        .eq("versao_id", versao.id)
                        .order("ordem", { ascending: true })
                        .limit(1)
                        .maybeSingle()
                    : { data: null as any };
                    
                  setProposalContext({ proposta: prop, versao, opcao });
                }
              }
            }
          } catch (err) {
            console.error("[EmitirReciboModal] Error loading context:", err);
          } finally {
            setLoadingContext(false);
          }
        })();
      }
    }
  }, [open, defaultClienteId, defaultProjetoId, defaultDealId]);

  const template = useMemo<DocumentTemplate | undefined>(
    () => (templates ?? []).find((t) => t.id === templateId),
    [templates, templateId],
  );

  // BUG 3 — Auto-sugerir template ao abrir, baseado no estado do projeto
  useEffect(() => {
    if (!open || templateId || !templates || templates.length === 0) return;
    // Aguarda contexto carregar para decidir
    if (loadingContext) return;

    const valorVenda = Number(proposalContext?.versao?.valor_total ?? projectContext?.valor_total ?? 0);
    const pago = totalPagoHistorico;
    const saldo = Math.max(0, valorVenda - pago);

    const pick = (...tokens: string[]) =>
      templates.find((t) => {
        const n = (t.nome || "").toLowerCase();
        return tokens.some((tok) => n.includes(tok));
      });

    let sugerido: DocumentTemplate | undefined;
    if (valorVenda > 0 && saldo <= 0.01) {
      sugerido = pick("quitação", "quitacao");
    } else if (pago > 0) {
      sugerido = pick("parcela");
    } else if (proposalContext?.proposta) {
      sugerido = pick("sinal", "entrada");
    }
    if (sugerido) setTemplateId(sugerido.id);
  }, [open, templates, loadingContext, projectContext, proposalContext, totalPagoHistorico, templateId]);

  const valorTotalVenda = useMemo(() => {
    return Number(proposalContext?.versao?.valor_total ?? projectContext?.valor_total ?? 0);
  }, [proposalContext, projectContext]);

  const saldoDevedorAtual = useMemo(() => {
    return Math.max(0, valorTotalVenda - totalPagoHistorico);
  }, [valorTotalVenda, totalPagoHistorico]);

  const saldoRestanteAposRecibo = useMemo(() => {
    const vRecibo = Number(valor || 0);
    return valorTotalVenda - totalPagoHistorico - vRecibo;
  }, [valorTotalVenda, totalPagoHistorico, valor]);

  // Aplicar sugestões baseadas no template
  useEffect(() => {
    if (!template) return;
    
    const nome = template.nome.toLowerCase();
    if (nome.includes("sinal")) {
      const sugerido = valorTotalVenda * 0.3;
      setValor(sugerido.toFixed(2));
      setDescricao("Sinal referente ao contrato de instalação solar");
      setNumero(""); // Sinal geralmente é o primeiro
    } else if (nome.includes("quitação") || nome.includes("quitacao")) {
      setValor(saldoDevedorAtual.toFixed(2));
      setDescricao("Quitação do contrato de instalação solar");
    } else if (nome.includes("parcela")) {
      setDescricao(`Parcela do contrato de instalação solar`);
      setNumero((ultimoNumeroRecibo + 1).toString());
    }
  }, [template, valorTotalVenda, saldoDevedorAtual, ultimoNumeroRecibo]);

  // Auto-fill dynamic fields. Roda assim que houver projectContext/proposalContext,
  // e re-aplica quando um template é selecionado depois.
  useEffect(() => {
    if (!projectContext && !proposalContext) return;

    const schema = (template?.form_schema ?? []) as FormFieldSchema[];
    if (schema.length === 0) return;

    const updates: Record<string, string> = {};
    const cliente = projectContext?.clientes;
    const versao = proposalContext?.versao;
    const opcao = proposalContext?.opcao;

    const has = (key: string, ...tokens: string[]) =>
      tokens.some((t) => key.includes(t));

    schema.forEach((field) => {
      const key = field.key.toLowerCase();

      if (cliente) {
        if (has(key, "nome_cliente", "cliente_nome") || key === "nome") {
          updates[field.key] = cliente.nome || "";
        }
        if (has(key, "cpf", "cnpj", "documento")) {
          updates[field.key] = cliente.cpf_cnpj || "";
        }
        if (key === "email" || has(key, "e_mail", "email_cliente")) {
          updates[field.key] = cliente.email || "";
        }
        if (has(key, "telefone", "celular", "whatsapp", "fone")) {
          updates[field.key] = cliente.telefone || "";
        }
        if (key === "cidade" || has(key, "municipio")) {
          updates[field.key] = cliente.cidade || "";
        }
        if (has(key, "empresa", "razao_social")) {
          updates[field.key] = cliente.empresa || cliente.nome || "";
        }
      }

      if (has(key, "valor_total", "valor_venda", "valor_projeto", "valor_proposta")) {
        const v = versao?.valor_total ?? projectContext?.valor_total;
        if (v) updates[field.key] = String(v);
      }

      if (has(key, "potencia", "kwp")) {
        const p = versao?.potencia_kwp ?? projectContext?.potencia_kwp;
        if (p) updates[field.key] = String(p);
      }

      // Parcelas (total)
      if (
        has(key, "total_parcelas", "num_parcelas", "numero_parcelas", "qtd_parcelas", "quantidade_parcelas")
      ) {
        if (opcao?.num_parcelas) updates[field.key] = String(opcao.num_parcelas);
      }

      // Valor da parcela
      if (
        key === "parcela" ||
        has(key, "valor_parcela", "valor_da_parcela", "parcela_valor")
      ) {
        if (opcao?.valor_parcela) updates[field.key] = String(opcao.valor_parcela);
      }
    });

    if (Object.keys(updates).length > 0) {
      setDynFields((prev) => {
        const merged = { ...prev };
        // Não sobrescreve valor já editado pelo usuário
        for (const k of Object.keys(updates)) {
          if (!merged[k]) merged[k] = updates[k];
        }
        return merged;
      });
    }

    // Auto-fill specialized fields for receipts
    if (template?.subcategoria) {
      setDynFields(prev => {
        const merged = { ...prev };
        merged["valor_recibo"] = valor;
        merged["numero_recibo"] = numero || (ultimoNumeroRecibo + 1).toString();
        merged["saldo_devedor"] = saldoRestanteAposRecibo.toFixed(2);
        merged["projeto_valor_total"] = valorTotalVenda.toFixed(2);
        return merged;
      });
    }
  }, [template, projectContext, proposalContext, valor, numero, ultimoNumeroRecibo, saldoRestanteAposRecibo, valorTotalVenda]);



  const schema: FormFieldSchema[] = useMemo(() => {
    const arr = (template?.form_schema ?? []) as FormFieldSchema[];
    return [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [template]);

  const canSubmit =
    !!templateId && !!clienteId && Number(valor) > 0 && Number(valor) <= saldoDevedorAtual + 0.01 && !!formaPagamento && !emitir.isPending;

  async function handleSubmit() {
    if (!canSubmit) return;
    const camposExtras: Record<string, any> = { ...dynFields };
    if (instituicaoFinanceira) camposExtras["instituicao_financeira"] = instituicaoFinanceira;

    // Metadados estruturados por forma de pagamento
    if (formaPagamento === "PIX") {
      camposExtras["pix"] = {
        chave_pix: pixChave,
        codigo_rastreio: rastreio,
        comprovante: pixComprovante
      };
      // Aliases para variáveis de template
      camposExtras["pix_chave"] = pixChave;
      camposExtras["pix_comprovante"] = pixComprovante;
    }

    if (formaPagamento === "Cheque") {
      camposExtras["cheque"] = {
        banco: chequeBanco,
        agencia: chequeAgencia,
        conta: chequeConta,
        numero: chequeNumero,
        titular_nome: chequeTitular,
        titular_cpf: chequeTitularCpf,
        terceiro: isChequeTerceiro,
        data_cheque: chequeData,
        pre_datado: isChequePreDatado,
        data_deposito: chequeDataDeposito,
        valor: valor
      };
      // Aliases para variáveis de template
      camposExtras["cheque_banco"] = chequeBanco;
      camposExtras["cheque_numero"] = chequeNumero;
      camposExtras["cheque_titular"] = chequeTitular;
      camposExtras["cheque_data"] = chequeData;
    }

    if (formaPagamento === "TED/DOC") {
      camposExtras["transferencia"] = {
        banco_origem: instituicaoFinanceira,
        codigo_rastreio: rastreio,
        comprovante: pixComprovante
      };
    }

    if (formaPagamento.startsWith("Cartão")) {
      camposExtras["cartao"] = {
        bandeira: cartaoBandeira,
        parcelas: cartaoParcelas,
        ultimos_digitos: cartaoUltimosDigitos,
        nsu: cartaoNsu,
        valor_parcela: Number(cartaoParcelas) > 0 ? (Number(valor) / Number(cartaoParcelas)).toFixed(2) : valor
      };
      // Aliases para variáveis de template
      camposExtras["cartao_bandeira"] = cartaoBandeira;
      camposExtras["cartao_parcelas"] = cartaoParcelas;
      camposExtras["cartao_valor_parcela"] = Number(cartaoParcelas) > 0 ? (Number(valor) / Number(cartaoParcelas)).toFixed(2) : valor;
      camposExtras["cartao_ultimos_digitos"] = cartaoUltimosDigitos;
    }

    if (formaPagamento === "Boleto") {
      camposExtras["boleto"] = {
        numero: boletoNumero,
        data_vencimento: boletoVencimento,
        banco_emissor: boletoBanco,
        linha_digitavel: boletoLinhaDigitavel
      };
    }

    try {
      // 1. Criar lançamento financeiro primeiro
      const { data: lancamento, error: lancErr } = await supabase
        .from("lancamentos_financeiros")
        .insert({
          tenant_id: projectContext?.tenant_id,
          projeto_id: projetoId,
          cliente_id: clienteId,
          tipo: 'receita',
          valor: Number(valor),
          forma_pagamento: formaPagamento,
          data_lancamento: dataPagamento,
          status: 'confirmado',
          origem: 'recibo_emitido',
          descricao: `Recibo: ${template?.nome || "Geral"}`,
          metadata: camposExtras
        } as any)
        .select("id")
        .single();

      if (lancErr) throw lancErr;

      // 2. Emitir recibo vinculado ao lançamento
      const id = await emitir.mutateAsync({
        template: template?.nome || "Recibo",
        cliente_id: clienteId,
        projeto_id: projetoId!,
        descricao: descricao || undefined,
        numero: numero || undefined,
        valor: Number(valor),
        forma_pagamento: formaPagamento,
        data_pagamento: dataPagamento,
        campos_extras: camposExtras,
        generate_pdf: true,
        lancamento_id: lancamento.id
      });
      
      onEmitted?.(id);

      // Notificar Hub
      supabase.functions.invoke('notification-hub', {
        body: {
          evento: 'recibo_emitido',
          tenant_id: projectContext?.tenant_id,
          dados: {
            projeto_id: projetoId,
            recibo_id: id,
            cliente_id: clienteId,
            valor: Number(valor),
            descricao: descricao || template?.nome
          }
        }
      }).catch(err => console.error("[notification-hub] Erro ao invocar:", err));

      onOpenChange(false);
    } catch (err: any) {
      console.error("[handleSubmit] Error:", err);
      toast.error("Erro ao processar recibo: " + (err.message || "Erro desconhecido"));
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => {
      if (!v) {
        if (timeoutRefMain.current) clearTimeout(timeoutRefMain.current);
        requestIdRefMain.current = 0;
      }
      onOpenChange(v);
    }}>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" /> Emitir recibo
          </DialogTitle>
          <DialogDescription>
            Escolha o template, preencha os dados e gere o PDF com branding automático.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2 relative">
          {loadingContext && (
            <div className="absolute inset-0 bg-background/50 z-10 flex items-center justify-center rounded-lg backdrop-blur-[1px]">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Carregando dados do projeto...</span>
              </div>
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Template</Label>
            <Select value={templateId} onValueChange={setTemplateId} disabled={loadingTpls}>
              <SelectTrigger><SelectValue placeholder={loadingTpls ? "Carregando..." : "Selecione um template"} /></SelectTrigger>
              <SelectContent>
                {(templates ?? []).map((t) => (
                  <SelectItem key={t.id} value={t.id}>{t.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Cliente</Label>
            <div className="p-2.5 rounded-lg border bg-muted/50 flex justify-between items-center">
              <div className="flex flex-col">
                <span className="text-sm font-semibold">{projectContext?.clientes?.nome || "Selecione um projeto"}</span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-tight font-mono">{projectContext?.clientes?.cpf_cnpj ? formatCpfCnpj(projectContext.clientes.cpf_cnpj) : "CPF/CNPJ não disponível"}</span>
              </div>
              <div className="text-right">
                <Badge variant="outline" className="text-[9px] uppercase font-bold bg-background/50">Projeto vinculado</Badge>
              </div>
            </div>
          </div>

          <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 sm:col-span-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium uppercase tracking-wider">Resumo do Financeiro</span>
              {saldoRestanteAposRecibo <= 0 ? (
                <span className="text-success font-bold flex items-center gap-1">Quitado ✓</span>
              ) : saldoRestanteAposRecibo < valorTotalVenda ? (
                <span className="text-amber-500 font-bold">Restam {formatBRL(saldoRestanteAposRecibo)}</span>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase">Valor Venda</span>
                <span className="text-sm font-bold">{formatBRL(valorTotalVenda)}</span>
              </div>
              <div className="flex flex-col border-l pl-2">
                <span className="text-[10px] text-muted-foreground uppercase">Total Pago</span>
                <span className="text-sm font-bold text-success">{formatBRL(totalPagoHistorico)}</span>
              </div>
              <div className="flex flex-col border-l pl-2">
                <span className="text-[10px] text-muted-foreground uppercase">Saldo Devedor</span>
                <span className={cn("text-sm font-bold", saldoDevedorAtual > 0 ? "text-destructive" : "text-success")}>
                  {formatBRL(saldoDevedorAtual)}
                </span>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Valor deste Recibo (R$)</Label>
            <Input
              type="number" step="0.01" min="0"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              placeholder="0,00"
              className={cn(Number(valor) > saldoDevedorAtual + 0.01 && "border-destructive text-destructive")}
            />
            {Number(valor) > saldoDevedorAtual + 0.01 && (
              <p className="text-[10px] text-destructive font-medium italic">Valor maior que o saldo devedor!</p>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Data do Pagamento</Label>
            <Input
              type="date"
              value={dataPagamento}
              onChange={(e) => setDataPagamento(e.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs">Forma de Pagamento</Label>
            <Select value={formaPagamento} onValueChange={setFormaPagamento}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="PIX">PIX</SelectItem>
                <SelectItem value="TED/DOC">Transferência (TED/DOC)</SelectItem>
                <SelectItem value="Boleto">Boleto Bancário</SelectItem>
                <SelectItem value="Cartão de Crédito">Cartão de Crédito</SelectItem>
                <SelectItem value="Cartão de Débito">Cartão de Débito</SelectItem>
                <SelectItem value="Dinheiro">Dinheiro</SelectItem>
                <SelectItem value="Cheque">Cheque</SelectItem>
                <SelectItem value="Financiamento">Financiamento (EOS / Banco)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formaPagamento === "Financiamento" && (
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs font-semibold">Instituição Financeira</Label>
              <Input value={instituicaoFinanceira} onChange={(e) => setInstituicaoFinanceira(e.target.value)} placeholder="Ex: EOS, BV, Santander..." />
            </div>
          )}

          {formaPagamento === "PIX" && (
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Chave PIX do pagador</Label>
                <Input value={pixChave} onChange={(e) => setPixChave(e.target.value)} placeholder="E-mail, CPF, Tel ou Chave" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground italic">Código de Rastreio (opcional)</Label>
                <Input value={rastreio} onChange={(e) => setRastreio(e.target.value)} placeholder="ID da transação" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-muted-foreground italic">ID / Comprovante do PIX (opcional)</Label>
                <Input value={pixComprovante} onChange={(e) => setPixComprovante(e.target.value)} placeholder="E2E ID ou nº do comprovante" />
              </div>
            </div>
          )}

          {formaPagamento === "TED/DOC" && (
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Banco de origem</Label>
                <Input value={instituicaoFinanceira} onChange={(e) => setInstituicaoFinanceira(e.target.value)} placeholder="Nome do banco de origem" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground italic">Código de Rastreio (opcional)</Label>
                <Input value={rastreio} onChange={(e) => setRastreio(e.target.value)} placeholder="ID da transação" />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-muted-foreground italic">ID / Comprovante (opcional)</Label>
                <Input value={pixComprovante} onChange={(e) => setPixComprovante(e.target.value)} placeholder="Nº do comprovante" />
              </div>
            </div>
          )}

          {formaPagamento === "Boleto" && (
            <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground italic">Nº do boleto (opcional)</Label>
                <Input value={boletoNumero} onChange={(e) => setBoletoNumero(e.target.value)} placeholder="Número do boleto" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground italic">Banco emissor (opcional)</Label>
                <Input value={boletoBanco} onChange={(e) => setBoletoBanco(e.target.value)} placeholder="Ex: Itaú, BB..." />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground italic">Data de vencimento (opcional)</Label>
                <Input type="date" value={boletoVencimento} onChange={(e) => setBoletoVencimento(e.target.value)} />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label className="text-xs font-semibold text-muted-foreground italic">Linha Digitável do Boleto (opcional)</Label>
                <Input value={boletoLinhaDigitavel} onChange={(e) => setBoletoLinhaDigitavel(e.target.value)} placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000" />
              </div>
            </div>
          )}

          {formaPagamento === "Cheque" && (
            <div className="sm:col-span-2 space-y-4 p-3 rounded-lg border bg-muted/20">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Banco *</Label>
                  <Select value={chequeBanco} onValueChange={setChequeBanco}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Banco do Brasil">Banco do Brasil</SelectItem>
                      <SelectItem value="Bradesco">Bradesco</SelectItem>
                      <SelectItem value="Itaú">Itaú</SelectItem>
                      <SelectItem value="Santander">Santander</SelectItem>
                      <SelectItem value="Caixa">Caixa</SelectItem>
                      <SelectItem value="Sicoob">Sicoob</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                  {chequeBanco === "Outro" && (
                    <Input className="mt-1.5" placeholder="Nome do banco" onChange={(e) => setChequeBanco(e.target.value)} />
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Nº do Cheque *</Label>
                  <Input value={chequeNumero} onChange={(e) => setChequeNumero(e.target.value)} placeholder="000123" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Agência *</Label>
                  <Input value={chequeAgencia} onChange={(e) => setChequeAgencia(e.target.value)} placeholder="0000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Conta *</Label>
                  <Input value={chequeConta} onChange={(e) => setChequeConta(e.target.value)} placeholder="00000-0" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">Nome do titular *</Label>
                <Input value={chequeTitular} onChange={(e) => setChequeTitular(e.target.value)} placeholder="Nome completo do titular" />
              </div>

              <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-background/50 border">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">É de terceiro?</Label>
                  <p className="text-[10px] text-muted-foreground">O cheque pertence a outra pessoa</p>
                </div>
                <Switch checked={isChequeTerceiro} onCheckedChange={setIsChequeTerceiro} />
              </div>

              {isChequeTerceiro && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                  <Label className="text-xs font-semibold">CPF do titular *</Label>
                  <Input value={chequeTitularCpf} onChange={(e) => setChequeTitularCpf(e.target.value)} placeholder="000.000.000-00" />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Data do cheque *</Label>
                  <Input type="date" value={chequeData} onChange={(e) => setChequeData(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground italic">Valor (readonly)</Label>
                  <Input readOnly value={formatBRL(Number(valor || 0))} className="bg-muted" />
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 p-2 rounded-md bg-background/50 border">
                <div className="space-y-0.5">
                  <Label className="text-xs font-semibold">Pré-datado?</Label>
                  <p className="text-[10px] text-muted-foreground">Data para depósito posterior</p>
                </div>
                <Switch checked={isChequePreDatado} onCheckedChange={setIsChequePreDatado} />
              </div>

              {isChequePreDatado && (
                <div className="space-y-1.5 animate-in slide-in-from-top-1 duration-200">
                  <Label className="text-xs font-semibold">Data para depósito *</Label>
                  <Input type="date" value={chequeDataDeposito} onChange={(e) => setChequeDataDeposito(e.target.value)} />
                </div>
              )}
            </div>
          )}

          {(formaPagamento === "Cartão de Crédito" || formaPagamento === "Cartão de Débito") && (
            <div className="sm:col-span-2 space-y-4 p-3 rounded-lg border bg-muted/20">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Bandeira *</Label>
                  <Select value={cartaoBandeira} onValueChange={setCartaoBandeira}>
                    <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Visa">Visa</SelectItem>
                      <SelectItem value="Mastercard">Mastercard</SelectItem>
                      <SelectItem value="Elo">Elo</SelectItem>
                      <SelectItem value="Amex">Amex</SelectItem>
                      <SelectItem value="Hipercard">Hipercard</SelectItem>
                      <SelectItem value="Outro">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {formaPagamento === "Cartão de Crédito" && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Nº de parcelas *</Label>
                    <Select value={cartaoParcelas} onValueChange={setCartaoParcelas}>
                      <SelectTrigger><SelectValue placeholder="1x" /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 18 }, (_, i) => i + 1).map((n) => (
                          <SelectItem key={n} value={String(n)}>{n}x</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground italic">Valor da parcela</Label>
                  <Input readOnly value={new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valor || 0) / (Number(cartaoParcelas) || 1))} className="bg-muted" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground italic">Últimos 4 dígitos</Label>
                  <Input maxLength={4} value={cartaoUltimosDigitos} onChange={(e) => setCartaoUltimosDigitos(e.target.value)} placeholder="0000" />
                </div>
              </div>
              
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-muted-foreground italic">NSU / Código de Autorização</Label>
                <Input value={cartaoNsu} onChange={(e) => setCartaoNsu(e.target.value)} placeholder="000000" />
              </div>
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Número (opcional)</Label>
            <Input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="Ex: 2026-0001"
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label className="text-xs">Descrição</Label>
            <Textarea
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Sinal referente ao projeto..."
              rows={2}
            />
          </div>

          {schema.length > 0 && (
            <div className="sm:col-span-2 border-t pt-3 space-y-3">
              <p className="text-xs font-medium text-muted-foreground">
                Campos do template
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {schema.map((f) => (
                  <div key={f.key} className="space-y-1.5">
                    <Label className="text-xs">
                      {f.label}{f.required && <span className="text-destructive"> *</span>}
                    </Label>
                    {f.type === "textarea" ? (
                      <Textarea
                        value={dynFields[f.key] ?? ""}
                        onChange={(e) => setDynFields((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                        rows={2}
                      />
                    ) : f.type === "select" ? (
                      <Select
                        value={dynFields[f.key] ?? ""}
                        onValueChange={(v) => setDynFields((p) => ({ ...p, [f.key]: v }))}
                      >
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {(f.options ?? []).map((o) => (
                            <SelectItem key={o} value={o}>{o}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Input
                        type={f.type === "number" || f.type === "currency" ? "number" : f.type === "date" ? "date" : "text"}
                        step={f.type === "currency" ? "0.01" : undefined}
                        value={dynFields[f.key] ?? ""}
                        onChange={(e) => setDynFields((p) => ({ ...p, [f.key]: e.target.value }))}
                        placeholder={f.placeholder}
                      />
                    )}
                    {f.helpText && <p className="text-[10px] text-muted-foreground">{f.helpText}</p>}
                  </div>
                ))}
              </div>
          {defaultProjetoId && (
            <div className="sm:col-span-2 border-t pt-4 space-y-4">
              <h4 className="font-bold flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground">
                <History className="h-4 w-4" /> Histórico de Recibos
              </h4>
              <ReciboHistoryList projetoId={defaultProjetoId} />
            </div>
          )}
        </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={emitir.isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2 min-w-[160px]">
            {emitir.isPending ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Emitindo...</>
            ) : (
              <><Send className="h-4 w-4" /> Emitir e gerar PDF</>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
