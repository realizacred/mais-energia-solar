import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useParcelasData } from "@/hooks/useParcelasManager";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui-kit/inputs/DateInput";
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
  Loader2, ExternalLink, Copy, Barcode, QrCode, Receipt,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/formatters";
import { CobrancaDialog, type CobrancaParcela } from "./CobrancaDialog";

interface Parcela {
  id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: string;
  pagamento_id: string | null;
  cobranca_status: string | null;
  cobranca_id: string | null;
  cobranca_gateway: string | null;
  boleto_url: string | null;
  boleto_linha_digitavel: string | null;
  boleto_codigo_barras: string | null;
  pix_qr_code: string | null;
  pix_copia_cola: string | null;
  cobranca_valor_original: number | null;
  cobranca_valor_cobrado: number | null;
  cobranca_multa_aplicada: number | null;
  cobranca_juros_aplicado: number | null;
  cobranca_paga_em: string | null;
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

export function ParcelasManager({ open, onOpenChange, recebimento, onUpdate }: ParcelasManagerProps) {
  const queryClient = useQueryClient();
  const { data: parcelasData, isLoading: loading } = useParcelasData(recebimento.id, open);
  const parcelas = parcelasData?.parcelas ?? [];
  const [generating, setGenerating] = useState(false);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [cobrancaParcela, setCobrancaParcela] = useState<Parcela | null>(null);
  const [payForm, setPayForm] = useState({
    forma_pagamento: "pix",
    data_pagamento: new Date().toISOString().split("T")[0],
  });

  const refreshParcelas = () => {
    queryClient.invalidateQueries({ queryKey: ["parcelas-manager", recebimento.id] });
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
      refreshParcelas();
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
      refreshParcelas();
      onUpdate();
    } catch (error) {
      console.error("Error updating parcela:", error);
      toast({ title: "Erro ao registrar pagamento", variant: "destructive" });
    }
  };

  const isVencida = (dataVencimento: string, status: string) => {
    return status === "pendente" && new Date(dataVencimento) < new Date();
  };

  const totalPago = parcelas.filter((p) => p.status === "paga").reduce((acc, p) => acc + p.valor, 0);
  const totalPendente = parcelas.filter((p) => p.status !== "paga" && p.status !== "cancelada").reduce((acc, p) => acc + p.valor, 0);

  const getCobrancaBadge = (p: Parcela) => {
    const cs = p.cobranca_status;
    if (cs === "pago") return { label: `Pago via ${p.cobranca_gateway || "gateway"}`, variant: "bg-success/10 text-success border-success/20" as const, icon: <CheckCircle className="h-3 w-3" /> };
    if (cs === "gerada") return { label: "Gerada", variant: "bg-info/10 text-info border-info/20" as const, icon: <Receipt className="h-3 w-3" /> };
    return { label: "Sem cobrança", variant: "bg-muted text-muted-foreground border-border" as const, icon: null };
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Parcelas - {recebimento.clientes?.nome}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="text-sm text-muted-foreground">
              {recebimento.numero_parcelas}x de {formatBRL(recebimento.valor_total / recebimento.numero_parcelas)}
              {parcelas.length > 0 && (
                <span className="ml-2">
                  · Pago: <strong className="text-success">{formatBRL(totalPago)}</strong>
                  · Pendente: <strong className="text-warning">{formatBRL(totalPendente)}</strong>
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
                Use <strong>"Gerar"</strong> na coluna Cobrança para emitir boleto/PIX.
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
              <div className="rounded-lg border border-border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead>Parcela</TableHead>
                    <TableHead>Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Cobrança</TableHead>
                    <TableHead className="w-28 text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parcelas.map((parcela) => {
                    const vencida = isVencida(parcela.data_vencimento, parcela.status);
                    const config = vencida
                      ? STATUS_CONFIG.atrasada
                      : STATUS_CONFIG[parcela.status] || STATUS_CONFIG.pendente;
                    const isPaying = payingId === parcela.id;
                    const cob = getCobrancaBadge(parcela);

                    return (
                      <>
                        <TableRow key={parcela.id} className={vencida ? "bg-destructive/5" : ""}>
                          <TableCell className="font-medium">
                            {parcela.numero_parcela}/{recebimento.numero_parcelas}
                          </TableCell>
                          <TableCell className="font-mono text-sm">{formatBRL(parcela.valor)}</TableCell>
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
                            <div className="flex items-center gap-1.5">
                              <Badge variant="outline" className={`${cob.variant} gap-1 text-[10px]`}>
                                {cob.icon}
                                {cob.label}
                              </Badge>
                              {parcela.status !== "paga" && parcela.status !== "cancelada" && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-6 px-2 text-[10px]"
                                  onClick={() => setCobrancaParcela(parcela)}
                                >
                                  {parcela.cobranca_status === "gerada" ? "Ver QR/Boleto" : "Gerar"}
                                </Button>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center justify-end gap-1">
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
                            <TableCell colSpan={6}>
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
                                  <DateInput
                                    className="h-8 w-36 text-xs"
                                    value={payForm.data_pagamento}
                                    onChange={(v) => setPayForm((prev) => ({ ...prev, data_pagamento: v }))}
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  className="h-8 gap-1"
                                  onClick={() => marcarComoPaga(parcela)}
                                >
                                  <CheckCircle className="h-3.5 w-3.5" />
                                  Confirmar {formatBRL(parcela.valor)}
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
              </div>
            </TooltipProvider>
          )}
        </div>

        {/* CobrancaDialog */}
        {cobrancaParcela && (
          <CobrancaDialog
            parcela={cobrancaParcela as CobrancaParcela}
            open={!!cobrancaParcela}
            onClose={() => {
              setCobrancaParcela(null);
              refreshParcelas();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
