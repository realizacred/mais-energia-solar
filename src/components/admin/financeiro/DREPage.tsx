import { useMemo, useState, useCallback } from "react";
import { TrendingUp, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingState } from "@/components/shared/LoadingState";
import { formatBRL } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useDRE, DREMes } from "@/hooks/useDRE";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Line, ComposedChart,
} from "recharts";

const MONTH_SHORT = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

export default function DREPage() {
  const currentYear = new Date().getFullYear();
  const [ano, setAno] = useState(String(currentYear));

  const anoMesInicio = `${ano}-01`;
  const anoMesFim = `${ano}-12`;

  const { data: meses = [], isLoading } = useDRE(anoMesInicio, anoMesFim);

  // Collect all expense categories
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    meses.forEach((m) => Object.keys(m.despesas_por_categoria).forEach((c) => cats.add(c)));
    return Array.from(cats).sort();
  }, [meses]);

  // Totals
  const totals = useMemo(() => {
    const t = {
      receitas_propostas: 0,
      receitas_avulsas: 0,
      total_receitas: 0,
      despesas_operacionais: 0,
      comissoes_pagas: 0,
      resultado_bruto: 0,
      resultado_liquido: 0,
      cats: {} as Record<string, number>,
    };
    meses.forEach((m) => {
      t.receitas_propostas += m.receitas_propostas;
      t.receitas_avulsas += m.receitas_avulsas;
      t.total_receitas += m.total_receitas;
      t.despesas_operacionais += m.despesas_operacionais;
      t.comissoes_pagas += m.comissoes_pagas;
      t.resultado_bruto += m.resultado_bruto;
      t.resultado_liquido += m.resultado_liquido;
      Object.entries(m.despesas_por_categoria).forEach(([k, v]) => {
        t.cats[k] = (t.cats[k] || 0) + v;
      });
    });
    return t;
  }, [meses]);

  // Chart data
  const chartData = useMemo(
    () =>
      meses.map((m, i) => ({
        name: MONTH_SHORT[i] || m.mes,
        Receitas: m.total_receitas,
        Despesas: m.despesas_operacionais,
        Resultado: m.resultado_liquido,
      })),
    [meses]
  );

  // CSV export
  const handleExportCSV = useCallback(() => {
    const header = ["Linha", ...meses.map((m) => m.mesLabel), "TOTAL"];
    const rows: string[][] = [];
    const addRow = (label: string, vals: number[], total: number) =>
      rows.push([label, ...vals.map((v) => String(v)), String(total)]);

    addRow("Propostas solares", meses.map((m) => m.receitas_propostas), totals.receitas_propostas);
    addRow("Serviços avulsos", meses.map((m) => m.receitas_avulsas), totals.receitas_avulsas);
    addRow("Total Receitas", meses.map((m) => m.total_receitas), totals.total_receitas);
    allCategories.forEach((cat) =>
      addRow(cat, meses.map((m) => m.despesas_por_categoria[cat] || 0), totals.cats[cat] || 0)
    );
    addRow("Total Despesas", meses.map((m) => m.despesas_operacionais), totals.despesas_operacionais);
    addRow("Resultado Bruto", meses.map((m) => m.resultado_bruto), totals.resultado_bruto);
    addRow("Comissões pagas", meses.map((m) => m.comissoes_pagas), totals.comissoes_pagas);
    addRow("Resultado Líquido", meses.map((m) => m.resultado_liquido), totals.resultado_liquido);

    const csv = [header, ...rows].map((r) => r.join(";")).join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `DRE_${ano}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [meses, totals, allCategories, ano]);

  const cell = (v: number, bold = false, colored = false) => (
    <TableCell
      className={cn(
        "text-right font-mono text-sm whitespace-nowrap",
        bold && "font-bold",
        colored && v > 0 && "text-success",
        colored && v < 0 && "text-destructive"
      )}
    >
      {formatBRL(v)}
    </TableCell>
  );

  if (isLoading) return <LoadingState />;

  return (
    <div className="space-y-6 p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-primary/10 text-primary">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-foreground">DRE — Demonstração de Resultado</h1>
            <p className="text-sm text-muted-foreground">Resultado operacional mensal consolidado</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={ano} onValueChange={setAno}>
            <SelectTrigger className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[currentYear - 2, currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={handleExportCSV}>
            <Download className="w-4 h-4 mr-1" /> CSV
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-0">
          <div className="rounded-lg border border-border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground sticky left-0 bg-muted/50 min-w-[180px]">
                    Linha
                  </TableHead>
                  {meses.map((m) => (
                    <TableHead key={m.mes} className="font-semibold text-foreground text-right whitespace-nowrap">
                      {MONTH_SHORT[parseInt(m.mes.split("-")[1], 10) - 1]}
                    </TableHead>
                  ))}
                  <TableHead className="font-semibold text-foreground text-right whitespace-nowrap">TOTAL</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {/* RECEITAS */}
                <TableRow className="bg-muted/30">
                  <TableCell className="font-bold text-foreground sticky left-0 bg-muted/30">RECEITAS</TableCell>
                  {meses.map((m) => <TableCell key={m.mes} />)}
                  <TableCell />
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-foreground sticky left-0 bg-card">Propostas solares</TableCell>
                  {meses.map((m) => <React.Fragment key={m.mes}>{cell(m.receitas_propostas)}</React.Fragment>)}
                  {cell(totals.receitas_propostas, true)}
                </TableRow>
                <TableRow>
                  <TableCell className="pl-6 text-foreground sticky left-0 bg-card">Serviços avulsos</TableCell>
                  {meses.map((m) => <React.Fragment key={m.mes}>{cell(m.receitas_avulsas)}</React.Fragment>)}
                  {cell(totals.receitas_avulsas, true)}
                </TableRow>
                <TableRow className="border-t-2 border-border">
                  <TableCell className="font-bold text-foreground sticky left-0 bg-card">Total Receitas</TableCell>
                  {meses.map((m) => <React.Fragment key={m.mes}>{cell(m.total_receitas, true)}</React.Fragment>)}
                  {cell(totals.total_receitas, true)}
                </TableRow>

                {/* DESPESAS */}
                <TableRow className="bg-muted/30">
                  <TableCell className="font-bold text-foreground sticky left-0 bg-muted/30">DESPESAS</TableCell>
                  {meses.map((m) => <TableCell key={m.mes} />)}
                  <TableCell />
                </TableRow>
                {allCategories.map((cat) => (
                  <TableRow key={cat}>
                    <TableCell className="pl-6 text-foreground sticky left-0 bg-card capitalize">{cat.replace(/_/g, " ")}</TableCell>
                    {meses.map((m) => (
                      <React.Fragment key={m.mes}>{cell(m.despesas_por_categoria[cat] || 0)}</React.Fragment>
                    ))}
                    {cell(totals.cats[cat] || 0, true)}
                  </TableRow>
                ))}
                <TableRow className="border-t-2 border-border">
                  <TableCell className="font-bold text-foreground sticky left-0 bg-card">Total Despesas</TableCell>
                  {meses.map((m) => <React.Fragment key={m.mes}>{cell(m.despesas_operacionais, true)}</React.Fragment>)}
                  {cell(totals.despesas_operacionais, true)}
                </TableRow>

                {/* RESULTADO BRUTO */}
                <TableRow className="bg-muted/30 border-t-2 border-border">
                  <TableCell className="font-bold text-foreground sticky left-0 bg-muted/30">RESULTADO BRUTO</TableCell>
                  {meses.map((m) => <React.Fragment key={m.mes}>{cell(m.resultado_bruto, true, true)}</React.Fragment>)}
                  {cell(totals.resultado_bruto, true, true)}
                </TableRow>

                {/* Comissões */}
                <TableRow>
                  <TableCell className="pl-6 text-foreground sticky left-0 bg-card">Comissões pagas</TableCell>
                  {meses.map((m) => <React.Fragment key={m.mes}>{cell(m.comissoes_pagas)}</React.Fragment>)}
                  {cell(totals.comissoes_pagas, true)}
                </TableRow>

                {/* RESULTADO LÍQUIDO */}
                <TableRow className="bg-muted/30 border-t-2 border-border">
                  <TableCell className="font-bold text-foreground sticky left-0 bg-muted/30">RESULTADO LÍQUIDO</TableCell>
                  {meses.map((m) => <React.Fragment key={m.mes}>{cell(m.resultado_liquido, true, true)}</React.Fragment>)}
                  {cell(totals.resultado_liquido, true, true)}
                </TableRow>
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Chart */}
      <Card className="bg-card border-border shadow-sm">
        <CardContent className="p-5">
          <h2 className="text-base font-semibold text-foreground mb-4">Evolução Mensal</h2>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={chartData}>
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(v: number) => `R$ ${(v / 1000).toFixed(0)}k`} tick={{ fontSize: 11 }} />
                <Tooltip formatter={(v: number) => formatBRL(v)} />
                <Legend />
                <Bar dataKey="Receitas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="Despesas" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Line dataKey="Resultado" stroke="hsl(var(--warning))" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
