import { useState } from "react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Printer } from "lucide-react";
import { ReciboDialog } from "./recebimentos/ReciboDialog";
import { toast } from "@/hooks/use-toast";
import { useRegistrarPagamento, useDeletarPagamento } from "@/hooks/usePagamentos";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Plus,
  Trash2,
  DollarSign,
  AlertCircle,
  Zap,
  ArrowDown,
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface Pagamento {
  id: string;
  valor_pago: number;
  forma_pagamento: string;
  data_pagamento: string;
  observacoes: string | null;
}

interface Cliente {
  id: string;
  nome: string;
  telefone: string;
}

interface Recebimento {
  id: string;
  cliente_id: string;
  valor_total: number;
  forma_pagamento_acordada: string;
  numero_parcelas: number;
  descricao: string | null;
  data_acordo: string;
  status: string;
  clientes?: Cliente;
  pagamentos?: Pagamento[];
}

interface PagamentosDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recebimento: Recebimento;
  onUpdate: () => void;
}

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "cartao_credito", label: "Cartão de Crédito" },
  { value: "cartao_debito", label: "Cartão de Débito" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
  { value: "financiamento", label: "Financiamento" },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function PagamentosDialog({
  open,
  onOpenChange,
  recebimento,
  onUpdate,
}: PagamentosDialogProps) {
  const [showForm, setShowForm] = useState(false);
  const [selectedPagamento, setSelectedPagamento] = useState<Pagamento | null>(null);
  const [reciboOpen, setReciboOpen] = useState(false);
  const [formData, setFormData] = useState({
    valor_pago: "",
    forma_pagamento: "",
    data_pagamento: new Date().toISOString().split("T")[0],
    observacoes: "",
  });

  const registrarMut = useRegistrarPagamento();
  const deletarMut = useDeletarPagamento();

  const pagamentos = recebimento.pagamentos || [];
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor_pago, 0);
  const saldoRestante = recebimento.valor_total - totalPago;
  const progresso = Math.min((totalPago / recebimento.valor_total) * 100, 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await registrarMut.mutateAsync({
        recebimentoId: recebimento.id,
        valor_pago: parseFloat(formData.valor_pago),
        forma_pagamento: formData.forma_pagamento,
        data_pagamento: formData.data_pagamento,
        observacoes: formData.observacoes || null,
      });
      toast({ title: "Pagamento registrado e parcelas atualizadas!" });
      resetForm();
      onUpdate();
    } catch {
      toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este pagamento? As parcelas vinculadas voltarão a pendente.")) return;
    try {
      await deletarMut.mutateAsync(id);
      toast({ title: "Pagamento excluído e parcelas restauradas!" });
      onUpdate();
    } catch {
      toast({ title: "Erro ao excluir pagamento", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      valor_pago: "",
      forma_pagamento: "",
      data_pagamento: new Date().toISOString().split("T")[0],
      observacoes: "",
    });
    setShowForm(false);
  };

  const isFormaDiferente = (formaPaga: string) => {
    return formaPaga !== recebimento.forma_pagamento_acordada;
  };

  const handlePrintRecibo = (pagamento: Pagamento, index: number) => {
    setSelectedPagamento({ ...pagamento, index } as Pagamento & { index: number });
    setReciboOpen(true);
  };

  const saving = registrarMut.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pagamentos - {recebimento.clientes?.nome}
          </DialogTitle>
        </DialogHeader>

        {/* Resumo */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Resumo do Recebimento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-sm text-muted-foreground">Valor Total</p>
                <p className="text-lg font-bold">{formatCurrency(recebimento.valor_total)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Pago</p>
                <p className="text-lg font-bold text-success">{formatCurrency(totalPago)}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Saldo Restante</p>
                <p className="text-lg font-bold text-warning">{formatCurrency(Math.max(0, saldoRestante))}</p>
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Progresso</span>
                <span>{progresso.toFixed(0)}%</span>
              </div>
              <Progress value={progresso} className="h-3" />
            </div>

            <div className="flex gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Forma acordada: </span>
                <Badge variant="outline">
                  {FORMAS_PAGAMENTO.find((f) => f.value === recebimento.forma_pagamento_acordada)?.label}
                </Badge>
              </div>
              <div>
                <span className="text-muted-foreground">Parcelas: </span>
                <span>{recebimento.numero_parcelas}x</span>
              </div>
            </div>

            {/* Hint about auto-reconciliation */}
            <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
              <Zap className="h-4 w-4 text-info mt-0.5 shrink-0" />
              <p className="text-xs text-info">
                <strong>Reconciliação automática:</strong> ao registrar um pagamento (inclusive adiantamento),
                as parcelas pendentes serão marcadas como pagas automaticamente da mais antiga para a mais recente.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Pagamentos */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">Histórico de Pagamentos</h3>
            {!showForm && (
              <Button size="sm" onClick={() => setShowForm(true)} className="gap-1">
                <Plus className="h-4 w-4" />
                {saldoRestante > 0 ? "Novo Pagamento" : "Pagamento Extra"}
              </Button>
            )}
          </div>

          {/* Formulário de novo pagamento */}
          {showForm && (
            <Card>
              <CardContent className="pt-4">
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="valor_pago">Valor Pago *</Label>
                      <Input
                        id="valor_pago"
                        type="number"
                        step="0.01"
                        placeholder={`Restante: ${formatCurrency(Math.max(0, saldoRestante))}`}
                        value={formData.valor_pago}
                        onChange={(e) => setFormData({ ...formData, valor_pago: e.target.value })}
                        required
                      />
                      {saldoRestante > 0 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs gap-1 text-muted-foreground"
                          onClick={() => setFormData({ ...formData, valor_pago: saldoRestante.toFixed(2) })}
                        >
                          <ArrowDown className="h-3 w-3" />
                          Usar saldo: {formatCurrency(saldoRestante)}
                        </Button>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="data_pagamento">Data do Pagamento *</Label>
                      <DateInput
                        value={formData.data_pagamento}
                        onChange={(v) => setFormData({ ...formData, data_pagamento: v })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>Forma de Pagamento *</Label>
                    <Select
                      value={formData.forma_pagamento}
                      onValueChange={(value) => setFormData({ ...formData, forma_pagamento: value })}
                      required
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {FORMAS_PAGAMENTO.map((fp) => (
                          <SelectItem key={fp.value} value={fp.value}>
                            {fp.label}
                            {fp.value !== recebimento.forma_pagamento_acordada && " ⚠️"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {formData.forma_pagamento && formData.forma_pagamento !== recebimento.forma_pagamento_acordada && (
                      <Alert variant="destructive" className="py-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertDescription className="text-xs">
                          Forma de pagamento diferente do acordado ({FORMAS_PAGAMENTO.find((f) => f.value === recebimento.forma_pagamento_acordada)?.label})
                        </AlertDescription>
                      </Alert>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="observacoes">Observações</Label>
                    <Textarea
                      id="observacoes"
                      value={formData.observacoes}
                      onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                      rows={2}
                      placeholder="Adiantamento, número do comprovante..."
                    />
                  </div>

                  <div className="flex justify-end gap-3">
                    <Button type="button" variant="ghost" onClick={resetForm}>
                      Cancelar
                    </Button>
                    <Button type="submit" disabled={saving}>
                      {saving && <Spinner size="sm" />}
                      Registrar
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Tabela de pagamentos */}
          {pagamentos.length === 0 ? (
            <p className="text-center text-muted-foreground py-4">
              Nenhum pagamento registrado
            </p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead>Data</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Forma</TableHead>
                  <TableHead>Obs</TableHead>
                  <TableHead className="w-24"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map((pagamento, index) => (
                  <TableRow key={pagamento.id}>
                    <TableCell>
                      {format(new Date(pagamento.data_pagamento), "dd/MM/yyyy", { locale: ptBR })}
                    </TableCell>
                    <TableCell className="font-medium">
                      {formatCurrency(pagamento.valor_pago)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={isFormaDiferente(pagamento.forma_pagamento) ? "destructive" : "secondary"}
                      >
                        {FORMAS_PAGAMENTO.find((f) => f.value === pagamento.forma_pagamento)?.label ||
                          pagamento.forma_pagamento}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                      {pagamento.observacoes || "-"}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handlePrintRecibo(pagamento, index + 1)}
                        title="Imprimir Recibo"
                      >
                        <Printer className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(pagamento.id)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>

    {selectedPagamento && (
      <ReciboDialog
        open={reciboOpen}
        onOpenChange={setReciboOpen}
        pagamento={selectedPagamento}
        clienteNome={recebimento.clientes?.nome || "Cliente"}
        descricaoRecebimento={recebimento.descricao}
        numeroRecibo={(selectedPagamento as Pagamento & { index: number }).index}
      />
    )}
    </>
   );
}
