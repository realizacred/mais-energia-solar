import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { useParcelasData } from "@/hooks/useParcelasManager";
import { toast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip, TooltipContent, TooltipProvider, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Calendar, CheckCircle, AlertTriangle, Clock, Zap, CreditCard,
  Barcode, Receipt, ExternalLink,
} from "lucide-react";
import { Spinner } from "@/components/ui-kit/Spinner";
import { format, addMonths } from "date-fns";
import { ptBR } from "date-fns/locale";
import { formatBRL } from "@/lib/formatters";
import { CobrancaDialog, type CobrancaParcela } from "./CobrancaDialog";
import { PagamentoParcelaDialog } from "./PagamentoParcelaDialog";

interface Parcela {
  id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: string;
  pagamento_id: string | null;
  recebimento_id: string;
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

export function ParcelasManager({ open, onOpenChange, recebimento, onUpdate }: ParcelasManagerProps) {
  const queryClient = useQueryClient();
  const { data: parcelasData, isLoading: loading } = useParcelasData(recebimento.id, open);
  const parcelas = (parcelasData?.parcelas ?? []) as Parcela[];
  const [generating, setGenerating] = useState(false);
  const [cobrancaParcela, setCobrancaParcela] = useState<Parcela | null>(null);
  const [pagamentoParcela, setPagamentoParcela] = useState<Parcela | null>(null);

  // Fetch comprovante_url for paid parcelas
  const [comprovantes, setComprovantes] = useState<Record<string, string>>({});

  // Load comprovantes on open
  useState(() => {
    if (!open || parcelas.length === 0) return;
    const paidIds = parcelas.filter(p => p.pagamento_id).map(p => p.pagamento_id!);
    if (paidIds.length === 0) return;

    supabase
      .from("pagamentos")
      .select("parcela_id, comprovante_url")
      .in("id", paidIds)
      .then(({ data }) => {
        if (!data) return;
        const map: Record<string, string> = {};
        data.forEach((p: any) => {
          if (p.parcela_id && p.comprovante_url) {
            map[p.parcela_id] = p.comprovante_url;
          }
        });
        setComprovantes(map);
      });
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
    } catch {
      toast({ title: "Erro ao gerar parcelas", variant: "destructive" });
    } finally {
      setGenerating(false);
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
                <strong>Pagar parcela:</strong> clique no ícone de pagamento para registrar com detalhes completos.
                Use <strong>"Gerar"</strong> na coluna Cobrança para emitir boleto/PIX via gateway.
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
                    const cob = getCobrancaBadge(parcela);
                    const comprovanteUrl = comprovantes[parcela.id];

                    return (
                      <TableRow key={parcela.id} className={vencida ? "bg-destructive/5" : ""}>
                        <TableCell className="font-medium">
                          {parcela.numero_parcela}/{recebimento.numero_parcelas}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{formatBRL(parcela.valor)}</TableCell>
                        <TableCell>
                          {format(new Date(parcela.data_vencimento), "dd/MM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <Badge variant="outline" className={`${config.color} gap-1`}>
                              {config.icon}
                              {config.label}
                            </Badge>
                            {parcela.status === "paga" && comprovanteUrl && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-6 w-6"
                                    onClick={() => window.open(comprovanteUrl, "_blank")}
                                  >
                                    <ExternalLink className="h-3 w-3 text-muted-foreground" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Ver comprovante</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
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
                            {parcela.status !== "paga" && parcela.status !== "cancelada" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    size="icon"
                                    variant="ghost"
                                    className="h-7 w-7"
                                    onClick={() => setPagamentoParcela(parcela)}
                                  >
                                    <CreditCard className="h-3.5 w-3.5 text-success" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Registrar pagamento manual</TooltipContent>
                              </Tooltip>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
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

        {/* PagamentoParcelaDialog */}
        {pagamentoParcela && (
          <PagamentoParcelaDialog
            open={!!pagamentoParcela}
            onClose={() => {
              setPagamentoParcela(null);
              refreshParcelas();
              onUpdate();
            }}
            parcela={{
              id: pagamentoParcela.id,
              recebimento_id: pagamentoParcela.recebimento_id,
              numero_parcela: pagamentoParcela.numero_parcela,
              valor: pagamentoParcela.valor,
              data_vencimento: pagamentoParcela.data_vencimento,
              status: pagamentoParcela.status,
              cobranca_status: pagamentoParcela.cobranca_status,
            }}
            onSuccess={() => {
              refreshParcelas();
              onUpdate();
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
