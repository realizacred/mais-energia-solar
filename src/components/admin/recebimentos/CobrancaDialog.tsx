import { useState } from "react";
import { useGerarCobranca } from "@/hooks/useGerarCobranca";
import { useTenantPremises } from "@/hooks/useTenantPremises";
import { formatBRL } from "@/lib/formatters";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertTriangle, Barcode, CheckCircle, Copy, ExternalLink,
  Loader2, QrCode, Receipt,
} from "lucide-react";

export interface CobrancaParcela {
  id: string;
  numero_parcela: number;
  valor: number;
  data_vencimento: string;
  status: string;
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

interface Props {
  parcela: CobrancaParcela;
  open: boolean;
  onClose: () => void;
}

const GATEWAYS = [
  { value: "pagseguro", label: "PagSeguro" },
  { value: "asaas", label: "Asaas" },
];

export function CobrancaDialog({ parcela, open, onClose }: Props) {
  const { premises } = useTenantPremises();
  const gerarMutation = useGerarCobranca();
  const [gateway, setGateway] = useState(premises.gateway_preferido || "pagseguro");

  const diasAtraso = Math.max(
    0,
    Math.floor((Date.now() - new Date(parcela.data_vencimento).getTime()) / 86_400_000)
  );
  const isAtrasada = diasAtraso > 0 && parcela.status !== "paga";
  const multaPrev = isAtrasada ? parcela.valor * (premises.cobranca_multa_percentual / 100) : 0;
  const jurosPrev = isAtrasada ? parcela.valor * (premises.cobranca_juros_percentual / 100) * (diasAtraso / 30) : 0;

  const status = parcela.cobranca_status;

  const handleGerar = () => {
    gerarMutation.mutate(
      { parcela_id: parcela.id, gateway: gateway as any },
      { onSuccess: () => onClose() }
    );
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copiado!`);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="w-[90vw] max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary/10 shrink-0">
              <Receipt className="w-5 h-5 text-primary" />
            </div>
            <div>
              <DialogTitle>Cobrança — Parcela {parcela.numero_parcela}</DialogTitle>
              <DialogDescription>
                Valor: {formatBRL(parcela.valor)} · Venc: {new Date(parcela.data_vencimento).toLocaleDateString("pt-BR")}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* ── PAGO ── */}
        {status === "pago" && (
          <div className="flex flex-col items-center gap-3 py-6">
            <Badge variant="outline" className="bg-success/10 text-success border-success/20 gap-1 text-sm px-4 py-1.5">
              <CheckCircle className="h-4 w-4" />
              Pago
            </Badge>
            {parcela.cobranca_paga_em && (
              <p className="text-sm text-muted-foreground">
                Pago em {new Date(parcela.cobranca_paga_em).toLocaleDateString("pt-BR")}
              </p>
            )}
          </div>
        )}

        {/* ── NÃO GERADA ── */}
        {(!status || status === "nao_gerada") && (
          <div className="space-y-4">
            {isAtrasada && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-warning/10 border border-warning/20">
                <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
                <div className="text-sm text-warning">
                  <strong>Parcela com {diasAtraso} dias de atraso</strong>
                  <p className="text-xs mt-1">
                    Multa prevista: {formatBRL(multaPrev)} ({premises.cobranca_multa_percentual}%)
                    · Juros previsto: {formatBRL(jurosPrev)} ({premises.cobranca_juros_percentual}%/mês)
                  </p>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Gateway de pagamento</label>
              <Select value={gateway} onValueChange={setGateway}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {GATEWAYS.map((g) => (
                    <SelectItem key={g.value} value={g.value}>{g.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleGerar}
              disabled={gerarMutation.isPending}
            >
              {gerarMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Barcode className="h-4 w-4" />
              )}
              Gerar Cobrança
            </Button>
          </div>
        )}

        {/* ── GERADA ── */}
        {status === "gerada" && (
          <div className="space-y-5">
            {/* PIX */}
            {(parcela.pix_qr_code || parcela.pix_copia_cola) && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <QrCode className="h-4 w-4 text-primary" />
                  PIX
                </h4>
                {parcela.pix_qr_code && (
                  <div className="flex justify-center p-4 bg-muted/30 rounded-lg">
                    <img
                      src={parcela.pix_qr_code}
                      alt="QR Code PIX"
                      className="w-48 h-48 object-contain"
                    />
                  </div>
                )}
                {parcela.pix_copia_cola && (
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={parcela.pix_copia_cola}
                      className="text-xs font-mono"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => copyToClipboard(parcela.pix_copia_cola!, "PIX")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            )}

            {/* Boleto */}
            {(parcela.boleto_url || parcela.boleto_linha_digitavel) && (
              <div className="space-y-3">
                <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Barcode className="h-4 w-4 text-primary" />
                  Boleto
                </h4>
                {parcela.boleto_linha_digitavel && (
                  <div className="flex gap-2">
                    <Input
                      readOnly
                      value={parcela.boleto_linha_digitavel}
                      className="text-xs font-mono"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      onClick={() => copyToClipboard(parcela.boleto_linha_digitavel!, "Linha digitável")}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                )}
                {parcela.boleto_url && (
                  <Button variant="outline" className="w-full gap-2" asChild>
                    <a href={parcela.boleto_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4" />
                      Abrir boleto PDF
                    </a>
                  </Button>
                )}
                {parcela.boleto_codigo_barras && (
                  <p className="text-xs text-muted-foreground font-mono break-all">
                    {parcela.boleto_codigo_barras}
                  </p>
                )}
              </div>
            )}

            {/* Valores */}
            <div className="space-y-2 p-4 bg-muted/30 rounded-lg">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">Valor original</span>
                <span className="font-mono text-foreground">{formatBRL(parcela.cobranca_valor_original)}</span>
              </div>
              {(parcela.cobranca_multa_aplicada ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Multa</span>
                  <span className="font-mono text-warning">{formatBRL(parcela.cobranca_multa_aplicada)}</span>
                </div>
              )}
              {(parcela.cobranca_juros_aplicado ?? 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Juros</span>
                  <span className="font-mono text-warning">{formatBRL(parcela.cobranca_juros_aplicado)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold border-t border-border pt-2 mt-2">
                <span className="text-foreground">Valor cobrado</span>
                <span className="font-mono text-foreground">{formatBRL(parcela.cobranca_valor_cobrado)}</span>
              </div>
            </div>

            {/* Regerar */}
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleGerar}
              disabled={gerarMutation.isPending}
            >
              {gerarMutation.isPending && <Loader2 className="h-3 w-3 animate-spin" />}
              Regerar cobrança
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
