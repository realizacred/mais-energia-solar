import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  MapPin, User, Zap, Package, Box, Wrench, DollarSign, CreditCard,
  SunMedium, TrendingUp, Phone, Mail, Building2, Percent,
  Banknote, Clock, ArrowDown, ChevronDown, ChevronRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface StepResumoProps {
  // Location
  estado: string;
  cidade: string;
  tipoTelhado: string;
  distribuidoraNome: string;
  irradiacao: number;
  // Client
  clienteNome: string;
  clienteCelular?: string;
  clienteEmail?: string;
  clienteEmpresa?: string;
  leadNome?: string;
  // System
  potenciaKwp: number;
  consumoTotal: number;
  geracaoMensalKwh: number;
  numUcs: number;
  grupo: string;
  // Kit
  itens: Array<{ descricao: string; quantidade: number; preco_unitario: number; categoria: string }>;
  // Adicionais
  adicionais: Array<{ descricao: string; quantidade: number; preco_unitario: number }>;
  // Servicos
  servicos: Array<{ descricao: string; valor: number; incluso_no_preco: boolean }>;
  // Venda
  precoFinal: number;
  margemPercentual: number;
  custoComissao: number;
  descontoPercentual: number;
  // Pagamento
  pagamentoOpcoes: Array<{
    nome: string;
    tipo: string;
    num_parcelas: number;
    valor_parcela: number;
    entrada: number;
    taxa_mensal?: number;
    valor_financiado?: number;
    carencia_meses?: number;
  }>;
}

function formatBRL(v: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);
}

function SectionHeader({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h3 className="text-sm font-bold text-foreground">{label}</h3>
    </div>
  );
}

function getTipoLabel(tipo: string): string {
  switch (tipo) {
    case "a_vista": return "À Vista";
    case "financiamento": return "Financiamento";
    case "parcelado": return "Parcelado";
    default: return tipo.replace(/_/g, " ");
  }
}

function getTipoBadgeColor(tipo: string): string {
  switch (tipo) {
    case "a_vista": return "bg-success/10 text-success border-success/20";
    case "financiamento": return "bg-info/10 text-info border-info/20";
    case "parcelado": return "bg-warning/10 text-warning border-warning/20";
    default: return "";
  }
}

export function StepResumo({
  estado, cidade, tipoTelhado, distribuidoraNome, irradiacao,
  clienteNome, clienteCelular, clienteEmail, clienteEmpresa, leadNome,
  potenciaKwp, consumoTotal, geracaoMensalKwh, numUcs, grupo,
  itens, adicionais, servicos,
  precoFinal, margemPercentual, custoComissao, descontoPercentual,
  pagamentoOpcoes,
}: StepResumoProps) {
  const custoKit = itens.reduce((s, i) => s + (i.quantidade * i.preco_unitario), 0);
  const custoAdicionais = adicionais.reduce((s, i) => s + (i.quantidade * i.preco_unitario), 0);
  const custoServicos = servicos.reduce((s, i) => s + i.valor, 0);

  return (
    <div className="space-y-4">
      {/* Top KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="border-l-[3px] border-l-primary bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Zap className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{(Number(potenciaKwp) || 0).toFixed(2)} kWp</p>
              <p className="text-[10px] text-muted-foreground">Potência</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-9 w-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <SunMedium className="h-4 w-4 text-success" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{geracaoMensalKwh.toLocaleString("pt-BR")} kWh</p>
              <p className="text-[10px] text-muted-foreground">Geração/mês</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-warning bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <DollarSign className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">{formatBRL(precoFinal)}</p>
              <p className="text-[10px] text-muted-foreground">Investimento</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info bg-card shadow-sm">
          <CardContent className="flex items-center gap-3 p-4">
            <div className="h-9 w-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
              <TrendingUp className="h-4 w-4 text-info" />
            </div>
            <div>
              <p className="text-lg font-bold text-foreground leading-none">
                {(Number(potenciaKwp) || 0) > 0 ? `R$ ${((Number(precoFinal) || 0) / (Number(potenciaKwp) || 1) / 1000).toFixed(2)}/Wp` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">Custo/Wp</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Client + Location side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Client — FIRST */}
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-4">
            <SectionHeader icon={User} label="Cliente" />
            <div className="grid grid-cols-[auto_1fr] gap-y-2.5 gap-x-6 text-sm">
              <span className="text-muted-foreground">Nome</span>
              <span className="font-medium text-foreground">{clienteNome || leadNome || "—"}</span>
              <span className="text-muted-foreground">Empresa</span>
              <span className="font-medium text-foreground">{clienteEmpresa || "—"}</span>
              <span className="text-muted-foreground">Telefone</span>
              <span className="font-medium text-foreground">{clienteCelular || "—"}</span>
              <span className="text-muted-foreground">E-mail</span>
              <span className="font-medium text-foreground">{clienteEmail || "—"}</span>
              <span className="text-muted-foreground">Grupo</span>
              <span className="font-medium text-foreground">{grupo || "—"}</span>
              <span className="text-muted-foreground">UCs</span>
              <span className="font-medium text-foreground">{numUcs}</span>
              <span className="text-muted-foreground">Consumo</span>
              <span className="font-medium text-foreground">{consumoTotal > 0 ? `${consumoTotal.toLocaleString("pt-BR")} kWh` : "—"}</span>
            </div>
          </CardContent>
        </Card>

        {/* Location — SECOND */}
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-4">
            <SectionHeader icon={MapPin} label="Localização" />
            <div className="grid grid-cols-[auto_1fr] gap-y-2.5 gap-x-6 text-sm">
              <span className="text-muted-foreground">Estado</span>
              <span className="font-medium text-foreground">{estado || "—"}</span>
              <span className="text-muted-foreground">Cidade</span>
              <span className="font-medium text-foreground">{cidade || "—"}</span>
              <span className="text-muted-foreground">Telhado</span>
              <span className="font-medium text-foreground">{tipoTelhado || "—"}</span>
              <span className="text-muted-foreground">Distribuidora</span>
              <span className="font-medium text-foreground">{distribuidoraNome || "—"}</span>
              <span className="text-muted-foreground">Irradiação</span>
              <span className="font-medium text-foreground">{(Number(irradiacao) || 0) > 0 ? `${(Number(irradiacao) || 0).toFixed(2)} kWh/m²/dia` : "—"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Kit */}
          <Card className="border-border/40 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={Package} label="Kit Gerador" />
              {itens.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum item no kit</p>
              ) : (
                <div className="space-y-1.5">
                  {itens.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <Badge variant="outline" className="text-[9px] shrink-0 capitalize">{item.categoria}</Badge>
                        <span className="truncate text-foreground">{item.descricao}</span>
                      </div>
                      <span className="text-muted-foreground shrink-0 ml-2">{item.quantidade}×</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">Valor do Kit</span>
                    <span className="text-foreground">{formatBRL(custoKit)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Adicionais */}
          {adicionais.length > 0 && (
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-4">
                <SectionHeader icon={Box} label="Itens Adicionais" />
                <div className="space-y-1.5">
                  {adicionais.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <span className="truncate text-foreground">{item.descricao}</span>
                      <span className="text-muted-foreground shrink-0 ml-2">{item.quantidade}×</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">Total Adicionais</span>
                    <span className="text-foreground">{formatBRL(custoAdicionais)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Serviços */}
          {servicos.length > 0 && (
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-4">
                <SectionHeader icon={Wrench} label="Serviços" />
                <div className="space-y-1.5">
                  {servicos.map((item, i) => (
                    <div key={i} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="truncate text-foreground">{item.descricao}</span>
                        {item.incluso_no_preco && (
                          <Badge className="text-[9px] bg-success/10 text-success border-0">Incluso</Badge>
                        )}
                      </div>
                      <span className="font-medium text-foreground shrink-0 ml-2">{formatBRL(item.valor)}</span>
                    </div>
                  ))}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-muted-foreground">Total Serviços</span>
                    <span className="text-foreground">{formatBRL(custoServicos)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financeiro */}
          <Card className="border-border/40 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={DollarSign} label="Financeiro" />
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <span className="text-muted-foreground">Valor do Kit</span>
                <span className="font-medium text-foreground text-right">{formatBRL(custoKit)}</span>
                {custoAdicionais > 0 && (
                  <>
                    <span className="text-muted-foreground">Adicionais</span>
                    <span className="font-medium text-foreground text-right">{formatBRL(custoAdicionais)}</span>
                  </>
                )}
                {custoServicos > 0 && (
                  <>
                    <span className="text-muted-foreground">Serviços</span>
                    <span className="font-medium text-foreground text-right">{formatBRL(custoServicos)}</span>
                  </>
                )}
                <span className="text-muted-foreground">Margem</span>
                <span className="font-medium text-foreground text-right">{(Number(margemPercentual) || 0).toFixed(1)}%</span>
                {descontoPercentual > 0 && (
                  <>
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="font-medium text-destructive text-right">-{(Number(descontoPercentual) || 0).toFixed(1)}%</span>
                  </>
                )}
                {custoComissao > 0 && (
                  <>
                    <span className="text-muted-foreground">Comissão</span>
                    <span className="font-medium text-foreground text-right">{formatBRL(custoComissao)}</span>
                  </>
                )}
              </div>
              <Separator className="my-3" />
              <div className="flex justify-between text-base font-bold">
                <span className="text-foreground">Preço Final</span>
                <span className="text-primary">{formatBRL(precoFinal)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pagamento — full width, expandable */}
      {pagamentoOpcoes.length > 0 && (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-4">
            <SectionHeader icon={CreditCard} label="Condições de Pagamento" />
            <div className="space-y-2">
              {pagamentoOpcoes.map((op, i) => (
                <PaymentOptionItem key={i} op={op} defaultOpen={i === 0} />
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Modern Payment Option Card ── */
function PaymentOptionItem({ op, defaultOpen }: {
  op: StepResumoProps["pagamentoOpcoes"][number];
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const totalFinanciado = op.num_parcelas > 0 && op.valor_parcela > 0
    ? op.num_parcelas * op.valor_parcela
    : 0;
  const totalGeral = (op.entrada || 0) + totalFinanciado;

  const tipoColor = getTipoBadgeColor(op.tipo);
  const isFinanciamento = op.tipo === "financiamento";
  const isAVista = op.tipo === "a_vista";

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className={cn(
            "w-full group rounded-xl border transition-all duration-200",
            "hover:shadow-md cursor-pointer",
            open
              ? "border-primary/30 shadow-sm bg-card"
              : "border-border/50 bg-card hover:border-primary/20"
          )}
        >
          <div className="flex items-center gap-4 p-4">
            {/* Icon */}
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
              isAVista ? "bg-success/10" : isFinanciamento ? "bg-info/10" : "bg-warning/10",
            )}>
              {isAVista ? (
                <Banknote className={cn("h-5 w-5", isAVista ? "text-success" : "text-info")} />
              ) : (
                <Building2 className={cn("h-5 w-5", isFinanciamento ? "text-info" : "text-warning")} />
              )}
            </div>

            {/* Name + summary */}
            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground truncate">{op.nome}</span>
                <Badge variant="outline" className={cn("text-[9px] shrink-0", tipoColor)}>
                  {getTipoLabel(op.tipo)}
                </Badge>
              </div>
              {!open && (
                <div className="flex items-center gap-3 mt-1">
                  {op.entrada > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      <ArrowDown className="h-2.5 w-2.5 inline mr-0.5" />
                      {formatBRL(op.entrada)}
                    </span>
                  )}
                  {op.num_parcelas > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                      {op.num_parcelas}× {formatBRL(op.valor_parcela)}
                    </span>
                  )}
                  {(op.taxa_mensal ?? 0) > 0 && (
                    <span className="text-[11px] text-muted-foreground">
                      <Percent className="h-2.5 w-2.5 inline mr-0.5" />
                      {((op.taxa_mensal ?? 0) * 100).toFixed(2)}%
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Total value on right */}
            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground">
                {isAVista ? formatBRL(op.entrada || op.valor_parcela) : totalGeral > 0 ? formatBRL(totalGeral) : formatBRL(op.valor_parcela)}
              </p>
              {!isAVista && op.num_parcelas > 0 && (
                <p className="text-[10px] text-muted-foreground">{op.num_parcelas}× de {formatBRL(op.valor_parcela)}</p>
              )}
            </div>

            {/* Chevron */}
            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
              open && "rotate-180"
            )} />
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mx-1 mb-1 rounded-b-xl border border-t-0 border-border/40 bg-muted/20 px-4 py-3">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {op.entrada > 0 && (
              <MetricMini icon={ArrowDown} label="Entrada" value={formatBRL(op.entrada)} />
            )}
            {op.num_parcelas > 0 && (
              <MetricMini
                icon={Clock}
                label="Parcelas"
                value={`${op.num_parcelas}× ${formatBRL(op.valor_parcela)}`}
              />
            )}
            {(op.taxa_mensal ?? 0) > 0 && (
              <MetricMini
                icon={Percent}
                label="Taxa mensal"
                value={`${((op.taxa_mensal ?? 0) * 100).toFixed(2)}%`}
              />
            )}
            {(op.carencia_meses ?? 0) > 0 && (
              <MetricMini
                icon={Clock}
                label="Carência"
                value={`${op.carencia_meses} meses`}
              />
            )}
            {(op.valor_financiado ?? 0) > 0 && (
              <MetricMini
                icon={Banknote}
                label="Financiado"
                value={formatBRL(op.valor_financiado ?? 0)}
              />
            )}
          </div>

          {totalGeral > 0 && !isAVista && (
            <>
              <Separator className="my-3" />
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground font-medium">Total com juros</span>
                <span className="text-sm font-bold text-primary">{formatBRL(totalGeral)}</span>
              </div>
            </>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Mini metric for expanded state ── */
function MetricMini({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="space-y-0.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        <Icon className="h-3 w-3 shrink-0" />
        <span className="text-[10px] font-medium uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}
