import { useState } from "react";
import { formatBRL } from "@/lib/formatters";
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
import { formatPhoneBR } from "@/lib/formatters";

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
  /** Override manual do custo do kit (do Centro Financeiro) */
  custoKitOverride?: number | null;
  // Adicionais
  adicionais: Array<{ descricao: string; quantidade: number; preco_unitario: number }>;
  // Servicos
  servicos: Array<{ descricao: string; valor: number; incluso_no_preco: boolean }>;
  // Venda
  precoFinal: number;
  margemPercentual: number;
  custoInstalacao: number;
  custoComissao: number;
  custoOutros: number;
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
  itens, custoKitOverride, adicionais, servicos,
  precoFinal, margemPercentual, custoInstalacao, custoComissao, custoOutros, descontoPercentual,
  pagamentoOpcoes,
}: StepResumoProps) {
  const custoKitCalculado = itens.reduce((s, i) => s + (i.quantidade * i.preco_unitario), 0);
  const custoKit = (custoKitOverride != null && custoKitOverride > 0) ? custoKitOverride : custoKitCalculado;
  const custoAdicionais = adicionais.reduce((s, i) => s + (i.quantidade * i.preco_unitario), 0);
  const custoServicos = servicos.reduce((s, i) => s + i.valor, 0);
  const hasFCCosts = (Number(custoInstalacao) || 0) > 0 || (Number(custoComissao) || 0) > 0 || (Number(custoOutros) || 0) > 0;
  const custoServicosEfetivo = hasFCCosts
    ? (Number(custoInstalacao) || 0)
    : servicos.filter((i) => i.incluso_no_preco).reduce((s, i) => s + i.valor, 0);
  const custoBase = custoKit + custoServicosEfetivo + (Number(custoComissao) || 0) + (Number(custoOutros) || 0);
  const margemRealPercentual = precoFinal > 0 ? ((precoFinal - custoBase) / precoFinal) * 100 : 0;

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
                {(Number(potenciaKwp) || 0) > 0 ? `${formatBRL((Number(precoFinal) || 0) / (Number(potenciaKwp) || 1) / 1000)}/Wp` : "—"}
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
              <span className="font-medium text-foreground">{clienteCelular ? formatPhoneBR(clienteCelular) : "—"}</span>
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
                <span className="text-muted-foreground">Margem real</span>
                <span className="font-medium text-foreground text-right">{(Number(margemRealPercentual) || 0).toFixed(1)}%</span>
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

      {/* Pagamento — grouped by entity */}
      {pagamentoOpcoes.length > 0 && (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-4">
            <SectionHeader icon={CreditCard} label="Condições de Pagamento" />
            <PaymentGroupedList opcoes={pagamentoOpcoes} precoBase={precoFinal} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}

/* ── Grouped Payment List ── */
type PaymentOp = StepResumoProps["pagamentoOpcoes"][number];

function PaymentGroupedList({ opcoes, precoBase }: { opcoes: PaymentOp[]; precoBase: number }) {
  // Separate "à vista" from financing/installment options
  const aVistaOps = opcoes.filter(op => op.tipo === "a_vista");
  const financingOps = opcoes.filter(op => op.tipo !== "a_vista");

  // Group financing by entity name (nome field)
  const entityGroups = new Map<string, PaymentOp[]>();
  for (const op of financingOps) {
    const entity = op.nome || "Outros";
    if (!entityGroups.has(entity)) entityGroups.set(entity, []);
    entityGroups.get(entity)!.push(op);
  }

  return (
    <div className="space-y-2">
      {/* À Vista options — shown individually */}
      {aVistaOps.map((op, i) => (
        <PaymentOptionItem key={`av-${i}`} op={op} defaultOpen={i === 0} precoBase={precoBase} />
      ))}

      {/* Grouped financing by entity */}
      {Array.from(entityGroups.entries()).map(([entity, ops]) => (
        <EntityPaymentGroup key={entity} entity={entity} options={ops} precoBase={precoBase} />
      ))}
    </div>
  );
}

/* ── Entity Group (e.g. Santander, BV Financeira) ── */
function EntityPaymentGroup({ entity, options, precoBase }: {
  entity: string;
  options: PaymentOp[];
  precoBase: number;
}) {
  const [open, setOpen] = useState(false);

  // Sort by num_parcelas ascending
  const sorted = [...options].sort((a, b) => a.num_parcelas - b.num_parcelas);

  // Summary: range of installments
  const minParcelas = sorted[0]?.num_parcelas || 0;
  const maxParcelas = sorted[sorted.length - 1]?.num_parcelas || 0;
  const minValorParcela = Math.min(...sorted.map(o => o.valor_parcela));
  const maxValorParcela = Math.max(...sorted.map(o => o.valor_parcela));

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
            <div className="h-10 w-10 rounded-xl flex items-center justify-center shrink-0 bg-info/10">
              <Building2 className="h-5 w-5 text-info" />
            </div>

            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground truncate">{entity}</span>
                <Badge variant="outline" className="text-[9px] shrink-0 bg-info/10 text-info border-info/20">
                  Financiamento
                </Badge>
                <Badge variant="outline" className="text-[9px] shrink-0 bg-muted text-muted-foreground">
                  {options.length} {options.length === 1 ? "opção" : "opções"}
                </Badge>
              </div>
              {!open && (
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-[11px] text-muted-foreground">
                    <Clock className="h-2.5 w-2.5 inline mr-0.5" />
                    {minParcelas === maxParcelas ? `${minParcelas}×` : `${minParcelas}× a ${maxParcelas}×`}
                  </span>
                  <span className="text-[11px] text-muted-foreground">
                    {formatBRL(minValorParcela)} – {formatBRL(maxValorParcela)}/mês
                  </span>
                </div>
              )}
            </div>

            <ChevronDown className={cn(
              "h-4 w-4 text-muted-foreground transition-transform duration-200 shrink-0",
              open && "rotate-180"
            )} />
          </div>
        </button>
      </CollapsibleTrigger>

      <CollapsibleContent>
        <div className="mx-1 mb-1 rounded-b-xl border border-t-0 border-border/40 bg-muted/10 p-2 space-y-1.5">
          {sorted.map((op, i) => {
            const totalFinanciado = op.num_parcelas > 0 && op.valor_parcela > 0
              ? op.num_parcelas * op.valor_parcela
              : 0;
            const totalGeral = (op.entrada || 0) + totalFinanciado;
            const ganho = totalGeral > 0 ? totalGeral - precoBase : 0;

            return (
              <div key={i} className="rounded-lg border border-border/30 bg-card p-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">
                        {op.num_parcelas}× de {formatBRL(op.valor_parcela)}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {(op.taxa_mensal ?? 0) > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            <Percent className="h-2.5 w-2.5 inline mr-0.5" />
                            {((op.taxa_mensal ?? 0) * 100).toFixed(2)}% a.m.
                          </span>
                        )}
                        {op.entrada > 0 && (
                          <span className="text-[10px] text-muted-foreground">
                            <ArrowDown className="h-2.5 w-2.5 inline mr-0.5" />
                            Entrada: {formatBRL(op.entrada)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-bold text-foreground">{formatBRL(totalGeral)}</p>
                    {ganho > 0 && (
                      <p className="text-[10px] text-success font-medium">
                        +{formatBRL(ganho)} de ganho
                      </p>
                    )}
                    {ganho < 0 && (
                      <p className="text-[10px] text-destructive font-medium">
                        {formatBRL(ganho)} abaixo
                      </p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ── Single Payment Option (used for À Vista) ── */
function PaymentOptionItem({ op, defaultOpen, precoBase }: {
  op: PaymentOp;
  defaultOpen?: boolean;
  precoBase: number;
}) {
  const [open, setOpen] = useState(defaultOpen ?? false);

  const totalFinanciado = op.num_parcelas > 0 && op.valor_parcela > 0
    ? op.num_parcelas * op.valor_parcela
    : 0;
  const totalGeral = (op.entrada || 0) + totalFinanciado;

  const tipoColor = getTipoBadgeColor(op.tipo);
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
            <div className={cn(
              "h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-colors",
              isAVista ? "bg-success/10" : "bg-warning/10",
            )}>
              <Banknote className={cn("h-5 w-5", isAVista ? "text-success" : "text-warning")} />
            </div>

            <div className="flex-1 min-w-0 text-left">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm text-foreground truncate">{op.nome}</span>
                <Badge variant="outline" className={cn("text-[9px] shrink-0", tipoColor)}>
                  {getTipoLabel(op.tipo)}
                </Badge>
              </div>
            </div>

            <div className="text-right shrink-0">
              <p className="text-sm font-bold text-foreground">
                {isAVista ? formatBRL(op.entrada || op.valor_parcela) : totalGeral > 0 ? formatBRL(totalGeral) : formatBRL(op.valor_parcela)}
              </p>
            </div>

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
            {(op.valor_financiado ?? 0) > 0 && (
              <MetricMini
                icon={Banknote}
                label="Financiado"
                value={formatBRL(op.valor_financiado ?? 0)}
              />
            )}
          </div>
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
