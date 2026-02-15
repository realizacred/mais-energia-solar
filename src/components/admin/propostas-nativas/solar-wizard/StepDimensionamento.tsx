import { useState, useCallback, useMemo, useRef } from "react";
import { BarChart3, Clipboard, Sparkles, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, ResponsiveContainer, Cell, ReferenceLine } from "recharts";
import { cn } from "@/lib/utils";
import {
  MOCK_CONCESSIONARIAS, TELHADO_OPTIONS, ORIENTACAO_OPTIONS,
  MESES_LABELS, SEASON_FACTORS,
} from "./mockData";
import {
  type WizConsumoData, type WizTecnicoData,
  calcSuggestedKwp, calcGeracaoEstimada, calcNumModulos,
} from "./wizardState";

interface Props {
  consumo: WizConsumoData;
  onConsumoChange: (c: WizConsumoData) => void;
  tecnico: WizTecnicoData;
  onTecnicoChange: (t: WizTecnicoData) => void;
  estado: string;
}

export function StepDimensionamento({ consumo, onConsumoChange, tecnico, onTecnicoChange, estado }: Props) {
  const [annualInput, setAnnualInput] = useState("");
  const [pasteMode, setPasteMode] = useState(false);
  const [mediaInput, setMediaInput] = useState("");

  const media = useMemo(() => {
    const total = consumo.meses.reduce((a, b) => a + b, 0);
    return total > 0 ? total / 12 : 0;
  }, [consumo.meses]);

  const totalAnual = consumo.meses.reduce((a, b) => a + b, 0);
  const suggestedKwp = calcSuggestedKwp(media);
  const orientFator = ORIENTACAO_OPTIONS.find(o => o.value === tecnico.orientacao)?.fator ?? 1;
  const geracaoEst = calcGeracaoEstimada(suggestedKwp, orientFator);
  const cobertura = media > 0 ? Math.min(100, Math.round((geracaoEst / media) * 100)) : 0;
  const numModulos = calcNumModulos(suggestedKwp, 550);

  const concsFiltradas = useMemo(() => {
    if (!estado) return MOCK_CONCESSIONARIAS;
    return MOCK_CONCESSIONARIAS.filter(c => c.estado === estado);
  }, [estado]);

  const updateMonth = (idx: number, value: number) => {
    const newMeses = [...consumo.meses];
    newMeses[idx] = Math.max(0, value);
    const total = newMeses.reduce((a, b) => a + b, 0);
    onConsumoChange({ meses: newMeses, mediaMensal: Math.round(total / 12) });
  };

  const autoDistribute = (annual: number) => {
    if (annual <= 0) return;
    const newMeses = SEASON_FACTORS.map(f => Math.round((annual / 12) * f));
    onConsumoChange({ meses: newMeses, mediaMensal: Math.round(annual / 12) });
  };

  const fillFromMedia = (avg: number) => {
    if (avg <= 0) return;
    const newMeses = SEASON_FACTORS.map(f => Math.round(avg * f));
    onConsumoChange({ meses: newMeses, mediaMensal: avg });
  };

  const handlePaste = (text: string) => {
    const nums = text.replace(/[^\d.,\s\t\n]/g, "").split(/[\s,\t\n]+/).map(s => parseInt(s.replace(/\./g, "").replace(",", "."), 10)).filter(n => !isNaN(n) && n > 0);
    if (nums.length >= 12) {
      const newMeses = nums.slice(0, 12);
      const total = newMeses.reduce((a, b) => a + b, 0);
      onConsumoChange({ meses: newMeses, mediaMensal: Math.round(total / 12) });
      setPasteMode(false);
    }
  };

  const handleConcChange = (id: string) => {
    const conc = MOCK_CONCESSIONARIAS.find(c => c.id === id);
    onTecnicoChange({ ...tecnico, concessionariaId: id, tarifa: conc?.tarifa_kwh || 0 });
  };

  const chartData = consumo.meses.map((kwh, i) => ({
    mes: MESES_LABELS[i],
    kwh,
  }));

  const maxKwh = Math.max(500, ...consumo.meses) * 1.2;

  return (
    <div className="space-y-4">
      {/* ── Consumption Chart Section ── */}
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
          <BarChart3 className="h-3.5 w-3.5" /> Consumo Mensal
        </h4>
        <div className="flex items-center gap-1.5">
          <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1" onClick={() => setPasteMode(!pasteMode)}>
            <Clipboard className="h-2.5 w-2.5" /> Colar 12 meses
          </Button>
        </div>
      </div>

      {pasteMode && (
        <div className="p-2.5 rounded-md border border-primary/20 bg-primary/5 space-y-1.5">
          <Label className="text-[10px]">Cole 12 valores separados por vírgula, tab ou linha</Label>
          <textarea
            className="w-full h-12 text-[11px] font-mono rounded-md border border-border p-2 bg-background resize-none"
            placeholder="350, 380, 420, 410, 390, 370, 360, 380, 400, 430, 450, 370"
            onPaste={e => { e.preventDefault(); handlePaste(e.clipboardData.getData("text")); }}
            onChange={e => handlePaste(e.target.value)}
          />
        </div>
      )}

      {/* Quick input row */}
      <div className="flex items-end gap-2">
        <div className="space-y-0.5 flex-1">
          <Label className="text-[10px]">Média Mensal (kWh)</Label>
          <Input type="number" min={0} value={mediaInput} onChange={e => setMediaInput(e.target.value)} placeholder="Ex: 450" className="h-8 text-xs" />
        </div>
        <Button variant="secondary" size="sm" className="h-8 text-[10px] gap-1 shrink-0" disabled={!mediaInput || Number(mediaInput) <= 0} onClick={() => fillFromMedia(Number(mediaInput))}>
          <Sparkles className="h-3 w-3" /> Preencher
        </Button>
        <div className="h-6 w-px bg-border" />
        <div className="space-y-0.5">
          <Label className="text-[10px]">Consumo Anual</Label>
          <Input type="number" min={0} value={annualInput} onChange={e => setAnnualInput(e.target.value)} placeholder="Ex: 6000" className="h-8 text-xs w-24" />
        </div>
        <Button variant="secondary" size="sm" className="h-8 text-[10px] gap-1 shrink-0" disabled={!annualInput || Number(annualInput) <= 0} onClick={() => autoDistribute(Number(annualInput))}>
          Distribuir
        </Button>
        {totalAnual > 0 && (
          <Badge variant="outline" className="text-[9px] font-mono shrink-0 h-6">{totalAnual.toLocaleString("pt-BR")} kWh/ano</Badge>
        )}
      </div>

      {/* Chart */}
      <div className="rounded-md border border-border/50 bg-card p-2.5">
        <div className="text-[9px] text-muted-foreground mb-1 text-right">Clique nos inputs abaixo para ajustar</div>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
            <XAxis dataKey="mes" tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" />
            <YAxis tick={{ fontSize: 9 }} stroke="hsl(var(--muted-foreground))" width={36} />
            {media > 0 && (
              <ReferenceLine y={media} stroke="hsl(var(--primary))" strokeDasharray="4 4" strokeWidth={1.5}
                label={{ value: `${Math.round(media)}`, fontSize: 9, fill: "hsl(var(--primary))", position: "right" }}
              />
            )}
            <Bar dataKey="kwh" radius={[2, 2, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={entry.kwh > media * 1.2 ? "hsl(var(--destructive))" : entry.kwh < media * 0.8 ? "hsl(var(--warning))" : "hsl(var(--primary))"} fillOpacity={0.7} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Monthly inputs */}
      <div className="grid grid-cols-6 sm:grid-cols-12 gap-1">
        {consumo.meses.map((v, i) => (
          <div key={i} className="space-y-0.5">
            <Label className="text-[8px] text-muted-foreground uppercase text-center block">{MESES_LABELS[i]}</Label>
            <Input type="number" min={0} value={v || ""} onChange={e => updateMonth(i, Number(e.target.value))} className="h-6 text-[10px] text-center px-0.5 font-mono" />
          </div>
        ))}
      </div>

      {/* ── Technical Configuration ── */}
      <div className="rounded-md border border-border/50 p-3 space-y-3">
        <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Configuração Técnica</h4>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="space-y-0.5">
            <Label className="text-[10px]">Concessionária</Label>
            <Select value={tecnico.concessionariaId} onValueChange={handleConcChange}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {concsFiltradas.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    <span className="font-medium">{c.sigla}</span>
                    <span className="text-muted-foreground ml-1">R$ {c.tarifa_kwh.toFixed(2)}/kWh</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px]">Tipo de Telhado</Label>
            <Select value={tecnico.tipoTelhado} onValueChange={v => onTecnicoChange({ ...tecnico, tipoTelhado: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {TELHADO_OPTIONS.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px]">Orientação</Label>
            <Select value={tecnico.orientacao} onValueChange={v => onTecnicoChange({ ...tecnico, orientacao: v })}>
              <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {ORIENTACAO_OPTIONS.map(o => (
                  <SelectItem key={o.value} value={o.value}>{o.label} ({o.desc})</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-0.5">
            <Label className="text-[10px]">Tarifa (R$/kWh)</Label>
            <Input type="number" step={0.01} value={tecnico.tarifa || ""} onChange={e => onTecnicoChange({ ...tecnico, tarifa: Number(e.target.value) })} className="h-8 text-xs font-mono" />
          </div>
        </div>
      </div>

      {/* ── Suggested System ── */}
      {media > 0 && (
        <div className="grid grid-cols-4 gap-2">
          <div className="col-span-1 p-3 rounded-md border-2 border-primary/30 bg-primary/5">
            <p className="text-[9px] text-muted-foreground uppercase">Potência</p>
            <p className="text-xl font-bold font-mono text-primary">{suggestedKwp}</p>
            <p className="text-[9px] text-muted-foreground">kWp</p>
          </div>
          <div className="p-3 rounded-md border border-border/50 bg-card">
            <p className="text-[9px] text-muted-foreground uppercase">Geração</p>
            <p className="text-sm font-bold font-mono">{geracaoEst.toLocaleString("pt-BR")}</p>
            <p className="text-[9px] text-muted-foreground">kWh/mês</p>
          </div>
          <div className="p-3 rounded-md border border-border/50 bg-card">
            <p className="text-[9px] text-muted-foreground uppercase">Cobertura</p>
            <p className={cn("text-sm font-bold font-mono", cobertura >= 100 ? "text-success" : cobertura >= 80 ? "text-primary" : "text-warning")}>{cobertura}%</p>
            <p className="text-[9px] text-muted-foreground">do consumo</p>
          </div>
          <div className="p-3 rounded-md border border-border/50 bg-card">
            <p className="text-[9px] text-muted-foreground uppercase">Módulos</p>
            <p className="text-sm font-bold font-mono">{numModulos}</p>
            <p className="text-[9px] text-muted-foreground">un (550W)</p>
          </div>
        </div>
      )}
    </div>
  );
}
