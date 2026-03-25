import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  MapPin, User, Zap, Package, Box, Wrench, DollarSign, CreditCard,
  SunMedium, TrendingUp, BarChart3, Phone, Mail, Building2, Percent,
  Banknote, Clock, ArrowDown,
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

  const moduloItem = itens.find(i => i.categoria === "modulo");
  const inversorItem = itens.find(i => i.categoria === "inversor");

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
              <p className="text-lg font-bold text-foreground leading-none">{potenciaKwp.toFixed(2)} kWp</p>
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
                {potenciaKwp > 0 ? `R$ ${(precoFinal / potenciaKwp / 1000).toFixed(2)}/Wp` : "—"}
              </p>
              <p className="text-[10px] text-muted-foreground">Custo/Wp</p>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Location */}
          <Card className="border-border/40 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={MapPin} label="Localização" />
              <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                <span className="text-muted-foreground">Estado</span>
                <span className="font-medium text-foreground">{estado}</span>
                <span className="text-muted-foreground">Cidade</span>
                <span className="font-medium text-foreground">{cidade}</span>
                <span className="text-muted-foreground">Telhado</span>
                <span className="font-medium text-foreground">{tipoTelhado || "—"}</span>
                <span className="text-muted-foreground">Distribuidora</span>
                <span className="font-medium text-foreground">{distribuidoraNome || "—"}</span>
                <span className="text-muted-foreground">Irradiação</span>
                <span className="font-medium text-foreground">{irradiacao > 0 ? `${irradiacao.toFixed(2)} kWh/m²/dia` : "—"}</span>
              </div>
            </CardContent>
          </Card>

          {/* Client */}
          <Card className="border-border/40 shadow-sm">
            <CardContent className="p-4">
              <SectionHeader icon={User} label="Cliente" />
              <div className="space-y-2">
                <p className="font-semibold text-foreground">{clienteNome || leadNome || "—"}</p>
                {clienteEmpresa && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Building2 className="h-3.5 w-3.5" /> {clienteEmpresa}
                  </div>
                )}
                {clienteCelular && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Phone className="h-3.5 w-3.5" /> {clienteCelular}
                  </div>
                )}
                {clienteEmail && (
                  <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" /> {clienteEmail}
                  </div>
                )}
                <div className="flex items-center gap-2 mt-1">
                  <Badge variant="outline" className="text-[10px]">
                    Grupo {grupo}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {numUcs} UC{numUcs > 1 ? "s" : ""}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    Consumo: {consumoTotal.toLocaleString("pt-BR")} kWh
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Kit — mostra itens SEM preço individual, apenas total do kit */}
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
        </div>

        {/* Right column */}
        <div className="space-y-4">
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

          {/* Financeiro — consolidado */}
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
                <span className="font-medium text-foreground text-right">{margemPercentual.toFixed(1)}%</span>
                {descontoPercentual > 0 && (
                  <>
                    <span className="text-muted-foreground">Desconto</span>
                    <span className="font-medium text-destructive text-right">-{descontoPercentual.toFixed(1)}%</span>
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

          {/* Pagamento — melhorado */}
          {pagamentoOpcoes.length > 0 && (
            <Card className="border-border/40 shadow-sm">
              <CardContent className="p-4">
                <SectionHeader icon={CreditCard} label="Condições de Pagamento" />
                <div className="space-y-3">
                  {pagamentoOpcoes.map((op, i) => {
                    const totalFinanciado = op.num_parcelas > 0 && op.valor_parcela > 0
                      ? op.num_parcelas * op.valor_parcela
                      : 0;
                    const totalGeral = (op.entrada || 0) + totalFinanciado;

                    return (
                      <div key={i} className="rounded-lg border border-border/50 p-3 bg-muted/20">
                        {/* Header */}
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-semibold text-sm text-foreground">{op.nome}</span>
                          <Badge variant="outline" className="text-[9px]">{getTipoLabel(op.tipo)}</Badge>
                        </div>
                        
                        {/* Details grid */}
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
                          {op.entrada > 0 && (
                            <>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <ArrowDown className="h-3 w-3 shrink-0" />
                                <span>Entrada</span>
                              </div>
                              <span className="font-medium text-foreground text-right">{formatBRL(op.entrada)}</span>
                            </>
                          )}
                          {op.num_parcelas > 0 && (
                            <>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>Parcelas</span>
                              </div>
                              <span className="font-medium text-foreground text-right">
                                {op.num_parcelas}× {formatBRL(op.valor_parcela)}
                              </span>
                            </>
                          )}
                          {(op.taxa_mensal ?? 0) > 0 && (
                            <>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Percent className="h-3 w-3 shrink-0" />
                                <span>Taxa mensal</span>
                              </div>
                              <span className="font-medium text-foreground text-right">
                                {((op.taxa_mensal ?? 0) * 100).toFixed(2)}%
                              </span>
                            </>
                          )}
                          {(op.carencia_meses ?? 0) > 0 && (
                            <>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Clock className="h-3 w-3 shrink-0" />
                                <span>Carência</span>
                              </div>
                              <span className="font-medium text-foreground text-right">
                                {op.carencia_meses} meses
                              </span>
                            </>
                          )}
                          {(op.valor_financiado ?? 0) > 0 && (
                            <>
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Banknote className="h-3 w-3 shrink-0" />
                                <span>Financiado</span>
                              </div>
                              <span className="font-medium text-foreground text-right">
                                {formatBRL(op.valor_financiado ?? 0)}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Total */}
                        {totalGeral > 0 && op.tipo !== "a_vista" && (
                          <>
                            <Separator className="my-2" />
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-muted-foreground">Total c/ juros</span>
                              <span className="text-foreground">{formatBRL(totalGeral)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
