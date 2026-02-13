import { useState } from "react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { Printer } from "lucide-react";
import { ReciboDialog } from "./recebimentos/ReciboDialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Loader2,
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

/**
 * After inserting a pagamento, auto-reconcile with pending parcelas.
 * Marks parcelas as "paga" starting from the earliest pending,
 * consuming the payment amount progressively.
 */
async function reconcilePagamentoWithParcelas(
  recebimentoId: string,
  pagamentoId: string,
  valorPago: number
) {
  // Fetch all pending parcelas for this recebimento, ordered by numero_parcela
  const { data: parcelas, error } = await supabase
    .from("parcelas")
    .select("id, numero_parcela, valor, status")
    .eq("recebimento_id", recebimentoId)
    .in("status", ["pendente", "atrasada"])
    .order("numero_parcela", { ascending: true });

  if (error || !parcelas || parcelas.length === 0) return;

  let remaining = valorPago;
  const parcelasToUpdate: string[] = [];

  for (const parcela of parcelas) {
    if (remaining <= 0) break;

    // If remaining covers this parcela (within 1 cent tolerance)
    if (remaining >= parcela.valor - 0.01) {
      parcelasToUpdate.push(parcela.id);
      remaining -= parcela.valor;
    }
  }

  // Mark matched parcelas as paid and link to pagamento
  if (parcelasToUpdate.length > 0) {
    await supabase
      .from("parcelas")
      .update({ status: "paga", pagamento_id: pagamentoId })
      .in("id", parcelasToUpdate);
  }
}

export function PagamentosDialog({
  open,
  onOpenChange,
  recebimento,
  onUpdate,
}: PagamentosDialogProps) {
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedPagamento, setSelectedPagamento] = useState<Pagamento | null>(null);
  const [reciboOpen, setReciboOpen] = useState(false);
  const [formData, setFormData] = useState({
    valor_pago: "",
    forma_pagamento: "",
    data_pagamento: new Date().toISOString().split("T")[0],
    observacoes: "",
  });

  const pagamentos = recebimento.pagamentos || [];
  const totalPago = pagamentos.reduce((acc, p) => acc + p.valor_pago, 0);
  const saldoRestante = recebimento.valor_total - totalPago;
  const progresso = Math.min((totalPago / recebimento.valor_total) * 100, 100);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);

    try {
      const valorPago = parseFloat(formData.valor_pago);

      const { data: inserted, error } = await supabase
        .from("pagamentos")
        .insert({
          recebimento_id: recebimento.id,
          valor_pago: valorPago,
          forma_pagamento: formData.forma_pagamento,
          data_pagamento: formData.data_pagamento,
          observacoes: formData.observacoes || null,
        })
        .select("id")
        .single();

      if (error) throw error;

      // Auto-reconcile with pending parcelas
      if (inserted?.id) {
        await reconcilePagamentoWithParcelas(recebimento.id, inserted.id, valorPago);
      }

      toast({ title: "Pagamento registrado e parcelas atualizadas!" });
      resetForm();
      onUpdate();
    } catch (error) {
      console.error("Error saving pagamento:", error);
      toast({
        title: "Erro ao registrar pagamento",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este pagamento? As parcelas vinculadas voltarão a pendente.")) return;

    try {
      // First, unlink any parcelas tied to this pagamento
      await supabase
        .from("parcelas")
        .update({ status: "pendente", pagamento_id: null })
        .eq("pagamento_id", id);

      const { error } = await supabase.from("pagamentos").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Pagamento excluído e parcelas restauradas!" });
      onUpdate();
    } catch (error) {
      console.error("Error deleting pagamento:", error);
      toast({
        title: "Erro ao excluir pagamento",
        variant: "destructive",
      });
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

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
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
                      <Input
                        id="data_pagamento"
                        type="date"
                        value={formData.data_pagamento}
                        onChange={(e) => setFormData({ ...formData, data_pagamento: e.target.value })}
                        required
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
                    <Button type="button" variant="outline" onClick={resetForm}>
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
            <Table>
              <TableHeader>
                <TableRow>
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
