import { useEffect, useMemo, useState } from "react";
import { Loader2, Send, FileText, Calculator, Landmark } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { useEmitirRecibo, type Recibo } from "@/hooks/useRecibos";
import type { DocumentTemplate, FormFieldSchema } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { formatBRL } from "@/lib/formatters";

interface EmitirReciboModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultClienteId?: string;
  defaultProjetoId?: string;
  defaultDealId?: string;
  onEmitted?: (reciboId: string) => void;
}

/**
 * Modal de emissão de recibo. Reaproveita document_templates (categoria='recibo')
 * e renderiza form dinâmico baseado em template.form_schema.
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

  const [templateId, setTemplateId] = useState<string>("");
  const [clienteId, setClienteId] = useState<string>(defaultClienteId ?? "");
  const [projetoId, setProjetoId] = useState<string | null>(defaultProjetoId ?? null);
  const [valor, setValor] = useState<string>("");
  const [descricao, setDescricao] = useState<string>("");
  const [numero, setNumero] = useState<string>("");
  const [formaPagamento, setFormaPagamento] = useState<string>("");
  const [dataPagamento, setDataPagamento] = useState<string>(new Date().toISOString().slice(0, 10));
  const [instituicaoFinanceira, setInstituicaoFinanceira] = useState<string>("");
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
  }, [template, projectContext, proposalContext]);
  // Em modo global (sem defaultProjetoId), ao escolher cliente buscar projeto principal
  useEffect(() => {
    if (defaultProjetoId) return;
    if (!clienteId) return;
    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("projetos")
        .select("id")
        .eq("cliente_id", clienteId)
        .eq("is_principal", true)
        .limit(1)
        .maybeSingle();
      if (!cancelled) setProjetoId(data?.id ?? null);
    })();
    return () => { cancelled = true; };
  }, [clienteId, defaultProjetoId]);


  const schema: FormFieldSchema[] = useMemo(() => {
    const arr = (template?.form_schema ?? []) as FormFieldSchema[];
    return [...arr].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }, [template]);

  const canSubmit =
    !!templateId && !!clienteId && Number(valor) > 0 && Number(valor) <= saldoDevedorAtual + 0.01 && !!formaPagamento && !emitir.isPending;

  async function handleSubmit() {
    if (!canSubmit) return;
    const camposExtras: Record<string, unknown> = { ...dynFields };
    if (instituicaoFinanceira) camposExtras["instituicao_financeira"] = instituicaoFinanceira;

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
    });
    onEmitted?.(id);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                <span className="text-[10px] text-muted-foreground uppercase tracking-tight">{projectContext?.clientes?.cpf_cnpj || "CPF/CNPJ não disponível"}</span>
              </div>
              <Badge variant="outline" className="text-[9px] uppercase">Projeto vinculado</Badge>
            </div>
          </div>

          <div className="space-y-1.5 p-3 rounded-lg bg-muted/30 sm:col-span-2">
            <div className="flex justify-between items-center text-xs">
              <span className="text-muted-foreground font-medium uppercase tracking-wider">Resumo do Financeiro</span>
              {saldoRestanteAposRecibo <= 0 ? (
                <span className="text-success font-bold flex items-center gap-1">Quitado ✓</span>
              ) : saldoRestanteAposRecibo < valorTotalVenda ? (
                <span className="text-amber-500 font-bold">Restam {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoRestanteAposRecibo)}</span>
              ) : null}
            </div>
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-muted-foreground uppercase">Valor Venda</span>
                <span className="text-sm font-bold">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valorTotalVenda)}</span>
              </div>
              <div className="flex flex-col border-l pl-2">
                <span className="text-[10px] text-muted-foreground uppercase">Total Pago</span>
                <span className="text-sm font-bold text-success">{new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalPago)}</span>
              </div>
              <div className="flex flex-col border-l pl-2">
                <span className="text-[10px] text-muted-foreground uppercase">Saldo Devedor</span>
                <span className={cn("text-sm font-bold", saldoDevedorAtual > 0 ? "text-destructive" : "text-success")}>
                  {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(saldoDevedorAtual)}
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
            <div className="space-y-1.5">
              <Label className="text-xs">Instituição Financeira</Label>
              <Input
                value={instituicaoFinanceira}
                onChange={(e) => setInstituicaoFinanceira(e.target.value)}
                placeholder="Ex: EOS, BV, Santander..."
              />
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
