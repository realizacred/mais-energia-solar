import { useState, useMemo } from "react";
import { formatBRL } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  MapPin, User, Zap, Package, Box, Wrench, DollarSign, CreditCard,
  SunMedium, TrendingUp, Phone, Mail, Building2, Percent,
  Banknote, Clock, ArrowDown, ChevronDown, ChevronRight, ChevronLeft
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatPhoneBR } from "@/lib/formatters";
import { resolveCustoKit } from "./types";
import { useWizardContext } from "./WizardContext";
import { usePrecoFinal } from "@/hooks/usePrecoFinal";
import { Button } from "@/components/ui/button";

interface StepResumoProps {
  // Navigation
  onBack?: () => void;
  onNext?: () => void;
  // Snapshot data (for read-only view)
  snapshotData?: {
    estado: string;
    cidade: string;
    tipoTelhado: string;
    distribuidoraNome: string;
    irradiacao: number;
    clienteNome: string;
    clienteCelular?: string;
    clienteEmail?: string;
    clienteEmpresa?: string;
    potenciaKwp: number;
    consumoTotal: number;
    geracaoMensalKwh: number;
    numUcs: number;
    grupo: string;
    itens: Array<{ descricao: string; quantidade: number; preco_unitario: number; categoria: string }>;
    adicionais: Array<{ descricao: string; quantidade: number; preco_unitario: number }>;
    servicos: Array<{ descricao: string; valor: number; incluso_no_preco: boolean }>;
    precoFinal: number;
    margemPercentual: number;
    custoInstalacao: number;
    custoComissao: number;
    custoOutros: number;
    descontoPercentual: number;
    pagamentoOpcoes: any[];
    custoKitOverride?: number | null;
  };
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
  onBack, onNext, snapshotData
}: StepResumoProps) {
  // Wizard Context (always call it, but ignore values if snapshotData is present)
  const context = useWizardContext();
  
  const isSnapshot = !!snapshotData;
  
  const estado = isSnapshot ? snapshotData.estado : context.locEstado;
  const cidade = isSnapshot ? snapshotData.cidade : context.locCidade;
  const tipoTelhado = isSnapshot ? snapshotData.tipoTelhado : context.locTipoTelhado;
  const distribuidoraNome = isSnapshot ? snapshotData.distribuidoraNome : context.locDistribuidoraNome;
  const irradiacao = isSnapshot ? snapshotData.irradiacao : context.locIrradiacao;
  
  const clienteNome = isSnapshot ? snapshotData.clienteNome : context.cliente.nome;
  const clienteCelular = isSnapshot ? snapshotData.clienteCelular : context.cliente.celular;
  const clienteEmail = isSnapshot ? snapshotData.clienteEmail : context.cliente.email;
  const clienteEmpresa = isSnapshot ? snapshotData.clienteEmpresa : context.cliente.empresa;
  const leadNome = isSnapshot ? undefined : context.selectedLead?.nome;
  
  const potenciaKwp = isSnapshot ? snapshotData.potenciaKwp : context.potenciaKwp;
  const numUcs = isSnapshot ? snapshotData.numUcs : context.ucs.length;
  const grupo = isSnapshot ? snapshotData.grupo : context.grupo;
  
  const itens = isSnapshot ? snapshotData.itens : context.itens;
  const adicionais = isSnapshot ? snapshotData.adicionais : context.adicionais;
  const servicos = isSnapshot ? snapshotData.servicos : context.servicos;
  
  const precoFinalFromHook = usePrecoFinal(context.itens, context.servicos, context.venda);
  const precoFinal = isSnapshot ? snapshotData.precoFinal : precoFinalFromHook;
  
  const custoInstalacao = isSnapshot ? snapshotData.custoInstalacao : context.venda.custo_instalacao;
  const custoComissao = isSnapshot ? snapshotData.custoComissao : context.venda.custo_comissao;
  const custoOutros = isSnapshot ? snapshotData.custoOutros : context.venda.custo_outros;
  const descontoPercentual = isSnapshot ? snapshotData.descontoPercentual : context.venda.desconto_percentual;
  const custoKitOverride = isSnapshot ? snapshotData.custoKitOverride : context.venda.custo_kit_override;
  
  const pagamentoOpcoes = isSnapshot ? snapshotData.pagamentoOpcoes : context.pagamentoOpcoes;

  const consumoTotal = isSnapshot ? snapshotData.consumoTotal : context.ucs.reduce((s, u) => s + (u.consumo_mensal || u.consumo_mensal_p + u.consumo_mensal_fp), 0);

  // Geração estimada
  const topologiaAtiva = (itens.length > 0 ? (itens.find(i => i.categoria === "inversor")?.descricao?.toLowerCase() ?? "tradicional") : "tradicional");
  const fatorGeracaoAtivo = isSnapshot ? 0 : (context.preDimensionamento.topologia_configs?.[topologiaAtiva]?.fator_geracao ?? context.preDimensionamento.fator_geracao ?? 0);

  const geracaoMensalKwh = useMemo(() => {
    if (isSnapshot) return snapshotData.geracaoMensalKwh;
    if (potenciaKwp <= 0) return 0;
    if (fatorGeracaoAtivo > 0) return Math.round(potenciaKwp * fatorGeracaoAtivo);
    if (irradiacao > 0) {
      const ucGeradora = context.ucs.find(u => u.is_geradora);
      const pr = (ucGeradora?.taxa_desempenho ?? 80) / 100;
      return Math.round(potenciaKwp * irradiacao * 30 * pr);
    }
    return 0;
  }, [isSnapshot, snapshotData, potenciaKwp, fatorGeracaoAtivo, irradiacao, context.ucs]);

  const custoKit = resolveCustoKit({ itens, custoKitOverride });
  const custoAdicionais = adicionais.reduce((s, i) => s + (i.quantidade * i.preco_unitario), 0);
  const hasFCCosts = (Number(custoInstalacao) || 0) > 0 || (Number(custoComissao) || 0) > 0 || (Number(custoOutros) || 0) > 0;
  const custoServicosEfetivo = hasFCCosts
    ? (Number(custoInstalacao) || 0)
    : servicos.filter((i) => i.incluso_no_preco).reduce((s, i) => s + i.valor, 0);
  const custoBase = custoKit + custoServicosEfetivo + (Number(custoComissao) || 0) + (Number(custoOutros) || 0);
  const margemRealPercentual = custoBase > 0 ? ((precoFinal - custoBase) / custoBase) * 100 : 0;

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
              <p className="text-lg font-bold text-foreground leading-none">{Math.round(geracaoMensalKwh).toLocaleString("pt-BR")} kWh</p>
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

      {/* Client + Location side by side — collapsible, closed by default */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Client */}
        <Collapsible defaultOpen={false} className="group">
          <Card className="border-border/40 shadow-sm">
            <CardContent className="p-4">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Cliente</h3>
                    <span className="text-xs text-muted-foreground ml-1 truncate">{clienteNome || leadNome || "—"}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-[auto_1fr] gap-y-2.5 gap-x-6 text-sm mt-3">
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
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>

        {/* Location */}
        <Collapsible defaultOpen={false} className="group">
          <Card className="border-border/40 shadow-sm">
            <CardContent className="p-4">
              <CollapsibleTrigger className="w-full">
                <div className="flex items-center justify-between cursor-pointer">
                  <div className="flex items-center gap-2">
                    <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-3.5 w-3.5 text-primary" />
                    </div>
                    <h3 className="text-sm font-bold text-foreground">Localização</h3>
                    <span className="text-xs text-muted-foreground ml-1 truncate">{cidade && estado ? `${cidade} - ${estado}` : "—"}</span>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform duration-200 group-data-[state=open]:rotate-90" />
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="grid grid-cols-[auto_1fr] gap-y-2.5 gap-x-6 text-sm mt-3">
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
              </CollapsibleContent>
            </CardContent>
          </Card>
        </Collapsible>
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
                    <span className="text-foreground">{formatBRL(servicos.reduce((s, i) => s + i.valor, 0))}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Financeiro */}
          <Card className="border-border/40 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={DollarSign} label="Financeiro" />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <span className="text-muted-foreground">Valor do Kit</span>
                <span className="font-medium text-foreground text-right">{formatBRL(custoKit)}</span>
                {custoAdicionais > 0 && (
                  <>
                    <span className="text-muted-foreground">Adicionais</span>
                    <span className="font-medium text-foreground text-right">{formatBRL(custoAdicionais)}</span>
                  </>
                )}
                {custoServicosEfetivo > 0 && (
                  <>
                    <span className="text-muted-foreground">Instalação</span>
                    <span className="font-medium text-foreground text-right">{formatBRL(custoServicosEfetivo)}</span>
                  </>
                )}
                {Number(custoComissao) > 0 && (
                  <>
                    <span className="text-muted-foreground">Comissão</span>
                    <span className="font-medium text-foreground text-right">{formatBRL(Number(custoComissao))}</span>
                  </>
                )}
                {(Number(custoOutros) || 0) > 0 && (
                  <>
                    <span className="text-muted-foreground">Outros custos</span>
                    <span className="font-medium text-foreground text-right">{formatBRL(Number(custoOutros))}</span>
                  </>
                )}
                {Number(descontoPercentual) > 0 && (
                  <>
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="font-medium text-destructive text-right">-{(Number(descontoPercentual) || 0).toFixed(1)}%</span>
                  </>
                )}
                <Separator className="col-span-2 my-1" />
                <span className="text-muted-foreground">Custo total</span>
                <span className="font-medium text-foreground text-right">{formatBRL(custoBase)}</span>
                <span className="text-muted-foreground">Margem real</span>
                <span className="font-medium text-foreground text-right">{(Number(margemRealPercentual) || 0).toFixed(1)}%</span>
              </div>
              <Separator className="my-3" />
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-foreground">Preço Final</span>
                <span className="text-lg font-black text-primary">{formatBRL(precoFinal)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Pagamento */}
      {pagamentoOpcoes.length > 0 && (
        <Card className="border-border/40 shadow-sm">
          <CardContent className="p-4">
            <SectionHeader icon={CreditCard} label="Opções de Pagamento" />
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {pagamentoOpcoes.map((opcao, i) => (
                <div key={i} className="p-3 rounded-lg border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-foreground uppercase truncate pr-2">{opcao.nome}</span>
                    <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", getTipoBadgeColor(opcao.tipo))}>
                      {getTipoLabel(opcao.tipo)}
                    </Badge>
                  </div>
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-muted-foreground">Parcelas</span>
                      <span className="text-sm font-bold text-foreground">{opcao.num_parcelas}x</span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-[10px] text-muted-foreground">Valor Parcela</span>
                      <span className="text-sm font-bold text-foreground">{formatBRL(opcao.valor_parcela)}</span>
                    </div>
                    {opcao.entrada > 0 && (
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-muted-foreground">Entrada</span>
                        <span className="text-sm font-semibold text-success">{formatBRL(opcao.entrada)}</span>
                      </div>
                    )}
                    {opcao.taxa_mensal != null && opcao.taxa_mensal > 0 && (
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-muted-foreground">Taxa</span>
                        <span className="text-[11px] font-medium text-foreground">{opcao.taxa_mensal.toFixed(2)}% a.m.</span>
                      </div>
                    )}
                    {opcao.carencia_meses != null && opcao.carencia_meses > 0 && (
                      <div className="flex justify-between items-baseline">
                        <span className="text-[10px] text-muted-foreground">Carência</span>
                        <span className="text-[11px] font-medium text-foreground">{opcao.carencia_meses} meses</span>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Footer Navigation (only if callbacks provided) */}
      {(onBack || onNext) && (
        <div className="flex items-center justify-between pt-4 border-t border-border/40">
          {onBack ? (
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-xs">
              <ChevronLeft className="h-4 w-4" /> Voltar
            </Button>
          ) : <div />}
          {onNext && (
            <Button size="sm" onClick={onNext} className="gap-1 text-xs px-6">
              Próximo <ChevronRight className="h-4 w-4" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeaderLegacy({ icon: Icon, label }: { icon: any; label: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
        <Icon className="h-3.5 w-3.5 text-primary" />
      </div>
      <h3 className="text-sm font-bold text-foreground">{label}</h3>
    </div>
  );
}
