import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DollarSign, AlertTriangle, TrendingUp, TrendingDown, Upload, X } from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { getCurrentTenantId, tenantPath } from "@/lib/storagePaths";

interface Comissao {
  id: string;
  consultor_id: string;
  descricao: string;
  valor_comissao: number;
  consultores?: { nome: string };
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
  const [comprovanteFile, setComprovanteFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [formData, setFormData] = useState({
    forma_pagamento: "",
    data_pagamento: new Date().toISOString().split("T")[0],
    valor_pago: "",
    observacoes: "",
  });

  // Check if all commissions are from the same vendor
  const vendedorIds = [...new Set(comissoes.map(c => c.consultor_id))];
  const isMultiVendor = vendedorIds.length > 1;
  const vendedorNome = comissoes[0]?.consultores?.nome || "Desconhecido";

  // Calculate totals
  const calcularSaldoRestante = (comissao: Comissao) => {
    const totalPago = comissao.pagamentos_comissao?.reduce((acc, p) => acc + p.valor_pago, 0) || 0;
    return Math.max(0, comissao.valor_comissao - totalPago);
  };

  const totalAReceber = comissoes.reduce((acc, c) => acc + calcularSaldoRestante(c), 0);
  
  // Custom payment amount
  const valorPagoNum = formData.valor_pago ? parseFloat(formData.valor_pago) : totalAReceber;
  const diferenca = valorPagoNum - totalAReceber;
  
  // Reset when dialog opens
  useEffect(() => {
    if (open) {
      setFormData(prev => ({
        ...prev,
        valor_pago: totalAReceber.toFixed(2),
      }));
      setComprovanteFile(null);
    }
  }, [open, totalAReceber]);

  const uploadComprovante = async (): Promise<string | null> => {
    if (!comprovanteFile) return null;
    setUploading(true);
    try {
      const tid = await getCurrentTenantId();
      if (!tid) throw new Error("Tenant não encontrado");
      const ext = comprovanteFile.name.split(".").pop()?.toLowerCase() || "pdf";
      const fileName = tenantPath(tid, "comissoes", `${Date.now()}.${ext}`);
      const { error: uploadError } = await supabase.storage
        .from("comprovantes")
        .upload(fileName, comprovanteFile, { cacheControl: "3600", upsert: false });
      if (uploadError) throw uploadError;
      const { data: signedData } = await supabase.storage
        .from("comprovantes")
        .createSignedUrl(fileName, 86400 * 365);
      return signedData?.signedUrl || null;
    } finally {
      setUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (isMultiVendor) {
      toast({ 
        title: "Pagamento em lote apenas para mesmo consultor", 
        description: "Selecione comissões de um único consultor",
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
      // Upload comprovante if present
      const comprovanteUrl = await uploadComprovante();

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
          comprovante_url: comprovanteUrl,
        }))
      );

      if (error) throw error;

      // Update status of fully paid commissions
      for (const comissao of comissoesOrdenadas) {
        const payment = payments.find(p => p.comissao_id === comissao.id);
        if (payment && payment.valor_pago >= comissao.saldo) {
          await supabase
            .from("comissoes")
            .update({ status: "pago", updated_at: new Date().toISOString() })
            .eq("id", comissao.id);
        } else if (payment) {
          await supabase
            .from("comissoes")
            .update({ status: "parcial", updated_at: new Date().toISOString() })
            .eq("id", comissao.id);
        }
      }

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
      <DialogContent className="w-[90vw] max-w-lg p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <DollarSign className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Pagamento em Lote
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Registre pagamento para comissões selecionadas
            </p>
          </div>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-y-auto p-5 space-y-4">
          {/* Multi-vendor warning */}
          {isMultiVendor && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Não é possível pagar comissões de consultores diferentes em lote. 
                Selecione apenas comissões de <strong>um consultor</strong>.
              </AlertDescription>
            </Alert>
          )}

          {/* Summary */}
          <Card>
            <CardContent className="pt-4">
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                   <span className="text-sm text-muted-foreground">Consultor:</span>
                  <Badge variant={isMultiVendor ? "destructive" : "default"}>
                    {isMultiVendor ? `${vendedorIds.length} consultores diferentes` : vendedorNome}
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
                  <div className={`p-3 rounded-lg ${diferenca > 0 ? 'bg-success/10 border border-success/30' : 'bg-warning/10 border border-warning/30'}`}>
                    <div className="flex items-center gap-2">
                      {diferenca > 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-success" />
                          <span className="text-sm text-success">
                            <strong>Crédito/Vale:</strong> {formatCurrency(diferenca)} será lançado como antecipação
                          </span>
                        </>
                      ) : (
                        <>
                          <TrendingDown className="h-4 w-4 text-warning" />
                          <span className="text-sm text-warning">
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
            <form id="bulk-payment-form" onSubmit={handleSubmit} className="space-y-4">
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

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                  <DateInput
                    value={formData.data_pagamento}
                    onChange={(v) => setFormData({ ...formData, data_pagamento: v })}
                  />
                </div>
              </div>

              {/* Comprovante upload */}
              <div className="space-y-2">
                <Label>Comprovante (opcional)</Label>
                {comprovanteFile ? (
                  <div className="flex items-center gap-2 p-2 rounded-lg border border-border bg-muted/30">
                    <Upload className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-sm text-foreground truncate flex-1">{comprovanteFile.name}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 w-7 p-0 shrink-0"
                      onClick={() => {
                        setComprovanteFile(null);
                        if (fileInputRef.current) fileInputRef.current.value = "";
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full gap-2"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="h-4 w-4" />
                    Anexar comprovante
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setComprovanteFile(file);
                  }}
                />
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
            </form>
          )}
        </div>

        {!isMultiVendor && (
          <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>
              Cancelar
            </Button>
            <Button 
              type="submit"
              form="bulk-payment-form"
              disabled={saving || uploading || !formData.forma_pagamento || valorPagoNum <= 0}
            >
              {(saving || uploading) && <Spinner size="sm" className="mr-2" />}
              Pagar {formatCurrency(valorPagoNum)}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
