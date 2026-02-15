import { useState, useCallback, useRef, useMemo } from "react";
import { BarChart3, Clipboard, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { type UCData, MESES, formatBRL } from "./types";

interface Props {
  ucs: UCData[];
  onUcsChange: (ucs: UCData[]) => void;
  potenciaKwp: number;
  onPotenciaChange: (p: number) => void;
}

const MONTH_LABELS: Record<string, string> = {
  jan: "Jan", fev: "Fev", mar: "Mar", abr: "Abr", mai: "Mai", jun: "Jun",
  jul: "Jul", ago: "Ago", set: "Set", out: "Out", nov: "Nov", dez: "Dez",
};

// Solar irradiation seasonality factor (Brazil avg)
const SEASON_FACTOR: Record<string, number> = {
  jan: 1.15, fev: 1.10, mar: 1.05, abr: 0.95, mai: 0.85, jun: 0.80,
  jul: 0.80, ago: 0.85, set: 0.95, out: 1.05, nov: 1.10, dez: 1.15,
};

export function StepConsumptionIntelligence({ ucs, onUcsChange, potenciaKwp, onPotenciaChange }: Props) {
  const [annualInput, setAnnualInput] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [dragging, setDragging] = useState(false);
  const chartRef = useRef<HTMLDivElement>(null);

  const uc = ucs[0];
  const consumoMeses = uc?.consumo_meses || {};

  const mediaConsumo = useMemo(() => {
    const vals = MESES.map(m => consumoMeses[m] || 0);
    const total = vals.reduce((a, b) => a + b, 0);
    return total > 0 ? total / 12 : 0;
  }, [consumoMeses]);

  const totalAnual = useMemo(() => {
    return MESES.reduce((s, m) => s + (consumoMeses[m] || 0), 0);
  }, [consumoMeses]);

  // Suggested kWp based on consumption (approx 130 kWh/kWp/month in Brazil)
  const suggestedKwp = useMemo(() => {
    if (mediaConsumo <= 0) return 0;
    return Math.round((mediaConsumo / 130) * 100) / 100;
  }, [mediaConsumo]);

  const updateMonth = useCallback((mes: string, value: number) => {
    if (!uc) return;
    const updated = [...ucs];
    updated[0] = {
      ...updated[0],
      consumo_meses: { ...updated[0].consumo_meses, [mes]: Math.max(0, value) },
    };
    // Update consumo_mensal as average
    const total = MESES.reduce((s, m) => s + (m === mes ? Math.max(0, value) : (updated[0].consumo_meses[m] || 0)), 0);
    updated[0].consumo_mensal = Math.round(total / 12);
    onUcsChange(updated);
  }, [ucs, onUcsChange]);

  const autoDistribute = useCallback((annual: number) => {
    if (annual <= 0) return;
    const updated = [...ucs];
    const newMeses: Record<string, number> = {};
    MESES.forEach(m => {
      newMeses[m] = Math.round((annual / 12) * (SEASON_FACTOR[m] || 1));
    });
    updated[0] = {
      ...updated[0],
      consumo_meses: newMeses,
      consumo_mensal: Math.round(annual / 12),
    };
    onUcsChange(updated);
  }, [ucs, onUcsChange]);

  const handlePaste = useCallback((text: string) => {
    // Try to parse 12 numbers from pasted text (comma, tab, newline separated)
    const nums = text.replace(/[^\d.,\s\t\n]/g, "").split(/[\s,\t\n]+/).map(s => parseInt(s.replace(/\./g, "").replace(",", "."), 10)).filter(n => !isNaN(n) && n > 0);
    if (nums.length >= 12) {
      const updated = [...ucs];
      const newMeses: Record<string, number> = {};
      MESES.forEach((m, i) => { newMeses[m] = nums[i] || 0; });
      const total = Object.values(newMeses).reduce((a, b) => a + b, 0);
      updated[0] = { ...updated[0], consumo_meses: newMeses, consumo_mensal: Math.round(total / 12) };
      onUcsChange(updated);
      setPasteMode(false);
    }
  }, [ucs, onUcsChange]);

  const chartData = useMemo(() => MESES.map(m => ({
    mes: MONTH_LABELS[m],
    key: m,
    kwh: consumoMeses[m] || 0,
  })), [consumoMeses]);

  const maxKwh = Math.max(500, ...chartData.map(d => d.kwh)) * 1.2;

  if (!uc) return null;

  const applySuggested = () => {
    if (suggestedKwp > 0) onPotenciaChange(suggestedKwp);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" /> Inteligência de Consumo
        </h3>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-[11px] gap-1"
            onClick={() => setPasteMode(!pasteMode)}
          >
            <Clipboard className="h-3 w-3" /> Colar 12 meses
          </Button>
        </div>
      </div>

      {/* Paste mode */}
      {pasteMode && (
        <div className="p-3 rounded-md border border-primary/20 bg-primary/5 space-y-2">
          <Label className="text-xs">Cole aqui os 12 valores de consumo (separados por vírgula, tab ou linha)</Label>
          <textarea
            className="w-full h-16 text-xs font-mono rounded-md border border-border p-2 bg-background resize-none"
            placeholder="350, 380, 420, 410, 390, 370, 360, 380, 400, 430, 450, 370"
            onPaste={(e) => {
              e.preventDefault();
              handlePaste(e.clipboardData.getData("text"));
            }}
            onChange={(e) => handlePaste(e.target.value)}
          />
        </div>
      )}

      {/* Annual quick input */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 flex-1">
          <Label className="text-xs whitespace-nowrap">Consumo Anual (kWh):</Label>
          <Input
            type="number"
            min={0}
            value={annualInput}
            onChange={(e) => setAnnualInput(e.target.value)}
            placeholder="Ex: 6000"
            className="h-8 text-xs w-28"
          />
          <Button
            variant="secondary"
            size="sm"
            className="h-8 text-[11px] gap-1"
            disabled={!annualInput || Number(annualInput) <= 0}
            onClick={() => autoDistribute(Number(annualInput))}
          >
            <Sparkles className="h-3 w-3" /> Auto-distribuir
          </Button>
        </div>
        {totalAnual > 0 && (
          <Badge variant="outline" className="text-[10px] font-mono shrink-0">
            Total: {totalAnual.toLocaleString("pt-BR")} kWh/ano
          </Badge>
        )}
      </div>

      {/* Interactive Chart */}
      <div className="rounded-md border border-border/50 bg-card p-3" ref={chartRef}>
        <div className="text-[10px] text-muted-foreground mb-2 text-right">Arraste as barras para ajustar • Clique para editar</div>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
            <XAxis dataKey="mes" tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 10 }} stroke="hsl(var(--muted-foreground))" width={40} />
            {mediaConsumo > 0 && (
              <ReferenceLine y={mediaConsumo} stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeWidth={1.5} label={{ value: `Média: ${Math.round(mediaConsumo)}`, fontSize: 10, fill: "hsl(var(--primary))", position: "right" }} />
            )}
            <Bar dataKey="kwh" radius={[3, 3, 0, 0]} cursor="ns-resize">
              {chartData.map((entry, i) => (
                <Cell
                  key={entry.key}
                  fill={entry.kwh > mediaConsumo * 1.2 ? "hsl(var(--destructive))" : entry.kwh < mediaConsumo * 0.8 ? "hsl(var(--warning))" : "hsl(var(--primary))"}
                  fillOpacity={0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly inputs grid */}
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1.5">
        {MESES.map(m => (
          <div key={m} className="space-y-0.5">
            <Label className="text-[9px] text-muted-foreground uppercase text-center block">{MONTH_LABELS[m]}</Label>
            <Input
              type="number"
              min={0}
              value={consumoMeses[m] || ""}
              onChange={(e) => updateMonth(m, Number(e.target.value))}
              className="h-7 text-[11px] text-center px-1 font-mono"
            />
          </div>
        ))}
      </div>

      {/* Suggested System Size */}
      {mediaConsumo > 0 && (
        <div className="rounded-md border-2 border-primary/30 bg-primary/5 p-4 flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Sistema Sugerido</p>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-bold font-mono text-primary">{suggestedKwp}</span>
              <span className="text-sm text-muted-foreground">kWp</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              Média {Math.round(mediaConsumo)} kWh/mês • ~{Math.ceil(suggestedKwp * 1000 / 550)} módulos (550W)
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <Button size="sm" className="h-8 text-xs gap-1" onClick={applySuggested}>
              <Zap className="h-3 w-3" /> Aplicar {suggestedKwp} kWp
            </Button>
            <div className="flex items-center gap-2">
              <Label className="text-[10px]">ou manual:</Label>
              <Input
                type="number"
                min={0}
                step={0.1}
                value={potenciaKwp || ""}
                onChange={(e) => onPotenciaChange(Number(e.target.value))}
                className="h-7 text-xs w-20 font-mono"
              />
              <span className="text-[10px] text-muted-foreground">kWp</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
