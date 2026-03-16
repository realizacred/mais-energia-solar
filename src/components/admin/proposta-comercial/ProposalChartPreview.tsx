import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Eye, Download } from "lucide-react";
import { useRenderChart } from "@/hooks/useProposalCharts";
import { buildChartDataset } from "@/lib/proposal-charts/charts-datasets";
import type { ProposalChart, ChartDataset } from "@/lib/proposal-charts/charts-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chart: ProposalChart;
}

// Sample data for preview
function getSampleData(chart: ProposalChart): Record<string, unknown>[] {
  const months = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

  if (chart.chart_type === "pie" || chart.chart_type === "doughnut") {
    return [
      { [chart.label_field]: "Conta Antes", [chart.value_field]: 850 },
      { [chart.label_field]: "Geração", [chart.value_field]: 720 },
      { [chart.label_field]: "Disponibilidade", [chart.value_field]: 100 },
      { [chart.label_field]: "ICMS", [chart.value_field]: 45 },
    ];
  }

  if (chart.placeholder.includes("fluxo_caixa")) {
    return Array.from({ length: 25 }, (_, i) => ({
      [chart.label_field]: `Ano ${i + 1}`,
      [chart.value_field]: -45000 + i * 4500,
    }));
  }

  return months.map((mes) => ({
    [chart.label_field]: mes,
    [chart.value_field]: Math.round(800 + Math.random() * 400),
  }));
}

export function ProposalChartPreview({ open, onOpenChange, chart }: Props) {
  const renderMutation = useRenderChart();
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const handleRender = () => {
    const sampleData = getSampleData(chart);
    const dataset: ChartDataset = buildChartDataset(chart, sampleData);

    renderMutation.mutate(
      {
        chart_config: {
          chart_type: chart.chart_type,
          title: chart.title,
          subtitle: chart.subtitle ?? undefined,
          width: chart.width,
          height: chart.height,
          colors: chart.colors as string[],
          show_legend: chart.show_legend,
          show_grid: chart.show_grid,
          show_labels: chart.show_labels,
        },
        dataset,
      },
      {
        onSuccess: (data) => {
          setImageBase64(data.image_base64);
        },
      }
    );
  };

  const handleDownload = () => {
    if (!imageBase64) return;
    const link = document.createElement("a");
    link.href = `data:image/png;base64,${imageBase64}`;
    link.download = `${chart.placeholder}.png`;
    link.click();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setImageBase64(null); }}>
      <DialogContent className="w-[90vw] max-w-3xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <Eye className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              Preview — {chart.name}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Placeholder: <code className="bg-muted px-1 rounded">[{chart.placeholder}]</code>
            </p>
          </div>
        </DialogHeader>

        <div className="p-5 flex-1 min-h-0 overflow-y-auto space-y-4">
          {!imageBase64 && !renderMutation.isPending && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Eye className="w-10 h-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground mb-4">
                Clique para gerar um preview com dados de exemplo
              </p>
              <Button onClick={handleRender}>
                <Eye className="w-4 h-4 mr-1" /> Gerar Preview
              </Button>
            </div>
          )}

          {renderMutation.isPending && (
            <div className="flex flex-col items-center py-12">
              <Skeleton className="w-full max-w-[800px] aspect-video rounded-lg" />
              <p className="text-sm text-muted-foreground mt-3">Renderizando gráfico...</p>
            </div>
          )}

          {imageBase64 && (
            <div className="space-y-3">
              <img
                src={`data:image/png;base64,${imageBase64}`}
                alt={chart.title}
                className="w-full rounded-lg border border-border shadow-sm"
              />
              <div className="flex justify-center gap-2">
                <Button variant="outline" size="sm" onClick={handleRender}>
                  <Eye className="w-4 h-4 mr-1" /> Regerar
                </Button>
                <Button variant="outline" size="sm" onClick={handleDownload}>
                  <Download className="w-4 h-4 mr-1" /> Download PNG
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
