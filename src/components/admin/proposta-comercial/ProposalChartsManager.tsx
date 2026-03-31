import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart3, Plus, Pencil, Trash2, Eye, Image, FileText, Download, Copy, BookOpen } from "lucide-react";
import { useProposalCharts, useDeleteProposalChart } from "@/hooks/useProposalCharts";
import { ProposalChartFormDialog } from "./ProposalChartFormDialog";
import { ProposalChartPreview } from "./ProposalChartPreview";
import { ProposalChartsTutorial } from "./ProposalChartsTutorial";
import type { ProposalChart } from "@/lib/proposal-charts/charts-types";
import { toast } from "sonner";

const ENGINE_LABELS: Record<string, { label: string; icon: typeof Image }> = {
  rendered_image: { label: "PNG (Sistema)", icon: Image },
  docx_native: { label: "Word Nativo", icon: FileText },
};

const CHART_TYPE_LABELS: Record<string, string> = {
  bar: "Barras",
  line: "Linha",
  pie: "Pizza",
  doughnut: "Rosca",
  area: "Área",
  stacked_bar: "Barras Empilhadas",
};

export function ProposalChartsManager() {
  const { data: charts, isLoading } = useProposalCharts();
  const deleteMutation = useDeleteProposalChart();
  const [formOpen, setFormOpen] = useState(false);
  const [editingChart, setEditingChart] = useState<ProposalChart | null>(null);
  const [previewChart, setPreviewChart] = useState<ProposalChart | null>(null);
  const [tutorialOpen, setTutorialOpen] = useState(false);

  const handleEdit = (chart: ProposalChart) => {
    setEditingChart(chart);
    setFormOpen(true);
  };

  const handleNew = () => {
    setEditingChart(null);
    setFormOpen(true);
  };

  const handleDelete = (chart: ProposalChart) => {
    if (confirm(`Excluir gráfico "${chart.name}"?`)) {
      deleteMutation.mutate(chart.id);
    }
  };

  const handleCopyPlaceholder = (placeholder: string) => {
    navigator.clipboard.writeText(`[${placeholder}]`);
    toast.success(`Placeholder [${placeholder}] copiado!`);
  };

  const handleDownloadTemplateSample = () => {
    // Generate a minimal DOCX-like content as a text file with placeholders
    const content = `PROPOSTA DE SISTEMA FOTOVOLTAICO
========================================

ANÁLISE DE CONSUMO

[grafico_consumo_mensal]

GERAÇÃO DO SISTEMA

[grafico_geracao_mensal]

ECONOMIA MENSAL

[grafico_economia_mensal]

COMPARAÇÃO DE CUSTOS

[vc_grafico_de_comparacao]

RETORNO DO INVESTIMENTO

[s_fluxo_caixa_acumulado_anual]

========================================
Modelo de template com placeholders de gráfico.
Copie os placeholders acima para o seu template DOCX real.
Cada placeholder deve ficar sozinho na linha, sem texto ao redor.
`;
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "template_graficos_exemplo.txt";
    link.click();
    URL.revokeObjectURL(link.href);
    toast.success("Modelo de template baixado!");
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <BarChart3 className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Catálogo de Gráficos</h2>
            <p className="text-sm text-muted-foreground">Gráficos disponíveis para inserção em propostas</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setTutorialOpen(true)}>
            <BookOpen className="w-4 h-4 mr-1" /> Como Usar
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadTemplateSample}>
            <Download className="w-4 h-4 mr-1" /> Template Exemplo
          </Button>
          <Button size="sm" onClick={handleNew}>
            <Plus className="w-4 h-4 mr-1" /> Novo Gráfico
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full rounded-lg" />
          ))}
        </div>
      ) : !charts?.length ? (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="w-10 h-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-muted-foreground">Nenhum gráfico cadastrado</p>
            <p className="text-xs text-muted-foreground/70 mt-1">
              Clique em "Novo Gráfico" para começar
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-lg border border-border overflow-hidden overflow-x-auto">          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50 hover:bg-muted/50">
                <TableHead className="font-semibold text-foreground">Nome</TableHead>
                <TableHead className="font-semibold text-foreground">Placeholder</TableHead>
                <TableHead className="font-semibold text-foreground">Tipo</TableHead>
                <TableHead className="font-semibold text-foreground">Motor</TableHead>
                <TableHead className="font-semibold text-foreground">Status</TableHead>
                <TableHead className="font-semibold text-foreground text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {charts.map((chart) => {
                const engineInfo = ENGINE_LABELS[chart.engine] ?? { label: chart.engine, icon: Image };
                return (
                  <TableRow key={chart.id} className="hover:bg-muted/30 transition-colors align-middle">
                    <TableCell className="font-medium text-foreground">
                      <div>
                        <p className="text-sm font-medium">{chart.name}</p>
                        {chart.subtitle && (
                          <p className="text-xs text-muted-foreground">{chart.subtitle}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                        [{chart.placeholder}]
                      </code>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {CHART_TYPE_LABELS[chart.chart_type] ?? chart.chart_type}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <engineInfo.icon className="w-3.5 h-3.5" />
                        {engineInfo.label}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={chart.active
                          ? "bg-success/10 text-success border-success/20 text-xs"
                          : "bg-muted text-muted-foreground text-xs"
                        }
                      >
                        {chart.active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <TooltipProvider delayDuration={300}>
                        <div className="flex items-center justify-end gap-1">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => setPreviewChart(chart)}
                              >
                                <Eye className="w-4 h-4 text-primary" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Preview</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleCopyPlaceholder(chart.placeholder)}
                              >
                                <Copy className="w-4 h-4 text-info" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Copiar Placeholder</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleEdit(chart)}
                              >
                                <Pencil className="w-4 h-4 text-warning" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Editar</TooltipContent>
                          </Tooltip>

                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7"
                                onClick={() => handleDelete(chart)}
                              >
                                <Trash2 className="w-4 h-4 text-destructive" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent>Excluir</TooltipContent>
                          </Tooltip>
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      <ProposalChartFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        chart={editingChart}
      />

      {previewChart && (
        <ProposalChartPreview
          open={!!previewChart}
          onOpenChange={(open) => !open && setPreviewChart(null)}
          chart={previewChart}
        />
      )}

      <ProposalChartsTutorial
        open={tutorialOpen}
        onOpenChange={setTutorialOpen}
      />
    </div>
  );
}
