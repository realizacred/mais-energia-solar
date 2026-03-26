import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart3 } from "lucide-react";
import { useCreateProposalChart, useUpdateProposalChart } from "@/hooks/useProposalCharts";
import type { ProposalChart, ChartType, ChartEngine } from "@/lib/proposal-charts/charts-types";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  chart: ProposalChart | null;
}

const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "bar", label: "Barras" },
  { value: "line", label: "Linha" },
  { value: "pie", label: "Pizza" },
  { value: "doughnut", label: "Rosca" },
  { value: "area", label: "Área" },
  { value: "stacked_bar", label: "Barras Empilhadas" },
];

const ENGINES: { value: ChartEngine; label: string }[] = [
  { value: "rendered_image", label: "PNG (gerado pelo sistema)" },
  { value: "docx_native", label: "Word Nativo" },
];

export function ProposalChartFormDialog({ open, onOpenChange, chart }: Props) {
  const createMutation = useCreateProposalChart();
  const updateMutation = useUpdateProposalChart();
  const isEditing = !!chart;

  const [form, setForm] = useState({
    name: "",
    placeholder: "",
    chart_type: "bar" as ChartType,
    engine: "rendered_image" as ChartEngine,
    data_source: "",
    label_field: "label",
    value_field: "value",
    title: "",
    subtitle: "",
    colors: "" as string,
    width: 1600,
    height: 900,
    show_legend: true,
    show_grid: true,
    show_labels: true,
    active: true,
  });

  useEffect(() => {
    if (chart) {
      setForm({
        name: chart.name,
        placeholder: chart.placeholder,
        chart_type: chart.chart_type,
        engine: chart.engine,
        data_source: chart.data_source,
        label_field: chart.label_field,
        value_field: chart.value_field,
        title: chart.title,
        subtitle: chart.subtitle ?? "",
        colors: Array.isArray(chart.colors) ? chart.colors.join(", ") : "",
        width: chart.width,
        height: chart.height,
        show_legend: chart.show_legend,
        show_grid: chart.show_grid,
        show_labels: chart.show_labels,
        active: chart.active,
      });
    } else {
      setForm({
        name: "",
        placeholder: "",
        chart_type: "bar",
        engine: "rendered_image",
        data_source: "",
        label_field: "label",
        value_field: "value",
        title: "",
        subtitle: "",
        colors: "hsl(var(--primary))",
        width: 1600,
        height: 900,
        show_legend: true,
        show_grid: true,
        show_labels: true,
        active: true,
      });
    }
  }, [chart, open]);

  const handleSave = () => {
    const colorsArray = form.colors
      .split(",")
      .map((c) => c.trim())
      .filter(Boolean);

    const payload = {
      name: form.name,
      placeholder: form.placeholder,
      chart_type: form.chart_type,
      engine: form.engine,
      data_source: form.data_source,
      label_field: form.label_field,
      value_field: form.value_field,
      title: form.title,
      subtitle: form.subtitle || null,
      colors: colorsArray,
      chart_options: {},
      width: form.width,
      height: form.height,
      show_legend: form.show_legend,
      show_grid: form.show_grid,
      show_labels: form.show_labels,
      active: form.active,
    };

    if (isEditing) {
      updateMutation.mutate({ id: chart.id, ...payload }, { onSuccess: () => onOpenChange(false) });
    } else {
      createMutation.mutate(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[90vw] max-w-2xl p-0 gap-0 overflow-hidden flex flex-col max-h-[calc(100dvh-2rem)]">
        <DialogHeader className="flex flex-row items-center gap-3 p-5 pb-4 border-b border-border">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1">
            <DialogTitle className="text-base font-semibold text-foreground">
              {isEditing ? "Editar Gráfico" : "Novo Gráfico"}
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Configure o gráfico para uso em propostas
            </p>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-5 flex-1 min-h-0 overflow-y-auto">
          {/* Identificação */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Identificação</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Nome</Label>
                <Input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Geração Mensal"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Placeholder</Label>
                <Input
                  value={form.placeholder}
                  onChange={(e) => setForm({ ...form, placeholder: e.target.value })}
                  placeholder="grafico_geracao_mensal"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Tipo e Motor */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Tipo e Motor</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Tipo de Gráfico</Label>
                <Select value={form.chart_type} onValueChange={(v) => setForm({ ...form, chart_type: v as ChartType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CHART_TYPES.map((ct) => (
                      <SelectItem key={ct.value} value={ct.value}>{ct.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Motor de Renderização</Label>
                <Select value={form.engine} onValueChange={(v) => setForm({ ...form, engine: v as ChartEngine })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {ENGINES.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Dados */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Fonte de Dados</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Data Source</Label>
                <Input
                  value={form.data_source}
                  onChange={(e) => setForm({ ...form, data_source: e.target.value })}
                  placeholder="tabelas.geracao_mensal"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Campo Label</Label>
                <Input
                  value={form.label_field}
                  onChange={(e) => setForm({ ...form, label_field: e.target.value })}
                  placeholder="mes"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Campo Valor</Label>
                <Input
                  value={form.value_field}
                  onChange={(e) => setForm({ ...form, value_field: e.target.value })}
                  placeholder="valor"
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Visual */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Visual</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Título</Label>
                <Input
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="Geração Mensal Estimada"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Subtítulo</Label>
                <Input
                  value={form.subtitle}
                  onChange={(e) => setForm({ ...form, subtitle: e.target.value })}
                  placeholder="kWh por mês"
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Cores (hex, separadas por vírgula)</Label>
                <Input
                  value={form.colors}
                  onChange={(e) => setForm({ ...form, colors: e.target.value })}
                  placeholder="#3b82f6, #10b981"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Largura (px)</Label>
                <Input
                  type="number"
                  value={form.width}
                  onChange={(e) => setForm({ ...form, width: Number(e.target.value) })}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Altura (px)</Label>
                <Input
                  type="number"
                  value={form.height}
                  onChange={(e) => setForm({ ...form, height: Number(e.target.value) })}
                />
              </div>
            </div>
          </div>

          <div className="border-t border-border" />

          {/* Opções */}
          <div className="space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Opções</p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.show_legend} onCheckedChange={(v) => setForm({ ...form, show_legend: v })} />
                <Label className="text-xs">Legenda</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.show_grid} onCheckedChange={(v) => setForm({ ...form, show_grid: v })} />
                <Label className="text-xs">Grade</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.show_labels} onCheckedChange={(v) => setForm({ ...form, show_labels: v })} />
                <Label className="text-xs">Labels</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.active} onCheckedChange={(v) => setForm({ ...form, active: v })} />
                <Label className="text-xs">Ativo</Label>
              </div>
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 p-4 border-t border-border bg-muted/30">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={isPending || !form.name || !form.placeholder}>
            {isPending ? "Salvando..." : isEditing ? "Salvar" : "Criar"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
