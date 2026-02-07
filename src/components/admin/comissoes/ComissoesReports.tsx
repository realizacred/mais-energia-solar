import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, PieChart, Pie, Cell } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { format, subMonths, differenceInDays, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, History, BarChart3, Target } from "lucide-react";

interface Comissao {
  id: string;
  vendedor_id: string;
  valor_comissao: number;
  mes_referencia: number;
  ano_referencia: number;
  status: string;
  created_at: string;
  vendedores?: { nome: string };
  pagamentos_comissao?: { valor_pago: number; data_pagamento: string }[];
}

interface Vendedor {
  id: string;
  nome: string;
}

interface ComissoesReportsProps {
  comissoes: Comissao[];
  allComissoes: Comissao[]; // All commissions for comparison
  vendedores: Vendedor[];
  formatCurrency: (value: number) => string;
}

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

const chartConfig: ChartConfig = {
  comissoes: {
    label: "Comissões",
    color: "hsl(var(--chart-1))",
  },
  pago: {
    label: "Pago",
    color: "hsl(var(--chart-2))",
  },
  pendente: {
    label: "Pendente",
    color: "hsl(var(--chart-3))",
  },
};

export function ComissoesReports({
  comissoes,
  allComissoes,
  vendedores,
  formatCurrency,
}: ComissoesReportsProps) {
  const [activeTab, setActiveTab] = useState("resumo");

  // Monthly summary by vendor
  const resumoMensal = useMemo(() => {
    return vendedores
      .map((v) => {
        const vendorComissoes = comissoes.filter((c) => c.vendedor_id === v.id);
        const total = vendorComissoes.reduce((acc, c) => acc + c.valor_comissao, 0);
        const pago = vendorComissoes.reduce(
          (acc, c) =>
            acc + (c.pagamentos_comissao?.reduce((a, p) => a + p.valor_pago, 0) || 0),
          0
        );
        return {
          vendedor: v.nome,
          vendedor_id: v.id,
          total,
          pago,
          pendente: Math.max(0, total - pago),
          quantidade: vendorComissoes.length,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [comissoes, vendedores]);

  // Payment history
  const historicoPagamentos = useMemo(() => {
    const pagamentos: { data: string; vendedor: string; valor: number; status: string }[] = [];
    comissoes.forEach((c) => {
      c.pagamentos_comissao?.forEach((p) => {
        pagamentos.push({
          data: p.data_pagamento,
          vendedor: c.vendedores?.nome || "Desconhecido",
          valor: p.valor_pago,
          status: "pago",
        });
      });
    });
    return pagamentos.sort((a, b) => new Date(b.data).getTime() - new Date(a.data).getTime());
  }, [comissoes]);

  // Period comparison (current month vs last month)
  const comparativoPeriodos = useMemo(() => {
    const currentDate = new Date();
    const lastMonth = subMonths(currentDate, 1);

    const mesAtual = currentDate.getMonth() + 1;
    const anoAtual = currentDate.getFullYear();
    const mesAnterior = lastMonth.getMonth() + 1;
    const anoAnterior = lastMonth.getFullYear();

    const comissoesMesAtual = allComissoes.filter(
      (c) => c.mes_referencia === mesAtual && c.ano_referencia === anoAtual
    );
    const comissoesMesAnterior = allComissoes.filter(
      (c) => c.mes_referencia === mesAnterior && c.ano_referencia === anoAnterior
    );

    const totalAtual = comissoesMesAtual.reduce((acc, c) => acc + c.valor_comissao, 0);
    const totalAnterior = comissoesMesAnterior.reduce((acc, c) => acc + c.valor_comissao, 0);

    const variacao = totalAnterior > 0 ? ((totalAtual - totalAnterior) / totalAnterior) * 100 : 0;

    return {
      mesAtual: { mes: mesAtual, ano: anoAtual, total: totalAtual, quantidade: comissoesMesAtual.length },
      mesAnterior: { mes: mesAnterior, ano: anoAnterior, total: totalAnterior, quantidade: comissoesMesAnterior.length },
      variacao,
    };
  }, [allComissoes]);

  // Projection based on average
  const projecao = useMemo(() => {
    const currentDate = new Date();
    const last6Months = Array.from({ length: 6 }, (_, i) => {
      const date = subMonths(currentDate, i);
      return { mes: date.getMonth() + 1, ano: date.getFullYear() };
    });

    const monthlyTotals = last6Months.map(({ mes, ano }) => {
      const monthComissoes = allComissoes.filter(
        (c) => c.mes_referencia === mes && c.ano_referencia === ano
      );
      return monthComissoes.reduce((acc, c) => acc + c.valor_comissao, 0);
    });

    const average = monthlyTotals.reduce((a, b) => a + b, 0) / monthlyTotals.length;
    const trend = monthlyTotals[0] - monthlyTotals[monthlyTotals.length - 1];

    return {
      media: average,
      tendencia: trend,
      projecaoProximoMes: average + trend / 6,
      historico: last6Months.map(({ mes, ano }, i) => ({
        periodo: `${mes}/${ano}`,
        valor: monthlyTotals[i],
      })).reverse(),
    };
  }, [allComissoes]);

  // Chart data for vendor distribution
  const vendorChartData = resumoMensal.slice(0, 5).map((r, i) => ({
    name: r.vendedor,
    value: r.total,
    fill: COLORS[i % COLORS.length],
  }));

  const getMesNome = (mes: number) => {
    const meses = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
    return meses[mes - 1];
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Relatórios e Análises
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4 mb-6">
            <TabsTrigger value="resumo">Resumo Mensal</TabsTrigger>
            <TabsTrigger value="historico">Histórico</TabsTrigger>
            <TabsTrigger value="projecao">Projeção</TabsTrigger>
            <TabsTrigger value="comparativo">Comparativo</TabsTrigger>
          </TabsList>

          {/* Resumo Mensal */}
          <TabsContent value="resumo" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Table */}
              <div>
                <h4 className="font-medium mb-4">Resumo por Vendedor</h4>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Vendedor</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead className="text-right">Pago</TableHead>
                      <TableHead className="text-right">Pendente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {resumoMensal.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center text-muted-foreground">
                          Nenhuma comissão no período
                        </TableCell>
                      </TableRow>
                    ) : (
                      resumoMensal.map((r) => (
                        <TableRow key={r.vendedor_id}>
                          <TableCell className="font-medium">{r.vendedor}</TableCell>
                          <TableCell className="text-right">{formatCurrency(r.total)}</TableCell>
                          <TableCell className="text-right text-green-600">
                            {formatCurrency(r.pago)}
                          </TableCell>
                          <TableCell className="text-right text-orange-600">
                            {formatCurrency(r.pendente)}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

              {/* Chart */}
              <div>
                <h4 className="font-medium mb-4">Distribuição por Vendedor</h4>
                {vendorChartData.length > 0 ? (
                  <ChartContainer config={chartConfig} className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie
                          data={vendorChartData}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={100}
                          label={({ name, percent }) =>
                            `${name} (${(percent * 100).toFixed(0)}%)`
                          }
                        >
                          {vendorChartData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={entry.fill} />
                          ))}
                        </Pie>
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value) => formatCurrency(Number(value))}
                            />
                          }
                        />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : (
                  <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                    Sem dados para exibir
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Histórico de Pagamentos */}
          <TabsContent value="historico">
            <div className="flex items-center gap-2 mb-4">
              <History className="h-5 w-5 text-muted-foreground" />
              <h4 className="font-medium">Histórico de Pagamentos</h4>
            </div>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Data</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead className="text-right">Valor</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historicoPagamentos.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={4} className="text-center text-muted-foreground">
                      Nenhum pagamento registrado no período
                    </TableCell>
                  </TableRow>
                ) : (
                  historicoPagamentos.slice(0, 20).map((p, i) => (
                    <TableRow key={i}>
                      <TableCell>
                        {format(parseISO(p.data), "dd/MM/yyyy", { locale: ptBR })}
                      </TableCell>
                      <TableCell>{p.vendedor}</TableCell>
                      <TableCell className="text-right text-green-600">
                        {formatCurrency(p.valor)}
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="default">Pago</Badge>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </TabsContent>

          {/* Projeção */}
          <TabsContent value="projecao">
            <div className="space-y-6">
              <div className="flex items-center gap-2 mb-4">
                <Target className="h-5 w-5 text-muted-foreground" />
                <h4 className="font-medium">Projeção de Comissões</h4>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Média últimos 6 meses</p>
                    <p className="text-2xl font-bold">{formatCurrency(projecao.media)}</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Tendência</p>
                    <div className="flex items-center gap-2">
                      {projecao.tendencia >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      )}
                      <p className={`text-2xl font-bold ${projecao.tendencia >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {projecao.tendencia >= 0 ? "+" : ""}
                        {formatCurrency(projecao.tendencia)}
                      </p>
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Projeção próximo mês</p>
                    <p className="text-2xl font-bold text-primary">
                      {formatCurrency(projecao.projecaoProximoMes)}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={projecao.historico}>
                    <XAxis dataKey="periodo" />
                    <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                    <Line
                      type="monotone"
                      dataKey="valor"
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-1))" }}
                    />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                      }
                    />
                  </LineChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </TabsContent>

          {/* Comparativo */}
          <TabsContent value="comparativo">
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      {getMesNome(comparativoPeriodos.mesAnterior.mes)}/{comparativoPeriodos.mesAnterior.ano}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(comparativoPeriodos.mesAnterior.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {comparativoPeriodos.mesAnterior.quantidade} registros
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">
                      {getMesNome(comparativoPeriodos.mesAtual.mes)}/{comparativoPeriodos.mesAtual.ano}
                    </p>
                    <p className="text-2xl font-bold">
                      {formatCurrency(comparativoPeriodos.mesAtual.total)}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {comparativoPeriodos.mesAtual.quantidade} registros
                    </p>
                  </CardContent>
                </Card>
                <Card className={comparativoPeriodos.variacao >= 0 ? "border-green-200" : "border-red-200"}>
                  <CardContent className="pt-6">
                    <p className="text-sm text-muted-foreground">Variação</p>
                    <div className="flex items-center gap-2">
                      {comparativoPeriodos.variacao >= 0 ? (
                        <TrendingUp className="h-5 w-5 text-green-600" />
                      ) : (
                        <TrendingDown className="h-5 w-5 text-red-600" />
                      )}
                      <p className={`text-2xl font-bold ${comparativoPeriodos.variacao >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {comparativoPeriodos.variacao >= 0 ? "+" : ""}
                        {comparativoPeriodos.variacao.toFixed(1)}%
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              <ChartContainer config={chartConfig} className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={[
                      {
                        name: `${getMesNome(comparativoPeriodos.mesAnterior.mes)}/${comparativoPeriodos.mesAnterior.ano}`,
                        valor: comparativoPeriodos.mesAnterior.total,
                      },
                      {
                        name: `${getMesNome(comparativoPeriodos.mesAtual.mes)}/${comparativoPeriodos.mesAtual.ano}`,
                        valor: comparativoPeriodos.mesAtual.total,
                      },
                    ]}
                  >
                    <XAxis dataKey="name" />
                    <YAxis tickFormatter={(value) => `R$ ${(value / 1000).toFixed(0)}k`} />
                    <Bar dataKey="valor" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    <ChartTooltip
                      content={
                        <ChartTooltipContent
                          formatter={(value) => formatCurrency(Number(value))}
                        />
                      }
                    />
                  </BarChart>
                </ResponsiveContainer>
              </ChartContainer>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}
