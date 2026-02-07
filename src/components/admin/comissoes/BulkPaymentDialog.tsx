import { useState, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, DollarSign, AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface Comissao {
  id: string;
  vendedor_id: string;
  descricao: string;
  valor_comissao: number;
  vendedores?: { nome: string };
  pagamentos_comissao?: { valor_pago: number }[];
}

interface BulkPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  comissoes: Comissao[];
  onUpdate: () => void;
}

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "transferencia", label: "Transferência" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cheque", label: "Cheque" },
  { value: "vale", label: "Vale Antecipado" },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
};

export function BulkPaymentDialog({
  open,
  onOpenChange,
  comissoes,
  onUpdate,
}: BulkPaymentDialogProps) {
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    forma_pagamento: "",
    data_pagamento: new Date().toISOString().split("T")[0],
    valor_pago: "",
    observacoes: "",
  });

  // Check if all commissions are from the same vendor
  const vendedorIds = [...new Set(comissoes.map(c => c.vendedor_id))];
  const isMultiVendor = vendedorIds.length > 1;
  const vendedorNome = comissoes[0]?.vendedores?.nome || "Desconhecido";

  // Calculate totals
  const calcularSaldoRestante = (comissao: Comissao) => {
    const totalPago = comissao.pagamentos_comissao?.reduce((acc, p) => acc + p.valor_pago, 0) || 0;
    return Math.max(0, comissao.valor_comissao - totalPago);
  };

  const totalAReceber = comissoes.reduce((acc, c) => acc + calcularSaldoRestante(c), 0);
  
  // Custom payment amount
  const valorPagoNum = formData.valor_pago ? parseFloat(formData.valor_pago) : totalAReceber;
  const diferenca = valorPagoNum - totalAReceber;
  
  // Reset valor_pago when dialog opens
  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        valor_pago: totalAReceber.toFixed(2),
      }));
    }
  }, [open, totalAReceber]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isMultiVendor) {
      toast({ 
        title: "Pagamento em lote apenas para mesmo vendedor", 
        description: "Selecione comissões de um único vendedor",
        variant: "destructive" 
      });
      return;
    }

    if (valorPagoNum <= 0) {
      toast({ title: "Valor deve ser maior que zero", variant: "destructive" });
      return;
    }

    setSaving(true);

    try {
      // Calculate how to distribute the payment across commissions
      let valorRestante = valorPagoNum;
      const payments: { comissao_id: string; valor_pago: number }[] = [];

      // Sort by remaining balance (pay off smaller ones first)
      const comissoesOrdenadas = [...comissoes]
        .map(c => ({ ...c, saldo: calcularSaldoRestante(c) }))
        .filter(c => c.saldo > 0)
        .sort((a, b) => a.saldo - b.saldo);

      for (const comissao of comissoesOrdenadas) {
        if (valorRestante <= 0) break;
        
        const valorParaEsta = Math.min(valorRestante, comissao.saldo);
        if (valorParaEsta > 0) {
          payments.push({
            comissao_id: comissao.id,
            valor_pago: valorParaEsta,
          });
          valorRestante -= valorParaEsta;
        }
      }

      // If there's extra value (advance/credit), add to the last commission or first one
      if (valorRestante > 0 && comissoes.length > 0) {
        // Create a credit entry - we'll add to existing payment or create new one
        const targetComissao = comissoes[0];
        const existingPayment = payments.find(p => p.comissao_id === targetComissao.id);
        if (existingPayment) {
          existingPayment.valor_pago += valorRestante;
        } else {
          payments.push({
            comissao_id: targetComissao.id,
            valor_pago: valorRestante,
          });
        }
      }

      // Build observation with credit/debit info
      let observacoesFinais = formData.observacoes || `Pagamento em lote - ${comissoes.length} comissões`;
      if (diferenca > 0) {
        observacoesFinais += ` | CRÉDITO/VALE: ${formatCurrency(diferenca)}`;
      } else if (diferenca < 0) {
        observacoesFinais += ` | SALDO PENDENTE: ${formatCurrency(Math.abs(diferenca))}`;
      }

      // Insert all payments
      const { error } = await supabase.from("pagamentos_comissao").insert(
        payments.map(p => ({
          comissao_id: p.comissao_id,
          valor_pago: p.valor_pago,
          forma_pagamento: formData.forma_pagamento,
          data_pagamento: formData.data_pagamento,
          observacoes: observacoesFinais,
        }))
      );

      if (error) throw error;

      let mensagem = `Pagamento de ${formatCurrency(valorPagoNum)} registrado!`;
      if (diferenca > 0) {
        mensagem += ` Crédito de ${formatCurrency(diferenca)} lançado.`;
      } else if (diferenca < 0) {
        mensagem += ` Saldo de ${formatCurrency(Math.abs(diferenca))} ainda pendente.`;
      }

      toast({ 
        title: "Pagamento registrado!", 
        description: mensagem 
      });
      
      onOpenChange(false);
      onUpdate();
    } catch (error) {
      console.error("Error saving bulk payments:", error);
      toast({ title: "Erro ao registrar pagamentos", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Pagamento em Lote
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Multi-vendor warning */}
          {isMultiVendor && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Não é possível pagar comissões de vendedores diferentes em lote. 
                Selecione apenas comissões de <strong>um vendedor</strong>.
              </AlertDescription>
            </Alert>
          )}

          {/* Summary */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Vendedor:</span>
                  <Badge variant={isMultiVendor ? "destructive" : "default"}>
                    {isMultiVendor ? `${vendedorIds.length} vendedores diferentes` : vendedorNome}
                  </Badge>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Comissões selecionadas:</span>
                  <span className="font-medium">{comissoes.length}</span>
                </div>

                <div className="border-t pt-3">
                  <div className="flex justify-between items-center">
                    <span className="font-medium">Saldo a Receber:</span>
                    <span className="text-lg font-bold text-primary">{formatCurrency(totalAReceber)}</span>
                  </div>
                </div>

                {/* Show credit/debit info */}
                {formData.valor_pago && diferenca !== 0 && (
                  <div className={`p-3 rounded-lg ${diferenca > 0 ? 'bg-green-50 border border-green-200' : 'bg-orange-50 border border-orange-200'}`}>
                    <div className="flex items-center gap-2">
                      {diferenca > 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-green-600" />
                          <span className="text-sm text-green-700">
                            <strong>Crédito/Vale:</strong> {formatCurrency(diferenca)} será lançado como antecipação
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-4 w-4 text-orange-600" />
                          <span className="text-sm text-orange-700">
                            <strong>Saldo pendente:</strong> {formatCurrency(Math.abs(diferenca))} ficará em aberto
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Form */}
          {!isMultiVendor && (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="valor_pago">Valor a Pagar *</Label>
                <Input
                  id="valor_pago"
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={formData.valor_pago}
                  onChange={(e) => setFormData({ ...formData, valor_pago: e.target.value })}
                  placeholder="Digite o valor"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Saldo: {formatCurrency(totalAReceber)} • Pode pagar mais (gera crédito) ou menos (fica pendente)
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
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
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="data_pagamento">Data *</Label>
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
                <Label htmlFor="observacoes">Observações</Label>
                <Textarea
                  id="observacoes"
                  value={formData.observacoes}
                  onChange={(e) => setFormData({ ...formData, observacoes: e.target.value })}
                  placeholder="Observações do pagamento"
                  rows={2}
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  Cancelar
                </Button>
                <Button 
                  type="submit" 
                  disabled={saving || !formData.forma_pagamento || valorPagoNum <= 0}
                >
                  {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Pagar {formatCurrency(valorPagoNum)}
                </Button>
              </div>
            </form>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
