import { useState, useMemo, useCallback } from "react";
import { Zap, Settings2, Pencil, Plus, BarChart3, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  type UCData, type PreDimensionamentoData, MESES,
  SOMBREAMENTO_OPTIONS, DESVIO_AZIMUTAL_OPTIONS, INCLINACAO_OPTIONS,
  createEmptyUC,
} from "./types";
import { UCCard } from "./uc/UCCard";
import { UCConfigModal, RateioCreditsModal, MesAMesDialog } from "./uc/UCModals";

interface Props {
  ucs: UCData[];
  onUcsChange: (ucs: UCData[]) => void;
  potenciaKwp: number;
  onPotenciaChange: (p: number) => void;
  preDimensionamento: PreDimensionamentoData;
  onPreDimensionamentoChange: (pd: PreDimensionamentoData) => void;
}

type ActiveTab = "ucs" | "pre";

export function StepConsumptionIntelligence({
  ucs, onUcsChange, potenciaKwp, onPotenciaChange,
  preDimensionamento: pd, onPreDimensionamentoChange: setPd,
}: Props) {
  const [activeTab, setActiveTab] = useState<ActiveTab>("ucs");
  const [configModal, setConfigModal] = useState<{ open: boolean; index: number }>({ open: false, index: 0 });
  const [rateioOpen, setRateioOpen] = useState(false);
  const [mesAMes, setMesAMes] = useState<{ open: boolean; ucIndex: number; field: "consumo" | "hp" | "hfp" }>({ open: false, ucIndex: 0, field: "consumo" });
  const [preDimModal, setPreDimModal] = useState(false);

  // ─── Derived metrics
  const consumoTotal = useMemo(() => {
    return ucs.reduce((s, u) => {
      if (u.grupo_tarifario === "A") return s + (u.consumo_mensal_p || 0) + (u.consumo_mensal_fp || 0);
      return s + (u.consumo_mensal || 0);
    }, 0);
  }, [ucs]);

  // Monthly generation estimate: potência × fator_geração
  const geracaoMensal = useMemo(() => {
    return Math.round(potenciaKwp * pd.fator_geracao * 100) / 100;
  }, [potenciaKwp, pd.fator_geracao]);

  const potenciaIdeal = useMemo(() => {
    if (pd.fator_geracao <= 0) return 0;
    return Math.round((consumoTotal / pd.fator_geracao) * 100) / 100;
  }, [consumoTotal, pd.fator_geracao]);

  // Auto-update potenciaKwp when potenciaIdeal changes
  const applyPotIdeal = useCallback(() => {
    if (potenciaIdeal > 0) onPotenciaChange(potenciaIdeal);
  }, [potenciaIdeal, onPotenciaChange]);

  // ─── UC handlers
  const updateUC = (index: number, uc: UCData) => {
    const updated = [...ucs];
    updated[index] = uc;
    onUcsChange(updated);
  };

  const removeUC = (index: number) => {
    if (ucs.length <= 1) return;
    onUcsChange(ucs.filter((_, i) => i !== index));
  };

  const addUC = () => {
    const newUC = createEmptyUC(ucs.length + 1);
    // Inherit regra/grupo from first UC
    newUC.regra = ucs[0].regra;
    newUC.grupo_tarifario = ucs[0].grupo_tarifario;
    newUC.tipo_dimensionamento = ucs[0].tipo_dimensionamento;
    newUC.is_geradora = false;
    onUcsChange([...ucs, newUC]);
  };

  const handleAutoRateio = () => {
    const equal = Math.round(100 / ucs.length);
    const updated = ucs.map((u, i) => ({
      ...u,
      rateio_creditos: i === 0 ? 100 - equal * (ucs.length - 1) : equal,
    }));
    onUcsChange(updated);
  };

  // ─── MesAMes handlers
  const mesAMesValues = useMemo(() => {
    const uc = ucs[mesAMes.ucIndex];
    if (!uc) return {};
    if (mesAMes.field === "hp") return uc.consumo_meses_p || {};
    if (mesAMes.field === "hfp") return uc.consumo_meses_fp || {};
    return uc.consumo_meses || {};
  }, [ucs, mesAMes]);

  const handleMesAMesSave = (values: Record<string, number>) => {
    const updated = [...ucs];
    const uc = { ...updated[mesAMes.ucIndex] };
    const total = MESES.reduce((s, m) => s + (values[m] || 0), 0);
    if (mesAMes.field === "hp") {
      uc.consumo_meses_p = values;
      uc.consumo_mensal_p = Math.round(total / 12);
    } else if (mesAMes.field === "hfp") {
      uc.consumo_meses_fp = values;
      uc.consumo_mensal_fp = Math.round(total / 12);
    } else {
      uc.consumo_meses = values;
      uc.consumo_mensal = Math.round(total / 12);
    }
    updated[mesAMes.ucIndex] = uc;
    onUcsChange(updated);
  };

  const mesAMesTitle = mesAMes.field === "hp" ? "Consumo Ponta (HP)" : mesAMes.field === "hfp" ? "Consumo Fora Ponta (HFP)" : "Consumo";

  // ─── Pre-dimensionamento update helper
  const pdUpdate = <K extends keyof PreDimensionamentoData>(field: K, value: PreDimensionamentoData[K]) => {
    setPd({ ...pd, [field]: value });
  };

  const toggleTopologia = (t: string) => {
    const current = pd.topologias;
    if (current.includes(t)) {
      if (current.length > 1) pdUpdate("topologias", current.filter(x => x !== t));
    } else {
      pdUpdate("topologias", [...current, t]);
    }
  };

  const showDoD = pd.sistema === "hibrido" || pd.sistema === "off_grid";

  // ─── Pre-dimensionamento content (reused in tab and modal)
  const preDimContent = (
    <div className="space-y-5">
      {/* Sistema / Tipo Kit / Topologia */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Label className="text-[11px] flex items-center gap-1">Sistema <TooltipProvider><Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="text-xs">Tipo do sistema solar</p></TooltipContent></Tooltip></TooltipProvider></Label>
          <RadioGroup value={pd.sistema} onValueChange={v => pdUpdate("sistema", v as any)} className="flex items-center gap-4">
            <div className="flex items-center gap-1.5"><RadioGroupItem value="on_grid" id="sys-on" /><Label htmlFor="sys-on" className="text-xs cursor-pointer">On grid</Label></div>
            <div className="flex items-center gap-1.5"><RadioGroupItem value="hibrido" id="sys-hib" /><Label htmlFor="sys-hib" className="text-xs cursor-pointer">Híbrido</Label></div>
            <div className="flex items-center gap-1.5"><RadioGroupItem value="off_grid" id="sys-off" /><Label htmlFor="sys-off" className="text-xs cursor-pointer">Off grid</Label></div>
          </RadioGroup>
        </div>

        <div className="flex items-center gap-4">
          <Label className="text-[11px]">Tipo de kit <span className="text-destructive">*</span></Label>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <Checkbox id="kit-custom" checked={pd.tipo_kit === "customizado"} onCheckedChange={() => pdUpdate("tipo_kit", "customizado")} />
              <Label htmlFor="kit-custom" className="text-xs cursor-pointer">Customizado</Label>
            </div>
            <div className="flex items-center gap-1.5">
              <Checkbox id="kit-fechado" checked={pd.tipo_kit === "fechado"} onCheckedChange={() => pdUpdate("tipo_kit", "fechado")} />
              <Label htmlFor="kit-fechado" className="text-xs cursor-pointer">Fechado</Label>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <Label className="text-[11px]">Topologia <span className="text-destructive">*</span></Label>
          <div className="flex items-center gap-3">
            {["tradicional", "microinversor", "otimizador"].map(t => (
              <div key={t} className="flex items-center gap-1.5">
                <Checkbox id={`topo-${t}`} checked={pd.topologias.includes(t)} onCheckedChange={() => toggleTopologia(t)} />
                <Label htmlFor={`topo-${t}`} className="text-xs cursor-pointer capitalize">{t === "microinversor" ? "Microinversor" : t === "otimizador" ? "Otimizador" : "Tradicional"}</Label>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sub-tabs: Premissas | Equipamentos */}
      <div className="border-b border-border">
        <div className="flex gap-6">
          <button className="text-sm font-semibold text-secondary border-b-2 border-secondary pb-2 px-1">Premissas</button>
          <button className="text-sm text-muted-foreground pb-2 px-1 hover:text-foreground">Equipamentos</button>
        </div>
      </div>

      {/* Premissas content */}
      <div className="space-y-4">
        <p className="text-xs font-semibold">Fator Geração</p>

        {/* Sombreamento / Desvio / Inclinação / DoD */}
        <div className="space-y-1.5">
          <Label className="text-[11px] flex items-center gap-1">
            Sombreamento <span className="text-destructive">*</span>
            <TooltipProvider><Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="text-xs">Nível de sombreamento no local</p></TooltipContent></Tooltip></TooltipProvider>
          </Label>
          <Select value={pd.sombreamento} onValueChange={v => pdUpdate("sombreamento", v)}>
            <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{SOMBREAMENTO_OPTIONS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent>
          </Select>
        </div>

        <div className={`grid gap-3 ${showDoD ? "grid-cols-3" : "grid-cols-2"}`}>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Desvio Azimutal <span className="text-destructive">*</span></Label>
            <Select value={String(pd.desvio_azimutal)} onValueChange={v => pdUpdate("desvio_azimutal", Number(v))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{DESVIO_AZIMUTAL_OPTIONS.map(d => <SelectItem key={d} value={String(d)}>{d}°</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Inclinação <span className="text-destructive">*</span></Label>
            <Select value={String(pd.inclinacao)} onValueChange={v => pdUpdate("inclinacao", Number(v))}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>{INCLINACAO_OPTIONS.map(i => <SelectItem key={i} value={String(i)}>{i}°</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {showDoD && (
            <div className="space-y-1.5">
              <Label className="text-[11px] flex items-center gap-1">
                DoD <span className="text-destructive">*</span>
                <TooltipProvider><Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="text-xs">Depth of Discharge — profundidade de descarga da bateria</p></TooltipContent></Tooltip></TooltipProvider>
              </Label>
              <div className="relative">
                <Input type="number" step="0.01" value={pd.dod || ""} onChange={e => pdUpdate("dod", Number(e.target.value))} className="h-9 text-xs pr-8" />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
              </div>
            </div>
          )}
        </div>

        {/* Tradicional + badge Pot ideal */}
        <div className="flex items-center gap-3 pt-1">
          <p className="text-sm font-bold">Tradicional</p>
          <Badge variant="outline" className="text-[10px] font-mono border-secondary text-secondary">
            Pot. ideal: {potenciaIdeal.toFixed(2)} kWp
          </Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] flex items-center gap-1">
              Desempenho <span className="text-destructive">*</span>
              <TooltipProvider><Tooltip><TooltipTrigger><AlertCircle className="h-3 w-3 text-muted-foreground" /></TooltipTrigger><TooltipContent><p className="text-xs">Performance Ratio do sistema</p></TooltipContent></Tooltip></TooltipProvider>
            </Label>
            <div className="relative">
              <Input type="number" step="0.01" value={pd.desempenho || ""} onChange={e => pdUpdate("desempenho", Number(e.target.value))} className="h-9 text-xs pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-[11px]">Fator de Geração <span className="text-destructive">*</span></Label>
              <button className="text-[10px] text-secondary hover:underline flex items-center gap-0.5">mês a mês <Pencil className="h-2.5 w-2.5" /></button>
            </div>
            <div className="relative">
              <Input type="number" step="0.01" value={pd.fator_geracao || ""} onChange={e => pdUpdate("fator_geracao", Number(e.target.value))} className="h-9 text-xs pr-16" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">kWh/kWp</span>
            </div>
          </div>
        </div>

        {/* Sistema Solar */}
        <p className="text-sm font-bold pt-1">Sistema Solar</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px]">Sobredimensionamento</Label>
            <div className="relative">
              <Input type="number" step="0.01" value={pd.sobredimensionamento || ""} onChange={e => pdUpdate("sobredimensionamento", Number(e.target.value))} className="h-9 text-xs pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px]">Margem para Pot. Ideal</Label>
            <div className="relative">
              <Input type="number" step="0.01" value={pd.margem_pot_ideal || ""} onChange={e => pdUpdate("margem_pot_ideal", Number(e.target.value))} className="h-9 text-xs pr-8" />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-1">
          <Label className="text-xs">Considerar kits que necessitam de transformador</Label>
          <Switch checked={pd.considerar_transformador} onCheckedChange={v => pdUpdate("considerar_transformador", v)} />
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      {/* ─── Header metrics bar */}
      <div className="flex items-center justify-end gap-6 text-xs">
        <div className="flex items-center gap-1.5 text-muted-foreground">
          <BarChart3 className="h-3.5 w-3.5" />
          <span>Consumo Mensal Total</span>
          <span className="font-bold text-foreground">{consumoTotal.toLocaleString("pt-BR")} kWh</span>
        </div>
        <button onClick={() => setPreDimModal(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground group">
          <Pencil className="h-3.5 w-3.5" />
          <span>Potência Ideal</span>
          <span className="font-bold text-foreground">{potenciaIdeal.toFixed(2)} kWp</span>
          <Pencil className="h-2.5 w-2.5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
        <button onClick={() => setPreDimModal(true)} className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground group">
          <Zap className="h-3.5 w-3.5" />
          <span>Fator de Geração</span>
          <span className="font-bold text-foreground">{pd.fator_geracao.toFixed(2)} kWh/kWp</span>
          <Pencil className="h-2.5 w-2.5 text-secondary opacity-0 group-hover:opacity-100 transition-opacity" />
        </button>
      </div>

      {/* ─── Tabs + actions */}
      <div className="flex items-center justify-between">
        <div className="flex gap-2">
          <Button
            variant={activeTab === "ucs" ? "outline" : "ghost"}
            size="sm"
            className={`gap-1.5 ${activeTab === "ucs" ? "border-2 border-secondary text-secondary font-semibold" : ""}`}
            onClick={() => setActiveTab("ucs")}
          >
            <Zap className="h-3.5 w-3.5" /> Unidades Consumidoras
          </Button>
          <Button
            variant={activeTab === "pre" ? "outline" : "ghost"}
            size="sm"
            className={`gap-1.5 ${activeTab === "pre" ? "border-2 border-secondary text-secondary font-semibold" : ""}`}
            onClick={() => setActiveTab("pre")}
          >
            <Settings2 className="h-3.5 w-3.5" /> Pré-Dimensionamento
          </Button>
        </div>

        {ucs.length > 1 && (
          <div className="flex items-center gap-2">
            <Button size="sm" className="h-7 text-[11px] bg-primary hover:bg-primary/90" onClick={handleAutoRateio}>
              Rateio automático
            </Button>
            <button onClick={() => setRateioOpen(true)} className="text-[11px] text-secondary hover:underline flex items-center gap-1">
              <Settings2 className="h-3 w-3" /> Gerenciar rateio de créditos
            </button>
          </div>
        )}
      </div>

      {/* ─── Tab content */}
      {activeTab === "ucs" ? (
        <div className="flex gap-4 overflow-x-auto pb-2">
          {ucs.map((uc, i) => (
            <UCCard
              key={uc.id}
              uc={uc}
              index={i}
              onChange={u => updateUC(i, u)}
              onRemove={() => removeUC(i)}
              onOpenConfig={() => setConfigModal({ open: true, index: i })}
              onOpenMesAMes={field => setMesAMes({ open: true, ucIndex: i, field })}
              isFirst={i === 0}
              totalUcs={ucs.length}
            />
          ))}

          {/* + Nova Unidade card */}
          <button
            onClick={addUC}
            className="rounded-xl border-2 border-dashed border-primary/30 bg-primary/5 min-w-[200px] min-h-[300px] flex flex-col items-center justify-center gap-2 hover:border-primary/50 hover:bg-primary/10 transition-colors flex-shrink-0"
          >
            <Plus className="h-5 w-5 text-primary" />
            <span className="text-sm text-primary font-medium">+ Nova Unidade</span>
          </button>
        </div>
      ) : (
        preDimContent
      )}

      {/* ─── Modals */}
      <UCConfigModal
        open={configModal.open}
        onOpenChange={o => setConfigModal({ ...configModal, open: o })}
        uc={ucs[configModal.index] || null}
        index={configModal.index}
        onSave={uc => updateUC(configModal.index, uc)}
      />

      <RateioCreditsModal
        open={rateioOpen}
        onOpenChange={setRateioOpen}
        ucs={ucs}
        geracaoMensal={geracaoMensal}
        onSave={onUcsChange}
      />

      <MesAMesDialog
        open={mesAMes.open}
        onOpenChange={o => setMesAMes({ ...mesAMes, open: o })}
        title={mesAMesTitle}
        values={mesAMesValues}
        onSave={handleMesAMesSave}
      />

      {/* Pre-dimensionamento modal (from header click) */}
      <Dialog open={preDimModal} onOpenChange={setPreDimModal}>
        <DialogContent className="sm:max-w-xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Pré-dimensionamento</DialogTitle>
          </DialogHeader>
          {preDimContent}
          <div className="flex items-center justify-end gap-3 pt-2 border-t">
            <Button variant="ghost" onClick={() => setPreDimModal(false)}>Voltar</Button>
            <Button onClick={() => { applyPotIdeal(); setPreDimModal(false); }} className="bg-secondary hover:bg-secondary/90 text-secondary-foreground">Salvar</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
