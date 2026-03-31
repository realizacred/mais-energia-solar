/**
 * PlantGenerationReport — Reusable generation & performance report component.
 * Shows KPI cards, daily bar chart, 12-month historical table, and estimated reports.
 * Used in both usina detail and UC detail pages.
 */
import { useState } from "react";
import { formatDecimalBR } from "@/lib/formatters";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Zap, Activity, BarChart3, FileDown, ChevronLeft, ChevronRight,
  ChevronDown, FileBarChart, Trash2, CalendarRange,
} from "lucide-react";
import { useGenerationReport, type MonthlyReportRow } from "@/hooks/useGenerationReport";
import { useEstimatedReports, useDeleteEstimatedReport, type EstimatedReport } from "@/hooks/useEstimatedReports";
import { EstimateReportDialog } from "./EstimateReportDialog";
import { format, subMonths, addMonths, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";

interface Props {
  plantId: string;
  showExport?: boolean;
}

export function PlantGenerationReport({ plantId, showExport = true }: Props) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() => format(now, "yyyy-MM"));
  const { data: report, isLoading } = useGenerationReport(plantId, selectedMonth);
  const { data: estimatedReports = [] } = useEstimatedReports(plantId);
  const deleteMutation = useDeleteEstimatedReport();

  const [showEstimateDialog, setShowEstimateDialog] = useState(false);

  const handlePrevMonth = () => {
    const d = parseISO(`${selectedMonth}-01`);
    setSelectedMonth(format(subMonths(d, 1), "yyyy-MM"));
  };
  const handleNextMonth = () => {
    const d = parseISO(`${selectedMonth}-01`);
    const next = addMonths(d, 1);
    if (next <= now) setSelectedMonth(format(next, "yyyy-MM"));
  };

  const selectedLabel = format(parseISO(`${selectedMonth}-01`), "MMMM yyyy", { locale: ptBR });

  const handleDeleteEstimated = async (id: string) => {
    try {
      await deleteMutation.mutateAsync({ id, plantId });
      toast.success("Relatório estimado removido");
    } catch (e: any) {
      toast.error(e?.message || "Erro ao remover relatório");
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full rounded-lg" />
          ))}
        </div>
        <Skeleton className="h-[280px] w-full rounded-lg" />
        <Skeleton className="h-[300px] w-full rounded-lg" />
      </div>
    );
  }

  if (!report) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        Usina não encontrada ou sem dados.
      </div>
    );
  }

  // Find the selected month's data
  const monthData = report.monthlyData.find((m) => m.month === selectedMonth);
  const monthGen = monthData?.generation_kwh ?? 0;
  const monthProg = monthData?.prognosis_kwh ?? 0;
  const monthPerf = monthData?.performance_pct ?? 0;

  return (
    <div className="space-y-5">
      {/* Sub-tabs: Detalhado / Geração + Advanced dropdown */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">
            Detalhado
          </Badge>
          <Badge variant="outline" className="text-muted-foreground">
            Geração
          </Badge>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              Avançado
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setShowEstimateDialog(true)}>
              <FileBarChart className="w-4 h-4 mr-2" />
              Estimar relatórios antigos
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-l-[3px] border-l-warning">
          <CardContent className="flex items-center gap-3 py-4 px-4">
            <div className="w-9 h-9 rounded-lg bg-warning/10 flex items-center justify-center shrink-0">
              <Zap className="w-4 h-4 text-warning" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">
                {report.capacityKwp.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kWp
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Potência Instalada</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-success">
          <CardContent className="flex items-center gap-3 py-4 px-4">
            <div className="w-9 h-9 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-success" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">
                {report.totalGeneration.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kWh
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Geração (12 meses)</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-l-[3px] border-l-info">
          <CardContent className="flex items-center gap-3 py-4 px-4">
            <div className="w-9 h-9 rounded-lg bg-info/10 flex items-center justify-center shrink-0">
              <BarChart3 className="w-4 h-4 text-info" />
            </div>
            <div>
              <p className="text-xl font-bold text-foreground leading-none">
                {report.overallPerformance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} %
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Desempenho Geral</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Month selector + daily chart */}
      <Card>
        <CardContent className="pt-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Geração Diária</h3>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevMonth}>
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm font-medium text-foreground min-w-[140px] text-center capitalize">
                {selectedLabel}
              </span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={handleNextMonth}
                disabled={selectedMonth === format(now, "yyyy-MM")}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Month KPIs */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground">Geração</p>
              <p className="text-sm font-bold text-foreground">{monthGen.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kWh</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground">Prognóstico</p>
              <p className="text-sm font-bold text-foreground">{monthProg.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kWh</p>
            </div>
            <div className="rounded-lg bg-muted/40 p-3 text-center">
              <p className="text-xs text-muted-foreground">Desempenho</p>
              <p className={`text-sm font-bold ${monthPerf >= 90 ? "text-success" : monthPerf >= 70 ? "text-warning" : "text-destructive"}`}>
                {monthPerf.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} %
              </p>
            </div>
          </div>

          {/* Daily bar chart */}
          {report.dailyReadings.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">Sem leituras no período</p>
          ) : (
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={report.dailyReadings} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="reportBarGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.9} />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.4} vertical={false} />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  interval={report.dailyReadings.length > 15 ? Math.floor(report.dailyReadings.length / 8) : 0}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  tickLine={false}
                  axisLine={false}
                  unit=" kWh"
                  width={65}
                />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.3 }}
                  contentStyle={{
                    background: "hsl(var(--card))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: "10px",
                    fontSize: "12px",
                  }}
                  formatter={(value: number) => [`${value} kWh`, "Geração"]}
                  labelFormatter={(label) => `Dia ${label}`}
                />
                <Bar dataKey="kwh" radius={[3, 3, 0, 0]} maxBarSize={40} fill="url(#reportBarGrad)" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Monthly history table (12 months) */}
      <Card>
        <CardContent className="pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Meses Anteriores</h3>
            {showExport && (
              <Button variant="outline" size="sm" className="text-xs gap-1" onClick={() => handleExportPdf(report)}>
                <FileDown className="w-3.5 h-3.5" /> Exportar PDF
              </Button>
            )}
          </div>

          <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="font-semibold text-foreground">Mês/Ano</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Prognóstico (kWh/mês)</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Geração (kWh/mês)</TableHead>
                  <TableHead className="font-semibold text-foreground text-right">Desempenho</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[...report.monthlyData].reverse().map((row) => (
                  <TableRow
                    key={row.month}
                    className={`hover:bg-muted/30 cursor-pointer ${row.month === selectedMonth ? "bg-primary/5" : ""}`}
                    onClick={() => setSelectedMonth(row.month)}
                  >
                    <TableCell className="text-sm font-medium">{row.label}</TableCell>
                    <TableCell className="text-sm text-right font-mono">
                      {row.prognosis_kwh.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-sm text-right font-mono font-medium">
                      {row.generation_kwh.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge
                        variant="outline"
                        className={`text-xs font-mono ${
                          row.performance_pct >= 90
                            ? "border-success/30 text-success"
                            : row.performance_pct >= 70
                            ? "border-warning/30 text-warning"
                            : "border-destructive/30 text-destructive"
                        }`}
                      >
                        {row.performance_pct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Estimated Reports Section */}
      {estimatedReports.length > 0 && (
        <Card>
          <CardContent className="pt-5 space-y-3">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Relatórios Estimados</h3>
              <Badge variant="outline" className="text-xs bg-warning/10 text-warning border-warning/20">
                E
              </Badge>
            </div>

            <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-foreground">Período</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Tarifa</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Geração</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Retorno</TableHead>
                    <TableHead className="font-semibold text-foreground text-right">Desempenho</TableHead>
                    <TableHead className="w-[50px]" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {estimatedReports.map((er) => (
                    <TableRow key={er.id} className="hover:bg-muted/30">
                      <TableCell className="text-sm">
                        <div className="flex items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px] px-1 py-0 bg-warning/10 text-warning border-warning/20">
                            E
                          </Badge>
                          <span className="font-medium">
                            {format(parseISO(er.period_start), "dd/MM/yyyy")} — {format(parseISO(er.period_end), "dd/MM/yyyy")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        R$ {Number(er.tarifa_kwh).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono">
                        {er.geracao_periodo_kwh != null ? `${formatDecimalBR(er.geracao_periodo_kwh, 1)} kWh` : "—"}
                      </TableCell>
                      <TableCell className="text-sm text-right font-mono font-medium text-success">
                        R$ {er.retorno_estimado?.toLocaleString("pt-BR", { minimumFractionDigits: 2 }) ?? "—"}
                        {er.retorno_pct ? (
                          <span className="text-xs text-muted-foreground ml-1">({er.retorno_pct.toFixed(2)}%)</span>
                        ) : null}
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge
                          variant="outline"
                          className={`text-xs font-mono ${
                            (er.desempenho_pct ?? 0) >= 90
                              ? "border-success/30 text-success"
                              : (er.desempenho_pct ?? 0) >= 70
                              ? "border-warning/30 text-warning"
                              : "border-destructive/30 text-destructive"
                          }`}
                        >
                          {er.desempenho_pct?.toFixed(0) ?? "—"}%
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:bg-destructive/10"
                          onClick={() => handleDeleteEstimated(er.id)}
                          disabled={deleteMutation.isPending}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Estimate Dialog */}
      <EstimateReportDialog
        open={showEstimateDialog}
        onOpenChange={setShowEstimateDialog}
        plantId={plantId}
        capacityKwp={report.capacityKwp}
        totalInvestido={null}
      />
    </div>
  );
}

// ── PDF Export ──
async function handleExportPdf(report: NonNullable<ReturnType<typeof useGenerationReport>["data"]>) {
  const { default: jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");

  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.text("Relatório de Geração e Desempenho", pageWidth / 2, 20, { align: "center" });

  doc.setFontSize(11);
  doc.text(report.plantName, pageWidth / 2, 28, { align: "center" });

  // KPIs
  doc.setFontSize(10);
  doc.text(`Potência: ${report.capacityKwp} kWp`, 14, 40);
  doc.text(`Geração Total: ${report.totalGeneration.toLocaleString("pt-BR", { minimumFractionDigits: 2 })} kWh`, 14, 47);
  doc.text(`Desempenho Geral: ${report.overallPerformance.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`, 14, 54);

  // Monthly table
  autoTable(doc, {
    startY: 62,
    head: [["Mês/Ano", "Prognóstico (kWh)", "Geração (kWh)", "Desempenho"]],
    body: [...report.monthlyData].reverse().map((row) => [
      row.label,
      row.prognosis_kwh.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      row.generation_kwh.toLocaleString("pt-BR", { minimumFractionDigits: 2 }),
      `${row.performance_pct.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}%`,
    ]),
    styles: { fontSize: 9, cellPadding: 3 },
    headStyles: { fillColor: [37, 99, 235] },
    theme: "grid",
  });

  doc.save(`relatorio-geracao-${report.plantName.replace(/\s+/g, "_")}.pdf`);
}
