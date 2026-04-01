import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Calculator, TrendingUp, CreditCard, AlertTriangle, Lock,
  Download, FileText, ChevronDown, ArrowUpCircle, ArrowDownCircle,
} from "lucide-react";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  useFechamentosCaixa, useResumoFechamento, usePagamentosPeriodo, useCriarFechamento,
} from "@/hooks/useFechamentoCaixa";
import { StatCard } from "@/components/ui-kit/StatCard";
import { formatBRL } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { CATEGORIAS_DESPESA, CATEGORIAS_RECEITA } from "@/hooks/useLancamentosFinanceiros";

const formatDateBR = (d: string) =>
  format(new Date(d), "dd/MM/yyyy", { locale: ptBR });

const FORMAS_LABEL: Record<string, string> = {
  pix: "PIX",
  boleto: "Boleto",
  cartao_credito: "Cartão Crédito",
  cartao_debito: "Cartão Débito",
  dinheiro: "Dinheiro",
  cheque: "Cheque",
  financiamento: "Financiamento",
  outros: "Outros",
};

const ALL_CATS = [...CATEGORIAS_RECEITA, ...CATEGORIAS_DESPESA];
const catLabel = (v: string) => ALL_CATS.find((c) => c.value === v)?.label || v;

export function FechamentoCaixaPage() {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");
  const [periodoInicio, setPeriodoInicio] = useState(todayStr);
  const [periodoFim, setPeriodoFim] = useState(todayStr);
  const [abrirFechamento, setAbrirFechamento] = useState(false);
  const [tipoFechamento, setTipoFechamento] = useState("diario");
  const [observacoes, setObservacoes] = useState("");

  const { data: fechamentos = [], isLoading: loadingFechamentos } = useFechamentosCaixa();
  const { data: resumo } = useResumoFechamento(periodoInicio, periodoFim);
  const { data: pagamentos = [], isLoading: loadingPagamentos } = usePagamentosPeriodo(periodoInicio, periodoFim);
  const criarFechamento = useCriarFechamento();

  const tipoData = useMemo(() => {
    const now = new Date();
    if (tipoFechamento === "diario") {
      return { inicio: format(now, "yyyy-MM-dd"), fim: format(now, "yyyy-MM-dd") };
    }
    if (tipoFechamento === "semanal") {
      return {
        inicio: format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        fim: format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
      };
    }
    return {
      inicio: format(startOfMonth(now), "yyyy-MM-dd"),
      fim: format(endOfMonth(now), "yyyy-MM-dd"),
    };
  }, [tipoFechamento]);

  const resumoFechamento = useResumoFechamento(tipoData.inicio, tipoData.fim);

  const handleFecharCaixa = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const r = resumoFechamento.data;
      await criarFechamento.mutateAsync({
        tipo: tipoFechamento,
        dataInicio: tipoData.inicio,
        dataFim: tipoData.fim,
        totalRecebido: r?.total || 0,
        totalParcelas: r?.quantidade || 0,
        breakdownFormas: r?.formas || {},
        totalReceitasAvulsas: r?.receitasAvulsas || 0,
        totalDespesas: r?.despesas || 0,
        totalReceitas: r?.totalReceitas || 0,
        saldoPeriodo: r?.saldoPeriodo || 0,
        breakdownCategorias: r?.breakdownCategorias || {},
        breakdownDespesas: r?.breakdownDespesas || {},
        observacoes: observacoes || undefined,
        fechadoPor: user.id,
      });
      toast({ title: "Caixa fechado com sucesso!" });
      setAbrirFechamento(false);
      setObservacoes("");
    } catch {
      toast({ title: "Erro ao fechar caixa", variant: "destructive" });
    }
  };

  const handleExportarCSV = () => {
    if (!pagamentos.length) return;
    const header = "Data,Cliente,Valor,Forma\n";
    const rows = pagamentos.map((p: any) =>
      `${formatDateBR(p.data_pagamento)},${p.cliente_nome},${p.valor_pago},${p.forma_pagamento}`
    ).join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `pagamentos_${periodoInicio}_${periodoFim}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loadingFechamentos) {
    return (
      <div className="space-y-6 p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-5"><Skeleton className="h-8 w-24 mb-2" /><Skeleton className="h-4 w-32" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Calculator className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">Fechamento de Caixa</h1>
            <p className="text-sm text-muted-foreground">Valide e consolide os pagamentos do período</p>
          </div>
        </div>
        <Button onClick={() => setAbrirFechamento(true)}>+ Novo Fechamento</Button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={TrendingUp}
          label="Receitas (período)"
          value={formatBRL(resumo?.totalReceitas || 0)}
          color="success"
        />
        <StatCard
          icon={ArrowDownCircle}
          label="Despesas (período)"
          value={formatBRL(resumo?.despesas || 0)}
          color="destructive"
        />
        <StatCard
          icon={CreditCard}
          label="Saldo do período"
          value={formatBRL(resumo?.saldoPeriodo || 0)}
          color={(resumo?.saldoPeriodo || 0) >= 0 ? "primary" : "destructive"}
        />
        <StatCard
          icon={AlertTriangle}
          label="Fechamentos realizados"
          value={String(fechamentos.length)}
          color="warning"
        />
      </div>

      {/* Breakdown resumo do período */}
      {resumo && (
        <Card className="shadow-sm">
          <CardContent className="p-5 space-y-3">
            <h3 className="text-base font-semibold text-foreground">Resumo do Período</h3>
            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Origem</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Valor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow className="hover:bg-muted/30">
                    <TableCell className="text-foreground">Propostas (parcelas)</TableCell>
                    <TableCell className="text-right font-mono text-sm text-success">{formatBRL(resumo.total)}</TableCell>
                  </TableRow>
                  {resumo.receitasAvulsas > 0 && (
                    <TableRow className="hover:bg-muted/30">
                      <TableCell className="text-foreground">Receitas avulsas</TableCell>
                      <TableCell className="text-right font-mono text-sm text-success">{formatBRL(resumo.receitasAvulsas)}</TableCell>
                    </TableRow>
                  )}
                  <TableRow className="bg-success/5 hover:bg-success/10 font-semibold">
                    <TableCell className="text-foreground font-semibold">Total Receitas</TableCell>
                    <TableCell className="text-right font-mono text-sm text-success font-bold">{formatBRL(resumo.totalReceitas)}</TableCell>
                  </TableRow>

                  {/* Despesas breakdown */}
                  {Object.entries(resumo.breakdownDespesas).map(([cat, val]) => (
                    <TableRow key={cat} className="hover:bg-muted/30">
                      <TableCell className="text-foreground pl-6">{catLabel(cat)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-destructive">- {formatBRL(val)}</TableCell>
                    </TableRow>
                  ))}
                  {resumo.despesas > 0 && (
                    <TableRow className="bg-destructive/5 hover:bg-destructive/10 font-semibold">
                      <TableCell className="text-foreground font-semibold">Total Despesas</TableCell>
                      <TableCell className="text-right font-mono text-sm text-destructive font-bold">- {formatBRL(resumo.despesas)}</TableCell>
                    </TableRow>
                  )}

                  <TableRow className={cn("font-bold", (resumo.saldoPeriodo >= 0) ? "bg-primary/5" : "bg-destructive/5")}>
                    <TableCell className="text-foreground font-bold text-base">Saldo</TableCell>
                    <TableCell className={cn("text-right font-mono font-bold text-base",
                      resumo.saldoPeriodo >= 0 ? "text-primary" : "text-destructive"
                    )}>
                      {formatBRL(resumo.saldoPeriodo)}
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Breakdown por forma */}
      {resumo && Object.keys(resumo.formas).length > 0 && (
        <Card className="shadow-sm">
          <CardContent className="p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Por forma de pagamento</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {Object.entries(resumo.formas).map(([forma, valor]) => (
                <div key={forma} className="flex justify-between items-center p-3 rounded-lg border border-border bg-muted/30">
                  <span className="text-sm text-muted-foreground">{FORMAS_LABEL[forma] || forma}</span>
                  <span className="text-sm font-semibold text-foreground font-mono">{formatBRL(valor)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabela de Pagamentos */}
      <Card className="shadow-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-border gap-2">
          <h2 className="text-sm font-semibold text-foreground">Pagamentos do período</h2>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={periodoInicio}
              onChange={(e) => setPeriodoInicio(e.target.value)}
              className="h-8 rounded-md border border-input bg-background text-foreground text-xs px-2"
            />
            <input
              type="date"
              value={periodoFim}
              onChange={(e) => setPeriodoFim(e.target.value)}
              className="h-8 rounded-md border border-input bg-background text-foreground text-xs px-2"
            />
            <Button variant="outline" size="sm" onClick={handleExportarCSV} disabled={!pagamentos.length}>
              <Download className="w-3 h-3 mr-1" /> Exportar
            </Button>
          </div>
        </div>

        {loadingPagamentos ? (
          <div className="p-4 space-y-2">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
          </div>
        ) : pagamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <FileText className="h-10 w-10 opacity-20 mb-2" />
            <p className="text-sm">Nenhum pagamento no período selecionado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Data</TableHead>
                  <TableHead className="font-semibold text-foreground">Cliente</TableHead>
                  <TableHead className="font-semibold text-foreground">Forma</TableHead>
                  <TableHead className="text-right font-semibold text-foreground">Valor</TableHead>
                  <TableHead className="font-semibold text-foreground">Obs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pagamentos.map((p: any) => (
                  <TableRow key={p.id} className="hover:bg-muted/30">
                    <TableCell className="text-sm text-foreground">
                      {formatDateBR(p.data_pagamento)}
                    </TableCell>
                    <TableCell className="font-medium text-foreground">{p.cliente_nome}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                        {FORMAS_LABEL[p.forma_pagamento] || p.forma_pagamento}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right font-mono font-medium text-foreground">
                      {formatBRL(p.valor_pago)}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground max-w-32 truncate">
                      {p.observacoes || "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Histórico de Fechamentos */}
      <Card className="shadow-sm">
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Histórico de fechamentos</h2>
        </div>
        {fechamentos.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Lock className="h-10 w-10 opacity-20 mb-2" />
            <p className="text-sm">Nenhum fechamento realizado ainda</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {fechamentos.map((f) => (
              <Collapsible key={f.id}>
                <CollapsibleTrigger asChild>
                  <div className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div>
                      <p className="text-sm font-medium text-foreground">
                        {f.tipo === "diario" ? "Diário" : f.tipo === "semanal" ? "Semanal" : "Mensal"}
                        {" — "}{formatDateBR(f.data_inicio)}
                        {f.data_inicio !== f.data_fim && ` a ${formatDateBR(f.data_fim)}`}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {f.total_parcelas_pagas} pagamentos
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="font-mono font-bold text-foreground">{formatBRL(f.saldo_periodo || f.total_recebido)}</p>
                        {f.total_despesas > 0 && (
                          <p className="text-xs text-destructive font-mono">- {formatBRL(f.total_despesas)}</p>
                        )}
                      </div>
                      <Badge variant="outline" className={cn(
                        "text-xs",
                        f.status === "conferido"
                          ? "bg-success/10 text-success border-success/30"
                          : f.status === "fechado"
                          ? "bg-primary/10 text-primary border-primary/30"
                          : "bg-muted text-muted-foreground"
                      )}>
                        {f.status === "conferido" ? "Conferido" : f.status === "fechado" ? "Fechado" : "Aberto"}
                      </Badge>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </div>
                  </div>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="px-4 pb-4 space-y-2">
                    {f.breakdown_despesas && Object.keys(f.breakdown_despesas).length > 0 && (
                      <div className="rounded-lg border border-border p-3 space-y-1">
                        <p className="text-xs font-semibold text-foreground mb-1">Despesas</p>
                        {Object.entries(f.breakdown_despesas).map(([cat, val]) => (
                          <div key={cat} className="flex justify-between text-xs">
                            <span className="text-muted-foreground">{catLabel(cat)}</span>
                            <span className="text-destructive font-mono">- {formatBRL(val as number)}</span>
                          </div>
                        ))}
                      </div>
                    )}
                    {f.observacoes && (
                      <p className="text-xs text-muted-foreground italic">{f.observacoes}</p>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            ))}
          </div>
        )}
      </Card>

      {/* Modal Fechar Caixa */}
      <Dialog open={abrirFechamento} onOpenChange={setAbrirFechamento}>
        <DialogContent className="w-[90vw] max-w-xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
          <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border shrink-0">
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Lock className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <DialogTitle className="text-base font-semibold text-foreground">Fechar Caixa</DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">Consolide e valide receitas e despesas do período</p>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-5 space-y-4">
              {/* Tipo de fechamento */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {(["diario", "semanal", "mensal"] as const).map((tipo) => (
                  <Button
                    key={tipo}
                    variant="outline"
                    onClick={() => setTipoFechamento(tipo)}
                    className={cn(
                      "h-auto p-3 text-sm font-medium",
                      tipoFechamento === tipo
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground"
                    )}
                  >
                    {tipo === "diario" ? "Diário" : tipo === "semanal" ? "Semanal" : "Mensal"}
                  </Button>
                ))}
              </div>

              {/* Resumo do período - tabela completa */}
              <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">
                <Table>
                  <TableBody>
                    <TableRow className="hover:bg-muted/30">
                      <TableCell className="text-sm text-muted-foreground">Período</TableCell>
                      <TableCell className="text-right text-sm text-foreground">
                        {formatDateBR(tipoData.inicio)}
                        {tipoData.inicio !== tipoData.fim && ` a ${formatDateBR(tipoData.fim)}`}
                      </TableCell>
                    </TableRow>
                    <TableRow className="hover:bg-muted/30">
                      <TableCell className="text-sm text-foreground">
                        <span className="flex items-center gap-2"><ArrowUpCircle className="w-3.5 h-3.5 text-success" /> Propostas (parcelas)</span>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-success">{formatBRL(resumoFechamento.data?.total || 0)}</TableCell>
                    </TableRow>
                    {(resumoFechamento.data?.receitasAvulsas || 0) > 0 && (
                      <TableRow className="hover:bg-muted/30">
                        <TableCell className="text-sm text-foreground">
                          <span className="flex items-center gap-2"><ArrowUpCircle className="w-3.5 h-3.5 text-success" /> Receitas avulsas</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-success">{formatBRL(resumoFechamento.data?.receitasAvulsas || 0)}</TableCell>
                      </TableRow>
                    )}
                    <TableRow className="bg-success/5 font-semibold">
                      <TableCell className="text-sm font-semibold text-foreground">Total Receitas</TableCell>
                      <TableCell className="text-right font-mono text-sm font-bold text-success">{formatBRL(resumoFechamento.data?.totalReceitas || 0)}</TableCell>
                    </TableRow>

                    {/* Despesas */}
                    {resumoFechamento.data && Object.entries(resumoFechamento.data.breakdownDespesas).map(([cat, val]) => (
                      <TableRow key={cat} className="hover:bg-muted/30">
                        <TableCell className="text-sm text-foreground pl-6">
                          <span className="flex items-center gap-2"><ArrowDownCircle className="w-3.5 h-3.5 text-destructive" /> {catLabel(cat)}</span>
                        </TableCell>
                        <TableCell className="text-right font-mono text-sm text-destructive">- {formatBRL(val)}</TableCell>
                      </TableRow>
                    ))}
                    {(resumoFechamento.data?.despesas || 0) > 0 && (
                      <TableRow className="bg-destructive/5 font-semibold">
                        <TableCell className="text-sm font-semibold text-foreground">Total Despesas</TableCell>
                        <TableCell className="text-right font-mono text-sm font-bold text-destructive">- {formatBRL(resumoFechamento.data?.despesas || 0)}</TableCell>
                      </TableRow>
                    )}

                    <TableRow className={cn("font-bold", (resumoFechamento.data?.saldoPeriodo || 0) >= 0 ? "bg-primary/5" : "bg-destructive/5")}>
                      <TableCell className="font-bold text-foreground">Saldo</TableCell>
                      <TableCell className={cn("text-right font-mono font-bold",
                        (resumoFechamento.data?.saldoPeriodo || 0) >= 0 ? "text-primary" : "text-destructive"
                      )}>
                        {formatBRL(resumoFechamento.data?.saldoPeriodo || 0)}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </div>

              {/* Breakdown formas */}
              {resumoFechamento.data && Object.entries(resumoFechamento.data.formas).length > 0 && (
                <div className="rounded-lg border border-border p-3 space-y-1">
                  <p className="text-xs font-semibold text-foreground mb-1">Por forma de pagamento</p>
                  {Object.entries(resumoFechamento.data.formas).map(([f, v]) => (
                    <div key={f} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{FORMAS_LABEL[f] || f}</span>
                      <span className="text-foreground font-mono">{formatBRL(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Observações */}
              <Textarea
                placeholder="Observações do fechamento (opcional)"
                className="resize-none h-20"
                value={observacoes}
                onChange={(e) => setObservacoes(e.target.value)}
              />
            </div>
          </ScrollArea>

          <DialogFooter className="flex justify-between gap-2 p-4 border-t border-border bg-muted/30 shrink-0">
            <Button variant="outline" onClick={() => setAbrirFechamento(false)}>Cancelar</Button>
            <Button onClick={handleFecharCaixa} disabled={criarFechamento.isPending}>
              <Lock className="w-4 h-4 mr-1" />
              {criarFechamento.isPending ? "Fechando..." : "Fechar Caixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
