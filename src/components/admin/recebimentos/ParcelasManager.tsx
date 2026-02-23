import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar, CheckCircle, AlertTriangle, Clock, Zap, CreditCard,
  Loader2, ExternalLink, Copy, Barcode, QrCode,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Parcela {
  id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: string;
  pagamento_id: string | null;
}

interface ChargeData {
  parcela_id: string;
  gateway_charge_id: string | null;
  gateway_status: string;
  boleto_pdf_url: string | null;
  pix_payload: string | null;
  pix_qr_code_url: string | null;
}

interface Recebimento {
  id: string;
  valor_total: number;
  numero_parcelas: number;
  data_acordo: string;
  clientes?: { nome: string };
}

interface ParcelasManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recebimento: Recebimento;
  onUpdate: () => void;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  pendente: { label: "Pendente", color: "bg-warning/15 text-warning border-warning/20", icon: <Clock className="h-3 w-3" /> },
  paga: { label: "Paga", color: "bg-success/15 text-success border-success/20", icon: <CheckCircle className="h-3 w-3" /> },
  atrasada: { label: "Atrasada", color: "bg-destructive/15 text-destructive border-destructive/20", icon: <AlertTriangle className="h-3 w-3" /> },
  cancelada: { label: "Cancelada", color: "bg-muted text-muted-foreground border-border", icon: null },
  aguardando_pagamento: { label: "Aguardando", color: "bg-info/15 text-info border-info/20", icon: <Barcode className="h-3 w-3" /> },
};

const FORMAS_PAGAMENTO = [
  { value: "pix", label: "PIX" },
  { value: "boleto", label: "Boleto" },
  { value: "dinheiro", label: "Dinheiro" },
  { value: "cartao_credito", label: "Cartão Crédito" },
  { value: "cartao_debito", label: "Cartão Débito" },
  { value: "cheque", label: "Cheque" },
  { value: "financiamento", label: "Financiamento" },
];

const formatCurrency = (value: number) => {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
};

export function ParcelasManager({ open, onOpenChange, recebimento, onUpdate }: ParcelasManagerProps) {
  const [parcelas, setParcelas] = useState<Parcela[]>([]);
  const [charges, setCharges] = useState<Map<string, ChargeData>>(new Map());
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [chargingId, setChargingId] = useState<string | null>(null);
  const [gatewayActive, setGatewayActive] = useState(false);
  const [payForm, setPayForm] = useState({
    forma_pagamento: "pix",
    data_pagamento: new Date().toISOString().split("T")[0],
  });

  useEffect(() => {
    if (open) {
      fetchParcelas();
      checkGateway();
    }
  }, [open, recebimento.id]);

  const checkGateway = async () => {
    try {
      const { data } = await supabase
        .from("payment_gateway_config")
        .select("is_active")
        .eq("provider", "asaas")
        .maybeSingle();
      setGatewayActive(data?.is_active ?? false);
    } catch { /* ignore */ }
  };

  const fetchParcelas = async () => {
    try {
      const { data, error } = await supabase
        .from("parcelas")
        .select("id, numero_parcela, valor, data_vencimento, status, pagamento_id, recebimento_id")
        .eq("recebimento_id", recebimento.id)
        .order("numero_parcela");

      if (error) throw error;
      setParcelas(data || []);

      // Fetch existing charges for these parcelas
      if (data?.length) {
        const ids = data.map((p) => p.id);
        const { data: chargeRows } = await supabase
          .from("payment_gateway_charges")
          .select("parcela_id, gateway_charge_id, gateway_status, boleto_pdf_url, pix_payload, pix_qr_code_url")
          .in("parcela_id", ids);

        const map = new Map<string, ChargeData>();
        chargeRows?.forEach((c) => map.set(c.parcela_id, c as ChargeData));
        setCharges(map);
      }
    } catch (error) {
      console.error("Error fetching parcelas:", error);
      toast({ title: "Erro ao carregar parcelas", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const gerarParcelas = async () => {
    setGenerating(true);
    try {
      await supabase.from("parcelas").delete().eq("recebimento_id", recebimento.id);

      const valorParcela = recebimento.valor_total / recebimento.numero_parcelas;
      const dataBase = new Date(recebimento.data_acordo);

      const novasParcelas = Array.from({ length: recebimento.numero_parcelas }, (_, i) => ({
        recebimento_id: recebimento.id,
        numero_parcela: i + 1,
        valor: Math.round(valorParcela * 100) / 100,
        data_vencimento: format(addMonths(dataBase, i), "yyyy-MM-dd"),
        status: "pendente",
      }));

      const totalCalculado = novasParcelas.reduce((acc, p) => acc + p.valor, 0);
      const diferenca = recebimento.valor_total - totalCalculado;
      novasParcelas[novasParcelas.length - 1].valor += diferenca;

      const { error } = await supabase.from("parcelas").insert(novasParcelas);
      if (error) throw error;

      toast({ title: `${recebimento.numero_parcelas} parcelas geradas!` });
      fetchParcelas();
      onUpdate();
    } catch (error) {
      console.error("Error generating parcelas:", error);
      toast({ title: "Erro ao gerar parcelas", variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  const marcarComoPaga = async (parcela: Parcela) => {
    try {
      const { data: pagamento, error: pagErr } = await supabase
        .from("pagamentos")
        .insert({
          recebimento_id: recebimento.id,
          valor_pago: parcela.valor,
          forma_pagamento: payForm.forma_pagamento,
          data_pagamento: payForm.data_pagamento,
          observacoes: `Parcela ${parcela.numero_parcela}/${recebimento.numero_parcelas}`,
        })
        .select("id")
        .single();

      if (pagErr) throw pagErr;

      const { error: parcErr } = await supabase
        .from("parcelas")
        .update({ status: "paga", pagamento_id: pagamento.id })
        .eq("id", parcela.id);

      if (parcErr) throw parcErr;

      toast({ title: `Parcela ${parcela.numero_parcela} paga!` });
      setPayingId(null);
      fetchParcelas();
      onUpdate();
    } catch (error) {
      console.error("Error updating parcela:", error);
      toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
    }
  };

  // ── Asaas charge generation ──
  const gerarCobranca = async (parcela: Parcela) => {
    setChargingId(parcela.id);
    try {
      const { data, error } = await supabase.functions.invoke("asaas-create-charge", {
        body: { parcela_id: parcela.id },
      });

      if (error) throw error;

      if (data?.error) {
        toast({ title: "Erro ao gerar cobrança", description: data.error, variant: "destructive" });
        return;
      }

      toast({ title: data.already_exists ? "Cobrança já existente recuperada ✅" : "Cobrança gerada com sucesso! ✅" });
      fetchParcelas(); // Refresh charges
    } catch (err: any) {
      console.error("Error creating charge:", err);
      toast({ title: "Erro ao gerar cobrança", description: err.message, variant: "destructive" });
    } finally {
      setChargingId(null);
    }
  };

  const copyPix = (payload: string) => {
    navigator.clipboard.writeText(payload);
    toast({ title: "Código Pix copiado! 📋" });
  };

  const isVencida = (dataVencimento: string, status: string) => {
    return status === "pendente" && new Date(dataVencimento) < new Date();
  };

  const totalPago = parcelas.filter((p) => p.status === "paga").reduce((acc, p) => acc + p.valor, 0);
  const totalPendente = parcelas.filter((p) => p.status !== "paga" && p.status !== "cancelada").reduce((acc, p) => acc + p.valor, 0);

  const canCharge = (p: Parcela) =>
    gatewayActive && p.status !== "paga" && p.status !== "cancelada" && !charges.get(p.id)?.gateway_charge_id;

  const hasCharge = (p: Parcela) => !!charges.get(p.id)?.gateway_charge_id;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Parcelas - {recebimento.clientes?.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {recebimento.numero_parcelas}x de {formatCurrency(recebimento.valor_total / recebimento.numero_parcelas)}
              {parcelas.length > 0 && (
                <span className="ml-2">
                  · Pago: <strong className="text-success">{formatCurrency(totalPago)}</strong>
                  · Pendente: <strong className="text-warning">{formatCurrency(totalPendente)}</strong>
                </span>
              )}
            </div>
            <Button onClick={gerarParcelas} disabled={generating} variant="outline" className="gap-2">
              {generating && <Spinner size="sm" />}
              {parcelas.length > 0 ? "Regenerar Parcelas" : "Gerar Parcelas"}
            </Button>
          </div>

          {parcelas.length > 0 && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-info/10 border border-info/20">
              <Zap className="h-4 w-4 text-info mt-0.5 shrink-0" />
              <p className="text-xs text-info">
                <strong>Pagar parcela individual:</strong> clique no ícone de pagamento para registrar.
                {gatewayActive && (
                  <> Use <strong>Gerar Boleto/Pix</strong> para emitir cobrança automática via Asaas.</>
                )}
              </p>
            </div>
          )}

          {loading ? (
            <div className="flex justify-center py-8">
              <Spinner size="md" />
            </div>
          ) : parcelas.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhuma parcela gerada</p>
              <p className="text-sm">Clique em "Gerar Parcelas" para criar</p>
            </div>
          ) : (
            <TooltipProvider>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="w-40 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcelas.map((parcela) => {
                    const vencida = isVencida(parcela.data_vencimento, parcela.status);
                    const config = vencida
                      ? STATUS_CONFIG.atrasada
                      : STATUS_CONFIG[parcela.status] || STATUS_CONFIG.pendente;
                    const isPaying = payingId === parcela.id;
                    const isCharging = chargingId === parcela.id;
                    const charge = charges.get(parcela.id);

                    return (
                      <>
                        <TableRow key={parcela.id} className={vencida ? "bg-destructive/5" : ""}>
                          <TableCell className="font-medium">
                            {parcela.numero_parcela}/{recebimento.numero_parcelas}
                          </TableCell>
                          <TableCell>{formatCurrency(parcela.valor)}</TableCell>
                          <TableCell>
                            {format(new Date(parcela.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline" className={`${config.color} gap-1`}>
                              {config.icon}
                              {config.label}
                            </Badge>
                            {parcela.pagamento_id && parcela.status === "paga" && (
                              <Badge variant="outline" className="ml-1 text-[10px]">Vinculado</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
                              {/* Quick actions for existing charges */}
                              {hasCharge(parcela) && charge && (
                                <>
                                  {charge.boleto_pdf_url && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          asChild
                                        >
                                          <a href={charge.boleto_pdf_url} target="_blank" rel="noopener noreferrer">
                                            <ExternalLink className="h-3.5 w-3.5 text-primary" />
                                          </a>
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Ver Boleto PDF</TooltipContent>
                                    </Tooltip>
                                  )}
                                  {charge.pix_payload && (
                                    <Tooltip>
                                      <TooltipTrigger asChild>
                                        <Button
                                          size="icon"
                                          variant="ghost"
                                          className="h-7 w-7"
                                          onClick={() => copyPix(charge.pix_payload!)}
                                        >
                                          <QrCode className="h-3.5 w-3.5 text-primary" />
                                        </Button>
                                      </TooltipTrigger>
                                      <TooltipContent>Copiar Pix</TooltipContent>
                                    </Tooltip>
                                  )}
                                </>
                              )}

                              {/* Generate charge button */}
                              {canCharge(parcela) && (
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="h-7 gap-1 text-xs"
                                      disabled={isCharging}
                                      onClick={() => gerarCobranca(parcela)}
                                    >
                                      {isCharging ? (
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                      ) : (
                                        <Barcode className="h-3 w-3" />
                                      )}
                                      Cobrar
                                    </Button>
                                  </TooltipTrigger>
                                  <TooltipContent>Gerar Boleto/Pix via Asaas</TooltipContent>
                                </Tooltip>
                              )}

                              {/* Manual payment */}
                              {parcela.status !== "paga" && parcela.status !== "cancelada" && (
                                isPaying ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-muted-foreground text-xs"
                                    onClick={() => setPayingId(null)}
                                  >
                                    Cancelar
                                  </Button>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button
                                        size="icon"
                                        variant="ghost"
                                        className="h-7 w-7"
                                        onClick={() => setPayingId(parcela.id)}
                                      >
                                        <CreditCard className="h-3.5 w-3.5 text-success" />
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>Registrar pagamento manual</TooltipContent>
                                  </Tooltip>
                                )
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                        {/* Inline payment form */}
                        {isPaying && (
                          <TableRow key={`${parcela.id}-pay`}>
                            <TableCell colSpan={5}>
                              <div className="flex items-end gap-3 p-2 bg-muted/50 rounded-lg">
                                <div className="space-y-1">
                                  <Label className="text-xs">Forma</Label>
                                  <Select
                                    value={payForm.forma_pagamento}
                                    onValueChange={(v) => setPayForm((prev) => ({ ...prev, forma_pagamento: v }))}
                                  >
                                    <SelectTrigger className="h-8 w-36 text-xs">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      {FORMAS_PAGAMENTO.map((f) => (
                                        <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                                <div className="space-y-1">
                                  <Label className="text-xs">Data</Label>
                                  <Input
                                    type="date"
                                    className="h-8 w-36 text-xs"
                                    value={payForm.data_pagamento}
                                    onChange={(e) => setPayForm((prev) => ({ ...prev, data_pagamento: e.target.value }))}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="h-8 gap-1"
                                  onClick={() => marcarComoPaga(parcela)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Confirmar {formatCurrency(parcela.valor)}
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                </TableBody>
              </Table>
            </TooltipProvider>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
