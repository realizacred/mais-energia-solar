import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  SunMedium, Zap, DollarSign, TrendingUp, CreditCard, Calendar, MapPin,
} from "lucide-react";

export interface ProposalClientSummaryData {
  clienteNome: string;
  empresaNome?: string;
  cidade: string;
  estado: string;
  potenciaKwp: number;
  geracaoMensalKwh: number;
  economiaMensal?: number;
  precoFinal: number;
  paybackAnos?: number;
  paybackMeses?: number;
  moduloDescricao?: string;
  moduloQuantidade?: number;
  inversorDescricao?: string;
  validade?: string;
  pagamentoOpcoes?: Array<{
    nome: string;
    tipo: string;
    num_parcelas: number;
    valor_parcela: number;
    entrada: number;
  }>;
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

/**
 * Reusable commercial summary for the client.
 * Can be used in: ProposalDetail, public page, PDF preview.
 */
export function ProposalClientSummary({ data }: { data: ProposalClientSummaryData }) {
  const potKwp = Number(data.potenciaKwp) || 0;
  const precoF = Number(data.precoFinal) || 0;
  const custoWp = potKwp > 0
    ? (precoF / potKwp / 1000).toFixed(2)
    : null;

  return (
    <div className="space-y-4">
      {/* Hero card */}
      <Card className="bg-gradient-to-br from-primary/5 via-card to-card border-primary/20 shadow-sm overflow-hidden">
        <CardContent className="p-5 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <SunMedium className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              Proposta Solar
            </h2>
          </div>
          <p className="text-sm text-muted-foreground mb-1">
            {data.empresaNome || data.clienteNome}
          </p>
          {data.cidade && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3" />
              {data.cidade}, {data.estado}
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
              <Zap className="h-3.5 w-3.5" />
              Sistema
            </div>
            <p className="text-xl font-bold text-foreground">{potKwp.toFixed(2)} kWp</p>
            {data.moduloQuantidade && data.moduloQuantidade > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {data.moduloQuantidade} módulos
              </p>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
              <SunMedium className="h-3.5 w-3.5" />
              Geração/mês
            </div>
            <p className="text-xl font-bold text-foreground">
              {Math.round(data.geracaoMensalKwh).toLocaleString("pt-BR")} kWh
            </p>
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
              <DollarSign className="h-3.5 w-3.5" />
              Investimento
            </div>
            <p className="text-xl font-bold text-foreground">{formatBRL(data.precoFinal)}</p>
            {custoWp && (
              <p className="text-[10px] text-muted-foreground mt-0.5">R$ {custoWp}/Wp</p>
            )}
          </CardContent>
        </Card>

        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-1.5 text-muted-foreground text-xs mb-1">
              <TrendingUp className="h-3.5 w-3.5" />
              Retorno
            </div>
            <p className="text-xl font-bold text-foreground">
              {data.paybackAnos != null
                ? `${(Number(data.paybackAnos) || 0).toFixed(1)} anos`
                : data.paybackMeses != null
                ? `${Math.round((Number(data.paybackMeses) || 0) / 12 * 10) / 10} anos`
                : "—"}
            </p>
            {data.economiaMensal != null && data.economiaMensal > 0 && (
              <p className="text-[10px] text-muted-foreground mt-0.5">
                Economia: {formatBRL(data.economiaMensal)}/mês
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Equipment summary */}
      {(data.moduloDescricao || data.inversorDescricao) && (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-4">
            <h3 className="text-sm font-bold text-foreground mb-3">Equipamentos</h3>
            <div className="space-y-2 text-sm">
              {data.moduloDescricao && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Módulo</span>
                  <span className="font-medium text-foreground text-right max-w-[60%] truncate">
                    {data.moduloDescricao}
                  </span>
                </div>
              )}
              {data.inversorDescricao && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Inversor</span>
                  <span className="font-medium text-foreground text-right max-w-[60%] truncate">
                    {data.inversorDescricao}
                  </span>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Payment options */}
      {data.pagamentoOpcoes && data.pagamentoOpcoes.length > 0 && (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <CreditCard className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-bold text-foreground">Formas de Pagamento</h3>
            </div>
            <div className="space-y-2">
              {data.pagamentoOpcoes.map((op, i) => (
                <div key={i} className="rounded-lg border border-border/50 p-3 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-foreground">{op.nome}</span>
                    <Badge variant="outline" className="text-[9px] capitalize">{op.tipo.replace("_", " ")}</Badge>
                  </div>
                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground mt-1">
                    {op.entrada > 0 && <span>Entrada: {formatBRL(op.entrada)}</span>}
                    {op.num_parcelas > 0 && <span>{op.num_parcelas}× {formatBRL(op.valor_parcela)}</span>}
                    {op.tipo === "a_vista" && <span>{formatBRL(data.precoFinal)}</span>}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Validity */}
      {data.validade && (
        <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground">
          <Calendar className="h-3 w-3" />
          <span>Válida até {data.validade}</span>
        </div>
      )}
    </div>
  );
}
