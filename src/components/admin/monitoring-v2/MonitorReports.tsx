import React, { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { PageHeader } from "@/components/ui-kit/PageHeader";
import { SectionCard } from "@/components/ui-kit/SectionCard";
import { EmptyState } from "@/components/ui-kit/EmptyState";
import { LoadingState } from "@/components/ui-kit/LoadingState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileText, Download, BarChart3, Calendar, Sun } from "lucide-react";
import { listPlantsWithHealth, listAllReadings } from "@/services/monitoring/monitorService";
import { getFinancials, getPerformanceRatios } from "@/services/monitoring/monitorFinancialService";
import { MonitorGenerationChart } from "./charts/MonitorGenerationChart";
import { MonitorPRChart } from "./charts/MonitorPRChart";
import { formatBRL, formatEnergyAutoScale, formatCO2, formatDate } from "@/lib/formatters/index";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";

type PeriodType = "current_month" | "last_month" | "last_3_months" | "last_year";

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: "current_month", label: "Mês Atual" },
  { value: "last_month", label: "Mês Anterior" },
  { value: "last_3_months", label: "Últimos 3 Meses" },
  { value: "last_year", label: "Último Ano" },
];

function getDateRange(period: PeriodType): { start: string; end: string; label: string } {
  const now = new Date();
  const end = now.toISOString().slice(0, 10);

  switch (period) {
    case "current_month": {
      const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10);
      return { start, end, label: `Mês Atual (${start} a ${end})` };
    }
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0);
      return { start: s.toISOString().slice(0, 10), end: e.toISOString().slice(0, 10), label: `Mês Anterior` };
    }
    case "last_3_months": {
      const s = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      return { start: s.toISOString().slice(0, 10), end, label: "Últimos 3 Meses" };
    }
    case "last_year": {
      const s = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      return { start: s.toISOString().slice(0, 10), end, label: "Último Ano" };
    }
  }
}

export default function MonitorReports() {
  const [period, setPeriod] = useState<PeriodType>("current_month");
  const range = getDateRange(period);

  const { data: plants = [], isLoading: loadingPlants } = useQuery({
    queryKey: ["monitor-plants-health"],
    queryFn: listPlantsWithHealth,
  });

  const { data: readings = [], isLoading: loadingReadings } = useQuery({
    queryKey: ["monitor-readings-report", range.start, range.end],
    queryFn: () => listAllReadings(range.start, range.end),
  });

  const { data: financials } = useQuery({
    queryKey: ["monitor-financials-report", readings.length],
    queryFn: () => {
      const totalKwh = readings.reduce((s, r) => s + r.energy_kwh, 0);
      return getFinancials(0, totalKwh);
    },
    enabled: readings.length > 0,
  });

  const { data: prData = [] } = useQuery({
    queryKey: ["monitor-pr-report", plants.length, readings.length],
    queryFn: () => getPerformanceRatios(
      plants.map((p) => ({ id: p.id, name: p.name, installed_power_kwp: p.installed_power_kwp, latitude: (p as any).latitude ?? null, longitude: (p as any).longitude ?? null })),
      readings
    ),
    enabled: plants.length > 0 && readings.length > 0,
  });

  // Aggregate per-plant data
  const plantSummary = useMemo(() => {
    const map = new Map<string, { name: string; kwh: number; kwp: number; pr: number }>();
    plants.forEach((p) => {
      map.set(p.id, { name: p.name, kwh: 0, kwp: p.installed_power_kwp || 0, pr: 0 });
    });
    readings.forEach((r) => {
      const entry = map.get(r.plant_id);
      if (entry) entry.kwh += r.energy_kwh;
    });
    prData.forEach((pr) => {
      const entry = map.get(pr.plant_id);
      if (entry) entry.pr = pr.pr_percent;
    });
    return Array.from(map.values()).sort((a, b) => b.kwh - a.kwh);
  }, [plants, readings, prData]);

  const totalKwh = readings.reduce((s, r) => s + r.energy_kwh, 0);

  const handleExportPDF = () => {
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Relatório de Monitoramento Solar", 14, 20);
    doc.setFontSize(10);
    doc.text(`Período: ${range.label}`, 14, 28);
    doc.text(`Gerado em: ${formatDate(new Date())}`, 14, 34);

    // Summary
    doc.setFontSize(12);
    doc.text("Resumo Geral", 14, 46);
    autoTable(doc, {
      startY: 50,
      head: [["Métrica", "Valor"]],
      body: [
        ["Total Usinas", String(plants.length)],
        ["Energia Total", formatEnergyAutoScale(totalKwh)],
        ["Economia (R$)", financials ? formatBRL(financials.savings_month_brl) : "—"],
        ["CO₂ Evitado", financials ? formatCO2(financials.co2_avoided_month_kg) : "—"],
      ],
      theme: "grid",
      styles: { fontSize: 9 },
    });

    // Per-plant table
    const finalY = (doc as any).lastAutoTable?.finalY || 90;
    doc.setFontSize(12);
    doc.text("Detalhamento por Usina", 14, finalY + 10);
    autoTable(doc, {
      startY: finalY + 14,
      head: [["Usina", "Potência (kWp)", "Geração (kWh)", "Economia (R$)", "PR (%)"]],
      body: plantSummary.map((p) => [
        p.name,
        p.kwp.toFixed(1),
        p.kwh.toFixed(1),
        financials ? formatBRL(p.kwh * financials.tarifa_kwh) : "—",
        p.pr > 0 ? `${p.pr}%` : "—",
      ]),
      theme: "striped",
      styles: { fontSize: 8 },
    });

    doc.save(`relatorio-solar-${range.start}-${range.end}.pdf`);
    toast.success("PDF exportado com sucesso!");
  };

  const handleExportExcel = () => {
    const wsData = [
      ["Relatório de Monitoramento Solar"],
      [`Período: ${range.label}`],
      [],
      ["Usina", "Potência (kWp)", "Geração (kWh)", "Economia (R$)", "PR (%)"],
      ...plantSummary.map((p) => [
        p.name,
        p.kwp,
        Number(p.kwh.toFixed(1)),
        financials ? Number((p.kwh * financials.tarifa_kwh).toFixed(2)) : 0,
        p.pr > 0 ? p.pr : "",
      ]),
      [],
      ["TOTAL", "", Number(totalKwh.toFixed(1)), financials ? Number(financials.savings_month_brl.toFixed(2)) : 0, ""],
    ];

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Relatório");
    XLSX.writeFile(wb, `relatorio-solar-${range.start}-${range.end}.xlsx`);
    toast.success("Excel exportado com sucesso!");
  };

  const isLoading = loadingPlants || loadingReadings;

  if (isLoading) return <LoadingState message="Carregando relatórios..." />;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Relatórios"
        description="Relatórios de geração, economia e performance das usinas"
        icon={FileText}
        actions={
          <div className="flex gap-2 items-center">
            <Select value={period} onValueChange={(v) => setPeriod(v as PeriodType)}>
              <SelectTrigger className="w-auto min-w-[160px] h-9 text-xs">
                <Calendar className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PERIOD_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" variant="outline" onClick={handleExportPDF} disabled={plants.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" />
              PDF
            </Button>
            <Button size="sm" variant="outline" onClick={handleExportExcel} disabled={plants.length === 0}>
              <Download className="h-3.5 w-3.5 mr-1" />
              Excel
            </Button>
          </div>
        }
      />

      {plants.length === 0 ? (
        <EmptyState
          icon={Sun}
          title="Nenhuma usina cadastrada"
          description="Conecte um provedor de monitoramento para gerar relatórios."
        />
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <ReportCard label="Usinas" value={String(plants.length)} />
            <ReportCard label="Energia Total" value={formatEnergyAutoScale(totalKwh)} />
            <ReportCard label="Economia" value={financials ? formatBRL(financials.savings_month_brl) : "—"} />
            <ReportCard label="CO₂ Evitado" value={financials ? formatCO2(financials.co2_avoided_month_kg) : "—"} />
          </div>

          {/* Generation Chart */}
          <SectionCard title={`Geração — ${range.label}`} icon={BarChart3} variant="blue">
            <MonitorGenerationChart readings={readings} />
          </SectionCard>

          {/* PR Chart */}
          {prData.length > 0 && (
            <SectionCard title="Performance Ratio por Usina" icon={BarChart3}>
              <MonitorPRChart data={prData} />
            </SectionCard>
          )}

          {/* Per-plant table */}
          <SectionCard title="Detalhamento por Usina" icon={Sun}>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs text-muted-foreground">
                    <th className="py-2 px-3 font-medium">Usina</th>
                    <th className="py-2 px-3 font-medium text-right">kWp</th>
                    <th className="py-2 px-3 font-medium text-right">Geração</th>
                    <th className="py-2 px-3 font-medium text-right">Economia</th>
                    <th className="py-2 px-3 font-medium text-right">PR</th>
                  </tr>
                </thead>
                <tbody>
                  {plantSummary.map((p, i) => (
                    <tr key={i} className="border-b border-border/40 hover:bg-muted/30 transition-colors">
                      <td className="py-2.5 px-3 font-medium text-foreground">{p.name}</td>
                      <td className="py-2.5 px-3 text-right text-muted-foreground">{p.kwp.toFixed(1)}</td>
                      <td className="py-2.5 px-3 text-right">{formatEnergyAutoScale(p.kwh)}</td>
                      <td className="py-2.5 px-3 text-right text-success">{financials ? formatBRL(p.kwh * financials.tarifa_kwh) : "—"}</td>
                      <td className="py-2.5 px-3 text-right">
                        {p.pr > 0 ? (
                          <span className={p.pr >= 75 ? "text-success" : p.pr >= 60 ? "text-warning" : "text-destructive"}>
                            {p.pr}%
                          </span>
                        ) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-border font-semibold">
                    <td className="py-2.5 px-3">TOTAL</td>
                    <td className="py-2.5 px-3 text-right">{plants.reduce((s, p) => s + (p.installed_power_kwp || 0), 0).toFixed(1)}</td>
                    <td className="py-2.5 px-3 text-right">{formatEnergyAutoScale(totalKwh)}</td>
                    <td className="py-2.5 px-3 text-right text-success">{financials ? formatBRL(financials.savings_month_brl) : "—"}</td>
                    <td className="py-2.5 px-3 text-right">—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </SectionCard>
        </>
      )}
    </div>
  );
}

function ReportCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border/60 bg-card p-4 ring-1 ring-primary/10">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-lg font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}
