import { useState, useRef } from "react";
import { usePagamentoManual } from "@/hooks/usePagamentoManual";
import { formatBRL } from "@/lib/formatters";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { CurrencyInput } from "@/components/ui-kit/inputs/CurrencyInput";
import { Spinner } from "@/components/ui-kit/Spinner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertCircle, Upload, X, FileText, Image as ImageIcon,
  Smartphone, CreditCard, Banknote, Building2, Receipt,
  Landmark, FileCheck,
} from "lucide-react";

interface ParcelaInfo {
  id: string;
  recebimento_id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: string;
  cobranca_status: string | null;
}

interface PagamentoParcelaDialogProps {
  open: boolean;
  onClose: () => void;
  parcela: ParcelaInfo;
  onSuccess?: () => void;
}

const FORMAS_PAGAMENTO = [
  { value: "pix_chave", label: "PIX (chave própria)", icon: Smartphone },
  { value: "cartao_credito", label: "Cartão de Crédito", icon: CreditCard },
  { value: "cartao_debito", label: "Cartão de Débito", icon: CreditCard },
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "transferencia", label: "Transferência TED/DOC", icon: Building2 },
  { value: "financiamento", label: "Financiamento Bancário", icon: Landmark },
  { value: "cheque", label: "Cheque", icon: FileCheck },
  { value: "boleto_manual", label: "Boleto (baixa manual)", icon: Receipt },
];

const BANDEIRAS_CREDITO = ["Visa", "Mastercard", "Elo", "Amex", "Hipercard", "Outro"];
const BANDEIRAS_DEBITO = ["Visa", "Mastercard", "Elo", "Outro"];

export function PagamentoParcelaDialog({
  open, onClose, parcela, onSuccess,
}: PagamentoParcelaDialogProps) {
  const mutation = usePagamentoManual();
  const fileRef = useRef<HTMLInputElement>(null);

  const [forma, setForma] = useState("pix_chave");
  const [valorPago, setValorPago] = useState(parcela.valor);
  const [dataPagamento, setDataPagamento] = useState(
    new Date().toISOString().split("T")[0]
  );

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

  // Comprovante
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [comprovantePreview, setComprovantePreview] = useState<string | null>(null);

  // Observações
  const [observacoesInternas, setObservacoesInternas] = useState("");

  const valorDiferente = Math.abs(valorPago - parcela.valor) > 0.01;

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
    if (forma === "cartao_debito" && bandeira) {
      parts.push(`Bandeira: ${bandeira}`);
    }
    if (forma === "transferencia") {
      if (numeroComprovante) parts.push(`Comprovante: ${numeroComprovante}`);
    }
    if (forma === "cheque") {
      if (bancoEmissor) parts.push(`Banco: ${bancoEmissor}`);
      if (bomPara) parts.push(`Bom para: ${bomPara}`);
    }
    if (forma === "financiamento") {
      if (bancoFinanciador) parts.push(`Banco: ${bancoFinanciador}`);
      if (numeroContrato) parts.push(`Contrato: ${numeroContrato}`);
    }
    parts.push(`Parcela ${parcela.numero_parcela}`);
    return parts.join(" | ");
  };

  const handleSubmit = async () => {
    if (forma === "cheque" && !numeroCheque.trim()) return;

    await mutation.mutateAsync({
      parcelaId: parcela.id,
      recebimentoId: parcela.recebimento_id,
      valorPago,
      dataPagamento,
      formaPagamento: forma,
      comprovanteFile: comprovanteFile || null,
      bancoOrigem: bancoOrigem || bancoEmissor || bancoFinanciador || null,
      numeroCheque: numeroCheque || null,
      numeroAutorizacao: codigoAutorizacao || null,
      gatewayUtilizado: null,
      numeroParcelasCartao: forma === "cartao_credito" ? parseInt(parcelasCartao) : 1,
      observacoes: buildObservacoes(),
      observacoesInternas: observacoesInternas || null,
    });

    onSuccess?.();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <CreditCard className="w-5 h-5 text-primary" />
            </div>
            Registrar Pagamento — Parcela {parcela.numero_parcela}
          </DialogTitle>
        </DialogHeader>

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
              <Label>Valor recebido *</Label>
              <CurrencyInput value={valorPago} onChange={setValorPago} />
              {valorDiferente && (
                <Alert className="py-1.5">
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">
                    Diferente do valor original ({formatBRL(parcela.valor)})
                  </AlertDescription>
                </Alert>
              )}
            </div>
            <div className="space-y-2">
              <Label>Data do recebimento *</Label>
              <DateInput value={dataPagamento} onChange={setDataPagamento} />
            </div>
          </div>

          {/* === Campos condicionais por forma === */}

          {forma === "pix_chave" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Chave PIX utilizada</Label>
                <Input value={chavePix} onChange={(e) => setChavePix(e.target.value)} placeholder="email, CPF, telefone..." />
              </div>
              <div className="space-y-2">
                <Label>ID/txid da transação</Label>
                <Input value={txidPix} onChange={(e) => setTxidPix(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          )}

          {forma === "cartao_credito" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Parcelas</Label>
                <Select value={parcelasCartao} onValueChange={setParcelasCartao}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 12 }, (_, i) => (
                      <SelectItem key={i + 1} value={String(i + 1)}>{i + 1}x</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Cód. autorização</Label>
                <Input value={codigoAutorizacao} onChange={(e) => setCodigoAutorizacao(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Bandeira</Label>
                <Select value={bandeira} onValueChange={setBandeira}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {BANDEIRAS_CREDITO.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {forma === "cartao_debito" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Cód. autorização</Label>
                <Input value={codigoAutorizacao} onChange={(e) => setCodigoAutorizacao(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Bandeira</Label>
                <Select value={bandeira} onValueChange={setBandeira}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>
                    {BANDEIRAS_DEBITO.map((b) => (
                      <SelectItem key={b} value={b}>{b}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}

          {forma === "transferencia" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banco de origem</Label>
                <Input value={bancoOrigem} onChange={(e) => setBancoOrigem(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Nº do comprovante</Label>
                <Input value={numeroComprovante} onChange={(e) => setNumeroComprovante(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          )}

          {forma === "cheque" && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Nº do cheque *</Label>
                <Input value={numeroCheque} onChange={(e) => setNumeroCheque(e.target.value)} placeholder="Obrigatório" />
              </div>
              <div className="space-y-2">
                <Label>Banco emissor</Label>
                <Input value={bancoEmissor} onChange={(e) => setBancoEmissor(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Bom para (data)</Label>
                <DateInput value={bomPara} onChange={setBomPara} />
              </div>
            </div>
          )}

          {forma === "financiamento" && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Banco financiador</Label>
                <Input value={bancoFinanciador} onChange={(e) => setBancoFinanciador(e.target.value)} placeholder="Opcional" />
              </div>
              <div className="space-y-2">
                <Label>Nº do contrato</Label>
                <Input value={numeroContrato} onChange={(e) => setNumeroContrato(e.target.value)} placeholder="Opcional" />
              </div>
            </div>
          )}

          {/* Upload comprovante */}
          <div className="space-y-2">
            <Label>Comprovante (foto/PDF)</Label>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5" />
                Anexar comprovante
              </Button>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept="image/*,.pdf"
                onChange={handleFileChange}
              />
              {comprovanteFile && (
                <div className="flex items-center gap-2 px-2 py-1 bg-muted rounded text-xs">
                  {comprovanteFile.type.startsWith("image/") ? (
                    comprovantePreview ? (
                      <img src={comprovantePreview} alt="preview" className="h-8 w-8 rounded object-cover" />
                    ) : (
                      <ImageIcon className="h-4 w-4 text-muted-foreground" />
                    )
                  ) : (
                    <FileText className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="max-w-32 truncate">{comprovanteFile.name}</span>
                  <Button type="button" variant="ghost" size="icon" className="h-5 w-5" onClick={removeComprovante}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          </div>

          {/* Observações internas */}
          <div className="space-y-2">
            <Label>Observações internas</Label>
            <Textarea
              value={observacoesInternas}
              onChange={(e) => setObservacoesInternas(e.target.value)}
              rows={2}
              placeholder="Visível apenas para a equipe"
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={mutation.isPending}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={mutation.isPending || (forma === "cheque" && !numeroCheque.trim())}
          >
            {mutation.isPending && <Spinner size="sm" />}
            Confirmar {formatBRL(valorPago)}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
