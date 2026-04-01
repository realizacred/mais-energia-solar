import { useState, useRef, useEffect } from "react";
import { usePagamentoLivre, usePagamentosDoRecebimento } from "@/hooks/usePagamentoLivre";
import { formatBRL } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle, Upload, X, FileText, Image as ImageIcon,
  Smartphone, CreditCard, Banknote, Building2, Receipt,
  Landmark, FileCheck, CheckCircle2, DollarSign,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";

interface ComposicaoItem {
  forma: string;
  valor: number;
}

interface RecebimentoInfo {
  id: string;
  valor_total: number;
  total_pago: number;
  descricao: string | null;
  clientes?: { nome: string; telefone: string } | null;
  composicao_acordada?: ComposicaoItem[];
}

interface PagamentoLivreDialogProps {
  open: boolean;
  onClose: () => void;
  recebimento: RecebimentoInfo;
}

const FORMAS_PAGAMENTO = [
  { value: "pix_chave", label: "PIX", icon: Smartphone },
  { value: "cartao_credito", label: "Cartão de Crédito", icon: CreditCard },
  { value: "cartao_debito", label: "Cartão de Débito", icon: CreditCard },
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "transferencia", label: "Transferência TED/DOC", icon: Building2 },
  { value: "financiamento", label: "Financiamento Bancário", icon: Landmark },
  { value: "cheque", label: "Cheque", icon: FileCheck },
  { value: "boleto_manual", label: "Boleto (baixa manual)", icon: Receipt },
];

const FORMA_LABELS: Record<string, string> = Object.fromEntries(
  FORMAS_PAGAMENTO.map((f) => [f.value, f.label])
);

const BANDEIRAS = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Outro"];

export function PagamentoLivreDialog({ open, onClose, recebimento }: PagamentoLivreDialogProps) {
  const mutation = usePagamentoLivre();
  const { data: pagamentos = [] } = usePagamentosDoRecebimento(open ? recebimento.id : null);
  const fileRef = useRef<HTMLInputElement>(null);

  const saldo = recebimento.valor_total - recebimento.total_pago;

  const [forma, setForma] = useState("pix_chave");
  const [valorPago, setValorPago] = useState(saldo > 0 ? saldo : 0);
  const [dataPagamento, setDataPagamento] = useState(new Date().toISOString().split("T")[0]);

  // Conditional fields
  const [chavePix, setChavePix] = useState("");
  const [txidPix, setTxidPix] = useState("");
  const [parcelasCartao, setParcelasCartao] = useState("1");
  const [codigoAutorizacao, setCodigoAutorizacao] = useState("");
  const [bandeira, setBandeira] = useState("");
  const [bancoOrigem, setBancoOrigem] = useState("");
  const [numeroComprovante, setNumeroComprovante] = useState("");
  const [numeroCheque, setNumeroCheque] = useState("");
  const [bancoEmissor, setBancoEmissor] = useState("");
  const [bomPara, setBomPara] = useState("");
  const [bancoFinanciador, setBancoFinanciador] = useState("");
  const [numeroContrato, setNumeroContrato] = useState("");
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [comprovantePreview, setComprovantePreview] = useState<string | null>(null);
  const [observacoesInternas, setObservacoesInternas] = useState("");

  // Reset values when dialog opens
  useEffect(() => {
    if (open) {
      const newSaldo = recebimento.valor_total - recebimento.total_pago;
      setValorPago(newSaldo > 0 ? newSaldo : 0);
      setForma("pix_chave");
      setDataPagamento(new Date().toISOString().split("T")[0]);
      setChavePix("");
      setTxidPix("");
      setParcelasCartao("1");
      setCodigoAutorizacao("");
      setBandeira("");
      setBancoOrigem("");
      setNumeroComprovante("");
      setNumeroCheque("");
      setBancoEmissor("");
      setBomPara("");
      setBancoFinanciador("");
      setNumeroContrato("");
      setComprovanteFile(null);
      setComprovantePreview(null);
      setObservacoesInternas("");
    }
  }, [open, recebimento.valor_total, recebimento.total_pago]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setComprovanteFile(file);
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = () => setComprovantePreview(reader.result as string);
      reader.readAsDataURL(file);
    } else {
      setComprovantePreview(null);
    }
  };

  const removeComprovante = () => {
    setComprovanteFile(null);
    setComprovantePreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const buildObservacoes = (): string => {
    const parts: string[] = [];
    if (forma === "pix_chave") {
      if (chavePix) parts.push(`Chave PIX: ${chavePix}`);
      if (txidPix) parts.push(`txid: ${txidPix}`);
    }
    if (forma === "cartao_credito") {
      if (bandeira) parts.push(`Bandeira: ${bandeira}`);
      if (parcelasCartao !== "1") parts.push(`${parcelasCartao}x`);
    }
    if (forma === "cartao_debito" && bandeira) parts.push(`Bandeira: ${bandeira}`);
    if (forma === "transferencia" && numeroComprovante) parts.push(`Comprovante: ${numeroComprovante}`);
    if (forma === "cheque") {
      if (bancoEmissor) parts.push(`Banco: ${bancoEmissor}`);
      if (bomPara) parts.push(`Bom para: ${bomPara}`);
    }
    if (forma === "financiamento") {
      if (bancoFinanciador) parts.push(`Banco: ${bancoFinanciador}`);
      if (numeroContrato) parts.push(`Contrato: ${numeroContrato}`);
    }
    return parts.join(" | ");
  };

  const acimaSaldo = valorPago > saldo + 0.01;

  const handleSubmit = async () => {
    if (valorPago <= 0) return;
    if (forma === "cheque" && !numeroCheque.trim()) return;

    try {
      await mutation.mutateAsync({
        recebimentoId: recebimento.id,
        valorPago,
        dataPagamento,
        formaPagamento: forma,
        comprovanteFile: comprovanteFile || null,
        bancoOrigem: bancoOrigem || bancoEmissor || bancoFinanciador || null,
        numeroCheque: numeroCheque || null,
        numeroAutorizacao: codigoAutorizacao || null,
        numeroParcelasCartao: forma === "cartao_credito" ? parseInt(parcelasCartao) : 1,
        observacoes: buildObservacoes(),
        observacoesInternas: observacoesInternas || null,
      });

      const novoSaldo = saldo - valorPago;
      if (novoSaldo <= 0.01) {
        toast({ title: "🎉 Recebimento quitado!" });
      } else {
        toast({ title: `Pagamento de ${formatBRL(valorPago)} registrado!` });
      }
      onClose();
    } catch {
      // Error handled by mutation onError
    }
  };

  const progresso = recebimento.valor_total > 0
    ? Math.min((recebimento.total_pago / recebimento.valor_total) * 100, 100)
    : 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <div>
              <span>Conta Corrente</span>
              {recebimento.clientes?.nome && (
                <span className="text-muted-foreground font-normal"> — {recebimento.clientes.nome}</span>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Summary bar */}
        <div className="space-y-2 p-3 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">Total: {formatBRL(recebimento.valor_total)}</span>
            <span className="text-muted-foreground">Pago: {formatBRL(recebimento.total_pago)}</span>
            <span className={saldo > 0.01 ? "text-warning font-semibold" : "text-success font-semibold"}>
              Saldo: {formatBRL(saldo)}
            </span>
          </div>
          <Progress value={progresso} className="h-2" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left column — History */}
          <div className="space-y-3">
            <h3 className="text-base font-semibold text-foreground">Pagamentos recebidos</h3>
            {pagamentos.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4">Nenhum pagamento ainda</p>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {pagamentos.map((p: any) => (
                  <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg border border-border bg-card">
                    <div>
                      <p className="text-sm font-medium text-foreground">{formatBRL(p.valor_pago)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(p.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {FORMA_LABELS[p.forma_pagamento] || p.forma_pagamento}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right column — New payment */}
          <div className="space-y-4 border-t md:border-t-0 md:border-l border-border pt-4 md:pt-0 md:pl-6">
            <h3 className="text-base font-semibold text-foreground">Registrar novo pagamento</h3>

            {saldo <= 0.01 ? (
              <div className="flex flex-col items-center gap-2 py-6">
                <CheckCircle2 className="h-10 w-10 text-success" />
                <p className="text-sm font-medium text-success">Totalmente quitado!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Forma de pagamento */}
                <div className="space-y-2">
                  <Label>Forma de pagamento *</Label>
                  <Select value={forma} onValueChange={setForma}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FORMAS_PAGAMENTO.map((f) => (
                        <SelectItem key={f.value} value={f.value}>
                          <span className="flex items-center gap-2">
                            <f.icon className="h-3.5 w-3.5" />
                            {f.label}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Valor e Data */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Valor *</Label>
                    <CurrencyInput value={valorPago} onChange={setValorPago} />
                    {acimaSaldo && (
                      <Alert className="py-1.5">
                        <AlertCircle className="h-3.5 w-3.5" />
                        <AlertDescription className="text-xs">
                          Acima do saldo ({formatBRL(saldo)}) — confirma?
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>
                  <div className="space-y-2">
                    <Label>Data *</Label>
                    <DateInput value={dataPagamento} onChange={setDataPagamento} />
                  </div>
                </div>

                {/* Conditional fields by forma */}
                {forma === "pix_chave" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Chave PIX</Label>
                      <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder="CPF, e-mail, telefone..." />
                    </div>
                    <div className="space-y-2">
                      <Label>txid</Label>
                      <Input value={txidPix} onChange={(e) => setTxidPix(e.target.value)} />
                    </div>
                  </div>
                )}

                {forma === "cartao_credito" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bandeira</Label>
                      <Select value={bandeira} onValueChange={setBandeira}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {BANDEIRAS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Parcelas</Label>
                      <Input type="number" min="1" max="18" value={parcelasCartao} onChange={(e) => setParcelasCartao(e.target.value)} />
                    </div>
                    <div className="space-y-2 col-span-1 sm:col-span-2">
                      <Label>Código de autorização</Label>
                      <Input value={codigoAutorizacao} onChange={(e) => setCodigoAutorizacao(e.target.value)} />
                    </div>
                  </div>
                )}

                {forma === "cartao_debito" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Bandeira</Label>
                      <Select value={bandeira} onValueChange={setBandeira}>
                        <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                        <SelectContent>
                          {BANDEIRAS.map((b) => <SelectItem key={b} value={b}>{b}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Código de autorização</Label>
                      <Input value={codigoAutorizacao} onChange={(e) => setCodigoAutorizacao(e.target.value)} />
                    </div>
                  </div>
                )}

                {forma === "transferencia" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Banco origem</Label>
                      <Input value={bancoOrigem} onChange={(e) => setBancoOrigem(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Nº comprovante</Label>
                      <Input value={numeroComprovante} onChange={(e) => setNumeroComprovante(e.target.value)} />
                    </div>
                  </div>
                )}

                {forma === "cheque" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Nº cheque *</Label>
                      <Input value={numeroCheque} onChange={(e) => setNumeroCheque(e.target.value)} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Banco emissor</Label>
                      <Input value={bancoEmissor} onChange={(e) => setBancoEmissor(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Bom para</Label>
                      <DateInput value={bomPara} onChange={setBomPara} />
                    </div>
                  </div>
                )}

                {forma === "financiamento" && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Banco financiador</Label>
                      <Input value={bancoFinanciador} onChange={(e) => setBancoFinanciador(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>Nº contrato</Label>
                      <Input value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} />
                    </div>
                  </div>
                )}

                {/* Comprovante upload */}
                <div className="space-y-2">
                  <Label>Comprovante</Label>
                  {comprovanteFile ? (
                    <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                      {comprovantePreview ? (
                        <img src={comprovantePreview} alt="Preview" className="h-10 w-10 object-cover rounded" />
                      ) : (
                        <FileText className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="text-xs text-foreground flex-1 truncate">{comprovanteFile.name}</span>
                      <Button variant="ghost" size="sm" onClick={removeComprovante}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 w-full"
                      onClick={() => fileRef.current?.click()}
                    >
                      <Upload className="h-4 w-4" />
                      Anexar comprovante
                    </Button>
                  )}
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>

                {/* Observações */}
                <div className="space-y-2">
                  <Label>Observações internas</Label>
                  <Textarea
                    value={observacoesInternas}
                    onChange={(e) => setObservacoesInternas(e.target.value)}
                    rows={2}
                    placeholder="Opcional..."
                  />
                </div>

                {/* Submit */}
                <Button
                  className="w-full gap-2"
                  onClick={handleSubmit}
                  disabled={mutation.isPending || valorPago <= 0}
                >
                  {mutation.isPending && <Spinner size="sm" />}
                  Confirmar Pagamento
                </Button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
